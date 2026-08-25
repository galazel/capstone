package com.capstone.rebyu.learningtools.controller;

import com.capstone.rebyu.learningtools.service.GeneratedAssessmentService;
import com.capstone.rebyu.learningtools.service.LearnerToolsService;
import com.capstone.rebyu.learningtools.service.StudyPracticeService;

import com.capstone.rebyu.aigateway.client.AiServiceClient;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/learner-tools")
@RequiredArgsConstructor
public class LearnerToolsController {

    private final LearnerToolsService service;
    private final CognitoAuthService auth;
    private final AiServiceClient aiServiceClient;
    private final GeneratedAssessmentService generatedAssessmentService;
    private final StudyPracticeService studyPracticeService;
    private final ObjectMapper objectMapper;

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
        String type = request.type() == null ? "" : request.type().toLowerCase();
        if (!List.of("quiz", "flashcard").contains(type)) {
            throw new IllegalArgumentException("Generate either a quiz or flashcards");
        }
        String lesson = request.lessonName() == null || request.lessonName().isBlank()
                ? "this lesson" : request.lessonName().trim();

        Map<String, Object> aiResult = aiServiceClient.generateStudyAid(type, lesson, request.lessonId());
        // AI-credit spend intentionally disabled while the study-aid generation
        // path itself is being tested end to end -- re-enable
        // `rewards.spendAiCredit(learnerId, requestId)` / `refundAiCredit` (see
        // git history) once generation is verified working.
        if ("flashcard".equals(type)) {
            var generatedSet = persistGeneratedFlashcards(
                    learnerId, lesson, request.lessonId(), aiResult);
            return service.createLibraryItem(learnerId,
                    new LearnerToolsService.LibraryRequest(type, generatedSet.title(),
                            "Generated from " + lesson + ". Open it to begin studying.",
                            "/learner/flashcards/" + generatedSet.id(),
                            generatedSet.certificationId(), request.lessonId()));
        }

        var generatedExam = persistGeneratedExam(learnerId, type, lesson, request.lessonId(), aiResult);
        return service.createLibraryItem(learnerId,
                new LearnerToolsService.LibraryRequest(type, generatedExam.title(),
                        "Generated from " + lesson + ". Open it to begin an attempt.",
                        "/learner/assessments/" + generatedExam.examId(),
                        generatedExam.certificationId(), request.lessonId()));
    }

    private StudyPracticeService.StudySet persistGeneratedFlashcards(
            Long learnerId, String lesson, Long lessonId, Map<String, Object> aiResult) {
        JsonNode root = objectMapper.valueToTree(aiResult == null ? Map.of() : aiResult);
        String title = root.path("title").asText("Flashcards: " + lesson);
        JsonNode nodes = root.path("items");
        if (!nodes.isArray()) {
            throw new IllegalArgumentException("The AI response did not contain study items");
        }

        List<StudyPracticeService.GeneratedItem> items = new java.util.ArrayList<>();
        for (JsonNode node : nodes) {
            items.add(new StudyPracticeService.GeneratedItem(
                            "FLASHCARD",
                            node.path("question").asText(),
                            null,
                            node.path("answer").asText(node.path("correctAnswer").asText(null)),
                            null,
                            node.path("explanation").asText(null),
                            node.path("difficulty").asText("AVERAGE")));
        }
        return studyPracticeService.createGeneratedStudySet(
                        learnerId, "FLASHCARD", title, lessonId, items);
    }

    /** Same real exam schema every other assessment lives in: quiz items become
     * MCQ questions with real choices, flashcards become SHORT_ANSWER questions
     * graded exactly like any other short-answer question. See
     * {@link GeneratedAssessmentService} for why it's published immediately. */
    private GeneratedAssessmentService.GeneratedExam persistGeneratedExam(
            Long learnerId, String type, String lesson, Long lessonId, Map<String, Object> aiResult) {
        try {
            JsonNode root = objectMapper.valueToTree(aiResult == null ? Map.of() : aiResult);
            String title = root.path("title").asText(("quiz".equals(type) ? "Practice Quiz: " : "Flashcards: ") + lesson);
            JsonNode nodes = root.path("items");
            if (!nodes.isArray()) throw new IllegalArgumentException("The AI response did not contain study items");

            List<GeneratedAssessmentService.GeneratedQuestionItem> items = new java.util.ArrayList<>();
            for (JsonNode node : nodes) {
                List<String> choices = new java.util.ArrayList<>();
                for (JsonNode choice : node.path("choices")) {
                    choices.add(choice.asText());
                }
                items.add(new GeneratedAssessmentService.GeneratedQuestionItem(
                        node.path("question").asText(),
                        choices,
                        node.path("correctAnswer").asText(null),
                        node.path("answer").asText(null),
                        node.path("explanation").asText(null),
                        node.path("difficulty").asText("AVERAGE")));
            }
            return generatedAssessmentService.createGeneratedExam(learnerId, type, title, lessonId, items);
        } catch (Exception ex) {
            if (ex instanceof IllegalArgumentException illegalArgumentException) throw illegalArgumentException;
            // The learner only ever sees the generic message below -- this is
            // the only place the real cause (bad JSON shape, an unseeded exam
            // type, a DB constraint) is visible at all.
            log.error("Study aid generation failed for lesson {} (type={})", lessonId, type, ex);
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
