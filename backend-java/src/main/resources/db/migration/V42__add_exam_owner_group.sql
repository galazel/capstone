-- NULL = official exam (unchanged, admin-authored). Non-null = owned by one
-- EnterpriseGroup -- an Enterprise Member's own assessment, kept separate
-- from the official curriculum's exams. Mirrors major_categories.owner_group_id.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS owner_group_id BIGINT NULL REFERENCES enterprise_groups(enterprise_group_id);
CREATE INDEX IF NOT EXISTS idx_exams_owner_group_id ON exams(owner_group_id);
