package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.CommunityCircleMember;
import com.capstone.rebyu.community.entity.CommunityCircleMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityCircleMemberRepository
        extends JpaRepository<CommunityCircleMember, CommunityCircleMemberId> {

    /** Insert rather than save() -- see the note on CommunityPostLikeRepository.addLike. */
    @Modifying
    @Query(value = """
            INSERT INTO community_circle_members(circle_id, learner_id, joined_at)
            VALUES (:circleId, :learnerId, now())
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    void addMember(@Param("circleId") Long circleId, @Param("learnerId") Long learnerId);

    /** Explicit, for the same reason as deletePostWithEngagement: no cascade to rely on. */
    @Modifying
    @Query(value = "DELETE FROM community_circle_members WHERE circle_id = :circleId", nativeQuery = true)
    void deleteMembersOfCircle(@Param("circleId") Long circleId);

    long countByCircle_CircleId(Long circleId);

    boolean existsByCircle_CircleIdAndLearner_LearnerId(Long circleId, Long learnerId);
}
