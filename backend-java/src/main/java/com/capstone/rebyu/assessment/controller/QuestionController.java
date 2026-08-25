package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.EligibleQuestionDto;
import com.capstone.rebyu.assessment.dto.QuestionDto;
import com.capstone.rebyu.assessment.service.EligibleQuestionService;
import com.capstone.rebyu.assessment.service.QuestionService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The question bank: admin manages it platform-wide; an institution (owner or
 * group leader) may add/edit/delete questions too, but only within
 * certifications their organization has purchased access to, and only for
 * questions they themselves authored (admin-authored questions are read-only
 * to them). Every question records who created it.
 */
@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {
    private final QuestionService questionService;
    private final EligibleQuestionService eligibleQuestionService;
    private final InstitutionGroupService institutionGroupService;
    private final InstitutionGroupRepository institutionGroupRepository;
    private final CognitoAuthService auth;

    @GetMapping
    public List<QuestionDto> getAll(
            @RequestParam(required = false) Long lessonId,
            @RequestParam(required = false) Long includeGroupId,
            @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrInstitution(jwt);
        requireGroupAccessIfRequested(caller, includeGroupId);
        if (lessonId != null) {
            return questionService.getByLessonId(lessonId, includeGroupId);
        }

        return questionService.getAll(includeGroupId);
    }

    /**
     * Questions eligible for an assessment's scope, excluding any already
     * assigned to {@code examId}. Pass only the scope ids relevant to the
     * assessment type; the most specific id wins.
     */
    @GetMapping("/eligible")
    public List<EligibleQuestionDto> getEligible(
            @RequestParam(required = false) Long certificationId,
            @RequestParam(required = false) Long majorId,
            @RequestParam(required = false) Long middleId,
            @RequestParam(required = false) Long lessonId,
            @RequestParam(required = false) Long examId,
            @RequestParam(required = false) Long includeGroupId,
            @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrInstitution(jwt);
        requireGroupAccessIfRequested(caller, includeGroupId);
        return eligibleQuestionService.getEligible(
                certificationId, majorId, middleId, lessonId, examId, includeGroupId);
    }

    @GetMapping("/{id}")
    public QuestionDto getById(
            @PathVariable Long id,
            @RequestParam(required = false) Long includeGroupId,
            @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrInstitution(jwt);
        requireGroupAccessIfRequested(caller, includeGroupId);
        return questionService.getById(id, includeGroupId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionDto create(
            @Valid @RequestBody QuestionDto dto,
            @RequestParam(required = false) Long ownerGroupId,
            @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrInstitution(jwt);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(caller.role());
        // ownerGroupId marks this as the group's own question. The caller must
        // actually be able to act on that group (owner or its active leader).
        InstitutionGroup ownerGroup = null;
        if (ownerGroupId != null) {
            requireGroupAccessIfRequested(caller, ownerGroupId);
            ownerGroup = institutionGroupRepository.findById(ownerGroupId)
                    .orElseThrow(() -> new EntityNotFoundException("Group not found: " + ownerGroupId));
        }
        return questionService.create(
                dto, caller.userId(), isAdmin ? null : caller.institutionId(), ownerGroup);
    }

    @PutMapping("/{id}")
    public QuestionDto update(
            @PathVariable Long id, @Valid @RequestBody QuestionDto dto, @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrInstitution(jwt);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(caller.role());
        return questionService.update(id, dto, caller.userId(), isAdmin, isAdmin ? null : caller.institutionId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrInstitution(jwt);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(caller.role());
        questionService.delete(id, caller.userId(), isAdmin);
    }

    private CurrentUserDto requireAdminOrInstitution(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role()) && !CognitoAuthService.isInstitutionRole(user.role())) {
            throw new IllegalArgumentException("Admin or institution access is required");
        }
        return user;
    }

    /**
     * No-op when no group is referenced. Otherwise the caller must belong to
     * that group's organization and be its active leader (or the institution
     * owner) -- so a group's private questions can't be read, or written to,
     * by guessing a group id. Reuses the same check as the rest of the app.
     */
    private void requireGroupAccessIfRequested(CurrentUserDto caller, Long groupId) {
        if (groupId == null) {
            return;
        }
        if (caller.institutionId() == null) {
            throw new IllegalArgumentException("An institution account is required");
        }
        boolean owner = "owner".equalsIgnoreCase(caller.institutionMemberRole());
        institutionGroupService.getAccessibleById(groupId, caller.institutionId(), caller.userId(), owner);
    }
}
