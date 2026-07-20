package com.capstone.rebyu.notification.controller;

import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.notification.service.NotificationService.NotificationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The signed-in user's own notifications -- any role (admin/enterprise/learner). */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<NotificationDto> myNotifications(@AuthenticationPrincipal Jwt jwt) {
        return notificationService.forUser(currentUserId(jwt));
    }

    @PutMapping("/{notificationId}/read")
    public void markRead(@AuthenticationPrincipal Jwt jwt, @PathVariable Long notificationId) {
        notificationService.markRead(currentUserId(jwt), notificationId);
    }

    private Long currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        return auth.syncCurrentUser(jwt, jwt.getTokenValue()).userId();
    }
}
