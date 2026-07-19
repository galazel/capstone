package com.capstone.rebyu.gamification.service;

import com.capstone.rebyu.gamification.entity.StudyPlan;
import com.capstone.rebyu.gamification.repository.StudyPlanRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class StudyPlanService {
  @Autowired private StudyPlanRepository planRepository;
  @Autowired private LearnerRepository learnerRepository;
  private ObjectMapper mapper = new ObjectMapper();

  public record StudyPlanDto(Long planId, String goal, Map<String, Object> schedule, String status) {}

  @Transactional
  public StudyPlanDto generatePlan(Long learnerId, String goal) {
    Learner learner = learnerRepository.findById(learnerId).orElseThrow();

    // TODO: generate a real schedule via AI instead of an empty stub.
    String scheduleJson = "{}";

    StudyPlan plan = new StudyPlan();
    plan.setLearner(learner);
    plan.setGoal(goal);
    plan.setSchedule(scheduleJson);
    plan.setStatus("ACTIVE");
    plan.setCreatedAt(LocalDateTime.now());

    StudyPlan saved = planRepository.save(plan);
    return toDto(saved);
  }

  public List<StudyPlanDto> getUserPlans(Long learnerId) {
    return planRepository.findByLearner_LearnerIdOrderByCreatedAtDesc(learnerId)
        .stream().map(this::toDto).toList();
  }

  @Transactional
  public void completeWeek(Long planId, Long learnerId) {
    StudyPlan plan = planRepository.findById(planId)
        .orElseThrow(() -> new EntityNotFoundException("Study plan not found: " + planId));
    if (learnerId == null || !plan.getLearner().getLearnerId().equals(learnerId)) {
      throw new EntityNotFoundException("Study plan not found: " + planId);
    }
    plan.setCompletedAt(LocalDateTime.now());
    plan.setStatus("COMPLETED");
    planRepository.save(plan);
  }

  private StudyPlanDto toDto(StudyPlan plan) {
    try {
      var schedule = mapper.readValue(plan.getSchedule(), Map.class);
      return new StudyPlanDto(plan.getPlanId(), plan.getGoal(), schedule, plan.getStatus());
    } catch (Exception e) {
      return new StudyPlanDto(plan.getPlanId(), plan.getGoal(), Map.of(), plan.getStatus());
    }
  }
}
