package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.AddExamQuestionsRequest;
import com.capstone.rebyu.assessment.dto.ExamDto;
import com.capstone.rebyu.assessment.service.ExamService;
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
 * Exam (assessment) management. Reads stay open because learners discover
 * available assessments through GET here; every WRITE is admin-only -- these
 * endpoints previously had NO authentication at all, so anyone on the internet
 * could create, edit, publish, or delete any exam platform-wide.
 *
 * (Enterprise-member-authored assessments will need this table scoped by an
 * owning group AND the learner-facing read path filtered before members can be
 * allowed to write here.)
 */
@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamController {
    private final ExamService examService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<ExamDto> getAll() {
        return examService.getAll();
    }

    @GetMapping("/{id}")
    public ExamDto getById(@PathVariable Long id) {
        return examService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExamDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ExamDto dto) {
        requireAdmin(jwt);
        return examService.create(dto);
    }

    @PutMapping("/{id}")
    public ExamDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody ExamDto dto) {
        requireAdmin(jwt);
        return examService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        examService.delete(id);
    }

    @PostMapping("/{id}/questions")
    public ExamDto addQuestions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @Valid @RequestBody AddExamQuestionsRequest request) {
        requireAdmin(jwt);
        return examService.addQuestions(id, request);
    }

    @PostMapping("/{id}/publish")
    public ExamDto publish(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        return examService.publish(id);
    }

    @PostMapping("/{id}/archive")
    public ExamDto archive(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        return examService.archive(id);
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
