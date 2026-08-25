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

/**
 * Reads stay public (browsed platform-wide). WRITES had no auth at all --
 * now either ADMIN (official content, ownerGroupId omitted) or an Institution
 * Member acting on their own group's content (ownerGroupId required, checked
 * against the caller's own group access -- see MajorCategoryService).
 */
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
    public MajorCategoryDto create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody MajorCategoryDto dto,
            @RequestParam(required = false) Long ownerGroupId) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return majorCategoryService.create(
                dto, isAdmin, user.institutionId(), user.userId(), isOwner(user), ownerGroupId);
    }

    @PutMapping("/{id}")
    public MajorCategoryDto update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody MajorCategoryDto dto) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return majorCategoryService.update(id, dto, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        majorCategoryService.delete(id, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    private CurrentUserDto requireAdminOrInstitution(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!isAdmin(user) && !CognitoAuthService.isInstitutionRole(user.role())) {
            throw new IllegalArgumentException("Admin or institution access is required");
        }
        return user;
    }

    private boolean isAdmin(CurrentUserDto user) {
        return "ADMIN".equalsIgnoreCase(user.role());
    }

    private boolean isOwner(CurrentUserDto user) {
        return "owner".equalsIgnoreCase(user.institutionMemberRole());
    }
}
