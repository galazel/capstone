package com.capstone.rebyu.gamification.service;

import com.capstone.rebyu.enrollment.repository.GamificationLedgerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;

@Service
public class LeaderboardService {
  @Autowired private GamificationLedgerRepository ledgerRepository;

  public record LeaderboardEntry(Long learnerId, String learnerName, Long totalXp, Integer rank) {}

  public List<LeaderboardEntry> getTopLeaderboard(int limit) {
    // Aggregate XP by learner from ledger
    var entries = ledgerRepository.findAll().stream()
        .collect(java.util.stream.Collectors.groupingBy(
            e -> e.getLearner(),
            java.util.stream.Collectors.summingLong(e -> e.getXpChange() != null ? e.getXpChange() : 0L)
        ))
        .entrySet()
        .stream()
        .map(e -> new LeaderboardEntry(
            e.getKey().getLearnerId(),
            e.getKey().getFirstName() + " " + e.getKey().getLastName(),
            e.getValue(),
            0 // rank assigned after sorting
        ))
        .sorted((a, b) -> b.totalXp().compareTo(a.totalXp()))
        .limit(limit)
        .toList();

    // Assign ranks
    return entries.stream()
        .map(e -> new LeaderboardEntry(e.learnerId(), e.learnerName(), e.totalXp(),
            entries.indexOf(e) + 1))
        .toList();
  }
}
