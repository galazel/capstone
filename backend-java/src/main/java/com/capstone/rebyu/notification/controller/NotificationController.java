package com.capstone.rebyu.notification.controller;

import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.notification.service.NotificationService.NotificationDto;
import com.capstone.rebyu.notification.service.NotificationStreamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/** The signed-in user's own notifications -- any role (admin/enterprise/learner). */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationStreamService streamService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<NotificationDto> myNotifications(@AuthenticationPrincipal Jwt jwt) {
        return notificationService.forUser(currentUserId(jwt));
    }

    /**
     * Live feed of this user's new notifications. Held open by the browser and
     * pushed to as events happen, which is what replaced the old fixed-interval
     * polling of the list endpoint above.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal Jwt jwt) {
        return streamService.subscribe(currentUserId(jwt));
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("unread", notificationService.unreadCount(currentUserId(jwt)));
    }

    @PutMapping("/{notificationId}/read")
    public void markRead(@AuthenticationPrincipal Jwt jwt, @PathVariable Long notificationId) {
        notificationService.markRead(currentUserId(jwt), notificationId);
    }

    @PutMapping("/read-all")
    public Map<String, Integer> markAllRead(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("updated", notificationService.markAllRead(currentUserId(jwt)));
    }

    @DeleteMapping("/{notificationId}")
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long notificationId) {
        notificationService.delete(currentUserId(jwt), notificationId);
    }

    @DeleteMapping
    public Map<String, Integer> deleteAll(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("deleted", notificationService.deleteAll(currentUserId(jwt)));
    }

    private Long currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        return auth.syncCurrentUser(jwt, jwt.getTokenValue()).userId();
    }
}
