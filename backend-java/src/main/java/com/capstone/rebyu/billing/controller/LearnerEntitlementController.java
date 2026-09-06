package com.capstone.rebyu.billing.controller;

import com.capstone.rebyu.billing.dto.EntitlementDtos.LearnerEntitlementsDto;
import com.capstone.rebyu.billing.dto.EntitlementDtos.LearnerSubscriptionDto;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.billing.service.LearnerEntitlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Learner-facing entitlement + subscription reads.
 *
 * <p>The learner is the token's, never the query parameter's. "Follows the
 * existing learner-endpoint convention" is what the convention used to be, and
 * on a path with no authentication it meant anyone could read any learner's
 * plan, subscription state and entitlements by incrementing a number. Premium
 * enforcement still happens in the services that guard each feature, not here.
 */
@RestController
@RequestMapping("/api/learner")
@RequiredArgsConstructor
public class LearnerEntitlementController {

    private final LearnerEntitlementService learnerEntitlementService;
    private final CognitoAuthService auth;

    /** The learner making this request, from the token and nothing else. */
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

    @GetMapping("/entitlements")
    public LearnerEntitlementsDto getEntitlements(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long learnerId,
            @RequestParam(required = false) Long certificationId) {
        return learnerEntitlementService.getEffectiveEntitlements(me(jwt), certificationId);
    }

    @GetMapping("/subscription")
    public LearnerSubscriptionDto getSubscription(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long learnerId) {
        return learnerEntitlementService.getSubscriptionView(me(jwt));
    }
}
