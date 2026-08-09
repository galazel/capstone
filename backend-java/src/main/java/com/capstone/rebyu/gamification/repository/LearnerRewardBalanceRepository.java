package com.capstone.rebyu.gamification.repository;

import com.capstone.rebyu.gamification.entity.LearnerRewardBalance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface LearnerRewardBalanceRepository extends JpaRepository<LearnerRewardBalance, Long> {

    // Columns spelled out rather than relying on the table's DEFAULT clauses:
    // the live schema has drifted from the V31 migration (likely from
    // ddl-auto: update managing this table without carrying the SQL-level
    // defaults over), so a bare `INSERT (learner_id)` was inserting NULL into
    // every NOT NULL column and failing the constraint instead of the row
    // quietly getting its zeroed defaults.
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO learner_reward_balances(learner_id, xp_balance, coin_balance, ai_credit_balance, updated_at) "
            + "VALUES (:learnerId, 0, 0, 0, now()) ON CONFLICT (learner_id) DO NOTHING",
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
