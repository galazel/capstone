package com.capstone.rebyu.gamification.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.gamification.service.StudyPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The signed-in learner's own study plans. Every learnerId is resolved from the
 * validated token -- never taken from the request -- so one learner can neither
 * read nor overwrite another's plan.
 *
 * <p>The role check is the explicit {@code me()} resolution below rather than
 * {@code @PreAuthorize("hasRole('LEARNER')")}, which is what this controller
 * used to carry: method security is not enabled in SecurityConfig, so that
 * annotation enforced nothing at all.
 */
@RestController
@RequestMapping("/api/study-plans")
@RequiredArgsConstructor
public class StudyPlanController {

  private final StudyPlanService studyPlanService;
  private final CognitoAuthService auth;

  /** Saves a generated plan, replacing whatever was active for that certification. */
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public StudyPlanService.StudyPlanDto save(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody StudyPlanService.SavePlanRequest request) {
    return studyPlanService.savePlan(me(jwt), request);
  }

  /**
   * The plan currently being followed, or {@code null} when there is none.
   *
   * <p>With {@code certificationId}, that certification's plan. With
   * {@code scope=overall}, the plan that spans several certifications. With
   * neither, the learner's most recent plan whatever its scope -- which is what
   * the study calendar shows, since it is not scoped to a certification.
   */
  @GetMapping("/me/active")
  public StudyPlanService.StudyPlanDto active(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(required = false) Long certificationId,
      @RequestParam(required = false) String scope) {
    Long learnerId = me(jwt);
    return "overall".equalsIgnoreCase(scope)
        ? studyPlanService.overallPlan(learnerId)
        : studyPlanService.activePlan(learnerId, certificationId);
  }

  @GetMapping("/my-plans")
  public List<StudyPlanService.StudyPlanDto> myPlans(@AuthenticationPrincipal Jwt jwt) {
    return studyPlanService.getUserPlans(me(jwt));
  }

  /** Every task status the learner has recorded, across all their plans. */
  @GetMapping("/me/tasks")
  public List<StudyPlanService.TaskStatusDto> taskStatuses(@AuthenticationPrincipal Jwt jwt) {
    return studyPlanService.taskStatuses(me(jwt));
  }

  /** Records that a scheduled task was started, finished, or passed over. */
  @PutMapping("/{planId}/tasks/{eventId}/status")
  public StudyPlanService.TaskStatusDto setTaskStatus(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable Long planId,
      @PathVariable String eventId,
      @RequestBody TaskStatusRequest request) {
    return studyPlanService.setTaskStatus(me(jwt), planId, eventId, request.status());
  }

  public record TaskStatusRequest(String status) {}

  @PostMapping("/{planId}/complete")
  public ResponseEntity<Void> complete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long planId) {
    studyPlanService.completePlan(planId, me(jwt));
    return ResponseEntity.ok().build();
  }

  private Long me(Jwt jwt) {
    if (jwt == null) {
      throw new IllegalArgumentException("Authentication is required");
    }
    CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
    if (user.learnerId() == null) {
      throw new IllegalArgumentException("A learner account is required");
    }
    return user.learnerId();
  }
}
