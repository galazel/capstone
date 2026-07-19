package com.capstone.rebyu.billing.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.billing.dto.EntitlementDtos.InstitutionalLicenseDto;
import com.capstone.rebyu.billing.service.InstitutionalEntitlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

/**
 * Enterprise-facing license + entitlement reads. enterpriseId is always
 * resolved from the caller's validated JWT, never a client-supplied
 * parameter -- previously this took enterpriseId as a plain @RequestParam
 * with no ownership check and no security-config authentication requirement,
 * so any unauthenticated caller could read any enterprise's license/billing
 * data by guessing an id.
 */
@RestController
@RequestMapping("/api/enterprise")
@RequiredArgsConstructor
public class InstitutionalLicenseController {

    private final InstitutionalEntitlementService institutionalEntitlementService;
    private final CognitoAuthService auth;

    @GetMapping("/license")
    public InstitutionalLicenseDto getLicense(@AuthenticationPrincipal Jwt jwt) {
        return institutionalEntitlementService.getLicenseUsageSummary(myEnterpriseId(jwt));
    }

    @GetMapping("/license/usage")
    public InstitutionalLicenseDto getLicenseUsage(@AuthenticationPrincipal Jwt jwt) {
        return institutionalEntitlementService.getLicenseUsageSummary(myEnterpriseId(jwt));
    }

    @GetMapping("/entitlements")
    public Set<String> getEntitlements(@AuthenticationPrincipal Jwt jwt) {
        return institutionalEntitlementService.getInstitutionalEntitlements(myEnterpriseId(jwt)).keySet();
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
