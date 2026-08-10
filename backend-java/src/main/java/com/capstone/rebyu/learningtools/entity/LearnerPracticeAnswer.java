package com.capstone.rebyu.learningtools.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
// Declared here as well as in V30: `ddl-auto: update` never creates a UNIQUE
// constraint it cannot see on the entity, and the answer upsert's ON CONFLICT
// needs it to exist. See LearnerRewardLedger for what its absence costs.
@Table(
        name = "learner_practice_answers",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_practice_answer_item",
                columnNames = {"attempt_id", "study_item_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerPracticeAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "practice_answer_id")
    private Long practiceAnswerId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private LearnerPracticeAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "study_item_id")
    private GeneratedStudyItem studyItem;

    @Column(name = "learner_answer", columnDefinition = "TEXT")
    private String learnerAnswer;

    @Column(name = "normalized_answer", columnDefinition = "TEXT")
    private String normalizedAnswer;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    private BigDecimal score;

    /** AGAIN | HARD | GOOD | EASY. */
    @Column(name = "flashcard_rating", length = 16)
    private String flashcardRating;

    @Column(name = "time_spent_seconds")
    private Integer timeSpentSeconds;

    @Column(name = "answered_at", nullable = false)
    @Builder.Default
    private OffsetDateTime answeredAt = OffsetDateTime.now();
}
