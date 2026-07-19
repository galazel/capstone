package com.capstone.rebyu.enrollment.controller;


import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enrollment.dto.OrganizationCertificationLearnerDto;
import com.capstone.rebyu.enrollment.service.OrganizationCertificationLearnerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organization-certification-learners")
@RequiredArgsConstructor
public class OrganizationCertificationLearnerController {
    private final OrganizationCertificationLearnerService organizationCertificationLearnerService;
    private final CognitoAuthService auth;

    // Cross-tenant learner-allocation data: the unfiltered list exposes which learners
    // hold which certifications across every organization, so it's admin-only.
    @GetMapping
    public List<OrganizationCertificationLearnerDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificationLearnerService.getAll();
    }

    @GetMapping("/{id}")
    public OrganizationCertificationLearnerDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificationLearnerService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrganizationCertificationLearnerDto create(@Valid @RequestBody OrganizationCertificationLearnerDto dto,
                                                        @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificationLearnerService.create(dto);
    }

    @PutMapping("/{id}")
    public OrganizationCertificationLearnerDto update(@PathVariable Long id,
                                                        @Valid @RequestBody OrganizationCertificationLearnerDto dto,
                                                        @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return organizationCertificationLearnerService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        organizationCertificationLearnerService.delete(id);
    }
}
