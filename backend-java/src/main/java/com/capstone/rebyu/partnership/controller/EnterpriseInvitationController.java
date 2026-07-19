package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.CertificationAccessDto;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.InvitationDto;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.SendInvitationsRequest;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.SendInvitationsResponse;
import com.capstone.rebyu.partnership.service.EnterpriseInvitationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Transaction Three: enterprise learner invitations and slot management. */
@RestController
@RequestMapping("/api/enterprise")
@RequiredArgsConstructor
public class EnterpriseInvitationController {

    private final EnterpriseInvitationService invitationService;
    private final CognitoAuthService auth;

    @GetMapping("/certification-access")
    public List<CertificationAccessDto> certificationAccess(@AuthenticationPrincipal Jwt jwt) {
        return invitationService.certificationAccess(myEnterpriseId(jwt));
    }

    // Only the target group's leader may send its invitations -- the
    // enterprise account itself does not invite learners directly.
    @PostMapping("/invitations")
    public SendInvitationsResponse send(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SendInvitationsRequest request) throws Exception {
        CurrentUserDto caller = currentUser(jwt);
        SendInvitationsRequest trusted = new SendInvitationsRequest(
                requireEnterpriseId(caller), caller.userId(), request.enterpriseGroupId(), request.emails());
        return invitationService.sendInvitations(trusted);
    }

    /** Read-only across the whole organization -- the owner keeps visibility here. */
    @GetMapping("/invitations")
    public List<InvitationDto> list(@AuthenticationPrincipal Jwt jwt) {
        return invitationService.listInvitations(myEnterpriseId(jwt));
    }

    @PutMapping("/invitations/{invitationId}/cancel")
    public InvitationDto cancel(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long invitationId) {
        CurrentUserDto caller = currentUser(jwt);
        return invitationService.cancelInvitation(invitationId, requireEnterpriseId(caller), caller.userId());
    }

    private Long myEnterpriseId(Jwt jwt) {
        return requireEnterpriseId(currentUser(jwt));
    }

    private CurrentUserDto currentUser(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        return auth.syncCurrentUser(jwt, jwt.getTokenValue());
    }

    private Long requireEnterpriseId(CurrentUserDto user) {
        if (user.enterpriseId() == null) {
            throw new IllegalArgumentException("An enterprise account is required");
        }
        return user.enterpriseId();
    }
}
