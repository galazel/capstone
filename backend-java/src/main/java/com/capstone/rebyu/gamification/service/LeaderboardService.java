package com.capstone.rebyu.gamification.service;

import com.capstone.rebyu.gamification.repository.LearnerRewardLedgerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class LeaderboardService {
  // No authenticated viewer on this public endpoint; a sentinel id that can
  // never match a real learner keeps every row's "is this me" flag false
  // instead of passing a null bind parameter into the native query.
  private static final Long NO_VIEWER = -1L;

  @Autowired private LearnerRewardLedgerRepository ledgerRepository;

  public record LeaderboardEntry(Long learnerId, String learnerName, Long totalXp, Integer rank) {}

  public List<LeaderboardEntry> getTopLeaderboard(int limit) {
    return ledgerRepository.overallLeaderboardAllTime(NO_VIEWER).stream()
        .limit(limit)
        .map(row -> new LeaderboardEntry(
            row.getLearnerId(), row.getLearnerName(), row.getXp(), row.getRanking()))
        .toList();
  }
}
