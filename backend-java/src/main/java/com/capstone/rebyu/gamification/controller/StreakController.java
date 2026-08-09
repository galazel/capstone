package com.capstone.rebyu.gamification.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.gamification.service.StreakService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/streaks")
public class StreakController {
  @Autowired private StreakService streakService;

  @GetMapping("/me")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<StreakService.StreakView> getMyStreak(@RequestAttribute CurrentUserDto currentUser) {
    return ResponseEntity.ok(streakService.getStreak(currentUser.getLearnerId()));
  }

  @PostMapping("/me/record")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<?> recordActivity(@RequestAttribute CurrentUserDto currentUser) {
    streakService.recordActivity(currentUser.getLearnerId());
    return ResponseEntity.ok().build();
  }
}
