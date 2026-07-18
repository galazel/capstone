package com.capstone.rebyu.gamification.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

/** Admin-editable gamification configuration. All amounts are non-negative; the conversion rate must be >= 1. */
public record GamificationSettingsDto(
        @NotNull @Min(0) Integer tutorQuizXp,
        @NotNull @Min(0) Integer tutorQuizCoins,
        @NotNull @Min(0) Integer communityQuizXp,
        @NotNull @Min(0) Integer communityQuizCoins,
        @NotNull @Min(0) Integer flashcardXp,
        @NotNull @Min(0) Integer flashcardCoins,
        @NotNull @Min(0) @Max(100) Integer lowScoreThresholdPercent,
        @NotNull @Min(0) Integer lowScoreMinXp,
        @NotNull @Min(1) Integer coinsPerAiCredit,
        @NotNull @Min(0) Integer aiGenerationCost,
        @NotNull @Min(0) Integer monthlyProAiCredits,
        OffsetDateTime updatedAt
) {}
