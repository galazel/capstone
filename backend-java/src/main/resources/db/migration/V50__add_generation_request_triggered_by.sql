-- Captures which admin triggered a generation request, resolved from the
-- authenticated caller at creation time. Lets the Python consumer send a
-- real "generation complete/failed" notification once it finishes, instead
-- of skipping notification entirely for lack of a resolvable recipient.
ALTER TABLE public.generation_requests
    ADD COLUMN IF NOT EXISTS triggered_by_user_id BIGINT NULL
        REFERENCES public.users(user_id);
