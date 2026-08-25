-- New peer-leader role for group assignees (learners placed in a group).
ALTER TABLE institution_group_assignees ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'member';
ALTER TABLE institution_group_assignees ADD CONSTRAINT chk_assignee_role CHECK (role IN ('lead', 'member'));

-- Optimistic lock so two near-simultaneous admin approve/reject calls on the
-- same partnership request can't both succeed (mirrors organization_certificates.version).
ALTER TABLE partnership_requests ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- Replace the plain uniques with partial indexes scoped to active rows, so a
-- learner/authority removed (archived) from a group can be re-added later
-- without colliding with their own archived row.
ALTER TABLE institution_group_assignees DROP CONSTRAINT uq_institution_group_assignee;
CREATE UNIQUE INDEX uq_institution_group_assignee_active
    ON institution_group_assignees (institution_group_id, org_cert_learner_id) WHERE status = 'active';

ALTER TABLE institution_group_authorities DROP CONSTRAINT uq_institution_group_authority;
CREATE UNIQUE INDEX uq_institution_group_authority_active
    ON institution_group_authorities (institution_group_id, user_id) WHERE status = 'active';
