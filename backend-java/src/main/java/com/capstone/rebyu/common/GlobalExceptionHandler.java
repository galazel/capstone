package com.capstone.rebyu.common;

import jakarta.persistence.EntityNotFoundException;
import com.capstone.rebyu.aigateway.common.AiProviderRateLimitException;
import com.capstone.rebyu.aigateway.common.InvalidAiGeneratedQuestionException;
import com.capstone.rebyu.aigateway.common.InvalidAiResponseException;
import com.capstone.rebyu.aigateway.client.AiServiceStatusException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(EntityNotFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(HttpStatus.NOT_FOUND.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }
        log.warn("Validation failed: {}", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(HttpStatus.BAD_REQUEST.value(), "Validation failed", fieldErrors));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        String message = ex.getMostSpecificCause().getMessage();
        log.warn("Data integrity violation: {}", message);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(HttpStatus.CONFLICT.value(), "Data integrity violation: " + message, null));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Illegal argument: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(HttpStatus.BAD_REQUEST.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex) {
        log.warn("Illegal state: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(HttpStatus.CONFLICT.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ErrorResponse> handleBusinessRule(BusinessRuleException ex) {
        log.warn("Business rule violation: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(HttpStatus.CONFLICT.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(InvitationAcceptanceException.class)
    public ResponseEntity<InvitationErrorResponse> handleInvitationAcceptance(
            InvitationAcceptanceException ex) {
        log.warn("Invitation acceptance failed [{}]: {}", ex.code(), ex.getMessage());
        return ResponseEntity.status(ex.status())
                .body(new InvitationErrorResponse(
                        ex.status().value(), ex.code().name(), ex.getMessage()));
    }

    @ExceptionHandler(InvalidAiResponseException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAiResponse(InvalidAiResponseException ex) {
        log.warn("Invalid AI response: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(InvalidAiGeneratedQuestionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAiGeneratedQuestion(InvalidAiGeneratedQuestionException ex) {
        log.warn("Invalid generated question draft: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY.value(), ex.getMessage(), null));
    }

    /**
     * A refusal the Python AI backend already explained — passed through with
     * its own status and sentence rather than flattened into a 500, so the
     * workspace can tell an admin why a retry was declined.
     */
    @ExceptionHandler(AiServiceStatusException.class)
    public ResponseEntity<ErrorResponse> handleAiServiceStatus(AiServiceStatusException ex) {
        log.warn("AI service refused the request ({}): {}", ex.status(), ex.getMessage());
        return ResponseEntity.status(ex.status())
                .body(new ErrorResponse(ex.status().value(), ex.getMessage(), null));
    }

    @ExceptionHandler(AiProviderRateLimitException.class)
    public ResponseEntity<ErrorResponse> handleAiProviderRateLimit(AiProviderRateLimitException ex) {
        log.warn("AI provider rate limited generation: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new ErrorResponse(HttpStatus.TOO_MANY_REQUESTS.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        log.warn("Upload too large: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(HttpStatus.BAD_REQUEST.value(),
                        "One of the uploaded files exceeds the allowed size limit.",
                        Map.of("files", "One of the uploaded files exceeds the allowed size limit.")));
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    public ResponseEntity<ErrorResponse> handleMissingRequestPart(Exception ex) {
        log.warn("Missing request data: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(HttpStatus.BAD_REQUEST.value(), ex.getMessage(), null));
    }

    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleClientDisconnect(AsyncRequestNotUsableException ex) {
        log.debug("Client disconnected before response was complete");
    }

    @ExceptionHandler(com.capstone.rebyu.billing.entitlement.PremiumAccessRequiredException.class)
    public ResponseEntity<java.util.Map<String, Object>> handlePremiumAccess(
            com.capstone.rebyu.billing.entitlement.PremiumAccessRequiredException ex) {
        log.debug("Premium access required for feature {}", ex.getFeature());
        java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("code", ex.getCode());
        body.put("feature", ex.getFeature());
        body.put("message", ex.getMessage());
        body.put("eligiblePlan", ex.getEligiblePlan());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(com.capstone.rebyu.billing.entitlement.InstitutionalEntitlementRequiredException.class)
    public ResponseEntity<java.util.Map<String, Object>> handleInstitutionalEntitlement(
            com.capstone.rebyu.billing.entitlement.InstitutionalEntitlementRequiredException ex) {
        log.debug("Institutional entitlement required for feature {}", ex.getFeature());
        java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("status", HttpStatus.FORBIDDEN.value());
        body.put("code", ex.getCode());
        body.put("feature", ex.getFeature());
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(com.capstone.rebyu.billing.entitlement.CapacityLimitReachedException.class)
    public ResponseEntity<java.util.Map<String, Object>> handleCapacityLimit(
            com.capstone.rebyu.billing.entitlement.CapacityLimitReachedException ex) {
        log.debug("Capacity limit reached: {} ({}/{})", ex.getCode(), ex.getUsed(), ex.getLimit());
        java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("status", HttpStatus.CONFLICT.value());
        body.put("code", ex.getCode());
        body.put("limit", ex.getLimit());
        body.put("used", ex.getUsed());
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unexpected error: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR.value(), "An unexpected error occurred", null));
    }

    public record ErrorResponse(int status, String message, Map<String, String> fieldErrors) {
        private static final LocalDateTime timestamp = LocalDateTime.now();
    }

    /** Structured error for invitation acceptance so React can switch on code. */
    public record InvitationErrorResponse(int status, String errorCode, String message) {
    }
}
