package com.capstone.rebyu.user.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.user.dto.LearnerDto;
import com.capstone.rebyu.user.dto.LearnerPortalDto;
import com.capstone.rebyu.user.service.LearnerPortalService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Learner-scoped portal snapshot. The learner/user ids are always resolved from the
 * validated Cognito access token -- never accepted from the client -- so a learner can
 * only ever load their own data.
 */
@RestController
@RequestMapping("/api/learners/me")
@RequiredArgsConstructor
public class LearnerPortalController {

    private final LearnerPortalService portalService;
    private final CognitoAuthService auth;

    @GetMapping("/portal")
    public LearnerPortalDto portal(@AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto me = requireLearner(jwt);
        return portalService.portal(me.learnerId(), me.userId());
    }

    /** The caller's own learner record (JWT-derived) -- replaces fetching the global learners list. */
    @GetMapping
    public LearnerDto me(@AuthenticationPrincipal Jwt jwt) {
        return portalService.currentLearner(requireLearner(jwt).learnerId());
    }

    private CurrentUserDto requireLearner(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return user;
    }
}
