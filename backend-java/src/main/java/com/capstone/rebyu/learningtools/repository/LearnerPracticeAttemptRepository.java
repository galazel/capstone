package com.capstone.rebyu.learningtools.repository;

import com.capstone.rebyu.learningtools.entity.LearnerPracticeAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LearnerPracticeAttemptRepository extends JpaRepository<LearnerPracticeAttempt, Long> {

    Optional<LearnerPracticeAttempt> findFirstByLearner_LearnerIdAndSourceTypeAndSourceIdAndStatusOrderByStartedAtDesc(
            Long learnerId, String sourceType, Long sourceId, String status);

    Optional<LearnerPracticeAttempt> findByAttemptIdAndLearner_LearnerId(Long attemptId, Long learnerId);

    /** Title comes from a separate join since source_id may point at different tables depending on sourceType. */
    @Query("""
            SELECT a, s.title FROM LearnerPracticeAttempt a
            LEFT JOIN GeneratedStudySet s ON s.studySetId = a.sourceId
            WHERE a.learner.learnerId = :learnerId
            ORDER BY COALESCE(a.completedAt, a.startedAt) DESC
            """)
    List<Object[]> findHistoryWithTitle(@Param("learnerId") Long learnerId);

    @Query("""
            SELECT a, s.title FROM LearnerPracticeAttempt a
            LEFT JOIN GeneratedStudySet s ON s.studySetId = a.sourceId
            WHERE a.learner.learnerId = :learnerId AND a.attemptId = :attemptId
            """)
    Optional<Object[]> findOneWithTitle(@Param("learnerId") Long learnerId, @Param("attemptId") Long attemptId);
}
