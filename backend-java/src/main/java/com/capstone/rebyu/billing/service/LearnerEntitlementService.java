package com.capstone.rebyu.billing.service;

import com.capstone.rebyu.billing.dto.EntitlementDtos.AccessSource;
import com.capstone.rebyu.billing.dto.EntitlementDtos.LearnerEntitlementsDto;
import com.capstone.rebyu.billing.dto.EntitlementDtos.LearnerSubscriptionDto;
import com.capstone.rebyu.billing.entitlement.Entitlements;
import com.capstone.rebyu.billing.entitlement.PremiumAccessRequiredException;
import com.capstone.rebyu.billing.entity.InstitutionalLicense;
import com.capstone.rebyu.billing.entity.LearnerSubscription;
import com.capstone.rebyu.billing.entity.PlanEntitlement;
import com.capstone.rebyu.billing.repository.LearnerSubscriptionRepository;
import com.capstone.rebyu.billing.repository.PlanEntitlementRepository;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Centralized learner (B2C) entitlement authority. Missing subscription = Free.
 * Combines personal Pro with institution-sponsored coverage. The caller passes
 * a learnerId already resolved from the authenticated identity — never a raw
 * client value used as proof of identity.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerEntitlementService {

    /** Always granted to any authenticated learner. */
    private static final Set<String> FREE_FEATURES = Set.of(
            Entitlements.CERTIFICATION_BROWSING,
            Entitlements.LESSON_ACCESS,
            Entitlements.BASIC_LEARNING,
            Entitlements.BASIC_COMPLETION_TRACKING);

    private final LearnerSubscriptionRepository learnerSubscriptionRepository;
    private final PlanEntitlementRepository planEntitlementRepository;
    private final OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private final InstitutionalEntitlementService institutionalEntitlementService;

    @Transactional(readOnly = true)
    public Optional<LearnerSubscription> getCurrentLearnerSubscription(Long learnerId) {
        return learnerSubscriptionRepository.findFirstByLearner_LearnerIdOrderByCreatedAtDesc(learnerId);
    }

    @Transactional(readOnly = true)
    public LearnerSubscriptionDto getSubscriptionView(Long learnerId) {
        LearnerSubscription subscription = getCurrentLearnerSubscription(learnerId).orElse(null);
        if (subscription == null) {
            return null;
        }
        var plan = subscription.getSubscriptionPlan();
        return new LearnerSubscriptionDto(
                subscription.getLearnerSubscriptionId(),
                learnerId,
                plan.getPlanCode(),
                plan.getPlanName(),
                plan.getAmount(),
                plan.getCurrency(),
                plan.getBillingInterval().name(),
                subscription.getStatus().name(),
                subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd(),
                subscription.isCancelAtPeriodEnd(),
                subscription.getCanceledAt());
    }

    @Transactional(readOnly = true)
    public boolean hasActiveProSubscription(Long learnerId) {
        return getCurrentLearnerSubscription(learnerId)
                .filter(LearnerSubscription::isCurrentlyActive)
                .filter(subscription -> !subscription.getSubscriptionPlan().isFree())
                .isPresent();
    }

    @Transactional(readOnly = true)
    public LearnerEntitlementsDto getEffectiveEntitlements(Long learnerId, Long certificationId) {
        Set<String> features = new HashSet<>(FREE_FEATURES);

        LearnerSubscription subscription = getCurrentLearnerSubscription(learnerId).orElse(null);
        boolean proActive = subscription != null
                && subscription.isCurrentlyActive()
                && !subscription.getSubscriptionPlan().isFree();
        if (proActive) {
            features.addAll(planFeatures(subscription.getSubscriptionPlan().getSubscriptionPlanId()));
        }

        Set<String> institutionalFeatures = institutionalCoverage(learnerId, certificationId);
        boolean institutionalActive = !institutionalFeatures.isEmpty();
        features.addAll(institutionalFeatures);

        AccessSource source;
        if (proActive && institutionalActive) {
            source = AccessSource.BOTH;
        } else if (proActive) {
            source = AccessSource.PERSONAL_PRO;
        } else if (institutionalActive) {
            source = AccessSource.INSTITUTIONAL_LICENSE;
        } else {
            source = AccessSource.FREE;
        }

        return new LearnerEntitlementsDto(
                learnerId,
                source,
                proActive,
                institutionalActive,
                features,
                subscription == null ? "FREE" : subscription.getSubscriptionPlan().getPlanCode(),
                subscription == null ? null : subscription.getStatus().name(),
                subscription == null ? null : subscription.getCurrentPeriodEnd(),
                subscription != null && subscription.isCancelAtPeriodEnd());
    }

    @Transactional(readOnly = true)
    public boolean hasLearnerEntitlement(Long learnerId, String feature, Long certificationId) {
        if (FREE_FEATURES.contains(feature)) {
            return true;
        }
        return getEffectiveEntitlements(learnerId, certificationId).features().contains(feature);
    }

    @Transactional(readOnly = true)
    public void requireLearnerEntitlement(Long learnerId, String feature, Long certificationId) {
        if (!hasLearnerEntitlement(learnerId, feature, certificationId)) {
            throw new PremiumAccessRequiredException(feature);
        }
    }

    // ----- internals -----

    /**
     * Institution-sponsored features for this learner. Coverage requires an
     * active org-cert-learner assignment whose institution holds an active
     * license; when a certification is given, the assignment must match it.
     */
    private Set<String> institutionalCoverage(Long learnerId, Long certificationId) {
        Set<String> features = new HashSet<>();
        for (OrganizationCertificationLearner assignment :
                orgCertLearnerRepository.findByLearner_LearnerIdAndStatus(
                        learnerId, OrganizationCertificationLearner.Status.active)) {
            var orgCert = assignment.getOrgCert();
            if (orgCert == null || orgCert.getInstitution() == null) {
                continue;
            }
            if (certificationId != null
                    && (orgCert.getCertification() == null
                    || !Objects.equals(orgCert.getCertification().getCertificationId(), certificationId))) {
                continue;
            }
            Optional<InstitutionalLicense> license = institutionalEntitlementService
                    .getActiveLicense(orgCert.getInstitution().getInstitutionId());
            if (license.isPresent()) {
                features.addAll(institutionalEntitlementService
                        .getInstitutionalEntitlements(orgCert.getInstitution().getInstitutionId())
                        .keySet());
            }
        }
        return features;
    }

    private Set<String> planFeatures(Long subscriptionPlanId) {
        Set<String> codes = new HashSet<>();
        for (PlanEntitlement entitlement :
                planEntitlementRepository.findBySubscriptionPlan_SubscriptionPlanId(subscriptionPlanId)) {
            if (entitlement.isEnabled()) {
                codes.add(entitlement.getEntitlementCode());
            }
        }
        return codes;
    }
}
