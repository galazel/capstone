package com.capstone.rebyu.learningtools.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.learningtools.service.SpacedRepetitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * The study plan's Spaced Repetition session.
 *
 * <p>The learner is resolved from the validated token and never taken from the
 * request: the queue is that learner's own memory state, and the grade written
 * against it changes when they next see the material.
 */
@RestController
@RequestMapping("/api/review-sessions")
@RequiredArgsConstructor
public class SpacedRepetitionController {

  private final SpacedRepetitionService reviews;
  private final CognitoAuthService auth;

  /**
   * The cards due now. Not a plain GET: a short session tops itself up from the
   * learner's history, which creates review items, so this writes.
   *
   * @param lessonId the topic the plan scheduled, when there is one -- its due
   *                 items are brought to the front
   */
  @PostMapping("/due")
  public SpacedRepetitionService.ReviewQueue due(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody DueRequest request) {
    return reviews.dueCards(me(jwt), request.certificationId(), request.lessonId(), request.size());
  }

  /** Records how well a card was recalled, and schedules its return. */
  @PutMapping("/items/{questionId}/grade")
  public SpacedRepetitionService.ReviewOutcome grade(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable Long questionId,
      @RequestBody GradeRequest request) {
    return reviews.grade(me(jwt), questionId, request.grade());
  }

  public record DueRequest(Long certificationId, Long lessonId, Integer size) {}

  /** @param grade one of AGAIN, HARD, GOOD, EASY */
  public record GradeRequest(String grade) {}

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
