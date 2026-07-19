package com.capstone.rebyu.bkt.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.bkt.dto.LearnerMasteryView;
import com.capstone.rebyu.bkt.service.LearnerMasteryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Learner-facing BKT analytics. The browser calls Spring Boot only; Spring Boot
 * calls the internal FastAPI BKT service. FastAPI is never exposed to learners.
 *
 * <p>learnerId is always resolved from the authenticated JWT, never trusted
 * from the request, so a caller can never read another learner's mastery data
 * by supplying someone else's id.
 */
@RestController
@RequestMapping("/api/learner/analytics")
@RequiredArgsConstructor
public class LearnerAnalyticsController {

    private final LearnerMasteryService learnerMasteryService;
    private final CognitoAuthService auth;

    /** All lesson mastery for the caller, optionally filtered to specific lessons. */
    @GetMapping("/mastery")
    public LearnerMasteryView getMastery(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "lessonId", required = false) List<Long> lessonIds) {
        return learnerMasteryService.getMastery(myLearnerId(jwt), lessonIds);
    }

    /** Weighted certification readiness for the caller. Proxies the FastAPI readiness endpoint. */
    @PostMapping("/readiness")
    public Map<String, Object> getReadiness(
            @AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        // learner_id is never taken from the request body -- always the caller.
        // FastAPI's ReadinessRequest schema expects snake_case.
        request.put("learner_id", myLearnerId(jwt));
        return learnerMasteryService.getReadiness(request);
    }

    /** Lesson → middle → major priority hierarchy for the caller's certification. */
    @GetMapping("/priorities/certifications/{certificationId}")
    public Map<String, Object> getPriorities(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long certificationId) {
        return learnerMasteryService.getPriorities(myLearnerId(jwt), certificationId);
    }

    /** Certification confidence summary for the caller. */
    @GetMapping("/confidence/certifications/{certificationId}")
    public Map<String, Object> getConfidence(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long certificationId) {
        return learnerMasteryService.getConfidence(myLearnerId(jwt), certificationId);
    }

    private Long myLearnerId(Jwt jwt) {
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
