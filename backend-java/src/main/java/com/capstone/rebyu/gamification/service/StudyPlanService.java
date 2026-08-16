package com.capstone.rebyu.gamification.service;

import com.capstone.rebyu.gamification.entity.StudyPlan;
import com.capstone.rebyu.gamification.repository.StudyPlanRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * The learner's study plan for a certification.
 *
 * <p>The schedule itself is built in the browser (see the study-plan generator:
 * it turns the diagnostic's priority topics, the target exam date, and the
 * chosen study days into dated events). This service is where that result is
 * kept, which is the whole difference between a plan and a form the learner
 * filled in once -- before this it lived in React state and was gone on
 * reload, and the stub here saved an empty {@code "{}"} schedule.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudyPlanService {

  private static final String ACTIVE = "ACTIVE";
  private static final String COMPLETED = "COMPLETED";
  private static final String ABANDONED = "ABANDONED";

  private final StudyPlanRepository planRepository;
  private final LearnerRepository learnerRepository;
  private final ObjectMapper mapper;

  /** What the browser sends after generating: the plan, whole. */
  public record SavePlanRequest(Long certificationId, String goal, Map<String, Object> schedule) {}

  public record StudyPlanDto(
      Long planId,
      Long certificationId,
      String goal,
      Map<String, Object> schedule,
      String status,
      LocalDateTime createdAt) {}

  /**
   * Stores a freshly generated plan, retiring whatever the learner was
   * following for that certification.
   *
   * <p>Regenerating is a normal thing to do -- an exam date moves, a diagnostic
   * is retaken -- so the previous plan is marked ABANDONED rather than deleted:
   * "what was I following in March" stays answerable, and only one plan per
   * certification is ever ACTIVE.
   */
  @Transactional
  public StudyPlanDto savePlan(Long learnerId, SavePlanRequest request) {
    Learner learner = learnerRepository.findById(learnerId)
        .orElseThrow(() -> new EntityNotFoundException("Learner not found: " + learnerId));

    if (request.certificationId() != null) {
      for (StudyPlan previous : planRepository.findByLearner_LearnerIdAndCertificationIdAndStatus(
          learnerId, request.certificationId(), ACTIVE)) {
        previous.setStatus(ABANDONED);
        planRepository.save(previous);
      }
    }

    StudyPlan plan = new StudyPlan();
    plan.setLearner(learner);
    plan.setCertificationId(request.certificationId());
    plan.setGoal(request.goal());
    plan.setSchedule(writeSchedule(request.schedule()));
    plan.setStatus(ACTIVE);
    plan.setCreatedAt(LocalDateTime.now());

    StudyPlan saved = planRepository.save(plan);
    log.info("Study plan {} saved for learner {} (certification {})",
        saved.getPlanId(), learnerId, request.certificationId());
    return toDto(saved);
  }

  /**
   * The plan the learner is currently following: for one certification when an
   * id is given, otherwise their most recent one -- which is what the calendar
   * page shows, since it is not scoped to a certification.
   *
   * @return null when there is no active plan, which is a normal state and not
   *         an error -- it is exactly what tells the curriculum page to offer
   *         the generator
   */
  @Transactional(readOnly = true)
  public StudyPlanDto activePlan(Long learnerId, Long certificationId) {
    return (certificationId == null
        ? planRepository.findFirstByLearner_LearnerIdAndStatusOrderByCreatedAtDesc(learnerId, ACTIVE)
        : planRepository.findFirstByLearner_LearnerIdAndCertificationIdAndStatusOrderByCreatedAtDesc(
            learnerId, certificationId, ACTIVE))
        .map(this::toDto)
        .orElse(null);
  }

  @Transactional(readOnly = true)
  public List<StudyPlanDto> getUserPlans(Long learnerId) {
    return planRepository.findByLearner_LearnerIdOrderByCreatedAtDesc(learnerId)
        .stream().map(this::toDto).toList();
  }

  @Transactional
  public void completePlan(Long planId, Long learnerId) {
    StudyPlan plan = planRepository.findById(planId)
        .orElseThrow(() -> new EntityNotFoundException("Study plan not found: " + planId));
    if (learnerId == null || !plan.getLearner().getLearnerId().equals(learnerId)) {
      // Another learner's plan is reported as simply not found.
      throw new EntityNotFoundException("Study plan not found: " + planId);
    }
    plan.setCompletedAt(LocalDateTime.now());
    plan.setStatus(COMPLETED);
    planRepository.save(plan);
  }

  private String writeSchedule(Map<String, Object> schedule) {
    try {
      return mapper.writeValueAsString(schedule == null ? Map.of() : schedule);
    } catch (Exception e) {
      throw new IllegalArgumentException("The study plan could not be stored: " + e.getMessage());
    }
  }

  private StudyPlanDto toDto(StudyPlan plan) {
    Map<String, Object> schedule = Map.of();
    try {
      if (plan.getSchedule() != null && !plan.getSchedule().isBlank()) {
        schedule = mapper.readValue(plan.getSchedule(), Map.class);
      }
    } catch (Exception e) {
      // A plan whose JSON cannot be parsed still exists and still has a goal
      // and a status; returning it without its schedule beats 500-ing the
      // curriculum page it is read from.
      log.warn("Study plan {} has an unreadable schedule: {}", plan.getPlanId(), e.getMessage());
    }
    return new StudyPlanDto(
        plan.getPlanId(), plan.getCertificationId(), plan.getGoal(),
        schedule, plan.getStatus(), plan.getCreatedAt());
  }
}
