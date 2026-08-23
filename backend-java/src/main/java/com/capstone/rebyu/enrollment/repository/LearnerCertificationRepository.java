package com.capstone.rebyu.enrollment.repository;

import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearnerCertificationRepository extends JpaRepository<LearnerCertification, Long> {

    java.util.Optional<LearnerCertification> findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
            Long learnerId, Long certificationId, LearnerCertification.Status status);

    java.util.List<LearnerCertification> findByLearner_LearnerId(Long learnerId);

    boolean existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
            Long learnerId, Long certificationId, LearnerCertification.Status status);

    long countByStatus(LearnerCertification.Status status);

    /** One row per certification: how many distinct people are studying it. */
    interface CertificationEnrolment {
        Long getCertificationId();
        String getTitle();
        long getLearners();
        long getEnrollments();
    }

    /**
     * Learners per certification, in one grouped query.
     *
     * COUNT(DISTINCT learner) rather than COUNT(*): a learner can hold more than
     * one enrollment row against the same certification over time, and the chart
     * is asking how many people are studying it, not how many rows exist.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT c.certificationId AS certificationId,
                   c.title AS title,
                   COUNT(DISTINCT lc.learner.learnerId) AS learners,
                   COUNT(lc) AS enrollments
            FROM LearnerCertification lc
            JOIN lc.certification c
            WHERE lc.status = :status
            GROUP BY c.certificationId, c.title
            ORDER BY COUNT(DISTINCT lc.learner.learnerId) DESC
            """)
    java.util.List<CertificationEnrolment> learnersPerCertification(
            @org.springframework.data.repository.query.Param("status") LearnerCertification.Status status);

    /**
     * Distinct learners with at least one active enrollment -- "how many people
     * are currently taking a certification", which is not the enrollment count:
     * one learner can hold several at once.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT COUNT(DISTINCT lc.learner.learnerId) FROM LearnerCertification lc
            WHERE lc.status = :status
            """)
    long countDistinctLearnersByStatus(
            @org.springframework.data.repository.query.Param("status") LearnerCertification.Status status);
}
