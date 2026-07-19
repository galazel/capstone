package com.capstone.rebyu.enterprise;

import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enterprise.dto.EnterprisePortalDtos.OverviewDto;
import com.capstone.rebyu.organization.dto.EnterpriseDto;
import com.capstone.rebyu.organization.service.EnterpriseService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Tenant-scoped enterprise portal reads; enterpriseId always comes from the caller's JWT. */
@RestController
@RequestMapping("/api/enterprise/me")
@RequiredArgsConstructor
public class EnterprisePortalController {

    private final EnterprisePortalService portalService;
    private final EnterpriseService enterpriseService;
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
