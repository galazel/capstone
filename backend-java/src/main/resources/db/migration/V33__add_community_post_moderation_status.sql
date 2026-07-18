ALTER TABLE community_posts
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(16) NOT NULL DEFAULT 'VISIBLE'
        CHECK (moderation_status IN ('VISIBLE', 'HIDDEN'));

CREATE INDEX IF NOT EXISTS idx_community_posts_moderation_status ON community_posts(moderation_status);
