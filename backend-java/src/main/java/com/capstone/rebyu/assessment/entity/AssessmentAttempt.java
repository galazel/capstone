package com.capstone.rebyu.assessment.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One learner attempt of a published exam. Questions are snapshotted at start
 * (learner-safe, no answer keys) and answers are scored server-side on submit.
 */
@Entity
@Table(
        name = "assessment_attempts",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_attempt_exam_learner_no",
                        columnNames = {"exam_id", "learner_id", "attempt_number"}
                ),
                @UniqueConstraint(
                        name = "uq_attempt_idempotency_key",
                        columnNames = {"idempotency_key"}
                )
        },
        /* uq_attempt_exam_learner_no leads with exam_id, so it cannot serve the
           learner-first reads: the attempt history list, the diagnostic gate,
           and every analytics rollup all filter on learner_id alone or on
           (learner_id, status). */
        indexes = {
                @Index(name = "ix_attempt_learner", columnList = "learner_id"),
                @Index(name = "ix_attempt_learner_status", columnList = "learner_id, status")
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentAttempt {

    public enum Status {
        IN_PROGRESS, SUBMITTED, EXPIRED, CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assessmentAttemptId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Column(name = "learner_id", nullable = false)
    private Long learnerId;

    /** learner_certifications id backing this attempt, when one exists. */
    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /** Percentage 0-100 across all snapshot points; pending items score 0. */
    @Column(precision = 5, scale = 2)
    private BigDecimal percentage;

    private Boolean passed;

    @Column(name = "total_points", precision = 8, scale = 2)
    private BigDecimal totalPoints;

    @Column(name = "earned_points", precision = 8, scale = 2)
    private BigDecimal earnedPoints;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    /** attempt_question id of the item the learner last viewed, for resume. */
    @Column(name = "current_question_id")
    private Long currentQuestionId;

    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    /**
     * JSON audit trail of why an adaptive retake's question set was assembled
     * the way it was (past-attempt weakness matrix + resulting target
     * distribution). NULL for attempt #1 or any attempt built from the exam's
     * fixed question list.
     */
    @Column(name = "retake_basis", columnDefinition = "TEXT")
    private String retakeBasis;

    @Version
    @Column(name = "version")
    private Long version;
}
