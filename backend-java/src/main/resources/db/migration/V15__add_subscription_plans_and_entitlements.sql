-- Revenue model foundation: B2C individual plans + B2B institutional plans,
-- their entitlements, and the per-learner / per-institution subscriptions.
-- Plan prices, limits and entitlements are data-driven so platform admins can
-- change them without code changes.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    subscription_plan_id BIGSERIAL   PRIMARY KEY,
    plan_code            VARCHAR(50)  NOT NULL UNIQUE,
    plan_name            VARCHAR(150) NOT NULL,
    customer_type        VARCHAR(20)  NOT NULL,
    description          TEXT,
    billing_interval     VARCHAR(20)  NOT NULL DEFAULT 'NONE',
    amount               NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency             VARCHAR(3)   NOT NULL DEFAULT 'PHP',
    is_free              BOOLEAN      NOT NULL DEFAULT FALSE,
    is_custom_pricing    BOOLEAN      NOT NULL DEFAULT FALSE,
    status               VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    display_order        INTEGER      NOT NULL DEFAULT 0,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_plan_customer_type CHECK (customer_type IN ('INDIVIDUAL', 'INSTITUTION')),
    CONSTRAINT chk_plan_billing_interval CHECK (billing_interval IN
        ('NONE','MONTHLY','QUARTERLY','SEMI_ANNUAL','ANNUAL','CUSTOM')),
    CONSTRAINT chk_plan_amount_nonneg CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.plan_entitlements (
    plan_entitlement_id  BIGSERIAL   PRIMARY KEY,
    subscription_plan_id BIGINT      NOT NULL REFERENCES public.subscription_plans(subscription_plan_id) ON DELETE CASCADE,
    entitlement_code     VARCHAR(60) NOT NULL,
    enabled              BOOLEAN     NOT NULL DEFAULT TRUE,
    limit_value          INTEGER,
    configuration_json   TEXT,
    CONSTRAINT uq_plan_entitlement UNIQUE (subscription_plan_id, entitlement_code),
    CONSTRAINT chk_entitlement_limit_nonneg CHECK (limit_value IS NULL OR limit_value >= 0)
);

CREATE TABLE IF NOT EXISTS public.learner_subscriptions (
    learner_subscription_id BIGSERIAL PRIMARY KEY,
    learner_id              BIGINT    NOT NULL REFERENCES public.learners(learner_id),
    subscription_plan_id    BIGINT    NOT NULL REFERENCES public.subscription_plans(subscription_plan_id),
    provider                VARCHAR(30),
    provider_customer_id    VARCHAR(100),
    provider_subscription_id VARCHAR(100),
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    started_at              TIMESTAMP,
    current_period_start    TIMESTAMP,
    current_period_end      TIMESTAMP,
    cancel_at_period_end    BOOLEAN   NOT NULL DEFAULT FALSE,
    canceled_at             TIMESTAMP,
    ended_at                TIMESTAMP,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_learner_sub_period CHECK
        (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end >= current_period_start)
);

CREATE INDEX IF NOT EXISTS idx_learner_subscriptions_learner
    ON public.learner_subscriptions(learner_id, status);

CREATE TABLE IF NOT EXISTS public.institutional_licenses (
    institutional_license_id  BIGSERIAL PRIMARY KEY,
    institution_id             BIGINT    NOT NULL REFERENCES public.institutions(institution_id),
    subscription_plan_id      BIGINT    NOT NULL REFERENCES public.subscription_plans(subscription_plan_id),
    provider                  VARCHAR(30),
    provider_customer_id      VARCHAR(100),
    provider_subscription_id  VARCHAR(100),
    contract_number           VARCHAR(60),
    license_status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    started_at                TIMESTAMP,
    current_period_start      TIMESTAMP,
    current_period_end        TIMESTAMP,
    cancel_at_period_end      BOOLEAN   NOT NULL DEFAULT FALSE,
    canceled_at               TIMESTAMP,
    ended_at                  TIMESTAMP,
    custom_seat_limit         INTEGER,
    custom_group_limit        INTEGER,
    custom_authority_limit    INTEGER,
    custom_certification_limit INTEGER,
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_license_period CHECK
        (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end >= current_period_start)
);

CREATE INDEX IF NOT EXISTS idx_institutional_licenses_institution
    ON public.institutional_licenses(institution_id, license_status);

-- ---------------------------------------------------------------------------
-- Seed default plans (prices/limits editable later by platform admins)
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription_plans
    (plan_code, plan_name, customer_type, description, billing_interval, amount, is_free, is_custom_pricing, display_order)
