package com.capstone.rebyu.assessment.controller;


import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.assessment.service.ExamResultService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam-results")
@RequiredArgsConstructor
public class ExamResultController {
    private final ExamResultService examResultService;
    private final CognitoAuthService auth;

    // Cross-learner results data: the unfiltered list/lookup exposes every learner's
    // exam results, so reads are admin-only. Learners read their own via
    // /api/learners/me/portal; enterprise managers via /api/enterprise/me/learners/{id}/exam-results.
    @GetMapping
    public List<ExamResultDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return examResultService.getAll();
    }

    @GetMapping("/{learnerId}/{examId}/{attemptNo}")
    public ExamResultDto getById(@PathVariable Long learnerId, @PathVariable Long examId,
                                  @PathVariable Integer attemptNo, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return examResultService.getById(learnerId, examId, attemptNo);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExamResultDto create(@Valid @RequestBody ExamResultDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return examResultService.create(dto);
    }

    @PutMapping("/{learnerId}/{examId}/{attemptNo}")
    public ExamResultDto update(@PathVariable Long learnerId, @PathVariable Long examId, @PathVariable Integer attemptNo,
                                 @Valid @RequestBody ExamResultDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return examResultService.update(learnerId, examId, attemptNo, dto);
    }

    @DeleteMapping("/{learnerId}/{examId}/{attemptNo}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long learnerId, @PathVariable Long examId, @PathVariable Integer attemptNo,
                        @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        examResultService.delete(learnerId, examId, attemptNo);
    }
}
