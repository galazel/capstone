-- Adaptive retake question selection (Phase 4): needs an efficient
-- lesson+difficulty lookup to pull "more questions from this weak tier"
-- without a full per-lesson table scan.
CREATE INDEX IF NOT EXISTS idx_questions_lesson_difficulty ON questions(lesson_id, difficulty_level);

-- Records why a retake's question set was assembled the way it was (the
-- learner's past-attempt weakness matrix and the resulting target
-- distribution) -- NULL for a first attempt or any attempt built from the
-- exam's fixed question list, populated only when adaptive selection ran.
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS retake_basis TEXT NULL;
