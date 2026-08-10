-- The third face of the V52/V53 problem: Hibernate's `ddl-auto: update` creates a
-- foreign key from the entity mapping, and the mapping carries no ON DELETE rule.
-- So on any community table Hibernate materialised first, V24's
-- "REFERENCES community_posts(post_id) ON DELETE CASCADE" came out as a plain
-- NO ACTION key with a generated name (fklrj6e98eodhkxqxolyyqowvbc and friends).
--
-- The visible symptom: deleting a post that has comments fails with 23503
-- instead of taking its comments with it. Every child of community_posts has the
-- same defect, and so does circle membership.
--
-- For each (child, column, parent) below: drop whatever foreign key currently
-- links that column to that parent, whatever it is named, then add ours back
-- with the intended ON DELETE rule and a deterministic name. Dropping first
-- makes this idempotent and safe to re-run.
DO $$
DECLARE
    spec RECORD;
    existing RECORD;
BEGIN
    FOR spec IN
        SELECT * FROM (VALUES
            -- Children of a post: deleting the post clears its engagement.
            ('community_comments',      'post_id',           'community_posts',   'CASCADE'),
            ('community_post_likes',    'post_id',           'community_posts',   'CASCADE'),
            ('community_saved_posts',   'post_id',           'community_posts',   'CASCADE'),
            ('community_post_shares',   'post_id',           'community_posts',   'CASCADE'),
            ('community_post_reports',  'post_id',           'community_posts',   'CASCADE'),
            -- A reply chain dies with the comment it hangs from.
            ('community_comments',      'parent_comment_id', 'community_comments', 'CASCADE'),
            -- Membership dies with the circle; posts survive it, unparented.
            ('community_circle_members', 'circle_id',        'community_circles', 'CASCADE'),
            ('community_posts',          'circle_id',        'community_circles', 'SET NULL')
        ) AS t(child, col, parent, action)
    LOOP
        FOR existing IN
            SELECT c.conname
            FROM pg_constraint c
            WHERE c.contype = 'f'
              AND c.conrelid = spec.child::regclass
              AND c.confrelid = spec.parent::regclass
              AND (SELECT a.attname FROM pg_attribute a
                   WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) = spec.col
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', spec.child, existing.conname);
        END LOOP;

        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I ON DELETE %s',
            spec.child, 'fk_' || spec.child || '_' || spec.col, spec.col, spec.parent, spec.action);
    END LOOP;
END $$;
