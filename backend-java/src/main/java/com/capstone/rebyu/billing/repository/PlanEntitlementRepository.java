package com.capstone.rebyu.billing.repository;

import com.capstone.rebyu.billing.entity.PlanEntitlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlanEntitlementRepository extends JpaRepository<PlanEntitlement, Long> {
    List<PlanEntitlement> findBySubscriptionPlan_SubscriptionPlanId(Long subscriptionPlanId);

    // Safe as an Optional: (subscription_plan_id, entitlement_code) is a unique
    // constraint on plan_entitlements, so this can only ever match 0 or 1 row.
    Optional<PlanEntitlement> findBySubscriptionPlan_SubscriptionPlanIdAndEntitlementCode(
            Long subscriptionPlanId, String entitlementCode);
}
