package com.capstone.rebyu.organization.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.organization.service.OrganizationCertificateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organization-certificates")
@RequiredArgsConstructor
public class OrganizationCertificateController {
    private final OrganizationCertificateService organizationCertificateService;
    private final CognitoAuthService auth;

    // Cross-tenant allocation data: the unfiltered list exposes every organization's
    // certificate allocations, so it's admin-only. Institutions read their own via
    // /api/institution/me/overview; learners via /api/learners/me/portal.
    @GetMapping
    public List<OrganizationCertificateDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificateService.getAll();
    }

    @GetMapping("/{id}")
    public OrganizationCertificateDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificateService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrganizationCertificateDto create(@Valid @RequestBody OrganizationCertificateDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificateService.create(dto);
    }

    @PutMapping("/{id}")
    public OrganizationCertificateDto update(@PathVariable Long id, @Valid @RequestBody OrganizationCertificateDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificateService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        organizationCertificateService.delete(id);
    }
}
