CREATE INDEX IF NOT EXISTS idx_community_post_likes_post_learner
    ON community_post_likes(post_id, learner_id);

CREATE INDEX IF NOT EXISTS idx_community_saved_posts_post_learner
    ON community_saved_posts(post_id, learner_id);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_created
    ON community_comments(post_id, created_at);
