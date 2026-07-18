package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.CommunityCircle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommunityCircleRepository extends JpaRepository<CommunityCircle, Long> {

    List<CommunityCircle> findAllByOrderByCreatedAtDesc();

    @Query(value = """
            SELECT c.circle_id AS circleId, c.name AS name, c.description AS description, c.topic AS topic,
              (SELECT count(*) FROM community_circle_members m WHERE m.circle_id=c.circle_id) AS members,
              EXISTS(SELECT 1 FROM community_circle_members m WHERE m.circle_id=c.circle_id AND m.learner_id=:learnerId) AS joined,
              (c.owner_learner_id=:learnerId) AS owner
            FROM community_circles c
            ORDER BY members DESC, c.created_at DESC
            """, nativeQuery = true)
    List<CommunityCircleRow> feed(@Param("learnerId") Long learnerId);

    @Query(value = """
            SELECT c.circle_id AS circleId, c.name AS name, c.description AS description, c.topic AS topic,
              (SELECT count(*) FROM community_circle_members m WHERE m.circle_id=c.circle_id) AS members,
              EXISTS(SELECT 1 FROM community_circle_members m WHERE m.circle_id=c.circle_id AND m.learner_id=:learnerId) AS joined,
              (c.owner_learner_id=:learnerId) AS owner
            FROM community_circles c WHERE c.circle_id=:circleId
            """, nativeQuery = true)
    Optional<CommunityCircleRow> findRowById(@Param("circleId") Long circleId, @Param("learnerId") Long learnerId);
}
