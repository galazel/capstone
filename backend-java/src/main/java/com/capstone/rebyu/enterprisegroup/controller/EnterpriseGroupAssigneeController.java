package com.capstone.rebyu.enterprisegroup.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupAssigneeDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee;
import com.capstone.rebyu.enterprisegroup.service.EnterpriseGroupAssigneeService;
import com.capstone.rebyu.enterprisegroup.service.EnterpriseGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/enterprise-group-assignees")
@RequiredArgsConstructor
public class EnterpriseGroupAssigneeController {

    private final EnterpriseGroupAssigneeService enterpriseGroupAssigneeService;
    private final EnterpriseGroupService enterpriseGroupService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<EnterpriseGroupAssigneeDto> getAll(
            @AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long groupId) {
        CurrentUserDto caller = requireEnterpriseCaller(jwt);
        if (groupId == null) {
            throw new IllegalArgumentException("A groupId is required.");
        }
        enterpriseGroupService.getAccessibleById(
                groupId,
                caller.enterpriseId(),
                caller.userId(),
                "owner".equalsIgnoreCase(caller.enterpriseMemberRole()));
        return enterpriseGroupAssigneeService.getAll(groupId);
    }

    @GetMapping("/{id}")
    public EnterpriseGroupAssigneeDto getById(@PathVariable Long id) {
        return enterpriseGroupAssigneeService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnterpriseGroupAssigneeDto create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody EnterpriseGroupAssigneeDto dto) {
        CurrentUserDto caller = requireEnterpriseCaller(jwt);
        dto.setAssignedBy(caller.userId());
        return enterpriseGroupAssigneeService.create(dto, caller.enterpriseId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto caller = requireEnterpriseCaller(jwt);
        enterpriseGroupAssigneeService.delete(id, caller.enterpriseId());
    }

    @PatchMapping("/{id}/role")
    public EnterpriseGroupAssigneeDto changeRole(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @RequestBody Map<String, String> body) {
        CurrentUserDto caller = requireEnterpriseCaller(jwt);
        EnterpriseGroupAssignee.Role newRole = EnterpriseGroupAssignee.Role.valueOf(
                body.getOrDefault("role", "").toLowerCase());
        return enterpriseGroupAssigneeService.changeRole(id, newRole, caller.enterpriseId());
    }

    private CurrentUserDto requireEnterpriseCaller(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.enterpriseId() == null) {
            throw new IllegalArgumentException("An enterprise account is required");
        }
        return user;
    }
}
