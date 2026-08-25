package com.capstone.rebyu.institutiongroup.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupDto;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institution-groups")
@RequiredArgsConstructor
public class InstitutionGroupController {

    private final InstitutionGroupService institutionGroupService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<InstitutionGroupDto> getAll(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long orgCertId) {
        CurrentUserDto user = institutionUser(jwt);
        return institutionGroupService.getAccessible(
                user.institutionId(), user.userId(), isOwner(user), orgCertId);
    }

    @GetMapping("/{id}")
    public InstitutionGroupDto getById(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto user = institutionUser(jwt);
        return institutionGroupService.getAccessibleById(id, user.institutionId(), user.userId(), isOwner(user));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionGroupDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InstitutionGroupDto dto) {
        // Never trust institutionId/createdBy from the client body -- a caller
        // could otherwise spoof another tenant or impersonate another user
        // when creating a group. Resolve both from the authenticated caller
        // and overwrite whatever was supplied in the request.
        CurrentUserDto user = institutionUser(jwt);
        requireOwner(user);
        Long institutionId = user.institutionId();
        dto.setInstitutionId(institutionId);
        dto.setCreatedBy(user.userId());
        return institutionGroupService.create(dto);
    }

    @PutMapping("/{id}")
    public InstitutionGroupDto update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody InstitutionGroupDto dto) {
        CurrentUserDto user = institutionUser(jwt);
        requireOwner(user);
        return institutionGroupService.update(id, dto, user.institutionId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto user = institutionUser(jwt);
        requireOwner(user);
        institutionGroupService.delete(id, user.institutionId());
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

    private boolean isOwner(CurrentUserDto user) {
        return "owner".equalsIgnoreCase(user.institutionMemberRole());
    }

    private void requireOwner(CurrentUserDto user) {
        if (!isOwner(user)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only Institution Administrators can manage groups.");
        }
    }
}
