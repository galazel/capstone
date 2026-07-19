-- Each group now carries its own slot allocation, carved out of (and capped
-- by) its certification's total allocation. A group's own leader can only
-- invite learners up to the group's own limit, not the whole cert's pool.
ALTER TABLE public.enterprise_groups
    ADD COLUMN IF NOT EXISTS total_slots INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS used_slots  INTEGER NOT NULL DEFAULT 0;
