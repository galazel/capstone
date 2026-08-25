-- Groundwork for Institution Member-authored content: a MajorCategory (and
-- everything nested under it -- middle categories, lessons) will eventually
-- be markable as owned by one institution_group instead of being official,
-- platform-wide content. NULL means official (today's only case, and the
-- only case until the read path that lists a certification's curriculum is
-- filtered by this column -- see MajorCategory entity javadoc). This column
-- is additive and unused by any code path yet: adding it changes no behavior.
ALTER TABLE public.major_categories
    ADD COLUMN IF NOT EXISTS owner_group_id BIGINT NULL
        REFERENCES public.institution_groups(institution_group_id);

CREATE INDEX IF NOT EXISTS idx_major_categories_owner_group
    ON public.major_categories(owner_group_id);
