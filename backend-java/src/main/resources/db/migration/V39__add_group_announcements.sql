-- Group-owned content, first instance: announcements a group's leader (or the
-- institution owner) posts to their own group. This establishes the
-- group-owned-content pattern -- a row scoped to one institution_group, authored
-- by a user, never part of the official certification curriculum -- that
-- member-authored lessons/assessments will follow.
CREATE TABLE IF NOT EXISTS public.group_announcements (
    group_announcement_id BIGSERIAL    PRIMARY KEY,
    institution_group_id   BIGINT       NOT NULL REFERENCES public.institution_groups(institution_group_id),
    title                 VARCHAR(200) NOT NULL,
    body                  TEXT         NOT NULL,
    pinned                BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by            BIGINT       NOT NULL REFERENCES public.users(user_id),
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP,
    status                VARCHAR(20)  NOT NULL DEFAULT 'active',
    CONSTRAINT chk_group_announcements_status CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_group_announcements_group
    ON public.group_announcements(institution_group_id);
