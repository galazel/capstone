package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.TextQuestionConfigDto;
import com.capstone.rebyu.assessment.service.TextQuestionConfigService;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Short-answer/descriptive answer keys -- had no authentication at all, the
 * same defect class the question bank itself had (see QuestionController).
 * Now admin- or institution-scoped like every other question-authoring endpoint.
 */
@RestController
@RequestMapping("/api/text-question-configs")
@RequiredArgsConstructor
public class TextQuestionConfigController {
    private final TextQuestionConfigService textQuestionConfigService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<TextQuestionConfigDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return textQuestionConfigService.getAll();
    }

    @GetMapping("/{id}")
    public TextQuestionConfigDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return textQuestionConfigService.getById(id);
    }

    @GetMapping("/by-question/{questionId}")
    public TextQuestionConfigDto getByQuestionId(@PathVariable Long questionId, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return textQuestionConfigService.getByQuestionId(questionId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TextQuestionConfigDto create(@Valid @RequestBody TextQuestionConfigDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return textQuestionConfigService.create(dto);
    }

    @PutMapping("/{id}")
    public TextQuestionConfigDto update(@PathVariable Long id, @Valid @RequestBody TextQuestionConfigDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return textQuestionConfigService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        textQuestionConfigService.delete(id);
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
