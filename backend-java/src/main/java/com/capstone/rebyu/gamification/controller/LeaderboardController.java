package com.capstone.rebyu.gamification.controller;

import com.capstone.rebyu.gamification.service.LeaderboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/leaderboards")
public class LeaderboardController {
  @Autowired private LeaderboardService leaderboardService;

  @GetMapping("/xp")
  public ResponseEntity<List<LeaderboardService.LeaderboardEntry>> getXpLeaderboard(
      @RequestParam(defaultValue = "100") int limit) {
    return ResponseEntity.ok(leaderboardService.getTopLeaderboard(limit));
  }
}
