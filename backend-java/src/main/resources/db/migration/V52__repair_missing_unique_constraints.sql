-- Repairs UNIQUE constraints that exist in earlier migrations but are missing
-- from databases where Hibernate's `ddl-auto: update` created the table first.
--
-- Hibernate creates tables, columns and primary keys, but it does NOT add a
-- UNIQUE constraint that only exists in a migration file -- it only creates the
-- ones declared on the entity via @Table(uniqueConstraints = ...). Any table
-- Hibernate materialised before its Flyway migration ran therefore ends up
-- without one, and every `ON CONFLICT (...)` upsert written against it fails at
-- runtime with 42P10 "no unique or exclusion constraint matching the ON
-- CONFLICT specification" -- taking the whole transaction down with it.
--
-- Each block below is guarded, so this is a no-op on a database that was built
-- by migrations alone.

-- V31: what makes RewardService.awardXp idempotent. Without it, every XP award
-- (lesson completion, assessment submission) threw and rolled back its caller.
DELETE FROM learner_reward_ledger a
    USING learner_reward_ledger b
WHERE a.reward_ledger_id > b.reward_ledger_id
  AND a.learner_id = b.learner_id
  AND a.source_key = b.source_key
  AND a.currency   = b.currency;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'learner_reward_ledger'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 3
          AND conkey @> ARRAY[
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'learner_reward_ledger'::regclass AND attname = 'learner_id'),
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'learner_reward_ledger'::regclass AND attname = 'source_key'),
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'learner_reward_ledger'::regclass AND attname = 'currency')
          ]::smallint[]
    ) THEN
        ALTER TABLE learner_reward_ledger
            ADD CONSTRAINT uq_learner_reward_source_currency
            UNIQUE (learner_id, source_key, currency);
    END IF;
END $$;

-- Balances are the running sum of the ledger, and the failed inserts above were
-- rolled back with their paired balance updates, so no XP was silently lost or
-- double-counted. Re-derive anyway: it is cheap, and it is the only way to be
-- certain the two agree after a period where the award path was throwing.
UPDATE learner_reward_balances b
SET xp_balance        = GREATEST(0, COALESCE(l.xp, 0)),
    coin_balance      = GREATEST(0, COALESCE(l.coins, 0)),
    ai_credit_balance = GREATEST(0, COALESCE(l.ai_credits, 0)),
    updated_at        = now()
FROM (
    SELECT learner_id,
           SUM(amount) FILTER (WHERE currency = 'XP')         AS xp,
           SUM(amount) FILTER (WHERE currency = 'COINS')      AS coins,
           SUM(amount) FILTER (WHERE currency = 'AI_CREDITS') AS ai_credits
    FROM learner_reward_ledger
    GROUP BY learner_id
) l
WHERE l.learner_id = b.learner_id;

-- V30: LearnerPracticeAnswerRepository's answer upsert.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'learner_practice_answers'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 2
          AND conkey @> ARRAY[
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'learner_practice_answers'::regclass AND attname = 'attempt_id'),
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'learner_practice_answers'::regclass AND attname = 'study_item_id')
          ]::smallint[]
    ) THEN
        DELETE FROM learner_practice_answers a
            USING learner_practice_answers b
        WHERE a.practice_answer_id > b.practice_answer_id
          AND a.attempt_id = b.attempt_id
          AND a.study_item_id = b.study_item_id;

        ALTER TABLE learner_practice_answers
            ADD CONSTRAINT uq_practice_answer_item UNIQUE (attempt_id, study_item_id);
    END IF;
END $$;

-- V32: CommunityPostReportRepository's "one report per learner per post" upsert.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'community_post_reports'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 2
          AND conkey @> ARRAY[
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'community_post_reports'::regclass AND attname = 'post_id'),
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'community_post_reports'::regclass AND attname = 'reporter_learner_id')
          ]::smallint[]
    ) THEN
        DELETE FROM community_post_reports a
            USING community_post_reports b
        WHERE a.report_id > b.report_id
          AND a.post_id = b.post_id
          AND a.reporter_learner_id = b.reporter_learner_id;

        ALTER TABLE community_post_reports
            ADD CONSTRAINT uq_community_reporter_post UNIQUE (post_id, reporter_learner_id);
    END IF;
END $$;
