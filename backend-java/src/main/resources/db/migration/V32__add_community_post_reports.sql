CREATE TABLE community_post_reports (
    report_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(post_id) ON DELETE CASCADE,
    reporter_learner_id BIGINT NOT NULL REFERENCES learners(learner_id) ON DELETE CASCADE,
    reason VARCHAR(48) NOT NULL CHECK (reason IN ('SPAM', 'HARASSMENT', 'COPYRIGHT', 'EXAM_CONTENT', 'OTHER')),
    details TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT uq_community_reporter_post UNIQUE (post_id, reporter_learner_id)
);

CREATE INDEX idx_community_reports_status_created ON community_post_reports(status, created_at);
