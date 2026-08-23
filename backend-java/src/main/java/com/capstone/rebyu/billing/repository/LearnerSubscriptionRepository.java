package com.capstone.rebyu.billing.repository;

import com.capstone.rebyu.billing.entity.LearnerSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LearnerSubscriptionRepository extends JpaRepository<LearnerSubscription, Long> {

    List<LearnerSubscription> findByLearner_LearnerIdOrderByCreatedAtDesc(Long learnerId);

    List<LearnerSubscription> findByLearner_LearnerId(Long learnerId);

    /** The learner's most recent subscription, whatever its status. */
    Optional<LearnerSubscription> findFirstByLearner_LearnerIdOrderByCreatedAtDesc(Long learnerId);

    /** Lookup subscription by PayMongo subscription ID. */
    Optional<LearnerSubscription> findByProviderSubscriptionId(String providerSubscriptionId);

    long countByStatusIn(java.util.Collection<com.capstone.rebyu.billing.entity.BillingStatus> statuses);
}
