-- Questions gain an author: admin, an enterprise owner, or a group leader can
-- all now create questions, so the table needs to record who created each one.
-- Nullable because existing questions predate this and have no known author.
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS created_by BIGINT NULL REFERENCES public.users(user_id),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_questions_created_by ON public.questions(created_by);
