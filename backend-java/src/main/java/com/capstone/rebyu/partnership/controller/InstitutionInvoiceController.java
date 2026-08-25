package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.InstitutionInvoiceDto;
import com.capstone.rebyu.partnership.service.InstitutionInvoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institution-invoices")
@RequiredArgsConstructor
public class InstitutionInvoiceController {
    private final InstitutionInvoiceService service;
    private final CognitoAuthService auth;

    // Every institution's billing/invoice data in one flat list -- admin-only.
    @GetMapping
    public List<InstitutionInvoiceDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.getAll();
    }

    @GetMapping("/{id}")
    public InstitutionInvoiceDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
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
    public InstitutionInvoiceDto create(@Valid @RequestBody InstitutionInvoiceDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public InstitutionInvoiceDto update(@PathVariable Long id, @Valid @RequestBody InstitutionInvoiceDto dto, @AuthenticationPrincipal Jwt jwt) {
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
