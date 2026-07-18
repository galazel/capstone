package com.capstone.rebyu.gamification;

import com.capstone.rebyu.gamification.dto.GamificationSettingsDto;
import com.capstone.rebyu.gamification.entity.GamificationSettings;
import com.capstone.rebyu.gamification.repository.GamificationSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GamificationSettingsServiceTest {

    private GamificationSettingsRepository repository;
    private GamificationSettingsService service;

    @BeforeEach
    void setUp() {
        repository = mock(GamificationSettingsRepository.class);
        service = new GamificationSettingsService(repository);
        when(repository.save(any(GamificationSettings.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private GamificationSettingsDto dto(int coinsPerAiCredit, int aiGenerationCost) {
        return new GamificationSettingsDto(15, 3, 20, 5, 8, 1, 50, 3,
                coinsPerAiCredit, aiGenerationCost, 30, null);
    }

    @Test
    void update_persistsNewValuesOntoTheSingletonRow() {
        when(repository.findById(GamificationSettings.SINGLETON_ID))
                .thenReturn(Optional.of(GamificationSettings.builder().build()));

        GamificationSettingsDto result = service.update(dto(20, 2));

        assertEquals(20, result.coinsPerAiCredit());
        assertEquals(2, result.aiGenerationCost());
        verify(repository).save(any(GamificationSettings.class));
    }

    @Test
    void current_createsDefaultRowWhenSeedMissing() {
        when(repository.findById(GamificationSettings.SINGLETON_ID)).thenReturn(Optional.empty());

        GamificationSettings result = service.current();

        // Falls back to defaults (which match the historical hardcoded reward values).
        assertEquals(15, result.getTutorQuizXp());
        assertEquals(10, result.getCoinsPerAiCredit());
        assertEquals(30, result.getMonthlyProAiCredits());
        verify(repository).save(any(GamificationSettings.class));
    }
}
