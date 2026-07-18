package com.capstone.rebyu.bkt.service;

import com.capstone.rebyu.bkt.client.BktClient;
import com.capstone.rebyu.bkt.client.BktServiceException;
import com.capstone.rebyu.bkt.dto.ConfidenceView;
import com.capstone.rebyu.bkt.dto.LearnerMasteryView;
import com.capstone.rebyu.bkt.dto.LessonPriorityView;
import com.capstone.rebyu.bkt.dto.MasteryHistoryView;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Facade to the FastAPI BKT service using PyBKT. All mastery calculations
 * are performed remotely; this service delegates to BktClient.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BKTService {

  private final BktClient bktClient;

  /**
   * Get learner mastery across all lessons in a certification
   */
  public LearnerMasteryView getLearnerMastery(Long learnerId, List<Long> lessonIds) {
    try {
      return bktClient.getLearnerMastery(learnerId, lessonIds);
    } catch (BktServiceException e) {
      log.warn("Could not fetch learner mastery for {}: {}", learnerId, e.getMessage());
      return null;
    }
  }

  /**
   * Get detailed mastery history for a learner-certification pair
   */
  public List<MasteryHistoryView> getMasteryHistory(Long learnerId, Long certificationId) {
    try {
      return bktClient.getMasteryHistory(learnerId, certificationId);
    } catch (BktServiceException e) {
      log.warn("Could not fetch mastery history for learner {}, cert {}: {}",
              learnerId, certificationId, e.getMessage());
      return List.of();
    }
  }

  /**
   * Get lesson-level priorities and mastery for a learner-certification pair
   */
  public List<LessonPriorityView> getLessonPriorities(Long learnerId, Long certificationId) {
    try {
      return bktClient.getLessonPriorities(learnerId, certificationId);
    } catch (BktServiceException e) {
      log.warn("Could not fetch lesson priorities for learner {}, cert {}: {}",
              learnerId, certificationId, e.getMessage());
      return List.of();
    }
  }

  /**
   * Get certification-level confidence summary (mastery across all lessons)
   */
  public ConfidenceView getConfidence(Long learnerId, Long certificationId) {
    try {
      return bktClient.getConfidenceView(learnerId, certificationId);
    } catch (BktServiceException e) {
      log.warn("Could not fetch confidence for learner {}, cert {}: {}",
              learnerId, certificationId, e.getMessage());
      return null;
    }
  }

  /**
   * Get generic confidence map (alternative to typed ConfidenceView)
   */
  public Map<String, Object> getConfidenceMap(Long learnerId, Long certificationId) {
    try {
      return bktClient.getConfidence(learnerId, certificationId);
    } catch (BktServiceException e) {
      log.warn("Could not fetch confidence map for learner {}, cert {}: {}",
              learnerId, certificationId, e.getMessage());
      return Map.of();
    }
  }
}
