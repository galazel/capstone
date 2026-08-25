package com.capstone.rebyu.institutiongroup.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupAuthorityDto;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupAuthorityService;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institution-group-authorities")
@RequiredArgsConstructor
public class InstitutionGroupAuthorityController {

    private final InstitutionGroupAuthorityService institutionGroupAuthorityService;
    private final InstitutionGroupService institutionGroupService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<InstitutionGroupAuthorityDto> getAll(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long userId) {
        CurrentUserDto caller = institutionUser(jwt);
        if (groupId == null) {
            throw new IllegalArgumentException("A groupId is required.");
        }
        institutionGroupService.getAccessibleById(
                groupId, caller.institutionId(), caller.userId(), isOwner(caller));
        return institutionGroupAuthorityService.getAll(groupId, userId);
    }

    @GetMapping("/{id}")
    public InstitutionGroupAuthorityDto getById(@PathVariable Long id) {
        return institutionGroupAuthorityService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionGroupAuthorityDto create(
            @Valid @RequestBody InstitutionGroupAuthorityDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        Long callerInstitutionId = myInstitutionId(jwt);
        requireOwner(institutionUser(jwt));
        // Never trust assignedBy from the client -- always the authenticated caller.
        dto.setAssignedBy(callerUserId(jwt));
        return institutionGroupAuthorityService.create(dto, callerInstitutionId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireOwner(institutionUser(jwt));
        institutionGroupAuthorityService.delete(id, myInstitutionId(jwt));
    }

    private Long myInstitutionId(Jwt jwt) {
        return institutionUser(jwt).institutionId();
    }

    private CurrentUserDto institutionUser(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.institutionId() == null) {
            throw new IllegalArgumentException("An institution account is required");
        }
        return user;
    }

    // Records who actually performed the assignment from the authenticated caller.
    private Long callerUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        return user.userId();
    }

    private boolean isOwner(CurrentUserDto user) {
        return "owner".equalsIgnoreCase(user.institutionMemberRole());
    }

    private void requireOwner(CurrentUserDto user) {
        if (!isOwner(user)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only Institution Administrators can assign group authorities.");
        }
    }
}
