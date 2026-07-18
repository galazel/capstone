package com.capstone.rebyu.progress.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.progress.dto.ActivityLogDto;
import com.capstone.rebyu.progress.service.ActivityLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activity-logs")
@RequiredArgsConstructor
public class ActivityLogController {
    private final ActivityLogService activityLogService;
    private final CognitoAuthService auth;

    // Cross-user activity data: reading the full list exposes every user's activity,
    // so it's admin-only. Learners read their own activity via /api/learners/me/portal.
    @GetMapping
    public List<ActivityLogDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return activityLogService.getAll();
    }

    @GetMapping("/{id}")
    public ActivityLogDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return activityLogService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityLogDto create(@Valid @RequestBody ActivityLogDto dto) {
        return activityLogService.create(dto);
    }

    @PutMapping("/{id}")
    public ActivityLogDto update(@PathVariable Long id, @Valid @RequestBody ActivityLogDto dto) {
        return activityLogService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        activityLogService.delete(id);
    }
}
