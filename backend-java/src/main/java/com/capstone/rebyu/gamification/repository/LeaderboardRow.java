package com.capstone.rebyu.gamification.repository;

/** Spring Data interface projection for the ranked leaderboard native queries. */
public interface LeaderboardRow {
    int getRanking();
    Long getLearnerId();
    String getLearnerName();
    long getXp();
    boolean getCurrentLearner();
}
