package com.capstone.rebyu.learningtools.controller;

import com.capstone.rebyu.learningtools.service.StudyPracticeService;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/learner-practice")
@RequiredArgsConstructor
public class StudyPracticeController {
    private final StudyPracticeService service;
    private final CognitoAuthService auth;
    @GetMapping("/study-sets/{id}")
    public StudyPracticeService.StudySet studySet(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { return service.studySet(me(jwt), id); }
    @GetMapping("/attempts")
    public java.util.List<StudyPracticeService.AttemptHistory> history(@AuthenticationPrincipal Jwt jwt) { return service.history(me(jwt)); }
    @GetMapping("/attempts/{id}")
    public StudyPracticeService.AttemptReview review(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { return service.review(me(jwt), id); }
    @PostMapping("/study-sets/{id}/attempts")
    public StudyPracticeService.Attempt start(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { return service.startAttempt(me(jwt), id); }
    public record AnswerRequest(Long studyItemId, String answer, String flashcardRating) {}
    @PostMapping("/attempts/{id}/answers")
    public StudyPracticeService.AnswerResult answer(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @RequestBody AnswerRequest request) {
        return service.submitAnswer(me(jwt), id, request.studyItemId(), request.answer(), request.flashcardRating());
    }
    @PostMapping("/attempts/{id}/complete")
    public StudyPracticeService.Completion complete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.completeAttempt(me(jwt), id);
    }
    private Long me(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) throw new IllegalArgumentException("A learner account is required");
        return user.learnerId();
    }
}
