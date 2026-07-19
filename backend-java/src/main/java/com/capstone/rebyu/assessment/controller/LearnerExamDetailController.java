package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.assessment.dto.LearnerExamDetailDto;
import com.capstone.rebyu.assessment.service.LearnerExamDetailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/learner-exam-details")
@RequiredArgsConstructor
public class LearnerExamDetailController {
    private final LearnerExamDetailService learnerExamDetailService;
    private final CognitoAuthService auth;

    // Per-question exam detail rows across every learner/enterprise -- admin-only.
    @GetMapping
    public List<LearnerExamDetailDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerExamDetailService.getAll();
    }

    @GetMapping("/{id}")
    public LearnerExamDetailDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerExamDetailService.getById(id);
    }

    @GetMapping("/by-attempt/{learnerId}/{examId}/{attemptNo}")
    public List<LearnerExamDetailDto> getByAttempt(@PathVariable Long learnerId,
                                                    @PathVariable Long examId,
                                                    @PathVariable Integer attemptNo,
                                                    @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerExamDetailService.getByAttempt(learnerId, examId, attemptNo);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerExamDetailDto create(@Valid @RequestBody LearnerExamDetailDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerExamDetailService.create(dto);
    }

    @PutMapping("/{id}")
    public LearnerExamDetailDto update(@PathVariable Long id, @Valid @RequestBody LearnerExamDetailDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerExamDetailService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        learnerExamDetailService.delete(id);
    }
}
