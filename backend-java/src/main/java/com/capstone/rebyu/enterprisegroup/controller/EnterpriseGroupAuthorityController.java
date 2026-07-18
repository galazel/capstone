package com.capstone.rebyu.enterprisegroup.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupAuthorityDto;
import com.capstone.rebyu.enterprisegroup.service.EnterpriseGroupAuthorityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enterprise-group-authorities")
@RequiredArgsConstructor
public class EnterpriseGroupAuthorityController {

    private final EnterpriseGroupAuthorityService enterpriseGroupAuthorityService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<EnterpriseGroupAuthorityDto> getAll(
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Long userId) {
        return enterpriseGroupAuthorityService.getAll(groupId, userId);
    }

    @GetMapping("/{id}")
    public EnterpriseGroupAuthorityDto getById(@PathVariable Long id) {
        return enterpriseGroupAuthorityService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnterpriseGroupAuthorityDto create(
            @Valid @RequestBody EnterpriseGroupAuthorityDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        Long callerEnterpriseId = myEnterpriseId(jwt);
        // Never trust assignedBy from the client -- always the authenticated caller.
        dto.setAssignedBy(callerUserId(jwt));
        return enterpriseGroupAuthorityService.create(dto, callerEnterpriseId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        enterpriseGroupAuthorityService.delete(id, myEnterpriseId(jwt));
    }

    private Long myEnterpriseId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.enterpriseId() == null) {
            throw new IllegalArgumentException("An enterprise account is required");
        }
        return user.enterpriseId();
    }

    // Records who actually performed the assignment from the authenticated caller.
    private Long callerUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        return user.userId();
    }
}
