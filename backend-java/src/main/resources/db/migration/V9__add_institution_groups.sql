-- Institution learner groups: an institution carves a certification allocation
-- (organization_certificate) into groups, assigns a teacher/authority/co-admin
-- to each group, and that authority adds the institution's learners to the group.

CREATE TABLE IF NOT EXISTS public.institution_groups (
    institution_group_id BIGSERIAL    PRIMARY KEY,
    institution_id       BIGINT       NOT NULL REFERENCES public.institutions(institution_id),
    org_cert_id         BIGINT       NOT NULL REFERENCES public.organization_certificates(org_cert_id),
    group_name          VARCHAR(150) NOT NULL,
    group_description   VARCHAR(500),
    created_by          BIGINT       NOT NULL REFERENCES public.users(user_id),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active',
    CONSTRAINT chk_institution_groups_status CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_institution_groups_institution ON public.institution_groups(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_groups_org_cert ON public.institution_groups(org_cert_id);

-- The teacher/authority/co-admin responsible for a group. The institution assigns
-- this authority; the authority (not the institution) manages the group learners.
CREATE TABLE IF NOT EXISTS public.institution_group_authorities (
    institution_group_authority_id BIGSERIAL   PRIMARY KEY,
    institution_group_id           BIGINT      NOT NULL REFERENCES public.institution_groups(institution_group_id),
    user_id                       BIGINT      NOT NULL REFERENCES public.users(user_id),
    assigned_by                   BIGINT      NOT NULL REFERENCES public.users(user_id),
    assigned_at                   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                        VARCHAR(20) NOT NULL DEFAULT 'active',
    removed_at                    TIMESTAMP,
    CONSTRAINT uq_institution_group_authority UNIQUE (institution_group_id, user_id),
    CONSTRAINT chk_institution_group_authority_status CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_egr_authorities_group ON public.institution_group_authorities(institution_group_id);
CREATE INDEX IF NOT EXISTS idx_egr_authorities_user ON public.institution_group_authorities(user_id);

-- Learners placed into a group. Each row must reference an existing
-- organization_certification_learner belonging to the same org_cert as the group.
CREATE TABLE IF NOT EXISTS public.institution_group_assignees (
    institution_group_assignee_id BIGSERIAL   PRIMARY KEY,
    institution_group_id          BIGINT      NOT NULL REFERENCES public.institution_groups(institution_group_id),
    org_cert_learner_id          BIGINT      NOT NULL REFERENCES public.organization_certification_learners(org_cert_learner_id),
    assigned_by                  BIGINT      NOT NULL REFERENCES public.users(user_id),
    assigned_at                  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                       VARCHAR(20) NOT NULL DEFAULT 'active',
    removed_at                   TIMESTAMP,
    CONSTRAINT uq_institution_group_assignee UNIQUE (institution_group_id, org_cert_learner_id),
    CONSTRAINT chk_institution_group_assignee_status CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_egr_assignees_group ON public.institution_group_assignees(institution_group_id);
CREATE INDEX IF NOT EXISTS idx_egr_assignees_learner ON public.institution_group_assignees(org_cert_learner_id);
