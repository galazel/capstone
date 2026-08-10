-- Same problem as V52/V53, one table set further: Hibernate's `ddl-auto: update`
-- materialised these tables with NOT NULL but without the DEFAULT now() declared
-- in V24, so a native INSERT that omits the timestamp fails with 23502.
--
-- The upserts in CommunityPostLikeRepository, CommunitySavedPostRepository,
-- and CommunityCircleMemberRepository now write the
-- timestamp explicitly, so they no longer depend on this. Restoring the defaults
-- anyway keeps the live schema honest to the migrations and stops the next
-- native insert against these tables from rediscovering the same trap.
-- SET DEFAULT is idempotent and a no-op where the default survived.

-- V24 -- post engagement.
ALTER TABLE community_post_likes   ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE community_saved_posts  ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE community_comments     ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE community_comments     ALTER COLUMN updated_at SET DEFAULT now();

-- V24 -- circles and their membership (note: joined_at, not created_at).
ALTER TABLE community_circles        ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE community_circle_members ALTER COLUMN joined_at  SET DEFAULT now();

-- V24 -- posts themselves.
ALTER TABLE community_posts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE community_posts ALTER COLUMN updated_at SET DEFAULT now();

-- V56 -- shares (created by Flyway, so its default should already be present).
ALTER TABLE community_post_shares ALTER COLUMN created_at SET DEFAULT now();

-- No backfill needed: every column above is NOT NULL, which is why the missing
-- default failed loudly instead of writing nulls.
