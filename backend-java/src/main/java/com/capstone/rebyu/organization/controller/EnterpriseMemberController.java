package com.capstone.rebyu.organization.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.organization.dto.EnterpriseMemberDto;
import com.capstone.rebyu.organization.service.EnterpriseMemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enterprise-members")
@RequiredArgsConstructor
public class EnterpriseMemberController {
    private final EnterpriseMemberService enterpriseMemberService;
    private final CognitoAuthService auth;

    // enterpriseId in getByEnterpriseId is a client-supplied path value with no
    // ownership check possible here yet, so this whole controller is admin-only
    // until a JWT-derived, self-service enterprise-manager view exists.
    @GetMapping
    public List<EnterpriseMemberDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseMemberService.getAll();
    }

    @GetMapping("/enterprise/{enterpriseId}")
    public List<EnterpriseMemberDto> getByEnterpriseId(@PathVariable Long enterpriseId, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseMemberService.getByEnterpriseId(enterpriseId);
    }

    @GetMapping("/{id}")
    public EnterpriseMemberDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseMemberService.getById(id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnterpriseMemberDto create(@Valid @RequestBody EnterpriseMemberDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseMemberService.create(dto);
    }

    @PutMapping("/{id}")
    public EnterpriseMemberDto update(@PathVariable Long id, @Valid @RequestBody EnterpriseMemberDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return enterpriseMemberService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        enterpriseMemberService.delete(id);
    }
}
