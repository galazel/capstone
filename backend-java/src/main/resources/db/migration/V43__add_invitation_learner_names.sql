-- Optional learner name captured at invite time (like NetAcad's first/last/email
-- invite). Nullable: older invitations and email-only invites have no name.
ALTER TABLE learner_invitations ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL;
ALTER TABLE learner_invitations ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL;
