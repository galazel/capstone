package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssessmentAttemptRepository extends JpaRepository<AssessmentAttempt, Long> {

    /** Reconciliation: page through finalized attempts newest-first. */
    List<AssessmentAttempt> findByStatusOrderBySubmittedAtDesc(
            AssessmentAttempt.Status status, Pageable pageable);

    Optional<AssessmentAttempt> findByIdempotencyKey(String idempotencyKey);

    Optional<AssessmentAttempt> findFirstByExam_ExamIdAndLearnerIdAndStatus(
            Long examId, Long learnerId, AssessmentAttempt.Status status);

    Optional<AssessmentAttempt> findTopByExam_ExamIdAndLearnerIdOrderByAttemptNumberDesc(
            Long examId, Long learnerId);

    List<AssessmentAttempt> findByLearnerIdOrderByStartedAtDesc(Long learnerId);

    List<AssessmentAttempt> findByExam_ExamIdAndLearnerIdOrderByAttemptNumberDesc(
            Long examId, Long learnerId);

    boolean existsByExam_ExamIdAndLearnerIdAndStatus(
            Long examId, Long learnerId, AssessmentAttempt.Status status);

    List<AssessmentAttempt> findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
            Long learnerId, Long certificationId, AssessmentAttempt.Status status);

    /** Past graded attempts of this exam by this learner, for adaptive retake analysis. */
    List<AssessmentAttempt> findByExam_ExamIdAndLearnerIdAndStatus(
            Long examId, Long learnerId, AssessmentAttempt.Status status);

    // --- Platform aggregates (admin dashboard) -----------------------------

    long countByStatus(AssessmentAttempt.Status status);

    long countByStatusAndPassed(AssessmentAttempt.Status status, Boolean passed);

    /** Mean percentage across graded attempts. Null when nothing is graded yet. */
    @org.springframework.data.jpa.repository.Query("""
            SELECT AVG(a.percentage) FROM AssessmentAttempt a
            WHERE a.status = :status AND a.percentage IS NOT NULL
            """)
    Double averagePercentageByStatus(
            @org.springframework.data.repository.query.Param("status") AssessmentAttempt.Status status);

    long countByStatusAndSubmittedAtGreaterThanEqual(
            AssessmentAttempt.Status status, java.time.LocalDateTime since);

    // --- Per-learner rollups (enterprise dashboard) ------------------------

    /** One row per learner. Projection interface so the rollup stays in SQL. */
    interface LearnerAttemptStats {
        Long getLearnerId();
        long getAttempts();
        long getPassedAttempts();
        Double getAverageScore();
        java.time.LocalDateTime getLastSubmittedAt();
    }

    /**
     * Graded-attempt statistics for a whole roster in one query.
     *
     * Batched on purpose: the enterprise dashboard renders a row per member,
     * and doing this per learner is the N+1 that makes a 200-seat organization's
     * dashboard take seconds.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT a.learnerId AS learnerId,
                   COUNT(a) AS attempts,
                   SUM(CASE WHEN a.passed = TRUE THEN 1 ELSE 0 END) AS passedAttempts,
                   AVG(a.percentage) AS averageScore,
                   MAX(a.submittedAt) AS lastSubmittedAt
            FROM AssessmentAttempt a
            WHERE a.learnerId IN :learnerIds AND a.status = :status
            GROUP BY a.learnerId
            """)
    List<LearnerAttemptStats> statsByLearnerIds(
            @org.springframework.data.repository.query.Param("learnerIds") java.util.Collection<Long> learnerIds,
            @org.springframework.data.repository.query.Param("status") AssessmentAttempt.Status status);
}
