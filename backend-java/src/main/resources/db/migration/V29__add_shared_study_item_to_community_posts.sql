ALTER TABLE community_posts
    ADD COLUMN IF NOT EXISTS shared_library_item_id BIGINT
        REFERENCES learner_library_items(library_item_id) ON DELETE SET NULL;

ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS community_posts_post_type_check;
ALTER TABLE community_posts
    ADD CONSTRAINT community_posts_post_type_check
        CHECK (post_type IN ('discussion', 'quiz', 'flashcard', 'quizzes', 'notes', 'docx', 'circle'));
