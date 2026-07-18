CREATE TABLE generated_study_sets (
    study_set_id BIGSERIAL PRIMARY KEY,
    learner_id BIGINT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
    certification_id BIGINT NOT NULL REFERENCES certifications(certification_id) ON DELETE CASCADE,
    lesson_id BIGINT NOT NULL REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    study_type VARCHAR(24) NOT NULL CHECK (study_type IN ('QUIZ', 'FLASHCARD')),
    title VARCHAR(180) NOT NULL,
    source VARCHAR(24) NOT NULL DEFAULT 'TUTOR_AI' CHECK (source IN ('TUTOR_AI', 'COMMUNITY')),
    generation_version VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_study_sets_learner_created
    ON generated_study_sets(learner_id, created_at DESC);

CREATE TABLE generated_study_items (
    study_item_id BIGSERIAL PRIMARY KEY,
    study_set_id BIGINT NOT NULL REFERENCES generated_study_sets(study_set_id) ON DELETE CASCADE,
    item_type VARCHAR(32) NOT NULL CHECK (item_type IN ('MCQ', 'SHORT_ANSWER', 'CRITICAL_THINKING', 'FLASHCARD')),
    question_text TEXT NOT NULL,
    choices_json JSONB,
    correct_answer TEXT,
    accepted_answers_json JSONB,
    explanation TEXT,
    difficulty VARCHAR(16) CHECK (difficulty IN ('EASY', 'AVERAGE', 'HARD')),
    display_order INTEGER NOT NULL,
    CONSTRAINT uq_generated_study_item_order UNIQUE (study_set_id, display_order)
);

CREATE TABLE learner_practice_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    learner_id BIGINT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
    source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('TUTOR_QUIZ', 'COMMUNITY_QUIZ', 'FLASHCARD_RECALL', 'CODING_CHALLENGE', 'DIAGRAM_CHALLENGE', 'OFFICIAL_ASSESSMENT')),
    source_id BIGINT NOT NULL,
    certification_id BIGINT REFERENCES certifications(certification_id) ON DELETE SET NULL,
    lesson_id BIGINT REFERENCES lessons(lesson_id) ON DELETE SET NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
    score NUMERIC(8,2),
    total_items INTEGER NOT NULL DEFAULT 0,
    percentage NUMERIC(5,2),
    xp_earned INTEGER NOT NULL DEFAULT 0,
    coin_earned INTEGER NOT NULL DEFAULT 0,
    mastery_eligible BOOLEAN NOT NULL DEFAULT false,
    ineligibility_reason VARCHAR(64),
    bkt_event_id VARCHAR(128),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_practice_attempts_learner_created
    ON learner_practice_attempts(learner_id, started_at DESC);

CREATE TABLE learner_practice_answers (
    practice_answer_id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES learner_practice_attempts(attempt_id) ON DELETE CASCADE,
    study_item_id BIGINT REFERENCES generated_study_items(study_item_id) ON DELETE SET NULL,
    learner_answer TEXT,
    normalized_answer TEXT,
    is_correct BOOLEAN,
    score NUMERIC(8,2),
    flashcard_rating VARCHAR(16) CHECK (flashcard_rating IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
    time_spent_seconds INTEGER,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_practice_answer_item UNIQUE (attempt_id, study_item_id)
);
