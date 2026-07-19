package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.EnterpriseInvoiceDto;
import com.capstone.rebyu.partnership.service.EnterpriseInvoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enterprise-invoices")
@RequiredArgsConstructor
public class EnterpriseInvoiceController {
    private final EnterpriseInvoiceService service;
    private final CognitoAuthService auth;

    // Every enterprise's billing/invoice data in one flat list -- admin-only.
    @GetMapping
    public List<EnterpriseInvoiceDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.getAll();
    }

    @GetMapping("/{id}")
    public EnterpriseInvoiceDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
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
    public EnterpriseInvoiceDto create(@Valid @RequestBody EnterpriseInvoiceDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public EnterpriseInvoiceDto update(@PathVariable Long id, @Valid @RequestBody EnterpriseInvoiceDto dto, @AuthenticationPrincipal Jwt jwt) {
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
