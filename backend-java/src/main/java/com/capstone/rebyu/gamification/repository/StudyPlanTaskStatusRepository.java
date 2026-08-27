package com.capstone.rebyu.gamification.repository;

import com.capstone.rebyu.gamification.entity.StudyPlanTaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudyPlanTaskStatusRepository extends JpaRepository<StudyPlanTaskStatus, Long> {

  /** Every recorded status on one plan -- what the scheduler reads on load. */
  List<StudyPlanTaskStatus> findByPlan_PlanId(Long planId);

  /**
   * Every recorded status the learner has, across plans. The scheduler watches
   * all active plans at once, so fetching per plan would be a request per plan
   * on every page load.
   */
  List<StudyPlanTaskStatus> findByLearner_LearnerId(Long learnerId);

  Optional<StudyPlanTaskStatus> findByPlan_PlanIdAndEventId(Long planId, String eventId);
}
