CREATE TABLE learner_reward_balances (
    learner_id BIGINT PRIMARY KEY REFERENCES learners(learner_id) ON DELETE CASCADE,
    xp_balance BIGINT NOT NULL DEFAULT 0 CHECK (xp_balance >= 0),
    coin_balance BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
    ai_credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (ai_credit_balance >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE learner_reward_ledger (
    reward_ledger_id BIGSERIAL PRIMARY KEY,
    learner_id BIGINT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
    currency VARCHAR(16) NOT NULL CHECK (currency IN ('XP', 'COINS', 'AI_CREDITS')),
    amount INTEGER NOT NULL CHECK (amount <> 0),
    reason VARCHAR(48) NOT NULL,
    source_key VARCHAR(180) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_learner_reward_source_currency UNIQUE (learner_id, source_key, currency)
);

CREATE INDEX idx_reward_ledger_leaderboard ON learner_reward_ledger(currency, learner_id);
