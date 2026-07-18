package com.capstone.rebyu.gamification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/** Single-row (id = 1) admin-editable gamification configuration. */
@Entity
@Table(name = "gamification_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GamificationSettings {

    public static final short SINGLETON_ID = 1;

    @Id
    @Column(name = "id")
    @Builder.Default
    private Short id = SINGLETON_ID;

    @Column(name = "tutor_quiz_xp", nullable = false)
    @Builder.Default
    private int tutorQuizXp = 15;

    @Column(name = "tutor_quiz_coins", nullable = false)
    @Builder.Default
    private int tutorQuizCoins = 3;

    @Column(name = "community_quiz_xp", nullable = false)
    @Builder.Default
    private int communityQuizXp = 20;

    @Column(name = "community_quiz_coins", nullable = false)
    @Builder.Default
    private int communityQuizCoins = 5;

    @Column(name = "flashcard_xp", nullable = false)
    @Builder.Default
    private int flashcardXp = 8;

    @Column(name = "flashcard_coins", nullable = false)
    @Builder.Default
    private int flashcardCoins = 1;

    @Column(name = "low_score_threshold_percent", nullable = false)
    @Builder.Default
    private int lowScoreThresholdPercent = 50;

    @Column(name = "low_score_min_xp", nullable = false)
    @Builder.Default
    private int lowScoreMinXp = 3;

    @Column(name = "coins_per_ai_credit", nullable = false)
    @Builder.Default
    private int coinsPerAiCredit = 10;

    @Column(name = "ai_generation_cost", nullable = false)
    @Builder.Default
    private int aiGenerationCost = 1;

    @Column(name = "monthly_pro_ai_credits", nullable = false)
    @Builder.Default
    private int monthlyProAiCredits = 30;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
