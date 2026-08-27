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

  /** Their most recent active plan of any scope -- what the calendar shows. */
  Optional<StudyPlan> findFirstByLearner_LearnerIdAndStatusOrderByCreatedAtDesc(
      Long learnerId, String status);

  /**
   * Their active overall plan specifically -- the one belonging to no single
   * certification.
   *
   * <p>Distinct from the finder above, which returns whatever plan is newest
   * whatever its scope: a learner holding an overall plan and a newer
   * certification-scoped one would get the certification's back from that, so
   * asking it for "the overall plan" quietly answers a different question.
   */
  Optional<StudyPlan> findFirstByLearner_LearnerIdAndCertificationIdIsNullAndStatusOrderByCreatedAtDesc(
      Long learnerId, String status);

  /** Existing active plans for a certification, so a regenerated plan can retire them. */
  List<StudyPlan> findByLearner_LearnerIdAndCertificationIdAndStatus(
      Long learnerId, Long certificationId, String status);

  /**
   * The same, for plans that belong to no certification -- the overall plan the
   * learner builds from the analytics page. A null certificationId cannot be
   * matched by the finder above: JPA renders it as {@code = null}, which is
   * never true, so those plans would never be retired and every regeneration
   * would leave another ACTIVE row behind.
   */
  List<StudyPlan> findByLearner_LearnerIdAndCertificationIdIsNullAndStatus(
      Long learnerId, String status);
}
