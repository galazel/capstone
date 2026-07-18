package com.capstone.rebyu.gamification.repository;

import com.capstone.rebyu.gamification.entity.LearnerRewardBalance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface LearnerRewardBalanceRepository extends JpaRepository<LearnerRewardBalance, Long> {

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO learner_reward_balances(learner_id) VALUES (:learnerId) ON CONFLICT (learner_id) DO NOTHING",
            nativeQuery = true)
    void ensureExists(@Param("learnerId") Long learnerId);

    @Modifying
    @Transactional
    @Query("UPDATE LearnerRewardBalance b SET b.xpBalance = b.xpBalance + :xp, b.coinBalance = b.coinBalance + :coins, "
            + "b.updatedAt = CURRENT_TIMESTAMP WHERE b.learnerId = :learnerId")
    void addXpAndCoins(@Param("learnerId") Long learnerId, @Param("xp") int xp, @Param("coins") int coins);

    @Modifying
    @Transactional
    @Query("UPDATE LearnerRewardBalance b SET b.aiCreditBalance = b.aiCreditBalance + :delta, "
            + "b.updatedAt = CURRENT_TIMESTAMP WHERE b.learnerId = :learnerId")
    void addAiCredits(@Param("learnerId") Long learnerId, @Param("delta") int delta);

    /** Returns the number of rows updated (0 means insufficient coin balance -- guarded, atomic). */
    @Modifying
    @Transactional
    @Query("UPDATE LearnerRewardBalance b SET b.coinBalance = b.coinBalance - :coins, b.updatedAt = CURRENT_TIMESTAMP "
            + "WHERE b.learnerId = :learnerId AND b.coinBalance >= :coins")
    int deductCoinsIfSufficient(@Param("learnerId") Long learnerId, @Param("coins") int coins);

    /** Returns the number of rows updated (0 means insufficient AI-credit balance -- guarded, atomic). */
    @Modifying
    @Transactional
    @Query("UPDATE LearnerRewardBalance b SET b.aiCreditBalance = b.aiCreditBalance - :credits, b.updatedAt = CURRENT_TIMESTAMP "
            + "WHERE b.learnerId = :learnerId AND b.aiCreditBalance >= :credits")
    int deductAiCreditsIfSufficient(@Param("learnerId") Long learnerId, @Param("credits") int credits);
}
