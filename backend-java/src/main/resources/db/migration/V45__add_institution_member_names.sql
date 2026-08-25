-- The inviter supplies the member's first/last name when provisioning their
-- account, but users table has no name columns (only learners do), so the org
-- portal could only ever label members by email. Persist them here.
ALTER TABLE institution_members ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL;
ALTER TABLE institution_members ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL;
