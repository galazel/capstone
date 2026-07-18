package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.CommunityPostReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface CommunityPostReportRepository extends JpaRepository<CommunityPostReport, Long> {

    Optional<CommunityPostReport> findByPost_PostIdAndReporter_LearnerId(Long postId, Long reporterLearnerId);

    @Query("""
            SELECT r FROM CommunityPostReport r
            JOIN FETCH r.post p JOIN FETCH p.author JOIN FETCH r.reporter
            WHERE r.status = :status ORDER BY r.createdAt ASC
            """)
    List<CommunityPostReport> findByStatusOrderByCreatedAtAsc(@Param("status") String status);

    /** Re-reporting the same post reopens it with the new reason/details instead of duplicating a row. */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO community_post_reports(post_id, reporter_learner_id, reason, details)
            VALUES (:postId, :reporterLearnerId, :reason, :details)
            ON CONFLICT (post_id, reporter_learner_id) DO UPDATE SET reason=EXCLUDED.reason,
                details=EXCLUDED.details, status='OPEN', created_at=now(), reviewed_at=null, reviewed_by_user_id=null
            """, nativeQuery = true)
    void upsertReport(@Param("postId") Long postId, @Param("reporterLearnerId") Long reporterLearnerId,
                       @Param("reason") String reason, @Param("details") String details);
}
