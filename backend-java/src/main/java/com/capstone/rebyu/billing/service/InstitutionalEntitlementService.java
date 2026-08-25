package com.capstone.rebyu.billing.service;

import com.capstone.rebyu.billing.dto.EntitlementDtos.InstitutionalLicenseDto;
import com.capstone.rebyu.billing.dto.EntitlementDtos.UsageMetricDto;
import com.capstone.rebyu.billing.entitlement.CapacityLimitReachedException;
import com.capstone.rebyu.billing.entitlement.Entitlements;
import com.capstone.rebyu.billing.entitlement.InstitutionalEntitlementRequiredException;
import com.capstone.rebyu.billing.entity.InstitutionalLicense;
import com.capstone.rebyu.billing.entity.PlanEntitlement;
import com.capstone.rebyu.billing.repository.InstitutionalLicenseRepository;
import com.capstone.rebyu.billing.repository.PlanEntitlementRepository;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAuthorityRepository;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Centralized institutional (B2B) entitlement + capacity authority. Everything
 * derives from the institution's active license and validated usage counts —
 * never from stored counters the caller supplies.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InstitutionalEntitlementService {

    private final InstitutionalLicenseRepository licenseRepository;
    private final PlanEntitlementRepository planEntitlementRepository;
    private final OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private final OrganizationCertificateRepository orgCertificateRepository;
    private final InstitutionGroupRepository groupRepository;
    private final InstitutionGroupAuthorityRepository authorityRepository;

    @Transactional(readOnly = true)
    public Optional<InstitutionalLicense> getCurrentInstitutionalLicense(Long institutionId) {
        return licenseRepository.findFirstByInstitution_InstitutionIdOrderByCreatedAtDesc(institutionId);
    }

    /** The most recent license that currently grants access, if any. */
    @Transactional(readOnly = true)
    public Optional<InstitutionalLicense> getActiveLicense(Long institutionId) {
        return licenseRepository.findByInstitution_InstitutionIdOrderByCreatedAtDesc(institutionId).stream()
                .filter(InstitutionalLicense::isCurrentlyActive)
                .findFirst();
    }

    /** Enabled entitlements of the active license's plan, keyed by code. */
    @Transactional(readOnly = true)
    public Map<String, PlanEntitlement> getInstitutionalEntitlements(Long institutionId) {
        return getActiveLicense(institutionId)
                .map(this::planEntitlements)
                .orElse(Map.of());
    }

    @Transactional(readOnly = true)
    public boolean hasInstitutionalEntitlement(Long institutionId, String entitlementCode) {
        return getInstitutionalEntitlements(institutionId).containsKey(entitlementCode);
    }

    @Transactional(readOnly = true)
    public void requireInstitutionalEntitlement(Long institutionId, String entitlementCode) {
        if (!hasInstitutionalEntitlement(institutionId, entitlementCode)) {
            throw new InstitutionalEntitlementRequiredException(entitlementCode);
        }
    }

    @Transactional(readOnly = true)
    public InstitutionalLicenseDto getLicenseUsageSummary(Long institutionId) {
        InstitutionalLicense license = getActiveLicense(institutionId).orElse(null);
        if (license == null) {
            return new InstitutionalLicenseDto(
                    null, institutionId, null, null, null, null, "NONE",
                    null, null, false, Set.of(), List.of());
        }
        Map<String, PlanEntitlement> entitlements = planEntitlements(license);
        List<UsageMetricDto> usage = List.of(
                metric(Entitlements.SEAT_LIMIT, seatsUsed(institutionId), seatLimit(license, entitlements)),
                metric(Entitlements.GROUP_LIMIT, groupsUsed(institutionId), limit(license.getCustomGroupLimit(), entitlements, Entitlements.GROUP_LIMIT)),
                metric(Entitlements.AUTHORITY_LIMIT, authoritiesUsed(institutionId), limit(license.getCustomAuthorityLimit(), entitlements, Entitlements.AUTHORITY_LIMIT)),
                metric(Entitlements.CERTIFICATION_ALLOCATION_LIMIT, certificationsUsed(institutionId),
                        limit(license.getCustomCertificationLimit(), entitlements, Entitlements.CERTIFICATION_ALLOCATION_LIMIT))
        );
        return new InstitutionalLicenseDto(
                license.getInstitutionalLicenseId(),
                institutionId,
                license.getSubscriptionPlan().getPlanCode(),
                license.getSubscriptionPlan().getPlanName(),
                license.getSubscriptionPlan().getBillingInterval().name(),
                license.getContractNumber(),
                license.getLicenseStatus().name(),
                license.getCurrentPeriodStart(),
                license.getCurrentPeriodEnd(),
                license.isCancelAtPeriodEnd(),
                entitlements.keySet(),
                usage);
    }

    // ----- capacity checks (throw on limit reached) -----

    @Transactional(readOnly = true)
    public void requireAvailableLearnerSeat(Long institutionId) {
        InstitutionalLicense license = requireActiveLicense(institutionId);
        int limit = seatLimit(license, planEntitlements(license));
        checkCapacity("LEARNER_SEAT_LIMIT_REACHED", seatsUsed(institutionId), limit,
                "The institutional learner-seat limit has been reached.");
    }

    @Transactional(readOnly = true)
    public void requireAvailableGroupCapacity(Long institutionId) {
        InstitutionalLicense license = requireActiveLicense(institutionId);
        int limit = limit(license.getCustomGroupLimit(), planEntitlements(license), Entitlements.GROUP_LIMIT);
        checkCapacity("GROUP_LIMIT_REACHED", groupsUsed(institutionId), limit,
                "The institutional group limit has been reached.");
    }

    @Transactional(readOnly = true)
    public void requireAvailableAuthorityCapacity(Long institutionId) {
        InstitutionalLicense license = requireActiveLicense(institutionId);
        int limit = limit(license.getCustomAuthorityLimit(), planEntitlements(license), Entitlements.AUTHORITY_LIMIT);
        checkCapacity("AUTHORITY_LIMIT_REACHED", authoritiesUsed(institutionId), limit,
                "The institutional authority limit has been reached.");
    }

    @Transactional(readOnly = true)
    public void requireAvailableCertificationCapacity(Long institutionId) {
        InstitutionalLicense license = requireActiveLicense(institutionId);
        int limit = limit(license.getCustomCertificationLimit(), planEntitlements(license),
                Entitlements.CERTIFICATION_ALLOCATION_LIMIT);
        checkCapacity("CERTIFICATION_ALLOCATION_LIMIT_REACHED", certificationsUsed(institutionId), limit,
                "The institutional certification-allocation limit has been reached.");
    }

    // ----- internals -----

    private InstitutionalLicense requireActiveLicense(Long institutionId) {
        return getActiveLicense(institutionId).orElseThrow(() ->
                new InstitutionalEntitlementRequiredException(
                        "INSTITUTIONAL_LICENSE",
                        "This organization does not have an active institutional license."));
    }

    private Map<String, PlanEntitlement> planEntitlements(InstitutionalLicense license) {
        return planEntitlementRepository
                .findBySubscriptionPlan_SubscriptionPlanId(license.getSubscriptionPlan().getSubscriptionPlanId())
                .stream()
                .filter(PlanEntitlement::isEnabled)
                .collect(Collectors.toMap(PlanEntitlement::getEntitlementCode, entitlement -> entitlement,
                        (existing, ignored) -> existing));
    }

    private int seatsUsed(Long institutionId) {
        return (int) orgCertLearnerRepository.countDistinctActiveLearners(
                institutionId, OrganizationCertificationLearner.Status.active);
    }

    private int groupsUsed(Long institutionId) {
        return (int) groupRepository.countByInstitution_InstitutionIdAndStatus(
                institutionId, InstitutionGroup.Status.active);
    }

    private int authoritiesUsed(Long institutionId) {
        return (int) authorityRepository.countDistinctActiveAuthorities(
                institutionId, InstitutionGroupAuthority.Status.active);
    }

    private int certificationsUsed(Long institutionId) {
        return (int) orgCertificateRepository.countByInstitution_InstitutionIdAndStatus(
                institutionId, OrganizationCertificate.Status.active);
    }

    private int seatLimit(InstitutionalLicense license, Map<String, PlanEntitlement> entitlements) {
        return limit(license.getCustomSeatLimit(), entitlements, Entitlements.SEAT_LIMIT);
    }

    /** Custom contract override wins; otherwise the plan's limit; else 0. */
    private int limit(Integer customLimit, Map<String, PlanEntitlement> entitlements, String code) {
        if (customLimit != null) {
            return customLimit;
        }
        PlanEntitlement entitlement = entitlements.get(code);
        return entitlement != null && entitlement.getLimitValue() != null ? entitlement.getLimitValue() : 0;
    }

    private void checkCapacity(String code, int used, int limit, String message) {
        if (used >= limit) {
            throw new CapacityLimitReachedException(code, limit, used, message);
        }
    }

    private UsageMetricDto metric(String code, int used, int limit) {
        return new UsageMetricDto(code, used, limit);
    }
}
