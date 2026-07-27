package com.capstone.rebyu.progress.analytics.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.progress.analytics.dto.ProgressAnalyticsDtos.ProgressAnalyticsResponse;
import com.capstone.rebyu.progress.analytics.service.ProgressAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Learner-scoped progress analytics. The learner id is always resolved from
 * the validated Cognito access token -- never accepted from the client -- so a
 * learner can only ever request their own analytics.
 */
@RestController
@RequestMapping("/api/learners/me/certifications")
@RequiredArgsConstructor
public class ProgressAnalyticsController {

    private final ProgressAnalyticsService progressAnalyticsService;
    private final CognitoAuthService auth;

    @GetMapping("/{certificationId}/progress-analytics")
    public ProgressAnalyticsResponse getProgressAnalytics(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long certificationId) {
        return progressAnalyticsService.getProgressAnalytics(me(jwt), certificationId);
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
