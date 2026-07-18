package com.capstone.rebyu.community;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/community/reports")
@RequiredArgsConstructor
public class AdminCommunityModerationController {
    private final CommunityService community;
    private final CognitoAuthService auth;

    public record ReviewRequest(String status) {}

    @GetMapping
    public List<CommunityService.ReportView> reports(@RequestParam(required = false) String status, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return community.reports(status);
    }

    @PutMapping("/{reportId}")
    public void review(@PathVariable Long reportId, @RequestBody ReviewRequest request, @AuthenticationPrincipal Jwt jwt) {
        CurrentUserDto admin = requireAdmin(jwt);
        community.reviewReport(reportId, request.status(), admin.userId());
    }

    @PutMapping("/posts/{postId}/hide")
    public void hidePost(@PathVariable Long postId, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        community.hidePost(postId);
    }

    private CurrentUserDto requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
        return user;
    }
}
