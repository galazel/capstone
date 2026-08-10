package com.capstone.rebyu.gamification.controller;

import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.gamification.service.StreakService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/streaks")
public class StreakController {
  @Autowired private StreakService streakService;
  @Autowired private CognitoAuthService auth;

  @GetMapping("/me")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<StreakService.StreakView> getMyStreak(@AuthenticationPrincipal Jwt jwt) {
    var currentUser = auth.syncCurrentUser(jwt, jwt.getTokenValue());
    return ResponseEntity.ok(streakService.getStreak(currentUser.getLearnerId()));
  }

  @PostMapping("/me/record")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<?> recordActivity(@AuthenticationPrincipal Jwt jwt) {
    var currentUser = auth.syncCurrentUser(jwt, jwt.getTokenValue());
    streakService.recordActivity(currentUser.getLearnerId());
    return ResponseEntity.ok().build();
  }
}
