-- AI-tutor-generated exams (GENERATED_QUIZ/GENERATED_FLASHCARD, see V54) are
-- authored by one learner for their own use, unlike every other exam here
-- (admin-authored, shared across every enrolled learner). Nullable and
-- ON DELETE SET NULL: every non-generated exam leaves this null, and losing
-- the learner shouldn't take the exam itself down with it.
ALTER TABLE public.exams
    ADD COLUMN IF NOT EXISTS learner_id BIGINT REFERENCES public.learners(learner_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exams_learner ON public.exams(learner_id);
