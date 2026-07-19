package com.capstone.rebyu.bkt.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.bkt.dto.ConfidenceView;
import com.capstone.rebyu.bkt.dto.LearnerMasteryView;
import com.capstone.rebyu.bkt.dto.LessonPriorityView;
import com.capstone.rebyu.bkt.dto.MasteryHistoryView;
import com.capstone.rebyu.bkt.service.BKTService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for BKT mastery data. All calculations are performed by the
 * FastAPI PyBKT service; this controller delegates via BKTService.
 */
@RestController
@RequestMapping("/api/bkt")
@RequiredArgsConstructor
public class BKTController {

  private final BKTService bktService;

  /**
   * Get learner's overall confidence/mastery in a certification
   * (aggregated across all lessons)
   */
  @GetMapping("/me/confidence/{certificationId}")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<ConfidenceView> getMyConfidence(
      @PathVariable Long certificationId,
      @RequestAttribute CurrentUserDto currentUser) {
    ConfidenceView confidence = bktService.getConfidence(currentUser.getLearnerId(), certificationId);
    return confidence != null
        ? ResponseEntity.ok(confidence)
        : ResponseEntity.notFound().build();
  }

  /**
   * Get learner's mastery across all lessons in a certification,
   * with priority/focus recommendations
   */
  @GetMapping("/me/lessons/{certificationId}")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<List<LessonPriorityView>> getMyLessonPriorities(
      @PathVariable Long certificationId,
      @RequestAttribute CurrentUserDto currentUser) {
    List<LessonPriorityView> priorities = bktService.getLessonPriorities(currentUser.getLearnerId(), certificationId);
    return ResponseEntity.ok(priorities);
  }

  /**
   * Get mastery history events (BKT updates over time)
   * for a learner-certification pair
   */
  @GetMapping("/me/history/{certificationId}")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<List<MasteryHistoryView>> getMyMasteryHistory(
      @PathVariable Long certificationId,
      @RequestAttribute CurrentUserDto currentUser) {
    List<MasteryHistoryView> history = bktService.getMasteryHistory(currentUser.getLearnerId(), certificationId);
    return ResponseEntity.ok(history);
  }

  /**
   * Get learner's overall mastery across all lessons (optional filtering)
   */
  @GetMapping("/me/mastery")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<LearnerMasteryView> getMyMastery(
      @RequestParam(required = false) List<Long> lessonIds,
      @RequestAttribute CurrentUserDto currentUser) {
    LearnerMasteryView mastery = bktService.getLearnerMastery(currentUser.getLearnerId(), lessonIds);
    return mastery != null
        ? ResponseEntity.ok(mastery)
        : ResponseEntity.noContent().build();
  }

  /**
   * Get generic confidence map for a learner-certification pair
   */
  @GetMapping("/me/confidence-map/{certificationId}")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<Map<String, Object>> getMyConfidenceMap(
      @PathVariable Long certificationId,
      @RequestAttribute CurrentUserDto currentUser) {
    Map<String, Object> confidenceMap = bktService.getConfidenceMap(currentUser.getLearnerId(), certificationId);
    return ResponseEntity.ok(confidenceMap);
  }
}
