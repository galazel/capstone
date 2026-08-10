package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.CommunityPostMemberId;
import com.capstone.rebyu.community.entity.CommunitySavedPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommunitySavedPostRepository extends JpaRepository<CommunitySavedPost, CommunityPostMemberId> {

    /** Insert rather than save() -- see the note on CommunityPostLikeRepository.addLike. */
    @Modifying
    @Query(value = """
            INSERT INTO community_saved_posts(post_id, learner_id, created_at)
            VALUES (:postId, :learnerId, now())
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    void addSave(@Param("postId") Long postId, @Param("learnerId") Long learnerId);

    long countByPost_PostId(Long postId);

    boolean existsByPost_PostIdAndLearner_LearnerId(Long postId, Long learnerId);

    void deleteByPost_PostIdAndLearner_LearnerId(Long postId, Long learnerId);

    List<CommunitySavedPost> findByLearner_LearnerIdOrderByCreatedAtDesc(Long learnerId);
}
