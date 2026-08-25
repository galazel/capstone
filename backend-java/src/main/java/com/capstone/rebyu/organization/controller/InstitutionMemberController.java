package com.capstone.rebyu.organization.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.organization.dto.InstitutionMemberDto;
import com.capstone.rebyu.organization.service.InstitutionMemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institution-members")
@RequiredArgsConstructor
public class InstitutionMemberController {
    private final InstitutionMemberService institutionMemberService;
    private final CognitoAuthService auth;

    // institutionId in getByInstitutionId is a client-supplied path value with no
    // ownership check possible here yet, so this whole controller is admin-only
    // until a JWT-derived, self-service institution-manager view exists.
    @GetMapping
    public List<InstitutionMemberDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionMemberService.getAll();
    }

    @GetMapping("/institution/{institutionId}")
    public List<InstitutionMemberDto> getByInstitutionId(@PathVariable Long institutionId, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionMemberService.getByInstitutionId(institutionId);
    }

    @GetMapping("/{id}")
    public InstitutionMemberDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionMemberService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionMemberDto create(@Valid @RequestBody InstitutionMemberDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionMemberService.create(dto);
    }

    @PutMapping("/{id}")
    public InstitutionMemberDto update(@PathVariable Long id, @Valid @RequestBody InstitutionMemberDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionMemberService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        institutionMemberService.delete(id);
    }
}
