package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.AddExamQuestionsRequest;
import com.capstone.rebyu.assessment.dto.ExamDto;
import com.capstone.rebyu.assessment.service.ExamService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Exam (assessment) management. Reads stay open because learners discover
 * available assessments through GET here; WRITES require either ADMIN
 * (official content, ownerGroupId omitted) or an Institution Member acting on
 * their own group's exam (ownerGroupId required on create, checked against
 * the caller's own group access -- see ExamService/MajorCategoryService).
 *
 * includeGroupId is the opt-in read filter that mixes a group's own exams
 * into the list/by-id responses -- omitted (every existing caller), the
 * response is unchanged from before ownerGroup existed, since no exam has
 * ever had a non-null owner group.
 */
@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamController {
    private final ExamService examService;
    private final InstitutionGroupService institutionGroupService;
    private final CognitoAuthService auth;

    /**
     * certificationId is an optional narrowing of the same open read: it does
     * not expose an exam a caller could not already fetch from the unfiltered
     * list, it only spares them fetching every other certification's.
     */
    @GetMapping
    public List<ExamDto> getAll(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long includeGroupId,
            @RequestParam(required = false) Long certificationId) {
        requireGroupAccessIfRequested(jwt, includeGroupId);
        return examService.getAll(includeGroupId, certificationId);
    }

    @GetMapping("/{id}")
    public ExamDto getById(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestParam(required = false) Long includeGroupId) {
        requireGroupAccessIfRequested(jwt, includeGroupId);
        return examService.getById(id, includeGroupId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExamDto create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ExamDto dto,
            @RequestParam(required = false) Long ownerGroupId) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return examService.create(
                dto, isAdmin, user.institutionId(), user.userId(), isOwner(user), ownerGroupId);
    }

    @PutMapping("/{id}")
    public ExamDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody ExamDto dto) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return examService.update(id, dto, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        examService.delete(id, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @PostMapping("/{id}/questions")
    public ExamDto addQuestions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @Valid @RequestBody AddExamQuestionsRequest request) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return examService.addQuestions(id, request, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @PostMapping("/{id}/publish")
    public ExamDto publish(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return examService.publish(id, isAdmin, user.institutionId(), user.userId(), isOwner(user));
    }

    @PostMapping("/{id}/archive")
    public ExamDto archive(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto user = requireAdminOrInstitution(jwt);
        boolean isAdmin = isAdmin(user);
        return examService.archive(id, isAdmin, user.institutionId(), user.userId(), isOwner(user));
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

    /**
     * No-op when includeGroupId is omitted. When supplied, the caller must be
     * authenticated and able to act on that specific group (owner or that
     * group's active leader) -- same check InstitutionGroupController already
     * relies on -- so a group's own exams can't be read by guessing its id.
     */
    private void requireGroupAccessIfRequested(Jwt jwt, Long includeGroupId) {
        if (includeGroupId == null) {
            return;
        }
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.institutionId() == null) {
            throw new IllegalArgumentException("An institution account is required");
        }
        boolean owner = "owner".equalsIgnoreCase(user.institutionMemberRole());
        institutionGroupService.getAccessibleById(includeGroupId, user.institutionId(), user.userId(), owner);
    }

    private boolean isAdmin(CurrentUserDto user) {
        return "ADMIN".equalsIgnoreCase(user.role());
    }

    private boolean isOwner(CurrentUserDto user) {
        return "owner".equalsIgnoreCase(user.institutionMemberRole());
    }
}
