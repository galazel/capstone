package com.capstone.rebyu.institution.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.institution.service.InstitutionLearnerInsightsService;
import com.capstone.rebyu.institution.service.InstitutionLearnerInsightsService.GroupLearnerRow;
import com.capstone.rebyu.progress.analytics.dto.ProgressAnalyticsDtos.ProgressAnalyticsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * A group leader's view of their own learners: the roster they monitor, one
 * learner's full statistics, and removing someone from the group.
 *
 * Everything here is scoped to a group the caller actually leads (or owns, as
 * the institution administrator). The learner id is a path variable, so the
 * service re-checks group membership on every call rather than trusting it.
 */
@RestController
@RequestMapping("/api/institution/me/groups")
@RequiredArgsConstructor
public class InstitutionLearnerInsightsController {

    private final InstitutionLearnerInsightsService insightsService;
    private final CognitoAuthService auth;

    /** The group's active learners, with the summary figures the table shows. */
    @GetMapping("/{groupId}/learners")
    public List<GroupLearnerRow> roster(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long groupId) {
        CurrentUserDto user = requireInstitution(jwt);
        return insightsService.groupRoster(
                groupId, user.institutionId(), user.userId(), isOwner(user));
    }

    /** Weak topics, curriculum progress, readiness and confidence for one learner. */
    @GetMapping("/{groupId}/learners/{learnerId}/analytics")
    public ProgressAnalyticsResponse analytics(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long groupId,
            @PathVariable Long learnerId) {
        CurrentUserDto user = requireInstitution(jwt);
        return insightsService.learnerAnalytics(
                groupId, learnerId, user.institutionId(), user.userId(), isOwner(user));
    }

    /** Unassigns the learner from this group; their account and progress remain. */
    @DeleteMapping("/{groupId}/learners/{learnerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeFromGroup(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long groupId,
            @PathVariable Long learnerId) {
        CurrentUserDto user = requireInstitution(jwt);
        insightsService.removeFromGroup(
                groupId, learnerId, user.institutionId(), user.userId(), isOwner(user));
    }

    private CurrentUserDto requireInstitution(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.institutionId() == null) {
            throw new IllegalArgumentException("An institution account is required");
        }
        return user;
    }

    private boolean isOwner(CurrentUserDto user) {
        return "owner".equalsIgnoreCase(user.institutionMemberRole());
    }
}
