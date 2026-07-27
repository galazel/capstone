package com.capstone.rebyu.bkt.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.bkt.dto.ConfidenceView;
import com.capstone.rebyu.bkt.dto.LearnerMasteryView;
import com.capstone.rebyu.bkt.dto.LessonPriorityView;
import com.capstone.rebyu.bkt.dto.MasteryHistoryView;
import com.capstone.rebyu.bkt.service.LearnerMasteryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for BKT mastery data. All calculations are performed by the
 * FastAPI PyBKT service; this controller delegates via LearnerMasteryService
 * (the single read facade over BktClient -- see its javadoc for why it's
 * preferred over hitting BktClient directly).
 */
@RestController
@RequestMapping("/api/bkt")
@RequiredArgsConstructor
public class BKTController {

  private final LearnerMasteryService learnerMasteryService;

  /**
   * Get learner's overall confidence/mastery in a certification
   * (aggregated across all lessons)
   */
  @GetMapping("/me/confidence/{certificationId}")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<ConfidenceView> getMyConfidence(
      @PathVariable Long certificationId,
      @RequestAttribute CurrentUserDto currentUser) {
    var result = learnerMasteryService.getConfidenceForAnalytics(currentUser.getLearnerId(), certificationId);
    return result.available() && result.confidence() != null
        ? ResponseEntity.ok(result.confidence())
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
    var result = learnerMasteryService.getLessonPrioritiesForAnalytics(currentUser.getLearnerId(), certificationId);
    return ResponseEntity.ok(result.lessons());
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
    var result = learnerMasteryService.getMasteryHistoryForAnalytics(currentUser.getLearnerId(), certificationId);
    return ResponseEntity.ok(result.history());
  }

  /**
   * Get learner's overall mastery across all lessons (optional filtering)
   */
  @GetMapping("/me/mastery")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<LearnerMasteryView> getMyMastery(
      @RequestParam(required = false) List<Long> lessonIds,
      @RequestAttribute CurrentUserDto currentUser) {
    LearnerMasteryView mastery = learnerMasteryService.getMastery(currentUser.getLearnerId(), lessonIds);
    return mastery.items().isEmpty()
        ? ResponseEntity.noContent().build()
        : ResponseEntity.ok(mastery);
  }

  /**
   * Get generic confidence map for a learner-certification pair
   */
  @GetMapping("/me/confidence-map/{certificationId}")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<Map<String, Object>> getMyConfidenceMap(
      @PathVariable Long certificationId,
      @RequestAttribute CurrentUserDto currentUser) {
    Map<String, Object> confidenceMap = learnerMasteryService.getConfidence(currentUser.getLearnerId(), certificationId);
    return ResponseEntity.ok(confidenceMap);
  }
}
