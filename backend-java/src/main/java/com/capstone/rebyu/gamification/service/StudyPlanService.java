package com.capstone.rebyu.gamification.service;

import com.capstone.rebyu.gamification.entity.StudyPlan;
import com.capstone.rebyu.gamification.entity.StudyPlanTaskStatus;
import com.capstone.rebyu.gamification.repository.StudyPlanRepository;
import com.capstone.rebyu.gamification.repository.StudyPlanTaskStatusRepository;
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
 * The learner's study plan, for one certification or across all of them.
 *
 * <p>A null {@code certificationId} is the overall plan -- one schedule covering
 * everything the learner is enrolled in, built from the analytics page. It is
 * optional: nothing requires a learner to have one, and it neither replaces nor
 * is replaced by the per-certification plans.
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
  private final StudyPlanTaskStatusRepository taskStatusRepository;
  private final LearnerRepository learnerRepository;
  private final ObjectMapper mapper;

  /** One scheduled task's state, as the scheduler reads it. */
  public record TaskStatusDto(
      Long planId, String eventId, String status,
      LocalDateTime startedAt, LocalDateTime completedAt) {}

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

    // A plan replaces the one it regenerates within its own scope: a
    // certification's plan retires that certification's, and the overall plan
    // (no certificationId -- built from the analytics page across everything
    // the learner is enrolled in) retires the previous overall one. The two
    // scopes do not retire each other, so keeping an overall plan alongside a
    // per-certification one is a supported thing to do.
    List<StudyPlan> superseded = request.certificationId() == null
        ? planRepository.findByLearner_LearnerIdAndCertificationIdIsNullAndStatus(learnerId, ACTIVE)
        : planRepository.findByLearner_LearnerIdAndCertificationIdAndStatus(
            learnerId, request.certificationId(), ACTIVE);

    for (StudyPlan previous : superseded) {
      previous.setStatus(ABANDONED);
      planRepository.save(previous);
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

  /**
   * The learner's active overall plan -- the one spanning several
   * certifications rather than belonging to one.
   *
   * <p>Asked for by name rather than by passing a null certificationId to
   * {@link #activePlan}, which means "newest of any scope" and would hand back
   * a certification's own plan whenever one is more recent.
   *
   * @return null when there is none, which is the normal case: an overall plan
   *         is optional
   */
  @Transactional(readOnly = true)
  public StudyPlanDto overallPlan(Long learnerId) {
    return planRepository
        .findFirstByLearner_LearnerIdAndCertificationIdIsNullAndStatusOrderByCreatedAtDesc(
            learnerId, ACTIVE)
        .map(this::toDto)
        .orElse(null);
  }

  @Transactional(readOnly = true)
  public List<StudyPlanDto> getUserPlans(Long learnerId) {
    return planRepository.findByLearner_LearnerIdOrderByCreatedAtDesc(learnerId)
        .stream().map(this::toDto).toList();
  }

  /**
   * Every task status the learner has recorded, across all their plans.
   *
   * <p>All of them in one call because the scheduler watches every active plan
   * at once: fetched per plan, this would be a request per plan on every page
   * load, to answer one question.
   */
  @Transactional(readOnly = true)
  public List<TaskStatusDto> taskStatuses(Long learnerId) {
    return taskStatusRepository.findByLearner_LearnerId(learnerId).stream()
        .map(row -> new TaskStatusDto(
            row.getPlan() == null ? null : row.getPlan().getPlanId(),
            row.getEventId(), row.getStatus(), row.getStartedAt(), row.getCompletedAt()))
        .toList();
  }

  /**
   * Records what has become of one scheduled task.
   *
   * <p>Upserted on (plan, event): a task is started, then finished, and the
   * second call must move the same row rather than add a second opinion about
   * the same session.
   */
  @Transactional
  public TaskStatusDto setTaskStatus(Long learnerId, Long planId, String eventId, String status) {
    String normalised = status == null ? "" : status.trim().toUpperCase();
    if (!List.of(StudyPlanTaskStatus.IN_PROGRESS, StudyPlanTaskStatus.COMPLETED,
        StudyPlanTaskStatus.SKIPPED).contains(normalised)) {
      throw new IllegalArgumentException("Unsupported task status: " + status);
    }
    if (eventId == null || eventId.isBlank()) {
      throw new IllegalArgumentException("A task id is required");
    }

    StudyPlan plan = planRepository.findById(planId)
        .orElseThrow(() -> new EntityNotFoundException("Study plan not found: " + planId));

    // Another learner's plan is reported as simply not found, matching
    // completePlan -- never confirming that someone else's plan exists.
    if (learnerId == null || plan.getLearner() == null
        || !plan.getLearner().getLearnerId().equals(learnerId)) {
      throw new EntityNotFoundException("Study plan not found: " + planId);
    }

    StudyPlanTaskStatus row = taskStatusRepository
        .findByPlan_PlanIdAndEventId(planId, eventId)
        .orElseGet(() -> {
          StudyPlanTaskStatus created = new StudyPlanTaskStatus();
          created.setPlan(plan);
          created.setLearner(plan.getLearner());
          created.setEventId(eventId);
          return created;
        });

    LocalDateTime now = LocalDateTime.now();
    row.setStatus(normalised);
    row.setUpdatedAt(now);

    // Kept from the first start rather than overwritten, so a resumed session
    // still reports when the learner actually began it.
    if (StudyPlanTaskStatus.IN_PROGRESS.equals(normalised) && row.getStartedAt() == null) {
      row.setStartedAt(now);
    }
    if (StudyPlanTaskStatus.COMPLETED.equals(normalised)) {
      row.setCompletedAt(now);
    }

    StudyPlanTaskStatus saved = taskStatusRepository.save(row);
    return new TaskStatusDto(planId, saved.getEventId(), saved.getStatus(),
        saved.getStartedAt(), saved.getCompletedAt());
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
