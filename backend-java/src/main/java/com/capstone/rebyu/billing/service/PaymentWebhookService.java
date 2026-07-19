package com.capstone.rebyu.billing.service;

import com.capstone.rebyu.billing.entity.BillingStatus;
import com.capstone.rebyu.billing.entity.LearnerSubscription;
import com.capstone.rebyu.billing.entity.SubscriptionPlan;
import com.capstone.rebyu.billing.repository.LearnerSubscriptionRepository;
import com.capstone.rebyu.billing.repository.SubscriptionPlanRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PaymentWebhookService {

    private final LearnerSubscriptionRepository learnerSubscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;

    /**
     * Activate (or idempotently re-confirm) a subscription from a completed
     * PayMongo Hosted Checkout Session. This is the one path both the
     * frontend's post-redirect verify call AND the webhook delivery funnel
     * into, so whichever arrives first does the work and the second is a
     * no-op -- there is no dependency on webhook delivery actually reaching
     * this server (which, in local/test-mode dev, it usually can't).
     *
     * <p>{@code providerReference} is the checkout session id: stable, unique
     * per attempt, and already used as the idempotency key.
     */
    public LearnerSubscription activateFromCheckoutSession(
            Long learnerId, Long planId, String providerReference) {
        Optional<LearnerSubscription> existing =
                learnerSubscriptionRepository.findByProviderSubscriptionId(providerReference);
        if (existing.isPresent()) {
            log.info("Checkout session {} already activated a subscription; skipping duplicate.", providerReference);
            return existing.get();
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findById(planId)
                .orElseThrow(() -> new EntityNotFoundException("Subscription plan not found: " + planId));

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime periodEnd = computePeriodEnd(now, plan.getBillingInterval());

        LearnerSubscription subscription = LearnerSubscription.builder()
                .learner(Learner.builder().learnerId(learnerId).build())
                .subscriptionPlan(plan)
                .provider("PAYMONGO")
                .providerSubscriptionId(providerReference)
                .status(BillingStatus.ACTIVE)
                .startedAt(now)
                .currentPeriodStart(now)
                .currentPeriodEnd(periodEnd)
                .createdAt(now)
                .updatedAt(now)
                .build();

        LearnerSubscription saved = learnerSubscriptionRepository.save(subscription);
        log.info("Subscription activated for learner={} plan={} via checkout session={}",
                learnerId, planId, providerReference);
        return saved;
    }

    /** Cancel-at-period-end: access continues until the paid period lapses. */
    public LearnerSubscription cancelAtPeriodEnd(Long learnerId) {
        LearnerSubscription subscription = learnerSubscriptionRepository
                .findFirstByLearner_LearnerIdOrderByCreatedAtDesc(learnerId)
                .orElseThrow(() -> new EntityNotFoundException("No subscription found for learner: " + learnerId));
        if (!subscription.isCurrentlyActive()) {
            throw new IllegalStateException("This subscription is not currently active.");
        }
        subscription.setCancelAtPeriodEnd(true);
        subscription.setCanceledAt(LocalDateTime.now());
        subscription.setUpdatedAt(LocalDateTime.now());
        return learnerSubscriptionRepository.save(subscription);
    }

    private LocalDateTime computePeriodEnd(LocalDateTime start, SubscriptionPlan.BillingInterval interval) {
        if (interval == null) {
            return null;
        }
        return switch (interval) {
            case MONTHLY -> start.plusMonths(1);
            case QUARTERLY -> start.plusMonths(3);
            case SEMI_ANNUAL -> start.plusMonths(6);
            case ANNUAL -> start.plusYears(1);
            // NONE (free) and CUSTOM (institution-negotiated) have no fixed
            // renewal cadence enforced here.
            case NONE, CUSTOM -> null;
        };
    }

    /**
     * checkout_session.payment.paid: the real PayMongo event for the Hosted
     * Checkout Sessions flow this app actually uses. sessionData is the
     * checkout session object nested under the event (data.attributes.data).
     */
    public void handleCheckoutSessionPaymentPaid(JsonNode sessionData) {
        String sessionId = sessionData.path("id").asText();
        JsonNode metadata = sessionData.path("attributes").path("metadata");
        Long learnerId = metadata.path("learnerId").asLong(0);
        Long planId = metadata.path("planId").asLong(0);

        if (sessionId.isBlank() || learnerId <= 0 || planId <= 0) {
            log.warn("checkout_session.payment.paid missing id/metadata; sessionId={} learnerId={} planId={}",
                    sessionId, learnerId, planId);
            return;
        }
        activateFromCheckoutSession(learnerId, planId, sessionId);
    }

    /**
     * A one-time checkout charge failed. There is no subscription to update
     * yet at this point (activation only happens on success), so this is
     * purely observability for now -- surfaced here instead of silently
     * dropped like before.
     */
    public void handleChargeFailed(JsonNode chargeData) {
        String chargeId = chargeData.path("id").asText();
        JsonNode metadata = chargeData.path("attributes").path("metadata");
        Long learnerId = metadata.path("learnerId").asLong(0);
        log.warn("PayMongo charge failed: chargeId={} learnerId={}", chargeId, learnerId);
    }

    /**
     * Legacy charge.updated/charge.succeeded handling, kept for PayMongo
     * event shapes that carry a flat charge object with metadata directly on
     * data.attributes (as opposed to the nested checkout-session shape).
     */
    public void handleChargeUpdated(JsonNode chargeData) {
        String chargeId = chargeData.path("id").asText();
        String status = chargeData.path("attributes").path("status").asText();
        log.info("Processing charge update: {} status={}", chargeId, status);
        if ("succeeded".equals(status)) {
            JsonNode metadata = chargeData.path("attributes").path("metadata");
            Long learnerId = metadata.path("learnerId").asLong(0);
            Long planId = metadata.path("planId").asLong(0);
            if (learnerId > 0 && planId > 0) {
                activateFromCheckoutSession(learnerId, planId, chargeId);
            }
        }
    }

    /** subscription.updated: kept for forward-compatibility if a real recurring PayMongo Subscription is ever created. */
    public void handleSubscriptionUpdated(JsonNode subscriptionData) {
        String payMongoSubId = subscriptionData.path("id").asText();
        String status = subscriptionData.path("attributes").path("status").asText();
        String currentPeriodEnd = subscriptionData.path("attributes").path("current_period_end").asText();

        log.info("Processing subscription update: {} status={}", payMongoSubId, status);

        learnerSubscriptionRepository.findByProviderSubscriptionId(payMongoSubId).ifPresent(subscription -> {
            subscription.setStatus(mapPayMongoStatus(status));
            if ("active".equals(status)) {
                subscription.setCurrentPeriodStart(LocalDateTime.now());
                subscription.setCurrentPeriodEnd(parseDateTime(currentPeriodEnd));
            }
            subscription.setUpdatedAt(LocalDateTime.now());
            learnerSubscriptionRepository.save(subscription);
        });
    }

    public void handleSubscriptionPaymentSuccessful(JsonNode paymentData) {
        String payMongoSubId = paymentData.path("attributes").path("subscription_id").asText();
        log.info("Subscription payment successful: {}", payMongoSubId);
        learnerSubscriptionRepository.findByProviderSubscriptionId(payMongoSubId).ifPresent(subscription -> {
            subscription.setStatus(BillingStatus.ACTIVE);
            subscription.setUpdatedAt(LocalDateTime.now());
            learnerSubscriptionRepository.save(subscription);
        });
    }

    public void handleSubscriptionPaymentFailed(JsonNode paymentData) {
        String payMongoSubId = paymentData.path("attributes").path("subscription_id").asText();
        log.warn("Subscription payment failed: {}", payMongoSubId);
        learnerSubscriptionRepository.findByProviderSubscriptionId(payMongoSubId).ifPresent(subscription -> {
            subscription.setStatus(BillingStatus.PAYMENT_FAILED);
            subscription.setUpdatedAt(LocalDateTime.now());
            learnerSubscriptionRepository.save(subscription);
        });
    }

    private BillingStatus mapPayMongoStatus(String payMongoStatus) {
        return switch (payMongoStatus) {
            case "active" -> BillingStatus.ACTIVE;
            case "canceled" -> BillingStatus.CANCELED;
            case "trialing" -> BillingStatus.TRIALING;
            case "incomplete" -> BillingStatus.PENDING;
            case "incomplete_expired" -> BillingStatus.EXPIRED;
            default -> BillingStatus.PENDING;
        };
    }

    private LocalDateTime parseDateTime(String dateString) {
        if (dateString == null || dateString.isBlank()) return null;
        try {
            ZonedDateTime zdt = ZonedDateTime.parse(dateString);
            return zdt.toLocalDateTime();
        } catch (Exception e) {
            log.warn("Failed to parse date: {}", dateString);
            return null;
        }
    }
}
