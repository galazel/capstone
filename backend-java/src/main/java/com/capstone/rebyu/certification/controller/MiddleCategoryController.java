package com.capstone.rebyu.certification.controller;


import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.dto.MiddleCategoryDto;
import com.capstone.rebyu.certification.service.MiddleCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Reads stay public (browsed platform-wide); WRITES had no auth at all -- now admin-only. */
@RestController
@RequestMapping("/api/middle-categories")
@RequiredArgsConstructor
public class MiddleCategoryController {
    private final MiddleCategoryService middleCategoryService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<MiddleCategoryDto> getAll() {
        return middleCategoryService.getAll();
    }

    @GetMapping("/{id}")
    public MiddleCategoryDto getById(@PathVariable Long id) {
        return middleCategoryService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MiddleCategoryDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MiddleCategoryDto dto) {
        requireAdmin(jwt);
        return middleCategoryService.create(dto);
    }

    @PutMapping("/{id}")
    public MiddleCategoryDto update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody MiddleCategoryDto dto) {
        requireAdmin(jwt);
        return middleCategoryService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        middleCategoryService.delete(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) {
            throw new IllegalArgumentException("Admin access is required");
        }
    }
}
