package com.capstone.rebyu.learningtools.controller;

import com.capstone.rebyu.learningtools.service.LearnerToolsService;
import com.capstone.rebyu.learningtools.service.StudyPracticeService;

import com.capstone.rebyu.aigateway.client.AiServiceClient;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.billing.entitlement.PremiumAccessRequiredException;
import com.capstone.rebyu.billing.service.LearnerEntitlementService;
import com.capstone.rebyu.gamification.RewardService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/learner-tools")
@RequiredArgsConstructor
public class LearnerToolsController {

    private final LearnerToolsService service;
    private final CognitoAuthService auth;
    private final AiServiceClient aiServiceClient;
    private final LearnerEntitlementService entitlementService;
    private final StudyPracticeService practiceService;
    private final ObjectMapper objectMapper;
    private final RewardService rewards;

    public record StudyAidRequest(String type, String lessonName, Long lessonId, String requestId) {}

    @GetMapping("/library")
    public List<LearnerToolsService.LibraryItem> library(@AuthenticationPrincipal Jwt jwt) {
        return service.library(me(jwt));
    }

    @PostMapping("/library")
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerToolsService.LibraryItem add(
            @AuthenticationPrincipal Jwt jwt, @RequestBody LearnerToolsService.LibraryRequest request) {
        return service.createLibraryItem(me(jwt), request);
    }

    /** Upload a real file before adding a "file"-type library item; the returned key becomes resourceUrl. */
    @PostMapping(value = "/library/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadFile(
            @AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) {
        me(jwt);
        return Map.of("resourceUrl", service.uploadLibraryFile(file));
    }

    @DeleteMapping("/library/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.deleteLibraryItem(me(jwt), id);
    }

    @GetMapping("/mistakes")
    public List<LearnerToolsService.Mistake> mistakes(@AuthenticationPrincipal Jwt jwt) {
        return service.mistakes(me(jwt));
    }

    @PutMapping("/mistakes/{questionId}/reviewed")
    public Map<String, Boolean> reviewed(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long questionId, @RequestBody Map<String, Boolean> body) {
        boolean reviewed = body.getOrDefault("reviewed", true);
        service.markReviewed(me(jwt), questionId, reviewed);
        return Map.of("reviewed", reviewed);
    }

    @PostMapping("/library/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerToolsService.LibraryItem generate(
            @AuthenticationPrincipal Jwt jwt, @RequestBody StudyAidRequest request) {
        Long learnerId = me(jwt);
        if (!entitlementService.hasActiveProSubscription(learnerId)) {
            throw new PremiumAccessRequiredException("AI_STUDY_AID_GENERATION", true);
        }
        String type = request.type() == null ? "" : request.type().toLowerCase();
        if (!List.of("quiz", "flashcard").contains(type)) {
            throw new IllegalArgumentException("Generate either a quiz or flashcards");
        }
        String lesson = request.lessonName() == null || request.lessonName().isBlank()
                ? "this lesson" : request.lessonName().trim();

        Map<String, Object> aiResult = aiServiceClient.generateStudyAid(type, lesson, request.lessonId());
        String requestId = request.requestId() == null || request.requestId().isBlank() ? java.util.UUID.randomUUID().toString() : request.requestId();
        boolean charged = rewards.spendAiCredit(learnerId, requestId);
        try {
            var studySet = persistGeneratedSet(learnerId, type, lesson, request.lessonId(), aiResult);
            return service.createLibraryItem(learnerId,
                    new LearnerToolsService.LibraryRequest(type, studySet.title(),
                            "Generated from " + lesson + ". Open it to begin a practice attempt.",
                            "/learner/practice/" + studySet.id(), studySet.certificationId(), request.lessonId()));
        } catch (RuntimeException exception) {
            if (charged) rewards.refundAiCredit(learnerId, requestId);
            throw exception;
        }
    }

    private StudyPracticeService.StudySet persistGeneratedSet(Long learnerId, String type, String lesson,
                                                               Long lessonId, Map<String, Object> aiResult) {
        try {
            JsonNode root = objectMapper.valueToTree(aiResult == null ? Map.of() : aiResult);
            String title = root.path("title").asText(("quiz".equals(type) ? "Practice Quiz: " : "Flashcards: ") + lesson);
            JsonNode nodes = root.path("items");
            if (!nodes.isArray()) throw new IllegalArgumentException("The AI response did not contain study items");
            List<StudyPracticeService.GeneratedItem> items = new java.util.ArrayList<>();
            for (JsonNode node : nodes) {
                String difficulty = node.path("difficulty").asText("AVERAGE").toUpperCase();
                if (!List.of("EASY", "AVERAGE", "HARD").contains(difficulty)) difficulty = "AVERAGE";
                if ("quiz".equals(type)) {
                    String correct = node.path("correctAnswer").asText();
                    ArrayNode choices = objectMapper.createArrayNode();
                    for (JsonNode choice : node.path("choices")) {
                        String text = choice.asText();
                        choices.add(objectMapper.createObjectNode().put("text", text).put("isCorrect", text.equals(correct)));
                    }
                    items.add(new StudyPracticeService.GeneratedItem("MCQ", node.path("question").asText(),
                            objectMapper.writeValueAsString(choices), correct, null,
                            node.path("explanation").asText(), difficulty));
                } else {
                    String answer = node.path("answer").asText();
                    items.add(new StudyPracticeService.GeneratedItem("FLASHCARD", node.path("question").asText(),
                            null, answer, null, node.path("explanation").asText(), difficulty));
                }
            }
            return practiceService.createGeneratedStudySet(learnerId, "quiz".equals(type) ? "QUIZ" : "FLASHCARD", title, lessonId, items);
        } catch (Exception ex) {
            if (ex instanceof IllegalArgumentException illegalArgumentException) throw illegalArgumentException;
            throw new IllegalStateException("The AI returned an invalid study set. Please generate it again.", ex);
        }
    }

    private Long me(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return user.learnerId();
    }
}
