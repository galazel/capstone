package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.CommunityPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    List<CommunityPost> findByPostTypeOrderByCreatedAtDesc(String postType);

    List<CommunityPost> findAllByOrderByCreatedAtDesc();

    long countByAuthor_LearnerId(Long learnerId);

    long deleteByPostIdAndAuthor_LearnerId(Long postId, Long learnerId);

    @Query("SELECT p.postId FROM CommunityPost p WHERE p.circle.circleId = :circleId")
    List<Long> findPostIdsByCircleId(@Param("circleId") Long circleId);

    /**
     * Deletes a post together with everything hanging off it, in one statement.
     *
     * <p>Not left to ON DELETE CASCADE: this environment builds its schema from
     * Hibernate {@code ddl-auto: update} (see SchemaDefaultsSeeder), and a
     * Hibernate-generated foreign key carries no ON DELETE rule -- so V24's
     * cascade does not exist here and deleting a commented post fails with 23503.
     *
     * <p>One statement matters. Postgres checks a NO ACTION key at the end of the
     * statement, so removing a comment and the reply pointing at it together is
     * fine, where row-by-row deletes would trip over their own ordering.
     *
     * <p>Callers must authorise BEFORE calling: the data-modifying CTEs run
     * regardless of whether the final DELETE matches a row.
     */
    @Modifying
    @Query(value = """
            WITH deleted_comments AS (DELETE FROM community_comments     WHERE post_id = :postId),
                 deleted_likes    AS (DELETE FROM community_post_likes   WHERE post_id = :postId),
                 deleted_saves    AS (DELETE FROM community_saved_posts  WHERE post_id = :postId),
                 deleted_shares   AS (DELETE FROM community_post_shares  WHERE post_id = :postId),
                 deleted_reports  AS (DELETE FROM community_post_reports WHERE post_id = :postId)
            DELETE FROM community_posts WHERE post_id = :postId
            """, nativeQuery = true)
    void deletePostWithEngagement(@Param("postId") Long postId);

    /**
     * Single aggregate query backing the community feed: per-post reaction/comment counts and the
     * viewer's liked/saved/owned flags via correlated subqueries, matching the previous raw-SQL
     * shape exactly. Optional filters use the "(:param IS NULL OR ...)" idiom so this stays one
     * static query instead of building SQL strings dynamically.
     */
    @Query(value = """
            SELECT p.post_id AS postId, concat(l.first_name, ' ', l.last_name) AS authorName, c.name AS community,
              p.created_at AS createdAt, p.title AS title, p.body AS body, p.post_type AS postType, p.circle_id AS circleId,
              p.attachment_name AS attachmentName, p.attachment_type AS attachmentType, p.attachment_key AS attachmentKey,
              p.attachment_size AS attachmentSize,
              (SELECT count(*) FROM community_post_likes x WHERE x.post_id=p.post_id) AS reactions,
              (SELECT count(*) FROM community_comments x WHERE x.post_id=p.post_id) AS comments,
              (SELECT count(*) FROM community_saved_posts x WHERE x.post_id=p.post_id) AS saves,
              EXISTS(SELECT 1 FROM community_post_likes x WHERE x.post_id=p.post_id AND x.learner_id=:learnerId) AS liked,
              EXISTS(SELECT 1 FROM community_saved_posts x WHERE x.post_id=p.post_id AND x.learner_id=:learnerId) AS saved,
              (p.author_learner_id=:learnerId) AS ownedByMe
            FROM community_posts p
            JOIN learners l ON l.learner_id=p.author_learner_id
            LEFT JOIN community_circles c ON c.circle_id=p.circle_id
            WHERE p.moderation_status='VISIBLE'
              AND (CAST(:type AS varchar) IS NULL OR p.post_type=:type)
              AND (CAST(:searchPattern AS varchar) IS NULL OR lower(p.title || ' ' || p.body || ' ' || concat(l.first_name,' ',l.last_name)) LIKE :searchPattern)
              AND (:savedOnly = false OR EXISTS(SELECT 1 FROM community_saved_posts s WHERE s.post_id=p.post_id AND s.learner_id=:learnerId))
            ORDER BY p.created_at DESC LIMIT 200
            """, nativeQuery = true)
    List<CommunityPostRow> feed(@Param("learnerId") Long learnerId, @Param("type") String type,
                                 @Param("searchPattern") String searchPattern, @Param("savedOnly") boolean savedOnly);

    @Query(value = """
            SELECT p.post_id AS postId, concat(l.first_name, ' ', l.last_name) AS authorName, c.name AS community,
              p.created_at AS createdAt, p.title AS title, p.body AS body, p.post_type AS postType, p.circle_id AS circleId,
              p.attachment_name AS attachmentName, p.attachment_type AS attachmentType, p.attachment_key AS attachmentKey,
              p.attachment_size AS attachmentSize,
              (SELECT count(*) FROM community_post_likes x WHERE x.post_id=p.post_id) AS reactions,
              (SELECT count(*) FROM community_comments x WHERE x.post_id=p.post_id) AS comments,
              (SELECT count(*) FROM community_saved_posts x WHERE x.post_id=p.post_id) AS saves,
              EXISTS(SELECT 1 FROM community_post_likes x WHERE x.post_id=p.post_id AND x.learner_id=:learnerId) AS liked,
              EXISTS(SELECT 1 FROM community_saved_posts x WHERE x.post_id=p.post_id AND x.learner_id=:learnerId) AS saved,
              (p.author_learner_id=:learnerId) AS ownedByMe
            FROM community_posts p
            JOIN learners l ON l.learner_id=p.author_learner_id
            LEFT JOIN community_circles c ON c.circle_id=p.circle_id
            WHERE p.post_id=:postId
            """, nativeQuery = true)
    Optional<CommunityPostRow> findRowById(@Param("postId") Long postId, @Param("learnerId") Long learnerId);
}
