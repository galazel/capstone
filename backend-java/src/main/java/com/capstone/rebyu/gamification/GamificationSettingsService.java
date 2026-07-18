package com.capstone.rebyu.gamification;

import com.capstone.rebyu.gamification.dto.GamificationSettingsDto;
import com.capstone.rebyu.gamification.entity.GamificationSettings;
import com.capstone.rebyu.gamification.repository.GamificationSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/** Reads/writes the single gamification settings row. RewardService reads it in place of hardcoded values. */
@Service
@RequiredArgsConstructor
public class GamificationSettingsService {

    private final GamificationSettingsRepository repository;

    /** The live settings entity; falls back to defaults if the seed row is somehow absent. */
    @Transactional
    public GamificationSettings current() {
        return repository.findById(GamificationSettings.SINGLETON_ID)
                .orElseGet(() -> repository.save(GamificationSettings.builder()
                        .id(GamificationSettings.SINGLETON_ID).build()));
    }

    @Transactional(readOnly = true)
    public GamificationSettingsDto get() {
        return toDto(repository.findById(GamificationSettings.SINGLETON_ID)
                .orElseGet(() -> GamificationSettings.builder().id(GamificationSettings.SINGLETON_ID).build()));
    }

    @Transactional
    public GamificationSettingsDto update(GamificationSettingsDto dto) {
        GamificationSettings s = current();
        s.setTutorQuizXp(dto.tutorQuizXp());
        s.setTutorQuizCoins(dto.tutorQuizCoins());
        s.setCommunityQuizXp(dto.communityQuizXp());
        s.setCommunityQuizCoins(dto.communityQuizCoins());
        s.setFlashcardXp(dto.flashcardXp());
        s.setFlashcardCoins(dto.flashcardCoins());
        s.setLowScoreThresholdPercent(dto.lowScoreThresholdPercent());
        s.setLowScoreMinXp(dto.lowScoreMinXp());
        s.setCoinsPerAiCredit(dto.coinsPerAiCredit());
        s.setAiGenerationCost(dto.aiGenerationCost());
        s.setMonthlyProAiCredits(dto.monthlyProAiCredits());
        s.setUpdatedAt(OffsetDateTime.now());
        return toDto(repository.save(s));
    }

    private static GamificationSettingsDto toDto(GamificationSettings s) {
        return new GamificationSettingsDto(
                s.getTutorQuizXp(), s.getTutorQuizCoins(), s.getCommunityQuizXp(), s.getCommunityQuizCoins(),
                s.getFlashcardXp(), s.getFlashcardCoins(), s.getLowScoreThresholdPercent(), s.getLowScoreMinXp(),
                s.getCoinsPerAiCredit(), s.getAiGenerationCost(), s.getMonthlyProAiCredits(), s.getUpdatedAt());
    }
}
