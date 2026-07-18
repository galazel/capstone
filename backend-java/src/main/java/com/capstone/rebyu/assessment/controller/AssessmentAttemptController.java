package com.capstone.rebyu.assessment.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.assessment.dto.AssessmentAttemptDto;
import com.capstone.rebyu.assessment.service.AssessmentAttemptService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.preauthorize.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assessments")
public class AssessmentAttemptController {

  @Autowired
  private AssessmentAttemptService attemptService;

  @PostMapping("/{assessmentId}/attempts")
  @PreAuthorize("hasRole('LEARNER')")
  @ResponseStatus(HttpStatus.CREATED)
  public AssessmentAttemptDto startAttempt(
      @PathVariable Long assessmentId,
      @RequestAttribute CurrentUserDto currentUser) {
    return attemptService.startAttempt(assessmentId, currentUser.getLearnerId());
  }

  @PostMapping("/attempts/{attemptId}/submit-answer")
  @PreAuthorize("hasRole('LEARNER')")
  public AssessmentAttemptDto submitAnswer(
      @PathVariable Long attemptId,
      @RequestParam Long questionId,
      @RequestParam String answer,
      @RequestAttribute CurrentUserDto currentUser) {
    return attemptService.submitAnswer(attemptId, questionId, answer, currentUser.getLearnerId());
  }

  @PostMapping("/attempts/{attemptId}/submit")
  @PreAuthorize("hasRole('LEARNER')")
  public AssessmentAttemptDto submitAttempt(
      @PathVariable Long attemptId,
      @RequestAttribute CurrentUserDto currentUser) {
    return attemptService.submitAttempt(attemptId, currentUser.getLearnerId());
  }
}
