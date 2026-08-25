package com.capstone.rebyu.institutiongroup.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupAssigneeDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAssignee;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupAssigneeService;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/institution-group-assignees")
@RequiredArgsConstructor
public class InstitutionGroupAssigneeController {

    private final InstitutionGroupAssigneeService institutionGroupAssigneeService;
    private final InstitutionGroupService institutionGroupService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<InstitutionGroupAssigneeDto> getAll(
            @AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long groupId) {
        CurrentUserDto caller = requireInstitutionCaller(jwt);
        if (groupId == null) {
            throw new IllegalArgumentException("A groupId is required.");
        }
        institutionGroupService.getAccessibleById(
                groupId,
                caller.institutionId(),
                caller.userId(),
                "owner".equalsIgnoreCase(caller.institutionMemberRole()));
        return institutionGroupAssigneeService.getAll(groupId);
    }

    @GetMapping("/{id}")
    public InstitutionGroupAssigneeDto getById(@PathVariable Long id) {
        return institutionGroupAssigneeService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionGroupAssigneeDto create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InstitutionGroupAssigneeDto dto) {
        CurrentUserDto caller = requireInstitutionCaller(jwt);
        dto.setAssignedBy(caller.userId());
        return institutionGroupAssigneeService.create(dto, caller.institutionId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        CurrentUserDto caller = requireInstitutionCaller(jwt);
        institutionGroupAssigneeService.delete(id, caller.institutionId());
    }

    @PatchMapping("/{id}/role")
    public InstitutionGroupAssigneeDto changeRole(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @RequestBody Map<String, String> body) {
        CurrentUserDto caller = requireInstitutionCaller(jwt);
        InstitutionGroupAssignee.Role newRole = InstitutionGroupAssignee.Role.valueOf(
                body.getOrDefault("role", "").toLowerCase());
        return institutionGroupAssigneeService.changeRole(id, newRole, caller.institutionId());
    }

    private CurrentUserDto requireInstitutionCaller(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.institutionId() == null) {
            throw new IllegalArgumentException("An institution account is required");
        }
        return user;
    }
}
