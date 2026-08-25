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

/**
 * Reads stay public (browsed platform-wide). WRITES had no auth at all --
 * now either ADMIN (official content) or an Institution Member acting on
 * their own group's content, authorized by walking up to the ancestor
 * MajorCategory's ownerGroup -- see LessonService. This includes the lesson
 * body editing endpoints (saveLessonComponent), since a member authoring
 * their own lesson needs to actually be able to edit its content, not just
 * create the shell.
 */
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
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return lessonService.create(dto, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @PutMapping("/{id}")
    public LessonDto update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @Valid @RequestBody LessonDto dto
    ) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return lessonService.update(id, dto, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        lessonService.delete(id, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @PutMapping("/lesson/{id}")
    @ResponseStatus(HttpStatus.OK)
    public void saveLessonComponent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestBody LessonDto lessonDto
    ) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        lessonService.saveLessonComponent(id, lessonDto, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @GetMapping("/lesson/{id}")
    public LessonComponentResponseDto getLessonComponent(
            @PathVariable Long id
    ) {
        return lessonService.getLessonComponent(id);
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
