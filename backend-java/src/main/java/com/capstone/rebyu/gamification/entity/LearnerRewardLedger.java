package com.capstone.rebyu.gamification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Append-only ledger; the unique (learner_id, source_key, currency) constraint (V31) makes awards idempotent. */
@Entity
@Table(name = "learner_reward_ledger")
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
