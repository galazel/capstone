package com.capstone.rebyu.organization.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.organization.dto.InstitutionVerificationDocumentDto;
import com.capstone.rebyu.organization.service.InstitutionVerificationDocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institution-verification-documents")
@RequiredArgsConstructor
public class InstitutionVerificationDocumentController {
    private final InstitutionVerificationDocumentService service;
    private final CognitoAuthService auth;

    // KYC-style verification documents across every institution -- admin-only.
    @GetMapping
    public List<InstitutionVerificationDocumentDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.getAll();
    }

    @GetMapping("/{id}")
    public InstitutionVerificationDocumentDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionVerificationDocumentDto create(@Valid @RequestBody InstitutionVerificationDocumentDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public InstitutionVerificationDocumentDto update(@PathVariable Long id, @Valid @RequestBody InstitutionVerificationDocumentDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        service.delete(id);
    }
}
