package com.capstone.rebyu.gamification.repository;

import com.capstone.rebyu.gamification.entity.LearnerRewardLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

public interface LearnerRewardLedgerRepository extends JpaRepository<LearnerRewardLedger, Long> {

    List<LearnerRewardLedger> findTop20ByLearnerIdOrderByCreatedAtDesc(Long learnerId);

    /**
     * Atomic idempotent insert: returns the number of rows actually inserted (0 or 1).
     * The uq_learner_reward_source_currency constraint (V31) is what makes this race-safe
     * under concurrent duplicate requests -- callers must only apply the paired balance
     * change when this returns > 0.
     *
     * {@code created_at} is written explicitly rather than left to the column's
     * DEFAULT. This is the award path for every lesson and assessment, and it
     * should not be able to fail because a database picked up the column
     * without its default (see V53) -- the value is the same either way.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO learner_reward_ledger(learner_id, currency, amount, reason, source_key, created_at)
            VALUES (:learnerId, :currency, :amount, :reason, :sourceKey, now())
            ON CONFLICT (learner_id, source_key, currency) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("learnerId") Long learnerId, @Param("currency") String currency,
                        @Param("amount") int amount, @Param("reason") String reason, @Param("sourceKey") String sourceKey);

    /** Only refunds if the original AI_CREDITS debit for originalSourceKey actually exists. */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO learner_reward_ledger(learner_id, currency, amount, reason, source_key, created_at)
            SELECT :learnerId, 'AI_CREDITS', :amount, 'AI_GENERATION_REFUND', :refundSourceKey, now()
            WHERE EXISTS (SELECT 1 FROM learner_reward_ledger WHERE learner_id=:learnerId AND currency='AI_CREDITS' AND source_key=:originalSourceKey)
            ON CONFLICT (learner_id, source_key, currency) DO NOTHING
            """, nativeQuery = true)
    int insertRefundIfOriginalExists(@Param("learnerId") Long learnerId, @Param("amount") int amount,
                                      @Param("refundSourceKey") String refundSourceKey,
                                      @Param("originalSourceKey") String originalSourceKey);

    @Query(value = """
            WITH scores AS (
              SELECT learner_id, coalesce(sum(xp_earned), 0) xp FROM learner_practice_attempts
              WHERE status='COMPLETED' AND source_type='COMMUNITY_QUIZ'
              GROUP BY learner_id
            ), ranked AS (
              SELECT l.learner_id, concat_ws(' ', l.first_name, l.last_name) learner_name, scores.xp,
                dense_rank() OVER (ORDER BY scores.xp DESC) ranking
              FROM scores JOIN learners l ON l.learner_id=scores.learner_id
              WHERE scores.xp > 0
            )
            SELECT ranking AS ranking, learner_id AS learnerId, learner_name AS learnerName, xp AS xp,
              (learner_id = :viewerLearnerId) AS currentLearner
            FROM ranked ORDER BY ranking, learner_name LIMIT 10
            """, nativeQuery = true)
    List<LeaderboardRow> communityLeaderboardAllTime(@Param("viewerLearnerId") Long viewerLearnerId);

    @Query(value = """
            WITH scores AS (
              SELECT learner_id, coalesce(sum(xp_earned), 0) xp FROM learner_practice_attempts
              WHERE status='COMPLETED' AND source_type='COMMUNITY_QUIZ' AND completed_at >= :cutoff
              GROUP BY learner_id
            ), ranked AS (
              SELECT l.learner_id, concat_ws(' ', l.first_name, l.last_name) learner_name, scores.xp,
                dense_rank() OVER (ORDER BY scores.xp DESC) ranking
              FROM scores JOIN learners l ON l.learner_id=scores.learner_id
              WHERE scores.xp > 0
            )
            SELECT ranking AS ranking, learner_id AS learnerId, learner_name AS learnerName, xp AS xp,
              (learner_id = :viewerLearnerId) AS currentLearner
            FROM ranked ORDER BY ranking, learner_name LIMIT 10
            """, nativeQuery = true)
    List<LeaderboardRow> communityLeaderboardSince(
            @Param("viewerLearnerId") Long viewerLearnerId, @Param("cutoff") OffsetDateTime cutoff);

    @Query(value = """
            WITH ranked AS (
              SELECT l.learner_id, concat_ws(' ', l.first_name, l.last_name) learner_name, b.xp_balance xp,
                dense_rank() OVER (ORDER BY b.xp_balance DESC) ranking
              FROM learner_reward_balances b JOIN learners l ON l.learner_id=b.learner_id
              WHERE b.xp_balance > 0
            )
            SELECT ranking AS ranking, learner_id AS learnerId, learner_name AS learnerName, xp AS xp,
              (learner_id = :viewerLearnerId) AS currentLearner
            FROM ranked ORDER BY ranking, learner_name LIMIT 10
            """, nativeQuery = true)
    List<LeaderboardRow> overallLeaderboardAllTime(@Param("viewerLearnerId") Long viewerLearnerId);

    @Query(value = """
            WITH scores AS (
              SELECT learner_id, coalesce(sum(amount), 0) xp FROM learner_reward_ledger
              WHERE currency='XP' AND created_at >= :cutoff
              GROUP BY learner_id
            ), ranked AS (
              SELECT l.learner_id, concat_ws(' ', l.first_name, l.last_name) learner_name, scores.xp,
                dense_rank() OVER (ORDER BY scores.xp DESC) ranking
              FROM scores JOIN learners l ON l.learner_id=scores.learner_id
              WHERE scores.xp > 0
            )
            SELECT ranking AS ranking, learner_id AS learnerId, learner_name AS learnerName, xp AS xp,
              (learner_id = :viewerLearnerId) AS currentLearner
            FROM ranked ORDER BY ranking, learner_name LIMIT 10
            """, nativeQuery = true)
    List<LeaderboardRow> overallLeaderboardSince(
            @Param("viewerLearnerId") Long viewerLearnerId, @Param("cutoff") OffsetDateTime cutoff);
}
