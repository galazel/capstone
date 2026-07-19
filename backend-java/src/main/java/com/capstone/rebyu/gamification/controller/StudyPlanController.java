package com.capstone.rebyu.gamification.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.gamification.service.StudyPlanService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/study-plans")
public class StudyPlanController {
  @Autowired private StudyPlanService studyPlanService;

  @PostMapping("/generate")
  @PreAuthorize("hasRole('LEARNER')")
  @ResponseStatus(HttpStatus.CREATED)
  public StudyPlanService.StudyPlanDto generatePlan(
      @RequestBody Map<String, String> request,
      @RequestAttribute CurrentUserDto currentUser) {
    return studyPlanService.generatePlan(currentUser.getLearnerId(), request.get("goal"));
  }

  @GetMapping("/my-plans")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<List<StudyPlanService.StudyPlanDto>> getMyPlans(
      @RequestAttribute CurrentUserDto currentUser) {
    return ResponseEntity.ok(studyPlanService.getUserPlans(currentUser.getLearnerId()));
  }

  @PostMapping("/{planId}/complete")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<?> completePlan(
      @PathVariable Long planId,
      @RequestAttribute CurrentUserDto currentUser) {
    studyPlanService.completeWeek(planId, currentUser.getLearnerId());
    return ResponseEntity.ok().build();
  }
}
