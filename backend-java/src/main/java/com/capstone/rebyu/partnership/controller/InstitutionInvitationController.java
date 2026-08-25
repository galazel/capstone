package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.InstitutionInvitationDtos.CertificationAccessDto;
import com.capstone.rebyu.partnership.dto.InstitutionInvitationDtos.InvitationDto;
import com.capstone.rebyu.partnership.dto.InstitutionInvitationDtos.SendInvitationsRequest;
import com.capstone.rebyu.partnership.dto.InstitutionInvitationDtos.SendInvitationsResponse;
import com.capstone.rebyu.partnership.service.InstitutionInvitationService;
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

/** Transaction Three: institution learner invitations and slot management. */
@RestController
@RequestMapping("/api/institution")
@RequiredArgsConstructor
public class InstitutionInvitationController {

    private final InstitutionInvitationService invitationService;
    private final CognitoAuthService auth;

    @GetMapping("/certification-access")
    public List<CertificationAccessDto> certificationAccess(@AuthenticationPrincipal Jwt jwt) {
        return invitationService.certificationAccess(myInstitutionId(jwt));
    }

    // Only the target group's leader may send its invitations -- the
    // institution account itself does not invite learners directly.
    @PostMapping("/invitations")
    public SendInvitationsResponse send(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SendInvitationsRequest request) throws Exception {
        CurrentUserDto caller = currentUser(jwt);
        SendInvitationsRequest trusted = new SendInvitationsRequest(
                requireInstitutionId(caller), caller.userId(), request.institutionGroupId(), request.learners());
        return invitationService.sendInvitations(trusted);
    }

    /** Read-only across the whole organization -- the owner keeps visibility here. */
    @GetMapping("/invitations")
    public List<InvitationDto> list(@AuthenticationPrincipal Jwt jwt) {
        return invitationService.listInvitations(myInstitutionId(jwt));
    }

    @PutMapping("/invitations/{invitationId}/cancel")
    public InvitationDto cancel(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long invitationId) {
        CurrentUserDto caller = currentUser(jwt);
        return invitationService.cancelInvitation(invitationId, requireInstitutionId(caller), caller.userId());
    }

    private Long myInstitutionId(Jwt jwt) {
        return requireInstitutionId(currentUser(jwt));
    }

    private CurrentUserDto currentUser(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        return auth.syncCurrentUser(jwt, jwt.getTokenValue());
    }

    private Long requireInstitutionId(CurrentUserDto user) {
        if (user.institutionId() == null) {
            throw new IllegalArgumentException("An institution account is required");
        }
        return user.institutionId();
    }
}
