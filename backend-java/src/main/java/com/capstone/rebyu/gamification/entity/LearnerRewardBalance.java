package com.capstone.rebyu.gamification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Server-authoritative balances; learner_id is the primary key (one row per learner). */
@Entity
@Table(name = "learner_reward_balances")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerRewardBalance {

    @Id
    @Column(name = "learner_id")
    private Long learnerId;

    @Column(name = "xp_balance", nullable = false)
    @Builder.Default
    private long xpBalance = 0;

    @Column(name = "coin_balance", nullable = false)
    @Builder.Default
    private long coinBalance = 0;

    @Column(name = "ai_credit_balance", nullable = false)
    @Builder.Default
    private int aiCreditBalance = 0;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
