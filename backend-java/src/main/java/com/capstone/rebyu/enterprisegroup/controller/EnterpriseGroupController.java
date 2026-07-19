package com.capstone.rebyu.enterprisegroup.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupDto;
import com.capstone.rebyu.enterprisegroup.service.EnterpriseGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enterprise-groups")
@RequiredArgsConstructor
public class EnterpriseGroupController {

    private final EnterpriseGroupService enterpriseGroupService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<EnterpriseGroupDto> getAll(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long orgCertId) {
        return enterpriseGroupService.getAll(myEnterpriseId(jwt), orgCertId);
    }

    @GetMapping("/{id}")
    public EnterpriseGroupDto getById(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return enterpriseGroupService.getById(id, myEnterpriseId(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnterpriseGroupDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody EnterpriseGroupDto dto) {
        // Never trust enterpriseId/createdBy from the client body -- a caller
        // could otherwise spoof another tenant or impersonate another user
        // when creating a group. Resolve both from the authenticated caller
        // and overwrite whatever was supplied in the request.
        Long enterpriseId = myEnterpriseId(jwt);
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        dto.setEnterpriseId(enterpriseId);
        dto.setCreatedBy(user.userId());
        return enterpriseGroupService.create(dto);
    }

    @PutMapping("/{id}")
    public EnterpriseGroupDto update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody EnterpriseGroupDto dto) {
        return enterpriseGroupService.update(id, dto, myEnterpriseId(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        enterpriseGroupService.delete(id, myEnterpriseId(jwt));
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
}
