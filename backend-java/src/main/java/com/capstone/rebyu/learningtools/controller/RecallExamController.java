package com.capstone.rebyu.learningtools.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.learningtools.service.RecallExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Builds the study plan's Active Recall session.
 *
 * <p>The learner is resolved from the validated token and never taken from the
 * request: the paper is assembled from that learner's own mistakes and mastery,
 * so accepting a learnerId would let anyone mint an exam revealing which
 * questions someone else has been getting wrong.
 */
@RestController
@RequestMapping("/api/recall-sessions")
@RequiredArgsConstructor
public class RecallExamController {

  private final RecallExamService recallExamService;
  private final CognitoAuthService auth;

  /**
   * Mints a recall exam and returns it. The caller then opens it through the
   * ordinary attempt flow -- this creates the paper, it does not start it.
   */
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RecallExamService.RecallExam create(
      @AuthenticationPrincipal Jwt jwt,
      @RequestBody CreateRecallRequest request) {
    return recallExamService.createRecallExam(
        me(jwt), request.certificationId(), request.lessonId(), request.size());
  }

  /**
   * @param lessonId the topic the plan scheduled, when there is one -- its
   *                 questions are preferred so a session lines up with what the
   *                 learner was told they would be studying
   * @param size     defaults to 20
   */
  public record CreateRecallRequest(Long certificationId, Long lessonId, Integer size) {}

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
