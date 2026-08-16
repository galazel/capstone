package com.capstone.rebyu.gamification.repository;

import com.capstone.rebyu.gamification.entity.StudyPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudyPlanRepository extends JpaRepository<StudyPlan, Long> {
  List<StudyPlan> findByLearner_LearnerIdOrderByCreatedAtDesc(Long learnerId);

  /** The plan the learner is currently following for one certification, if any. */
  Optional<StudyPlan> findFirstByLearner_LearnerIdAndCertificationIdAndStatusOrderByCreatedAtDesc(
      Long learnerId, Long certificationId, String status);

  /** Their most recent active plan across every certification -- what the calendar shows. */
  Optional<StudyPlan> findFirstByLearner_LearnerIdAndStatusOrderByCreatedAtDesc(
      Long learnerId, String status);

  /** Existing active plans for a certification, so a regenerated plan can retire them. */
  List<StudyPlan> findByLearner_LearnerIdAndCertificationIdAndStatus(
      Long learnerId, Long certificationId, String status);
}
