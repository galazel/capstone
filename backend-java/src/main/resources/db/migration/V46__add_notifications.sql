-- Generic in-app notification, one row per (user, event) -- unlike
-- learner_community_notifications (learner-only, community events), this is
-- keyed to any User so ADMIN and ENTERPRISE accounts can receive
-- notifications too (partnership requests, invitations, and so on).
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    href VARCHAR(240),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
