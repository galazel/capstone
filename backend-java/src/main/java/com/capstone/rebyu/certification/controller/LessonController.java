package com.capstone.rebyu.certification.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.certification.dto.LessonComponentResponseDto;
import com.capstone.rebyu.certification.dto.LessonDto;
import com.capstone.rebyu.certification.service.LessonService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Reads stay public (browsed platform-wide); WRITES had no auth at all -- now admin-only. */
@RestController
@RequestMapping("/api/lessons")
@RequiredArgsConstructor
public class LessonController {

    private final LessonService lessonService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<LessonDto> getAll() {
        return lessonService.getAll();
    }

    @GetMapping("/middle-category/{middleCategoryId}")
    public List<LessonDto> getByMiddleCategoryId(
            @PathVariable Long middleCategoryId
    ) {
        return lessonService.getByMiddleCategoryId(middleCategoryId);
    }

    @GetMapping("/{id}")
    public LessonDto getById(@PathVariable Long id) {
        return lessonService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LessonDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody LessonDto dto) {
        requireAdmin(jwt);
        return lessonService.create(dto);
    }

    @PutMapping("/{id}")
    public LessonDto update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @Valid @RequestBody LessonDto dto
    ) {
        requireAdmin(jwt);
        return lessonService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        lessonService.delete(id);
    }

    @PutMapping("/lesson/{id}")
    @ResponseStatus(HttpStatus.OK)
    public void saveLessonComponent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestBody LessonDto lessonDto
    ) {
        requireAdmin(jwt);
        lessonService.saveLessonComponent(id, lessonDto);
    }

    @GetMapping("/lesson/{id}")
    public LessonComponentResponseDto getLessonComponent(
            @PathVariable Long id
    ) {
        return lessonService.getLessonComponent(id);
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