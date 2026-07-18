-- Single-row, admin-editable gamification configuration. Replaces the values that
-- were hardcoded in RewardService (reward amounts, conversion rate, AI credit cost,
-- monthly Pro grant). The id = 1 CHECK enforces exactly one settings row.
CREATE TABLE gamification_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    tutor_quiz_xp INTEGER NOT NULL DEFAULT 15 CHECK (tutor_quiz_xp >= 0),
    tutor_quiz_coins INTEGER NOT NULL DEFAULT 3 CHECK (tutor_quiz_coins >= 0),
    community_quiz_xp INTEGER NOT NULL DEFAULT 20 CHECK (community_quiz_xp >= 0),
    community_quiz_coins INTEGER NOT NULL DEFAULT 5 CHECK (community_quiz_coins >= 0),
    flashcard_xp INTEGER NOT NULL DEFAULT 8 CHECK (flashcard_xp >= 0),
    flashcard_coins INTEGER NOT NULL DEFAULT 1 CHECK (flashcard_coins >= 0),
    low_score_threshold_percent INTEGER NOT NULL DEFAULT 50 CHECK (low_score_threshold_percent BETWEEN 0 AND 100),
    low_score_min_xp INTEGER NOT NULL DEFAULT 3 CHECK (low_score_min_xp >= 0),
    coins_per_ai_credit INTEGER NOT NULL DEFAULT 10 CHECK (coins_per_ai_credit >= 1),
    ai_generation_cost INTEGER NOT NULL DEFAULT 1 CHECK (ai_generation_cost >= 0),
    monthly_pro_ai_credits INTEGER NOT NULL DEFAULT 30 CHECK (monthly_pro_ai_credits >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO gamification_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
