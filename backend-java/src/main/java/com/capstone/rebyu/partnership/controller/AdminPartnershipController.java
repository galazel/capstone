package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.AdminPartnershipDtos.PartnershipRequestDetailDto;
import com.capstone.rebyu.partnership.dto.AdminPartnershipDtos.PartnershipRequestSummaryDto;
import com.capstone.rebyu.partnership.dto.AdminPartnershipDtos.ReviewPartnershipRequest;
import com.capstone.rebyu.partnership.service.AdminPartnershipService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Transaction Two: admin review of partnership requests. */
@RestController
@RequestMapping("/api/admin/partnership-requests")
@RequiredArgsConstructor
public class AdminPartnershipController {

    private final AdminPartnershipService adminPartnershipService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<PartnershipRequestSummaryDto> list(
            @RequestParam(value = "status", required = false) String status,
            @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminPartnershipService.list(status);
    }

    @GetMapping("/{requestId}")
    public PartnershipRequestDetailDto detail(
            @PathVariable Long requestId,
            @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminPartnershipService.getDetail(requestId);
    }

    @PutMapping("/{requestId}/approve")
    public PartnershipRequestDetailDto approve(
            @PathVariable Long requestId,
            @RequestBody(required = false) ReviewPartnershipRequest body,
            @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminPartnershipService.approve(
                requestId,
                body != null ? body.remarks() : null,
                reviewerName(jwt));
    }

    @PutMapping("/{requestId}/reject")
    public PartnershipRequestDetailDto reject(
            @PathVariable Long requestId,
            @RequestBody(required = false) ReviewPartnershipRequest body,
            @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return adminPartnershipService.reject(
                requestId,
                body != null ? body.remarks() : null,
                reviewerName(jwt));
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) {
            throw new IllegalArgumentException("Admin access is required");
        }
    }

    // Records who reviewed the request from the authenticated caller.
    private String reviewerName(Jwt jwt) {
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        return user.email();
    }
}
