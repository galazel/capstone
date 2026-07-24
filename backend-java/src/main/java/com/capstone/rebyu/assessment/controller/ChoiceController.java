package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.assessment.dto.ChoiceDto;
import com.capstone.rebyu.assessment.service.ChoiceService;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * A question's answer choices (including which one is correct) -- had no
 * authentication at all, the same defect class the question bank itself had
 * (see QuestionController). Now admin- or enterprise-scoped like every other
 * question-authoring endpoint.
 */
@RestController
@RequestMapping("/api/choices")
@RequiredArgsConstructor
public class ChoiceController {
    private final ChoiceService choiceService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<ChoiceDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        return choiceService.getAll();
    }

    @GetMapping("/{id}")
    public ChoiceDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        return choiceService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChoiceDto create(@Valid @RequestBody ChoiceDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        return choiceService.create(dto);
    }

    @PutMapping("/{id}")
    public ChoiceDto update(@PathVariable Long id, @Valid @RequestBody ChoiceDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        return choiceService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdminOrEnterprise(jwt);
        choiceService.delete(id);
    }

    private void requireAdminOrEnterprise(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        var user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role()) && !CognitoAuthService.isEnterpriseRole(user.role())) {
            throw new IllegalArgumentException("Admin or enterprise access is required");
        }
    }
}
