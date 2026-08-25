-- NULL = official question (admin-authored, platform-wide -- unchanged).
-- Non-null = authored by one Institution group; only that group sees and uses
-- it. Mirrors major_categories.owner_group_id and exams.owner_group_id.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS owner_group_id BIGINT NULL REFERENCES institution_groups(institution_group_id);
CREATE INDEX IF NOT EXISTS idx_questions_owner_group_id ON questions(owner_group_id);
