package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.attempt.DiagramAttemptDtos.*;
import com.capstone.rebyu.assessment.dto.attempt.LearnerAttemptDtos.*;
import com.capstone.rebyu.assessment.dto.attempt.ProgrammingAttemptDtos.*;
import com.capstone.rebyu.assessment.service.AssessmentAttemptService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Learner-safe assessment endpoints. Responses never contain answer keys,
 * rubrics, or reference diagram data before submission.
 *
 * <p>The acting learner is always {@link #me}, resolved from the validated
 * access token. Every request here still CARRIES a {@code learnerId} -- as a
 * query parameter or a {@code @NotNull} field on the body -- and every one of
 * them is now ignored.
 *
 * <p>It was previously the only thing deciding whose attempt was being read or
 * written, on a path that required no authentication at all, so changing a
 * number in the URL was enough to open someone else's assessment, answer it,
 * submit it, and read the graded result. The service layer's ownership check
 * (`requireOwnedAttempt`) was already correct and always had been -- it
 * compares the attempt's learner against the id it is handed, which is exactly
 * as trustworthy as that id. Handing it the token's learner is what makes it
 * mean something.
 *
 * <p>The fields are deliberately left on the DTOs rather than deleted. They are
 * {@code @NotNull}, and validation runs BEFORE any handler body, so removing
 * them from the contract would reject every request the current frontend
 * sends with a 400 before this class ever ran. They are accepted, unread, and
 * overwritten.
 */
@RestController
@RequestMapping("/api/learner")
@RequiredArgsConstructor
public class LearnerAssessmentController {

    private final AssessmentAttemptService assessmentAttemptService;
    private final CognitoAuthService auth;

    /**
     * The learner making this request, from the token and nothing else.
     *
     * <p>Mirrors {@code LearnerAnalyticsController.myLearnerId}; the resolve is
     * cached per request by {@code CognitoAuthService}, so calling it in every
     * handler costs one lookup per HTTP request rather than one per call.
     */
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

    @GetMapping("/assessments/{assessmentId}")
    public LearnerAssessmentDto getAssessment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long assessmentId,
            @RequestParam(required = false) Long learnerId) {
        return assessmentAttemptService.getLearnerAssessment(assessmentId, me(jwt));
    }

    @PostMapping("/assessments/{assessmentId}/attempts")
    @ResponseStatus(HttpStatus.CREATED)
    public AssessmentAttemptStartResponseDto startAttempt(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long assessmentId,
            @Valid @RequestBody AssessmentAttemptStartRequestDto request) {
        return assessmentAttemptService.startAttempt(
                assessmentId, me(jwt), request.idempotencyKey());
    }

    @PutMapping("/assessment-attempts/{attemptId}/answers")
    public void autosaveAnswers(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long attemptId,
            @Valid @RequestBody AutosaveAnswersRequestDto request) {
        assessmentAttemptService.autosaveAnswers(attemptId,
                new AutosaveAnswersRequestDto(me(jwt), request.answers()));
    }

    @PutMapping("/assessment-attempts/{attemptId}/flags/{attemptQuestionId}")
    public void setFlag(
            @PathVariable Long attemptId,
            @PathVariable Long attemptQuestionId,
            @Valid @RequestBody FlagRequestDto request,
            @AuthenticationPrincipal Jwt jwt) {
        assessmentAttemptService.setFlag(
                attemptId, attemptQuestionId, me(jwt), request.flagged());
    }

    @PutMapping("/assessment-attempts/{attemptId}/skip/{attemptQuestionId}")
    public void setSkip(
            @PathVariable Long attemptId,
            @PathVariable Long attemptQuestionId,
            @Valid @RequestBody SkipRequestDto request,
            @AuthenticationPrincipal Jwt jwt) {
        assessmentAttemptService.setSkip(
                attemptId, attemptQuestionId, me(jwt), request.skipped());
    }

    @PutMapping("/assessment-attempts/{attemptId}/current-item")
    public void setCurrentItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long attemptId,
            @Valid @RequestBody CurrentItemRequestDto request) {
        assessmentAttemptService.setCurrentItem(
                attemptId, request.attemptQuestionId(), me(jwt));
    }

    @PostMapping("/assessment-attempts/{attemptId}/programming/{attemptQuestionId}/run")
    public ExecutionResultDto runProgramming(
            @PathVariable Long attemptId,
            @PathVariable Long attemptQuestionId,
            @Valid @RequestBody ProgrammingRunRequestDto request,
            @AuthenticationPrincipal Jwt jwt) {
        return assessmentAttemptService.runProgramming(attemptId, attemptQuestionId,
                new ProgrammingRunRequestDto(me(jwt), request.code(), request.language()));
    }

    @PostMapping("/assessment-attempts/{attemptId}/programming/{attemptQuestionId}/check")
    public ExecutionResultDto checkProgramming(
            @PathVariable Long attemptId,
            @PathVariable Long attemptQuestionId,
            @Valid @RequestBody ProgrammingRunRequestDto request,
            @AuthenticationPrincipal Jwt jwt) {
        return assessmentAttemptService.checkProgramming(attemptId, attemptQuestionId,
                new ProgrammingRunRequestDto(me(jwt), request.code(), request.language()));
    }

    @GetMapping("/assessment-attempts/{attemptId}/programming/{attemptQuestionId}/executions")
    public List<ExecutionHistoryItemDto> listExecutions(
            @PathVariable Long attemptId,
            @PathVariable Long attemptQuestionId,
            @RequestParam(required = false) Long learnerId,
            @AuthenticationPrincipal Jwt jwt) {
        return assessmentAttemptService.listExecutions(attemptId, attemptQuestionId, me(jwt));
    }

    @PostMapping("/assessment-attempts/{attemptId}/diagram/{attemptQuestionId}/check")
    public DiagramCheckResultDto checkDiagram(
            @PathVariable Long attemptId,
            @PathVariable Long attemptQuestionId,
            @Valid @RequestBody DiagramCheckRequestDto request,
            @AuthenticationPrincipal Jwt jwt) {
        return assessmentAttemptService.checkDiagram(attemptId, attemptQuestionId,
                new DiagramCheckRequestDto(
                        me(jwt), request.diagramData(), request.diagramType()));
    }

    @PostMapping("/assessment-attempts/{attemptId}/submit")
    public AssessmentAttemptResultDto submitAttempt(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long attemptId,
            @Valid @RequestBody SubmitAssessmentAttemptRequestDto request) {
        return assessmentAttemptService.submitAttempt(attemptId,
                new SubmitAssessmentAttemptRequestDto(me(jwt), request.answers()));
    }

    @GetMapping("/assessment-attempts")
    public java.util.List<java.util.Map<String, Object>> listAttempts(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long learnerId) {
        return assessmentAttemptService.listAttempts(me(jwt));
    }

    @GetMapping("/assessments/{assessmentId}/attempts")
    public List<AttemptSummaryDto> listAttemptsForAssessment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long assessmentId,
            @RequestParam(required = false) Long learnerId) {
        return assessmentAttemptService.listAttemptsForAssessment(assessmentId, me(jwt));
    }

    @GetMapping("/assessment-attempts/{attemptId}/result")
    public AssessmentAttemptResultDto getResult(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long attemptId,
            @RequestParam(required = false) Long learnerId) {
        return assessmentAttemptService.getResult(attemptId, me(jwt));
    }
}