VALUES
    ('FREE', 'Free', 'INDIVIDUAL', 'Browse certifications and study all published lessons for free.', 'NONE', 0, TRUE, FALSE, 1),
    ('PRO_MONTHLY', 'REBYU Pro Monthly', 'INDIVIDUAL', 'Unlocks analytics, study plans, mock exams, battles and challenges.', 'MONTHLY', 499, FALSE, FALSE, 2),
    ('INSTITUTIONAL_STARTER', 'Institutional Starter', 'INSTITUTION', 'Entry institutional license.', 'ANNUAL', 59000, FALSE, FALSE, 3),
    ('INSTITUTIONAL_PROFESSIONAL', 'Institutional Professional', 'INSTITUTION', 'Institutional license with learner analytics and reports.', 'ANNUAL', 149000, FALSE, FALSE, 4),
    ('INSTITUTIONAL_INSTITUTION', 'Institutional Institution', 'INSTITUTION', 'Institutional license with org-wide analytics and audit logs.', 'ANNUAL', 349000, FALSE, FALSE, 5),
    ('INSTITUTIONAL_PILOT', 'Institutional Pilot', 'INSTITUTION', 'Short pilot license; fee creditable toward an annual plan.', 'CUSTOM', 25000, FALSE, FALSE, 6),
    ('CUSTOM_INSTITUTION', 'Custom Institution', 'INSTITUTION', 'Custom-priced institutional license (contact sales).', 'CUSTOM', 0, FALSE, TRUE, 7)
ON CONFLICT (plan_code) DO NOTHING;

-- Individual entitlements
INSERT INTO public.plan_entitlements (subscription_plan_id, entitlement_code, enabled)
SELECT p.subscription_plan_id, code, TRUE
FROM public.subscription_plans p
CROSS JOIN (VALUES
    ('CERTIFICATION_BROWSING'), ('LESSON_ACCESS'), ('BASIC_LEARNING'), ('BASIC_COMPLETION_TRACKING')
) AS c(code)
WHERE p.plan_code IN ('FREE', 'PRO_MONTHLY')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_entitlements (subscription_plan_id, entitlement_code, enabled)
SELECT p.subscription_plan_id, code, TRUE
FROM public.subscription_plans p
CROSS JOIN (VALUES
    ('DETAILED_PROGRESS'), ('PROGRESS_ANALYTICS'), ('MASTERY_ANALYTICS'), ('WEAKNESS_ANALYSIS'),
    ('PERSONALIZED_STUDY_PLAN'), ('MOCK_EXAM_ACCESS'), ('BATTLES_ACCESS'), ('CHALLENGES_ACCESS'),
    ('READINESS_ANALYSIS'), ('ADVANCED_RECOMMENDATIONS')
) AS c(code)
WHERE p.plan_code = 'PRO_MONTHLY'
ON CONFLICT DO NOTHING;

-- Institutional management + learner features (sponsored) + limits
INSERT INTO public.plan_entitlements (subscription_plan_id, entitlement_code, enabled, limit_value)
SELECT p.subscription_plan_id, e.code, TRUE, e.lim
FROM public.subscription_plans p
JOIN (VALUES
    ('INSTITUTIONAL_STARTER','SEAT_LIMIT',75), ('INSTITUTIONAL_STARTER','CERTIFICATION_ALLOCATION_LIMIT',2),
    ('INSTITUTIONAL_STARTER','GROUP_LIMIT',5), ('INSTITUTIONAL_STARTER','AUTHORITY_LIMIT',3),
    ('INSTITUTIONAL_STARTER','ORG_ADMIN_LIMIT',1),
    ('INSTITUTIONAL_PROFESSIONAL','SEAT_LIMIT',250), ('INSTITUTIONAL_PROFESSIONAL','CERTIFICATION_ALLOCATION_LIMIT',5),
    ('INSTITUTIONAL_PROFESSIONAL','GROUP_LIMIT',20), ('INSTITUTIONAL_PROFESSIONAL','AUTHORITY_LIMIT',10),
    ('INSTITUTIONAL_PROFESSIONAL','ORG_ADMIN_LIMIT',3),
    ('INSTITUTIONAL_INSTITUTION','SEAT_LIMIT',750), ('INSTITUTIONAL_INSTITUTION','CERTIFICATION_ALLOCATION_LIMIT',10),
    ('INSTITUTIONAL_INSTITUTION','GROUP_LIMIT',50), ('INSTITUTIONAL_INSTITUTION','AUTHORITY_LIMIT',25),
    ('INSTITUTIONAL_INSTITUTION','ORG_ADMIN_LIMIT',10),
    ('INSTITUTIONAL_PILOT','SEAT_LIMIT',50), ('INSTITUTIONAL_PILOT','CERTIFICATION_ALLOCATION_LIMIT',2),
    ('INSTITUTIONAL_PILOT','GROUP_LIMIT',3), ('INSTITUTIONAL_PILOT','AUTHORITY_LIMIT',2),
    ('INSTITUTIONAL_PILOT','ORG_ADMIN_LIMIT',1)
) AS e(plan_code, code, lim) ON e.plan_code = p.plan_code
ON CONFLICT DO NOTHING;

