package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.CommunityPostLike;
import com.capstone.rebyu.community.entity.CommunityPostMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityPostLikeRepository extends JpaRepository<CommunityPostLike, CommunityPostMemberId> {

    /**
     * Insert, not save(): this entity's id is assigned, so save() takes JPA's merge()
     * path and merge cannot resolve the id-only post/learner stubs. ON CONFLICT also
     * makes a double-click idempotent instead of a primary-key violation.
     */
    @Modifying
    @Query(value = """
            INSERT INTO community_post_likes(post_id, learner_id, created_at)
            VALUES (:postId, :learnerId, now())
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    void addLike(@Param("postId") Long postId, @Param("learnerId") Long learnerId);

    long countByPost_PostId(Long postId);

    boolean existsByPost_PostIdAndLearner_LearnerId(Long postId, Long learnerId);

    void deleteByPost_PostIdAndLearner_LearnerId(Long postId, Long learnerId);
}
