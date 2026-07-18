package com.capstone.rebyu.billing.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.billing.client.PayMongoClient;
import com.capstone.rebyu.billing.entity.SubscriptionPlan;
import com.capstone.rebyu.billing.repository.SubscriptionPlanRepository;
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

        if (!plan.isIsFree()) {
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
     * Verify payment status after learner returns from hosted checkout.
     * This is called by the frontend after redirect.
     */
    @GetMapping("/verify/{sessionId}")
    public ResponseEntity<?> verifyPayment(
            @PathVariable String sessionId,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
        }

        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        boolean isPaid = payMongoClient.isPaymentSuccessful(sessionId);

        if (isPaid) {
            log.info("Payment verified for learner={}, session={}", user.learnerId(), sessionId);
            return ResponseEntity.ok(Map.of("status", "success", "message", "Payment successful"));
        } else {
            return ResponseEntity.ok(Map.of("status", "pending", "message", "Payment still processing"));
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
