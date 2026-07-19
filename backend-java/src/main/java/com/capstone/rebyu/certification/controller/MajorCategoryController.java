package com.capstone.rebyu.certification.controller;


import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.dto.MajorCategoryDto;
import com.capstone.rebyu.certification.service.MajorCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Reads stay public (browsed platform-wide); WRITES had no auth at all -- now admin-only. */
@RestController
@RequestMapping("/api/major-categories")
@RequiredArgsConstructor
public class MajorCategoryController {
    private final MajorCategoryService majorCategoryService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<MajorCategoryDto> getAll() {
        return majorCategoryService.getAll();
    }

    @GetMapping("/{id}")
    public MajorCategoryDto getById(@PathVariable Long id) {
        return majorCategoryService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MajorCategoryDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MajorCategoryDto dto) {
        requireAdmin(jwt);
        return majorCategoryService.create(dto);
    }

    @PutMapping("/{id}")
    public MajorCategoryDto update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody MajorCategoryDto dto) {
        requireAdmin(jwt);
        return majorCategoryService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        majorCategoryService.delete(id);
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
