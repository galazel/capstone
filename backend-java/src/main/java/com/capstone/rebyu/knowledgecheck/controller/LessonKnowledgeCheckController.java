package com.capstone.rebyu.knowledgecheck.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.knowledgecheck.dto.KnowledgeCheckDtos.CheckOffer;
import com.capstone.rebyu.knowledgecheck.service.LessonKnowledgeCheckService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * The pop-up knowledge check that interrupts a learner mid-lesson with five
 * questions from lessons they have already finished.
 *
 * <p>The learner id is always resolved from the validated Cognito access token,
 * mirroring {@code LearnerReadSectionController}, so a learner can only ever
 * mint a check for themselves. Mounted under {@code /api/learners/me}, which
 * {@code SecurityConfig} already requires authentication for.
 */
@RestController
@RequestMapping("/api/learners/me/knowledge-checks")
@RequiredArgsConstructor
public class LessonKnowledgeCheckController {

    private final LessonKnowledgeCheckService knowledgeCheckService;
    private final CognitoAuthService auth;

    /**
     * Pre-flight: may a check fire on this lesson right now? Read-only and
     * cheap, so the frontend can ask before committing to interrupting.
     */
    @GetMapping("/offer")
    public CheckOffer offer(@RequestParam Long lessonId, @AuthenticationPrincipal Jwt jwt) {
        return knowledgeCheckService.offer(requireLearner(jwt), lessonId);
    }

    /**
     * Mints the check. Returns an unavailable offer rather than an error when
     * the learner has become ineligible between the pre-flight and this call
     * -- a lost race is a reason not to interrupt, not a failure.
     */
    @PostMapping
    public CheckOffer create(@RequestBody CreateRequest request, @AuthenticationPrincipal Jwt jwt) {
        return knowledgeCheckService.create(requireLearner(jwt), request.lessonId());
    }

    public record CreateRequest(Long lessonId) {}

    private Long requireLearner(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.getLearnerId() == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return user.getLearnerId();
    }
}
