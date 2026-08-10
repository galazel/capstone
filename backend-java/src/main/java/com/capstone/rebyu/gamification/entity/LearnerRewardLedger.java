package com.capstone.rebyu.gamification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Append-only ledger; the unique (learner_id, source_key, currency) constraint
 * (V31) makes awards idempotent.
 *
 * That constraint is declared here as well as in the migration, and it has to
 * be. Under {@code ddl-auto: update} Hibernate creates tables, columns and
 * primary keys but never a UNIQUE constraint it cannot see on the entity, so a
 * database where Hibernate got to this table before Flyway did ended up without
 * one -- and every {@code ON CONFLICT} award insert failed with 42P10, rolling
 * back the lesson completion or assessment submission that triggered it. See
 * V52, which repairs databases already in that state.
 */
@Entity
@Table(
        name = "learner_reward_ledger",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_learner_reward_source_currency",
                columnNames = {"learner_id", "source_key", "currency"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerRewardLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "reward_ledger_id")
    private Long rewardLedgerId;

    @Column(name = "learner_id", nullable = false)
    private Long learnerId;

    /** XP | COINS | AI_CREDITS. */
    @Column(nullable = false, length = 16)
    private String currency;

    @Column(nullable = false)
    private int amount;

    @Column(nullable = false, length = 48)
    private String reason;

    @Column(name = "source_key", nullable = false, length = 180)
    private String sourceKey;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
