package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.DiagramQuestionConfigDto;
import com.capstone.rebyu.assessment.service.DiagramQuestionConfigService;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Diagram reference answers -- had no authentication at all, the same defect
 * class the question bank itself had (see QuestionController). Now admin- or
 * institution-scoped like every other question-authoring endpoint.
 */
@RestController
@RequestMapping("/api/diagram-question-configs")
@RequiredArgsConstructor
public class DiagramQuestionConfigController {
    private final DiagramQuestionConfigService diagramQuestionConfigService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<DiagramQuestionConfigDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return diagramQuestionConfigService.getAll();
    }

    @GetMapping("/{id}")
    public DiagramQuestionConfigDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return diagramQuestionConfigService.getById(id);
    }

    @GetMapping("/by-question/{questionId}")
    public DiagramQuestionConfigDto getByQuestionId(@PathVariable Long questionId, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return diagramQuestionConfigService.getByQuestionId(questionId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DiagramQuestionConfigDto create(@Valid @RequestBody DiagramQuestionConfigDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return diagramQuestionConfigService.create(dto);
    }

    @PutMapping("/{id}")
    public DiagramQuestionConfigDto update(@PathVariable Long id, @Valid @RequestBody DiagramQuestionConfigDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        return diagramQuestionConfigService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrInstitution(jwt);
        diagramQuestionConfigService.delete(id);
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
