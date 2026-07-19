package com.capstone.rebyu.billing.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.billing.client.PayMongoClient;
import com.capstone.rebyu.billing.entity.LearnerSubscription;
import com.capstone.rebyu.billing.entity.SubscriptionPlan;
import com.capstone.rebyu.billing.repository.SubscriptionPlanRepository;
import com.capstone.rebyu.billing.service.PaymentWebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/subscription")
@RequiredArgsConstructor
public class SubscriptionCheckoutController {

    private final PayMongoClient payMongoClient;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final PaymentWebhookService paymentWebhookService;
    private final CognitoAuthService auth;

    /**
     * Initiate PayMongo hosted checkout for a subscription plan.
     * Returns the PayMongo checkout URL.
     */
    @PostMapping("/checkout/{planId}")
    public ResponseEntity<?> initiateCheckout(
            @PathVariable Long planId,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
        }

        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Learner account required"));
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Plan not found: " + planId));

        if (plan.isFree()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only premium plans can be purchased"));
        }

        // Create hosted checkout
        String checkoutUrl = payMongoClient.createHostedCheckout(
                user.learnerId(),
                planId,
                plan.getPlanCode(),
                plan.getAmount().multiply(java.math.BigDecimal.valueOf(100)).longValue(),
                plan.getPlanName()
        );

        if (checkoutUrl == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to create checkout"));
        }

        log.info("Checkout initiated for learner={}, plan={}", user.learnerId(), planId);
        return ResponseEntity.ok(Map.of("checkout_url", checkoutUrl));
    }

    /**
     * Verify payment status after learner returns from hosted checkout, and
     * activate the subscription if it's paid. This is the primary activation
     * path (called by the frontend right after redirect) rather than relying
     * solely on the webhook, which can't reach this server at all in local
     * dev and isn't guaranteed to arrive promptly even in production.
     * Idempotent: safe to call more than once for the same session.
     */
    @GetMapping("/verify/{sessionId}")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> verifyPayment(
            @PathVariable String sessionId,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Learner account required"));
        }

        Map<String, Object> session = payMongoClient.getCheckoutSession(sessionId);
        if (session == null) {
            return ResponseEntity.ok(Map.of("status", "pending", "message", "Payment still processing"));
        }
        Map<String, Object> attributes = (Map<String, Object>) session.get("attributes");
        if (attributes == null || !"paid".equalsIgnoreCase(String.valueOf(attributes.get("payment_status")))) {
            return ResponseEntity.ok(Map.of("status", "pending", "message", "Payment still processing"));
        }

        Map<String, Object> metadata = (Map<String, Object>) attributes.get("metadata");
        Long metadataLearnerId = metadata != null && metadata.get("learnerId") != null
                ? Long.valueOf(String.valueOf(metadata.get("learnerId"))) : null;
        Long metadataPlanId = metadata != null && metadata.get("planId") != null
                ? Long.valueOf(String.valueOf(metadata.get("planId"))) : null;

        // Never activate a subscription for anyone other than the checkout's
        // original owner, even if the caller somehow knows/guesses another
        // learner's session id.
        if (metadataLearnerId == null || metadataPlanId == null || !metadataLearnerId.equals(user.learnerId())) {
            log.warn("Checkout session {} metadata does not match caller learnerId={}", sessionId, user.learnerId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "This checkout session does not belong to you"));
        }

        LearnerSubscription subscription =
                paymentWebhookService.activateFromCheckoutSession(metadataLearnerId, metadataPlanId, sessionId);
        log.info("Payment verified and subscription activated for learner={}, session={}", user.learnerId(), sessionId);
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Payment successful",
                "subscriptionStatus", subscription.getStatus().name(),
                "currentPeriodEnd", String.valueOf(subscription.getCurrentPeriodEnd())
        ));
    }

    /**
     * Cancel the caller's active subscription. Access continues until the
     * already-paid period ends (cancel-at-period-end), not immediately.
     */
    @PostMapping("/cancel")
    public ResponseEntity<?> cancelSubscription(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Learner account required"));
        }
        try {
            LearnerSubscription subscription = paymentWebhookService.cancelAtPeriodEnd(user.learnerId());
            return ResponseEntity.ok(Map.of(
                    "status", "canceled",
                    "accessUntil", String.valueOf(subscription.getCurrentPeriodEnd())
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get available subscription plans.
     */
    @GetMapping("/plans")
    public ResponseEntity<?> getPlans() {
        var plans = subscriptionPlanRepository.findAll();
        return ResponseEntity.ok(plans);
    }
}
