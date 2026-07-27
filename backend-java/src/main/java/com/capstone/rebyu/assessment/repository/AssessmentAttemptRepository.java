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
}
