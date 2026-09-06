package com.capstone.rebyu.enrollment.controller;

import com.capstone.rebyu.enrollment.dto.PurchaseDtos.*;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.enrollment.service.EnrollmentTransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Learner-facing purchase and enrollment transaction endpoints.
 *
 * <p>The buyer is the token's learner, never the {@code learnerId} in the body.
 * This path had no authentication at all, so both endpoints below would open an
 * order and confirm its payment for whatever learner id an anonymous caller
 * named -- enrolling strangers in certifications and marking those enrolments
 * paid. The id is still accepted (it is {@code @NotNull}, so rejecting it would
 * 400 the current frontend before this class ran) and ignored.
 */
@RestController
@RequestMapping("/api/learner")
@RequiredArgsConstructor
public class LearnerEnrollmentController {

    private final EnrollmentTransactionService enrollmentTransactionService;
    private final CognitoAuthService auth;

    /** The learner making this request, from the token and nothing else. */
    private Long me(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return user.learnerId();
    }

    @PostMapping("/certifications/{certificationId}/purchase")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseTransactionDto purchase(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long certificationId,
            @Valid @RequestBody PurchaseRequestDto request) {
        return enrollmentTransactionService.purchase(
                certificationId, me(jwt), request.idempotencyKey());
    }

    @PostMapping("/purchases/{transactionId}/confirm")
    public PurchaseTransactionDto confirm(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long transactionId,
            @Valid @RequestBody ConfirmPaymentRequestDto request) {
        return enrollmentTransactionService.confirmPayment(
                transactionId, me(jwt), request.paymentReference());
    }

    @GetMapping("/enrollments")
    public List<LearnerEnrollmentDto> getEnrollments(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long learnerId) {
        return enrollmentTransactionService.getEnrollments(me(jwt));
    }
}
