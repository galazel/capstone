package com.capstone.rebyu.billing.service;

import com.capstone.rebyu.billing.entitlement.Entitlements;
import com.capstone.rebyu.billing.repository.LearnerSubscriptionRepository;
import com.capstone.rebyu.billing.repository.PlanEntitlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Feature gate checker: verifies if a learner has access to a feature
 * based on their active subscription and the plan's entitlements.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EntitlementService {

    private final LearnerSubscriptionRepository learnerSubscriptionRepository;
    private final PlanEntitlementRepository planEntitlementRepository;

    /**
     * Check if a learner has access to a feature.
     * Returns true if they have an active subscription that grants the entitlement.
     */
    public boolean hasAccess(Long learnerId, String entitlementCode) {
        // Get all active subscriptions for this learner
        List<com.capstone.rebyu.billing.entity.LearnerSubscription> subs =
                learnerSubscriptionRepository.findByLearner_LearnerId(learnerId);

        for (var sub : subs) {
            if (!sub.isCurrentlyActive()) continue;

            // Check if this plan grants the entitlement
            var entitlements = planEntitlementRepository
                    .findBySubscriptionPlan_SubscriptionPlanIdAndEntitlementCode(
                            sub.getSubscriptionPlan().getSubscriptionPlanId(),
                            entitlementCode);

            if (entitlements.isPresent() && entitlements.get().isEnabled()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get a limit value for a learner's plan (e.g., SEAT_LIMIT = 75).
     */
    public Integer getLimitValue(Long learnerId, String entitlementCode) {
        List<com.capstone.rebyu.billing.entity.LearnerSubscription> subs =
                learnerSubscriptionRepository.findByLearner_LearnerId(learnerId);

        for (var sub : subs) {
            if (!sub.isCurrentlyActive()) continue;

            var entitlements = planEntitlementRepository
                    .findBySubscriptionPlan_SubscriptionPlanIdAndEntitlementCode(
                            sub.getSubscriptionPlan().getSubscriptionPlanId(),
                            entitlementCode);

            if (entitlements.isPresent() && entitlements.get().getLimitValue() != null) {
                return entitlements.get().getLimitValue();
            }
        }

        return null;
    }

    /**
     * Check if learner has Pro/Premium access (any non-free subscription).
     */
    public boolean isProSubscriber(Long learnerId) {
        return hasAccess(learnerId, Entitlements.DETAILED_PROGRESS);
    }
}
