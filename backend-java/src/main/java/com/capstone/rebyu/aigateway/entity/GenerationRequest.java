package com.capstone.rebyu.aigateway.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Persisted record of an admin-triggered AI generation request. The
 * RabbitMQ trigger message published for this request carries only this
 * row's id -- the consumer re-fetches {@code paramsJson} and re-derives
 * everything else from the database, never from the message body itself.
 */
@Entity
@Table(name = "generation_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GenerationRequest {

    public enum RequestType {
        CERTIFICATION, QUESTION
    }

    public enum Status {
        PENDING, PROCESSING, DONE, FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long generationRequestId;

    @Column(name = "certification_id", nullable = false)
    private Long certificationId;

    /** Admin who triggered this request, resolved from the JWT at creation
     * time -- lets the Python consumer notify the right person on completion. */
    @Column(name = "triggered_by_user_id")
    private Long triggeredByUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 20)
    private RequestType requestType;

    /** JSON blob of whatever request-specific params the consumer needs (e.g. additionalInstructions, questionCountsJson, sourceMode). */
    @Column(name = "params_json", columnDefinition = "TEXT")
    private String paramsJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
