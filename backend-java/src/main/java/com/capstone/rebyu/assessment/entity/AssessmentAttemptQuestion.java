package com.capstone.rebyu.assessment.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Learner-visible snapshot of one question at attempt start. The snapshot JSON
 * never contains answer keys, rubrics, or reference diagram data.
 */
@Entity
@Table(
        name = "assessment_attempt_questions",
        /* Postgres does not index a foreign key column just because it is one,
           and `ddl-auto: update` only creates what is declared here. Every read
           of a paper -- start, resume, submit, result, analytics -- filters on
           assessment_attempt_id, so without this each of them is a sequential
           scan of every attempt question ever recorded. */
        indexes = @Index(
                name = "ix_attempt_question_attempt",
                columnList = "assessment_attempt_id"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentAttemptQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long attemptQuestionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_attempt_id", nullable = false)
    private AssessmentAttempt attempt;

    @Column(name = "source_question_id", nullable = false)
    private Long sourceQuestionId;

    @Column(name = "question_type", nullable = false, length = 30)
    private String questionType;

    @Column(name = "question_text_snapshot", nullable = false, columnDefinition = "TEXT")
    private String questionTextSnapshot;

    /** Learner-safe JSON: choices without correct flags, starter code, etc. */
    @Column(name = "question_data_snapshot", columnDefinition = "TEXT")
    private String questionDataSnapshot;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(precision = 5, scale = 2)
    private BigDecimal points;

    @Column(name = "lesson_id")
    private Long lessonId;

    /** Learner marked this item for review. */
    @Column(name = "flagged", nullable = false)
    private boolean flagged = false;

    /** Learner intentionally moved past this item without answering. */
    @Column(name = "skipped", nullable = false)
    private boolean skipped = false;
}
