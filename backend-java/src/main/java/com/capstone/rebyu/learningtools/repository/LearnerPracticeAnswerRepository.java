package com.capstone.rebyu.learningtools.repository;

import com.capstone.rebyu.learningtools.entity.LearnerPracticeAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LearnerPracticeAnswerRepository extends JpaRepository<LearnerPracticeAnswer, Long> {

    long countByAttempt_AttemptId(Long attemptId);

    long countByAttempt_AttemptIdAndIsCorrectTrue(Long attemptId);

    @Query("""
            SELECT a FROM LearnerPracticeAnswer a JOIN FETCH a.studyItem i
            WHERE a.attempt.attemptId = :attemptId ORDER BY i.displayOrder
            """)
    List<LearnerPracticeAnswer> findByAttemptIdOrderByItemDisplayOrder(@Param("attemptId") Long attemptId);

    /** Only MCQ items with a recorded objective answer feed BKT mastery evidence. */
    @Query("""
            SELECT a FROM LearnerPracticeAnswer a JOIN FETCH a.studyItem i
            WHERE a.attempt.attemptId = :attemptId AND i.itemType = 'MCQ' AND a.isCorrect IS NOT NULL
            """)
    List<LearnerPracticeAnswer> findMcqAnsweredByAttempt(@Param("attemptId") Long attemptId);

    /**
     * Atomic upsert preserving the original ON CONFLICT semantics: re-submitting the
     * same (attempt, item) pair updates the existing answer instead of duplicating it,
     * matching the uq_practice_answer_item constraint (V30).
     */
    @Modifying
    @Query(value = """
            INSERT INTO learner_practice_answers(attempt_id, study_item_id, learner_answer, normalized_answer, is_correct, score, flashcard_rating)
            VALUES (:attemptId, :studyItemId, :learnerAnswer, :normalizedAnswer, :isCorrect, :score, :flashcardRating)
            ON CONFLICT (attempt_id, study_item_id) DO UPDATE SET learner_answer=EXCLUDED.learner_answer,
              normalized_answer=EXCLUDED.normalized_answer, is_correct=EXCLUDED.is_correct, score=EXCLUDED.score,
              flashcard_rating=EXCLUDED.flashcard_rating, answered_at=now()
            """, nativeQuery = true)
    void upsertAnswer(@Param("attemptId") Long attemptId, @Param("studyItemId") Long studyItemId,
                       @Param("learnerAnswer") String learnerAnswer, @Param("normalizedAnswer") String normalizedAnswer,
                       @Param("isCorrect") boolean isCorrect, @Param("score") int score,
                       @Param("flashcardRating") String flashcardRating);
}
