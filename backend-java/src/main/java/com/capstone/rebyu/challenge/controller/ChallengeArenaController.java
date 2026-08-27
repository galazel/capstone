package com.capstone.rebyu.challenge.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.challenge.service.ChallengeArenaService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Arena configuration, and the status the learner's view locks against.
 *
 * <p>Reading is open to any signed-in user: the learner's challenge cards need
 * to know which arenas are ready, and "this arena has eight problems" gives
 * away nothing about them. Writing is admin-only -- configuring an arena
 * decides what every learner sits.
 */
@RestController
@RequestMapping("/api/challenge-arenas")
@RequiredArgsConstructor
public class ChallengeArenaController {

  private final ChallengeArenaService arenas;
  private final CognitoAuthService auth;

  /** Every arena and whether it is ready to run. */
  @GetMapping
  public List<ChallengeArenaService.ArenaStatus> statuses() {
    return arenas.statuses();
  }

  @GetMapping("/{arenaId}")
  public ChallengeArenaService.ArenaStatus status(@PathVariable String arenaId) {
    return arenas.status(arenaId);
  }

  /**
   * Replaces an arena's problems.
   *
   * <p>The questions themselves are already in the bank by this point -- the
   * builder saves them through the same endpoints the question bank uses, so an
   * arena problem is an ordinary question and is validated as one. This records
   * only which of them the arena runs, and in what order.
   */
  @PutMapping("/{arenaId}/problems")
  public ChallengeArenaService.ArenaStatus saveProblems(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String arenaId,
      @RequestBody ChallengeArenaService.SaveArenaProblemsRequest request) {
    requireAdmin(jwt);
    return arenas.saveProblems(arenaId, request);
  }

  /** Replaces the industries allowed into an arena. */
  @PutMapping("/{arenaId}/industries")
  public ChallengeArenaService.ArenaStatus setIndustries(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String arenaId,
      @RequestBody SetIndustriesRequest request) {
    requireAdmin(jwt);
    return arenas.setIndustries(arenaId, request == null ? List.of() : request.industries());
  }

  public record SetIndustriesRequest(List<String> industries) {}

  /** Empties an arena, which locks it again for learners. */
  @DeleteMapping("/{arenaId}/problems")
  public ChallengeArenaService.ArenaStatus clearProblems(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String arenaId) {
    requireAdmin(jwt);
    return arenas.clearProblems(arenaId);
  }

  /**
   * Admin only, and deliberately not "admin or institution".
   *
   * <p>The question bank lets an institution author its own questions because
   * those are scoped to that institution's own learners. An arena is not: it is
   * one shared surface every learner on the platform enters, so an institution
   * configuring it would be choosing what everyone else sits.
   */
  private void requireAdmin(Jwt jwt) {
    if (jwt == null) {
      throw new IllegalArgumentException("Authentication is required");
    }
    CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
    if (!"ADMIN".equalsIgnoreCase(user.role())) {
      throw new IllegalArgumentException("Admin access is required");
    }
  }
}
