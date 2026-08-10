-- The other half of the V52 problem.
--
-- Hibernate's `ddl-auto: update` creates a column's type and NOT NULL, but it
-- does not carry over the DEFAULT declared in the migration. On a table
-- Hibernate materialised first, a NOT NULL column with a migration-only
-- DEFAULT ends up NOT NULL with no default at all -- so every native INSERT
-- that omits the column, expecting the database to fill it, fails with 23502
-- "null value in column ... violates not-null constraint".
--
-- These are exactly the columns that the native upserts in
-- LearnerRewardLedgerRepository, LearnerPracticeAnswerRepository,
-- CommunityPostReportRepository and LearnerToolsService leave out of their
-- column lists. `SET DEFAULT` is idempotent, so this is safe to re-run and a
-- no-op where the default already survived.

-- V31 -- the XP/coin/AI-credit ledger (RewardService.awardXp).
ALTER TABLE learner_reward_ledger   ALTER COLUMN created_at  SET DEFAULT now();
ALTER TABLE learner_reward_balances ALTER COLUMN updated_at  SET DEFAULT now();

-- V30 -- practice answers and their parent attempts/sets.
ALTER TABLE learner_practice_answers  ALTER COLUMN answered_at SET DEFAULT now();
ALTER TABLE learner_practice_attempts ALTER COLUMN started_at  SET DEFAULT now();
ALTER TABLE generated_study_sets      ALTER COLUMN created_at  SET DEFAULT now();
ALTER TABLE generated_study_sets      ALTER COLUMN updated_at  SET DEFAULT now();

-- V32 -- community post reports.
ALTER TABLE community_post_reports ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE community_post_reports ALTER COLUMN status     SET DEFAULT 'OPEN';

-- V25 -- library items and mistake reviews.
ALTER TABLE learner_library_items   ALTER COLUMN created_at  SET DEFAULT now();
ALTER TABLE learner_library_items   ALTER COLUMN updated_at  SET DEFAULT now();
ALTER TABLE learner_mistake_reviews ALTER COLUMN reviewed_at SET DEFAULT now();

-- No backfill needed: every column above is NOT NULL, which is precisely why
-- the missing default was fatal rather than silent -- nothing was ever written
-- with a null in it.
