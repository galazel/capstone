package com.capstone.rebyu.billing.service;

import com.capstone.rebyu.billing.entity.BillingStatus;
import com.capstone.rebyu.billing.entity.LearnerSubscription;
import com.capstone.rebyu.billing.repository.LearnerSubscriptionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PaymentWebhookService {

    private final LearnerSubscriptionRepository learnerSubscriptionRepository;

    /**
     * Handle charge.updated event from PayMongo.
     * Marks a one-time payment as successful.
     */
    public void handleChargeUpdated(JsonNode chargeData) {
        String chargeId = chargeData.path("id").asText();
        String status = chargeData.path("attributes").path("status").asText();

        log.info("Processing charge update: {} status={}", chargeId, status);

        if ("succeeded".equals(status)) {
            handleChargeSucceeded(chargeData);
        }
    }

    /**
     * Handle charge.failed event from PayMongo.
     * Marks subscription as failed.
     */
    public void handleChargeFailed(JsonNode chargeData) {
        String chargeId = chargeData.path("id").asText();
        log.warn("Charge failed: {}", chargeId);
        // Find and mark subscription as failed
    }

    /**
     * Handle subscription.updated event from PayMongo.
     * Sync subscription status (active, canceled, etc.).
     */
    public void handleSubscriptionUpdated(JsonNode subscriptionData) {
        String payMongoSubId = subscriptionData.path("id").asText();
        String status = subscriptionData.path("attributes").path("status").asText();
        String currentPeriodEnd = subscriptionData.path("attributes").path("current_period_end").asText();

        log.info("Processing subscription update: {} status={}", payMongoSubId, status);

        Optional<LearnerSubscription> sub = learnerSubscriptionRepository
                .findByProviderSubscriptionId(payMongoSubId);
        if (sub.isPresent()) {
            LearnerSubscription subscription = sub.get();
            subscription.setStatus(mapPayMongoStatus(status));
            if ("active".equals(status)) {
                subscription.setStartedAt(LocalDateTime.now());
                subscription.setCurrentPeriodStart(LocalDateTime.now());
                subscription.setCurrentPeriodEnd(parseDateTime(currentPeriodEnd));
            }
            learnerSubscriptionRepository.save(subscription);
        }
    }

    /**
     * Handle subscription.payment.successful event from PayMongo.
     * Marks a subscription payment as successful.
     */
    public void handleSubscriptionPaymentSuccessful(JsonNode paymentData) {
        String payMongoSubId = paymentData.path("attributes").path("subscription_id").asText();
        log.info("Subscription payment successful: {}", payMongoSubId);

        Optional<LearnerSubscription> sub = learnerSubscriptionRepository
                .findByProviderSubscriptionId(payMongoSubId);
        if (sub.isPresent()) {
            LearnerSubscription subscription = sub.get();
            subscription.setStatus(BillingStatus.ACTIVE);
            learnerSubscriptionRepository.save(subscription);
        }
    }

    /**
     * Handle subscription.payment.failed event from PayMongo.
     * Marks a subscription payment as failed.
     */
    public void handleSubscriptionPaymentFailed(JsonNode paymentData) {
        String payMongoSubId = paymentData.path("attributes").path("subscription_id").asText();
        log.warn("Subscription payment failed: {}", payMongoSubId);

        Optional<LearnerSubscription> sub = learnerSubscriptionRepository
                .findByProviderSubscriptionId(payMongoSubId);
        if (sub.isPresent()) {
            LearnerSubscription subscription = sub.get();
            subscription.setStatus(BillingStatus.PAYMENT_FAILED);
            learnerSubscriptionRepository.save(subscription);
        }
    }

    private void handleChargeSucceeded(JsonNode chargeData) {
        JsonNode metadata = chargeData.path("attributes").path("metadata");
        Long learnerId = metadata.path("learnerId").asLong();
        Long planId = metadata.path("planId").asLong();
        String chargeId = chargeData.path("id").asText();

        // Create or update subscription for this learner
        LearnerSubscription subscription = LearnerSubscription.builder()
                .learner(new com.capstone.rebyu.user.entity.Learner() {
                    {
                        this.learnerId = learnerId;
                    }
                })
                .subscriptionPlan(new com.capstone.rebyu.billing.entity.SubscriptionPlan() {
                    {
                        this.subscriptionPlanId = planId;
                    }
                })
                .provider("PAYMONGO")
                .providerSubscriptionId(chargeId)
                .status(BillingStatus.ACTIVE)
                .startedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        learnerSubscriptionRepository.save(subscription);
        log.info("Subscription activated for learner: {}", learnerId);
    }

    private BillingStatus mapPayMongoStatus(String payMongoStatus) {
        return switch (payMongoStatus) {
            case "active" -> BillingStatus.ACTIVE;
            case "canceled" -> BillingStatus.CANCELED;
            case "trialing" -> BillingStatus.TRIAL;
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
