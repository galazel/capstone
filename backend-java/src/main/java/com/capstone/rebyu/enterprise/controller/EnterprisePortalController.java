package com.capstone.rebyu.enterprise.controller;

import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enterprise.service.EnterpriseMemberProvisioningService;
import com.capstone.rebyu.enterprise.service.EnterpriseMemberProvisioningService.InviteResult;
import com.capstone.rebyu.enterprise.service.EnterprisePortalService;
import com.capstone.rebyu.enterprise.dto.EnterpriseMemberInviteRequestDto;
import com.capstone.rebyu.enterprise.dto.EnterprisePortalDtos.OverviewDto;
import com.capstone.rebyu.organization.dto.EnterpriseDto;
import com.capstone.rebyu.organization.dto.EnterpriseMemberDto;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.repository.EnterpriseRepository;
import com.capstone.rebyu.organization.service.EnterpriseMemberService;
import com.capstone.rebyu.organization.service.EnterpriseService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Tenant-scoped enterprise portal reads; enterpriseId always comes from the caller's JWT. */
@RestController
@RequestMapping("/api/enterprise/me")
@RequiredArgsConstructor
public class EnterprisePortalController {

    private final EnterprisePortalService portalService;
    private final EnterpriseService enterpriseService;
    private final EnterpriseMemberService enterpriseMemberService;
    private final EnterpriseMemberProvisioningService enterpriseMemberProvisioningService;
    private final EnterpriseRepository enterpriseRepository;
    private final CognitoAuthService auth;

    /** The caller's own organization profile (name, contact, address, etc.). */
    @GetMapping("/profile")
    public EnterpriseDto profile(@AuthenticationPrincipal Jwt jwt) {
        return enterpriseService.getById(myEnterpriseId(jwt));
    }

    @GetMapping("/overview")
    public OverviewDto overview(@AuthenticationPrincipal Jwt jwt) {
        return portalService.overview(myEnterpriseId(jwt));
    }

    /** Every member of the caller's own organization (owners, managers, staff). */
    @GetMapping("/members")
    public List<EnterpriseMemberDto> members(@AuthenticationPrincipal Jwt jwt) {
        return enterpriseMemberService.getByEnterpriseId(myEnterpriseId(jwt));
    }

    /**
     * Creates a brand-new login account for someone the enterprise wants to
     * manage a group (or otherwise act on the org's behalf) -- e.g. a group
     * leader. A Cognito account is minted and credentials are emailed to them,
     * the same way the enterprise's own account was created on approval.
     */
    @PostMapping("/members")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResult inviteMember(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody EnterpriseMemberInviteRequestDto request) {
        Long enterpriseId = myEnterpriseId(jwt);
        Enterprise enterprise = enterpriseRepository.findById(enterpriseId)
                .orElseThrow(() -> new EntityNotFoundException("Enterprise not found: " + enterpriseId));
        return enterpriseMemberProvisioningService.inviteMember(enterprise, request);
    }

    /** Exam results for one of the caller's own learners; 404 for learners outside the tenant. */
    @GetMapping("/learners/{learnerId}/exam-results")
    public List<ExamResultDto> learnerExamResults(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long learnerId) {
        return portalService.learnerExamResults(myEnterpriseId(jwt), learnerId);
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
