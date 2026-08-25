package com.capstone.rebyu.organization.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.organization.dto.InstitutionDto;
import com.capstone.rebyu.organization.service.InstitutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institutions")
@RequiredArgsConstructor
public class InstitutionController {
    private final InstitutionService institutionService;
    private final CognitoAuthService auth;

    // Every institution's org profile/billing metadata in one flat list, so this
    // whole controller is admin-only. An institution manager reads their own
    // org via /api/institution/me/overview.
    @GetMapping
    public List<InstitutionDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionService.getAll();
    }

    @GetMapping("/{id}")
    public InstitutionDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionDto create(@Valid @RequestBody InstitutionDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionService.create(dto);
    }

    @PutMapping("/{id}")
    public InstitutionDto update(@PathVariable Long id, @Valid @RequestBody InstitutionDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return institutionService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        institutionService.delete(id);
    }
}
