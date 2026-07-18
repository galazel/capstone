package com.capstone.rebyu.learningtools.entity;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "learner_practice_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerPracticeAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "attempt_id")
    private Long attemptId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    private Learner learner;

    /** TUTOR_QUIZ | COMMUNITY_QUIZ | FLASHCARD_RECALL | CODING_CHALLENGE | DIAGRAM_CHALLENGE | OFFICIAL_ASSESSMENT. */
    @Column(name = "source_type", nullable = false, length = 32)
    private String sourceType;

    /** Points at generated_study_sets.study_set_id (or another table depending on sourceType) -- not a JPA FK. */
    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certification_id")
    private Certification certification;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    private Lesson lesson;

    /** IN_PROGRESS | COMPLETED | ABANDONED. */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = "IN_PROGRESS";

    private BigDecimal score;

    @Column(name = "total_items", nullable = false)
    @Builder.Default
    private int totalItems = 0;

    private BigDecimal percentage;

    @Column(name = "xp_earned", nullable = false)
    @Builder.Default
    private int xpEarned = 0;

    @Column(name = "coin_earned", nullable = false)
    @Builder.Default
    private int coinEarned = 0;

    @Column(name = "mastery_eligible", nullable = false)
    @Builder.Default
    private boolean masteryEligible = false;

    @Column(name = "ineligibility_reason", length = 64)
    private String ineligibilityReason;

    @Column(name = "bkt_event_id", length = 128)
    private String bktEventId;

    @Column(name = "started_at", nullable = false)
    @Builder.Default
    private OffsetDateTime startedAt = OffsetDateTime.now();

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
