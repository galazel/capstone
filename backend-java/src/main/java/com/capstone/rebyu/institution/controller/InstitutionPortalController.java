package com.capstone.rebyu.institution.controller;

import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.institution.service.InstitutionMemberProvisioningService;
import com.capstone.rebyu.institution.service.InstitutionMemberProvisioningService.InviteResult;
import com.capstone.rebyu.institution.service.InstitutionLearningStatsService;
import com.capstone.rebyu.institution.service.InstitutionPortalService;
import com.capstone.rebyu.institution.dto.InstitutionMemberInviteRequestDto;
import com.capstone.rebyu.institution.dto.InstitutionLearningStatsDtos.InstitutionLearningStatsDto;
import com.capstone.rebyu.institution.dto.InstitutionLearningStatsDtos.GroupProgressDto;
import com.capstone.rebyu.institution.dto.InstitutionPortalDtos.OverviewDto;
import com.capstone.rebyu.organization.dto.InstitutionDto;
import com.capstone.rebyu.organization.dto.InstitutionMemberDto;
import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.organization.repository.InstitutionRepository;
import com.capstone.rebyu.organization.service.InstitutionMemberService;
import com.capstone.rebyu.organization.service.InstitutionService;
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

/** Tenant-scoped institution portal reads; institutionId always comes from the caller's JWT. */
@RestController
@RequestMapping("/api/institution/me")
@RequiredArgsConstructor
public class InstitutionPortalController {

    private final InstitutionPortalService portalService;
    private final InstitutionLearningStatsService learningStatsService;
    private final InstitutionService institutionService;
    private final InstitutionMemberService institutionMemberService;
    private final InstitutionMemberProvisioningService institutionMemberProvisioningService;
    private final InstitutionRepository institutionRepository;
    private final CognitoAuthService auth;

    /** The caller's own organization profile (name, contact, address, etc.). */
    @GetMapping("/profile")
    public InstitutionDto profile(@AuthenticationPrincipal Jwt jwt) {
        return institutionService.getById(myInstitutionId(jwt));
    }

    @GetMapping("/overview")
    public OverviewDto overview(@AuthenticationPrincipal Jwt jwt) {
        return portalService.overview(myInstitutionId(jwt));
    }

    /**
     * Learning statistics for the caller's own organization: a roster-wide
     * rollup plus a row per member (progress, lessons finished, graded attempts,
     * pass rate, average score, last activity).
     */
    @GetMapping("/learning-stats")
    public InstitutionLearningStatsDto learningStats(@AuthenticationPrincipal Jwt jwt) {
        return learningStatsService.learningStats(myInstitutionId(jwt));
    }

    /** Completion per learning group, for the group-analytics panels. */
    @GetMapping("/group-stats")
    public List<GroupProgressDto> groupStats(@AuthenticationPrincipal Jwt jwt) {
        return learningStatsService.groupProgress(myInstitutionId(jwt));
    }

    /** Every member of the caller's own organization (owners, managers, staff). */
    @GetMapping("/members")
    public List<InstitutionMemberDto> members(@AuthenticationPrincipal Jwt jwt) {
        return institutionMemberService.getByInstitutionId(myInstitutionId(jwt));
    }

    /**
     * Creates a brand-new login account for someone the institution wants to
     * manage a group (or otherwise act on the org's behalf) -- e.g. a group
     * leader. A Cognito account is minted and credentials are emailed to them,
     * the same way the institution's own account was created on approval.
     */
    @PostMapping("/members")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResult inviteMember(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody InstitutionMemberInviteRequestDto request) {
        Long institutionId = myInstitutionId(jwt);
        Institution institution = institutionRepository.findById(institutionId)
                .orElseThrow(() -> new EntityNotFoundException("Institution not found: " + institutionId));
        return institutionMemberProvisioningService.inviteMember(institution, request);
    }

    /** Exam results for one of the caller's own learners; 404 for learners outside the tenant. */
    @GetMapping("/learners/{learnerId}/exam-results")
    public List<ExamResultDto> learnerExamResults(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long learnerId) {
        return portalService.learnerExamResults(myInstitutionId(jwt), learnerId);
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
