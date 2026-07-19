package com.capstone.rebyu.enterprisegroup.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enterprisegroup.dto.GroupAnnouncementDto;
import com.capstone.rebyu.enterprisegroup.service.GroupAnnouncementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Announcements scoped to one group. The service enforces that the caller is
 * the institution owner or an active leader of the group.
 */
@RestController
@RequestMapping("/api/enterprise-groups/{groupId}/announcements")
@RequiredArgsConstructor
public class GroupAnnouncementController {

    private final GroupAnnouncementService groupAnnouncementService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<GroupAnnouncementDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long groupId) {
        CurrentUserDto user = enterpriseUser(jwt);
        return groupAnnouncementService.list(groupId, user.enterpriseId(), user.userId(), isOwner(user));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupAnnouncementDto create(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long groupId,
            @Valid @RequestBody GroupAnnouncementDto dto) {
        CurrentUserDto user = enterpriseUser(jwt);
        return groupAnnouncementService.create(groupId, dto, user.enterpriseId(), user.userId(), isOwner(user));
    }

    @PutMapping("/{announcementId}")
    public GroupAnnouncementDto update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long groupId,
            @PathVariable Long announcementId, @Valid @RequestBody GroupAnnouncementDto dto) {
        CurrentUserDto user = enterpriseUser(jwt);
        return groupAnnouncementService.update(
                groupId, announcementId, dto, user.enterpriseId(), user.userId(), isOwner(user));
    }

    @DeleteMapping("/{announcementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archive(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long groupId, @PathVariable Long announcementId) {
        CurrentUserDto user = enterpriseUser(jwt);
        groupAnnouncementService.archive(groupId, announcementId, user.enterpriseId(), user.userId(), isOwner(user));
    }

    private CurrentUserDto enterpriseUser(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.enterpriseId() == null) {
            throw new IllegalArgumentException("An enterprise account is required");
        }
        return user;
    }

    private boolean isOwner(CurrentUserDto user) {
        return "owner".equalsIgnoreCase(user.enterpriseMemberRole());
    }
}
