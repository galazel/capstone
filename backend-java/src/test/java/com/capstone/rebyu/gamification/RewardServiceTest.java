package com.capstone.rebyu.gamification;

import com.capstone.rebyu.billing.service.LearnerEntitlementService;
import com.capstone.rebyu.gamification.entity.GamificationSettings;
import com.capstone.rebyu.gamification.entity.LearnerRewardBalance;
import com.capstone.rebyu.gamification.repository.LearnerRewardBalanceRepository;
import com.capstone.rebyu.gamification.repository.LearnerRewardLedgerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RewardServiceTest {

    private static final Long LEARNER_ID = 1L;

    private LearnerRewardBalanceRepository balances;
    private LearnerRewardLedgerRepository ledger;
    private LearnerEntitlementService entitlements;
    private GamificationSettingsService settings;
    private RewardService service;

    @BeforeEach
    void setUp() {
        balances = mock(LearnerRewardBalanceRepository.class);
        ledger = mock(LearnerRewardLedgerRepository.class);
        entitlements = mock(LearnerEntitlementService.class);
        settings = mock(GamificationSettingsService.class);
        service = new RewardService(balances, ledger, entitlements, settings);

        // Default settings match the historical hardcoded values (15/3 XP-coins, 10:1 conversion,
        // 1-credit AI cost, 30 monthly Pro credits, 50% low-score threshold, 3 min XP).
        when(settings.current()).thenReturn(GamificationSettings.builder().build());
        when(balances.findById(LEARNER_ID)).thenReturn(Optional.of(
                LearnerRewardBalance.builder().learnerId(LEARNER_ID).xpBalance(0).coinBalance(0).aiCreditBalance(0).build()));
    }

    @Test
    void awardCompletedPractice_duplicateAward_isNoOpAndDoesNotTouchBalance() {
        when(ledger.insertIfAbsent(eq(LEARNER_ID), eq("XP"), anyInt(), eq("PRACTICE_COMPLETED"), anyString()))
                .thenReturn(0); // already awarded for this source_key

        RewardService.PracticeReward result = service.awardCompletedPractice(LEARNER_ID, 10L, "TUTOR_QUIZ", 90.0);

        assertFalse(result.awarded());
        assertEquals(0, result.xp());
        assertEquals(0, result.coins());
        verify(balances, never()).addXpAndCoins(any(), anyInt(), anyInt());
    }

    @Test
    void awardCompletedPractice_freshAward_creditsBalance() {
        when(ledger.insertIfAbsent(eq(LEARNER_ID), eq("XP"), anyInt(), eq("PRACTICE_COMPLETED"), anyString())).thenReturn(1);

        RewardService.PracticeReward result = service.awardCompletedPractice(LEARNER_ID, 10L, "TUTOR_QUIZ", 90.0);

        assertTrue(result.awarded());
        assertEquals(15, result.xp());
        assertEquals(3, result.coins());
        verify(balances).addXpAndCoins(LEARNER_ID, 15, 3);
    }

    @Test
    void convertCoinsToAiCredits_insufficientBalance_throws() {
        when(ledger.insertIfAbsent(eq(LEARNER_ID), eq("COINS"), anyInt(), eq("COIN_TO_AI_CONVERSION"), anyString())).thenReturn(1);
        when(balances.deductCoinsIfSufficient(LEARNER_ID, 20)).thenReturn(0); // guarded UPDATE affected 0 rows

        assertThrows(IllegalArgumentException.class,
                () -> service.convertCoinsToAiCredits(LEARNER_ID, 20, "key-1"));
    }

    @Test
    void convertCoinsToAiCredits_duplicateIdempotencyKey_returnsUnconverted() {
        when(ledger.insertIfAbsent(eq(LEARNER_ID), eq("COINS"), anyInt(), eq("COIN_TO_AI_CONVERSION"), anyString())).thenReturn(0);

        RewardService.Conversion result = service.convertCoinsToAiCredits(LEARNER_ID, 20, "key-1");

        assertFalse(result.converted());
        assertEquals(0, result.aiCreditsReceived());
        verify(balances, never()).deductCoinsIfSufficient(any(), anyInt());
    }

    @Test
    void grantMonthlyProAiCredits_secondCallSameMonth_isNoOp() {
        when(entitlements.hasActiveProSubscription(LEARNER_ID)).thenReturn(true);
        when(ledger.insertIfAbsent(eq(LEARNER_ID), eq("AI_CREDITS"), eq(30), eq("PRO_MONTHLY_GRANT"), anyString()))
                .thenReturn(0); // already granted this calendar month

        service.grantMonthlyProAiCredits(LEARNER_ID);

        verify(balances, never()).addAiCredits(any(), anyInt());
    }

    @Test
    void grantMonthlyProAiCredits_nonProLearner_neverInsertsLedgerRow() {
        when(entitlements.hasActiveProSubscription(LEARNER_ID)).thenReturn(false);

        service.grantMonthlyProAiCredits(LEARNER_ID);

        verify(ledger, never()).insertIfAbsent(any(), anyString(), anyInt(), anyString(), anyString());
    }

    @Test
    void spendAiCredit_insufficientCredits_throws() {
        when(ledger.insertIfAbsent(eq(LEARNER_ID), eq("AI_CREDITS"), eq(-1), eq("AI_GENERATION"), anyString())).thenReturn(1);
        when(balances.deductAiCreditsIfSufficient(LEARNER_ID, 1)).thenReturn(0);

        assertThrows(IllegalArgumentException.class, () -> service.spendAiCredit(LEARNER_ID, "req-1"));
    }

    @Test
    void spendAiCredit_duplicateRequestKey_returnsFalseWithoutDeducting() {
        when(ledger.insertIfAbsent(eq(LEARNER_ID), eq("AI_CREDITS"), eq(-1), eq("AI_GENERATION"), anyString())).thenReturn(0);

        boolean charged = service.spendAiCredit(LEARNER_ID, "req-1");

        assertFalse(charged);
        verify(balances, never()).deductAiCreditsIfSufficient(any(), anyInt());
    }

    @Test
    void refundAiCredit_noMatchingOriginalCharge_doesNotCreditBalance() {
        when(ledger.insertRefundIfOriginalExists(eq(LEARNER_ID), anyInt(), anyString(), anyString())).thenReturn(0);

        service.refundAiCredit(LEARNER_ID, "req-1");

        verify(balances, never()).addAiCredits(any(), anyInt());
    }

    @Test
    void refundAiCredit_matchingOriginalCharge_creditsOneAiCredit() {
        when(ledger.insertRefundIfOriginalExists(eq(LEARNER_ID), anyInt(), anyString(), anyString())).thenReturn(1);

        service.refundAiCredit(LEARNER_ID, "req-1");

        verify(balances, times(1)).addAiCredits(LEARNER_ID, 1);
    }
}
