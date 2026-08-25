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
 * Institution-facing license + entitlement reads. institutionId is always
 * resolved from the caller's validated JWT, never a client-supplied
 * parameter -- previously this took institutionId as a plain @RequestParam
 * with no ownership check and no security-config authentication requirement,
 * so any unauthenticated caller could read any institution's license/billing
 * data by guessing an id.
 */
@RestController
@RequestMapping("/api/institution")
@RequiredArgsConstructor
public class InstitutionalLicenseController {

    private final InstitutionalEntitlementService institutionalEntitlementService;
    private final CognitoAuthService auth;

    @GetMapping("/license")
    public InstitutionalLicenseDto getLicense(@AuthenticationPrincipal Jwt jwt) {
        return institutionalEntitlementService.getLicenseUsageSummary(myInstitutionId(jwt));
    }

    @GetMapping("/license/usage")
    public InstitutionalLicenseDto getLicenseUsage(@AuthenticationPrincipal Jwt jwt) {
        return institutionalEntitlementService.getLicenseUsageSummary(myInstitutionId(jwt));
    }

    @GetMapping("/entitlements")
    public Set<String> getEntitlements(@AuthenticationPrincipal Jwt jwt) {
        return institutionalEntitlementService.getInstitutionalEntitlements(myInstitutionId(jwt)).keySet();
    }

    private Long myInstitutionId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.institutionId() == null) {
            throw new IllegalArgumentException("An institution account is required");
        }
        return user.institutionId();
    }
}
