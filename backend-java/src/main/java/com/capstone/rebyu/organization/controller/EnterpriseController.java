package com.capstone.rebyu.organization.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.organization.dto.EnterpriseDto;
import com.capstone.rebyu.organization.service.EnterpriseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enterprises")
@RequiredArgsConstructor
public class EnterpriseController {
    private final EnterpriseService enterpriseService;
    private final CognitoAuthService auth;

    // Every enterprise's org profile/billing metadata in one flat list, so this
    // whole controller is admin-only. An enterprise manager reads their own
    // org via /api/enterprise/me/overview.
    @GetMapping
    public List<EnterpriseDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseService.getAll();
    }

    @GetMapping("/{id}")
    public EnterpriseDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnterpriseDto create(@Valid @RequestBody EnterpriseDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseService.create(dto);
    }

    @PutMapping("/{id}")
    public EnterpriseDto update(@PathVariable Long id, @Valid @RequestBody EnterpriseDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        enterpriseService.delete(id);
    }
}
