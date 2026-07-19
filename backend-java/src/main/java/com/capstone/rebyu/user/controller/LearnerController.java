package com.capstone.rebyu.user.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.common.InvitationAcceptanceException;
import com.capstone.rebyu.user.dto.AcceptInvitationRequest;
import com.capstone.rebyu.user.dto.AcceptInvitationResponse;
import com.capstone.rebyu.user.dto.LearnerDto;
import com.capstone.rebyu.user.service.LearnerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/learners")
@RequiredArgsConstructor
public class LearnerController {
    private final LearnerService learnerService;
    private final CognitoAuthService cognitoAuthService;

    // Reading the full learner list / arbitrary learner records exposes every
    // learner across every enterprise, so reads are admin-only. Learners read
    // their own record via /api/learners/me/portal.
    @GetMapping
    public List<LearnerDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerService.getAll();
    }

    @GetMapping("/{id}")
    public LearnerDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = cognitoAuthService.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerDto create(@Valid @RequestBody LearnerDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerService.create(dto);
    }
    /**
     * Accepts an enterprise invitation for the signed-in learner. The learner
     * is resolved from the validated Cognito JWT — never from the request body.
     */
    @PostMapping("accept-invitation")
    @ResponseStatus(HttpStatus.OK)
    public AcceptInvitationResponse acceptInvitation(
            @Valid @RequestBody AcceptInvitationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.NOT_AUTHENTICATED,
                    "Please sign in to accept this invitation.");
        }
        CurrentUserDto currentUser = cognitoAuthService.syncCurrentUser(jwt, jwt.getTokenValue());
        return learnerService.acceptInvitation(
                currentUser.learnerId(), currentUser.email(), request.token());
    }

    @PutMapping("/{id}")
    public LearnerDto update(@PathVariable Long id, @Valid @RequestBody LearnerDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        learnerService.delete(id);
    }
}
