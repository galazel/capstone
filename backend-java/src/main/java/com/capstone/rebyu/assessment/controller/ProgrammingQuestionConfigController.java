package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.ProgrammingQuestionConfigDto;
import com.capstone.rebyu.assessment.service.ProgrammingQuestionConfigService;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Programming test cases -- had no authentication at all, the same defect
 * class the question bank itself had (see QuestionController). Now admin- or
 * institution-scoped like every other question-authoring endpoint.
 */
@RestController
@RequestMapping("/api/programming-question-configs")
@RequiredArgsConstructor
public class ProgrammingQuestionConfigController {
    private final ProgrammingQuestionConfigService programmingQuestionConfigService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<ProgrammingQuestionConfigDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return programmingQuestionConfigService.getAll();
    }

    @GetMapping("/{id}")
    public ProgrammingQuestionConfigDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return programmingQuestionConfigService.getById(id);
    }

    @GetMapping("/by-question/{questionId}")
    public ProgrammingQuestionConfigDto getByQuestionId(@PathVariable Long questionId, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return programmingQuestionConfigService.getByQuestionId(questionId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProgrammingQuestionConfigDto create(@Valid @RequestBody ProgrammingQuestionConfigDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return programmingQuestionConfigService.create(dto);
    }

    @PutMapping("/{id}")
    public ProgrammingQuestionConfigDto update(@PathVariable Long id, @Valid @RequestBody ProgrammingQuestionConfigDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return programmingQuestionConfigService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        programmingQuestionConfigService.delete(id);
    }

    private void requireAdminOrInstitution(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        var user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role()) && !CognitoAuthService.isInstitutionRole(user.role())) {
            throw new IllegalArgumentException("Admin or institution access is required");
        }
    }
}
