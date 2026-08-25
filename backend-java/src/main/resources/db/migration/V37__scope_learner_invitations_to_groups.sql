-- Invitations become group-scoped: the group leader (not the institution owner)
-- invites learners into their own assigned group. Nullable so existing rows
-- (sent before groups existed) remain valid; every NEW invitation is required
-- to carry a group at the application layer.
ALTER TABLE public.learner_invitations
    ADD COLUMN IF NOT EXISTS institution_group_id BIGINT NULL
        REFERENCES public.institution_groups(institution_group_id),
    ADD COLUMN IF NOT EXISTS invited_by BIGINT NULL
        REFERENCES public.users(user_id);

CREATE INDEX IF NOT EXISTS idx_learner_invitations_group
    ON public.learner_invitations(institution_group_id);