-- Institutional feature entitlements (management + sponsored learner features)
INSERT INTO public.plan_entitlements (subscription_plan_id, entitlement_code, enabled)
SELECT p.subscription_plan_id, e.code, TRUE
FROM public.subscription_plans p
JOIN (VALUES
    ('INSTITUTIONAL_STARTER','GROUP_MANAGEMENT'), ('INSTITUTIONAL_STARTER','AUTHORITY_MANAGEMENT'),
    ('INSTITUTIONAL_STARTER','LEARNER_ASSIGNMENT'), ('INSTITUTIONAL_STARTER','BASIC_MONITORING'),
    ('INSTITUTIONAL_PROFESSIONAL','GROUP_MANAGEMENT'), ('INSTITUTIONAL_PROFESSIONAL','AUTHORITY_MANAGEMENT'),
    ('INSTITUTIONAL_PROFESSIONAL','LEARNER_ASSIGNMENT'), ('INSTITUTIONAL_PROFESSIONAL','BASIC_MONITORING'),
    ('INSTITUTIONAL_PROFESSIONAL','DETAILED_GROUP_ANALYTICS'), ('INSTITUTIONAL_PROFESSIONAL','WEAKNESS_ANALYSIS'),
    ('INSTITUTIONAL_PROFESSIONAL','MASTERY_ANALYTICS'), ('INSTITUTIONAL_PROFESSIONAL','PERSONALIZED_STUDY_PLAN'),
    ('INSTITUTIONAL_PROFESSIONAL','MOCK_EXAM_ACCESS'), ('INSTITUTIONAL_PROFESSIONAL','READINESS_ANALYSIS'),
    ('INSTITUTIONAL_PROFESSIONAL','DETAILED_PROGRESS'), ('INSTITUTIONAL_PROFESSIONAL','PROGRESS_ANALYTICS'),
    ('INSTITUTIONAL_PROFESSIONAL','EXPORT_REPORTS'),
    ('INSTITUTIONAL_INSTITUTION','GROUP_MANAGEMENT'), ('INSTITUTIONAL_INSTITUTION','AUTHORITY_MANAGEMENT'),
    ('INSTITUTIONAL_INSTITUTION','LEARNER_ASSIGNMENT'), ('INSTITUTIONAL_INSTITUTION','BASIC_MONITORING'),
    ('INSTITUTIONAL_INSTITUTION','DETAILED_GROUP_ANALYTICS'), ('INSTITUTIONAL_INSTITUTION','WEAKNESS_ANALYSIS'),
    ('INSTITUTIONAL_INSTITUTION','MASTERY_ANALYTICS'), ('INSTITUTIONAL_INSTITUTION','PERSONALIZED_STUDY_PLAN'),
    ('INSTITUTIONAL_INSTITUTION','MOCK_EXAM_ACCESS'), ('INSTITUTIONAL_INSTITUTION','READINESS_ANALYSIS'),
    ('INSTITUTIONAL_INSTITUTION','DETAILED_PROGRESS'), ('INSTITUTIONAL_INSTITUTION','PROGRESS_ANALYTICS'),
    ('INSTITUTIONAL_INSTITUTION','EXPORT_REPORTS'), ('INSTITUTIONAL_INSTITUTION','ORG_WIDE_ANALYTICS'),
    ('INSTITUTIONAL_INSTITUTION','AUDIT_LOGS'), ('INSTITUTIONAL_INSTITUTION','ADVANCED_RECOMMENDATIONS'),
    ('INSTITUTIONAL_INSTITUTION','BATTLES_ACCESS'), ('INSTITUTIONAL_INSTITUTION','CHALLENGES_ACCESS'),
    ('INSTITUTIONAL_PILOT','GROUP_MANAGEMENT'), ('INSTITUTIONAL_PILOT','AUTHORITY_MANAGEMENT'),
    ('INSTITUTIONAL_PILOT','LEARNER_ASSIGNMENT'), ('INSTITUTIONAL_PILOT','BASIC_MONITORING')
) AS e(plan_code, code) ON e.plan_code = p.plan_code
ON CONFLICT DO NOTHING;
