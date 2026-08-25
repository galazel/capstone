package com.capstone.rebyu.enrollment.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enrollment.dto.LearnerCertificationDto;
import com.capstone.rebyu.enrollment.service.LearnerCertificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/learner-certifications")
@RequiredArgsConstructor
public class LearnerCertificationController {
    private final LearnerCertificationService learnerCertificationService;
    private final CognitoAuthService auth;

    // Cross-learner enrollment data: the unfiltered list/lookup exposes every learner's
    // purchased enrollments, so reads are admin-only. Learners get their own via
    // /api/learners/me/portal; institution managers via the scoped institution endpoints.
    @GetMapping
    public List<LearnerCertificationDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerCertificationService.getAll();
    }

    @GetMapping("/{id}")
    public LearnerCertificationDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerCertificationService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerCertificationDto create(@Valid @RequestBody LearnerCertificationDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerCertificationService.create(dto);
    }

    @PutMapping("/{id}")
    public LearnerCertificationDto update(@PathVariable Long id, @Valid @RequestBody LearnerCertificationDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerCertificationService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        learnerCertificationService.delete(id);
    }
}
