package com.capstone.rebyu.bkt.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.bkt.dto.BktOutboxAdminView;
import com.capstone.rebyu.bkt.dto.BktReconciliationSummary;
import com.capstone.rebyu.bkt.entity.BktOutboxStatus;
import com.capstone.rebyu.bkt.service.BktAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Admin operations for the BKT outbox and reconciliation, restricted to the ADMIN role. */
@RestController
@RequestMapping("/api/admin/bkt")
@RequiredArgsConstructor
public class BktAdminController {

    private final BktAdminService adminService;
    private final CognitoAuthService auth;

    @GetMapping("/outbox/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Long> outboxStats(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminService.outboxStats();
    }

    @GetMapping("/outbox/dead-letter")
    @PreAuthorize("hasRole('ADMIN')")
    public List<BktOutboxAdminView> deadLetter(
            @RequestParam(defaultValue = "100") int limit, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminService.deadLetter(limit);
    }

    @GetMapping("/outbox")
    @PreAuthorize("hasRole('ADMIN')")
    public List<BktOutboxAdminView> byStatus(
            // FAILED is a reserved, not-yet-used status (see BktOutboxStatus)
            // -- the dispatcher only ever produces PENDING/PROCESSING/
            // PROCESSED/DEAD_LETTER, so defaulting here to FAILED silently
            // returned nothing. DEAD_LETTER is the status admins actually
            // need to see by default.
            @RequestParam(defaultValue = "DEAD_LETTER") BktOutboxStatus status,
            @RequestParam(defaultValue = "100") int limit,
            @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminService.byStatus(status, limit);
    }

    @PostMapping("/outbox/{id}/retry")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> retry(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return Map.of("retried", adminService.retry(id));
    }

    @PostMapping("/outbox/dead-letter/retry")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> retryDeadLetter(
            @RequestParam(defaultValue = "100") int limit, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return Map.of("retried", adminService.retryDeadLetter(limit));
    }

    @PostMapping("/reconcile")
    @PreAuthorize("hasRole('ADMIN')")
    public BktReconciliationSummary reconcile(
            @RequestParam(defaultValue = "200") int limit, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminService.reconcile(limit);
    }

    private CurrentUserDto requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
        return user;
    }
}
