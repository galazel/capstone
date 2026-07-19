package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.EligibleQuestionDto;
import com.capstone.rebyu.assessment.dto.QuestionDto;
import com.capstone.rebyu.assessment.service.EligibleQuestionService;
import com.capstone.rebyu.assessment.service.QuestionService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The question bank: admin manages it platform-wide; an enterprise (owner or
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
    private final CognitoAuthService auth;

    @GetMapping
    public List<QuestionDto> getAll(
            @RequestParam(required = false) Long lessonId, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        if (lessonId != null) {
            return questionService.getByLessonId(lessonId);
        }

        return questionService.getAll();
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
            @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        return eligibleQuestionService.getEligible(certificationId, majorId, middleId, lessonId, examId);
    }

    @GetMapping("/{id}")
    public QuestionDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        return questionService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionDto create(@Valid @RequestBody QuestionDto dto, @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrEnterprise(jwt);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(caller.role());
        return questionService.create(dto, caller.userId(), isAdmin ? null : caller.enterpriseId());
    }

    @PutMapping("/{id}")
    public QuestionDto update(
            @PathVariable Long id, @Valid @RequestBody QuestionDto dto, @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrEnterprise(jwt);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(caller.role());
        return questionService.update(id, dto, caller.userId(), isAdmin, isAdmin ? null : caller.enterpriseId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto caller = requireAdminOrEnterprise(jwt);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(caller.role());
        questionService.delete(id, caller.userId(), isAdmin);
    }

    private CurrentUserDto requireAdminOrEnterprise(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role()) && !"ENTERPRISE".equalsIgnoreCase(user.role())) {
            throw new IllegalArgumentException("Admin or enterprise access is required");
        }
        return user;
    }
}
