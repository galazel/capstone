package com.capstone.rebyu.learningtools.repository;

import com.capstone.rebyu.learningtools.entity.LearnerReviewItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface LearnerReviewItemRepository extends JpaRepository<LearnerReviewItem, Long> {

  /** Everything due on or before a date, soonest-due first. */
  List<LearnerReviewItem> findByLearner_LearnerIdAndCertificationIdAndDueOnLessThanEqualOrderByDueOnAsc(
      Long learnerId, Long certificationId, LocalDate dueOn);

  Optional<LearnerReviewItem> findByLearner_LearnerIdAndSourceQuestion_QuestionId(
      Long learnerId, Long questionId);

  /**
   * Which of these questions the learner is already tracking.
   *
   * <p>Seeding needs to add only what is new, and asking per question would be
   * a round trip per candidate.
   */
  @org.springframework.data.jpa.repository.Query("""
      select item.sourceQuestion.questionId from LearnerReviewItem item
      where item.learner.learnerId = :learnerId
        and item.sourceQuestion.questionId in :questionIds
      """)
  Set<Long> findTrackedQuestionIds(Long learnerId, Set<Long> questionIds);

  long countByLearner_LearnerIdAndCertificationId(Long learnerId, Long certificationId);
}
