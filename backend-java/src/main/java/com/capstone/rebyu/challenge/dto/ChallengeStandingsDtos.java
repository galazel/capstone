package com.capstone.rebyu.challenge.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The challenge standings the learner portal shows: one board, one record.
 *
 * <p>These exist because the page used to build both in the browser, from
 * {@code GET /api/challenge-sessions} (every session of every learner) joined
 * against {@code GET /api/learners} (every learner's name). That is a
 * cross-learner read for a page that only ever displays ten rows, and when the
 * learner list refused the request the page silently fell back to invented
 * names. Computed here, the browser receives exactly the rows it renders.
 */
public final class ChallengeStandingsDtos {

    private ChallengeStandingsDtos() {}

    /**
     * One row of the leaderboard.
     *
     * <p>`you` is resolved server-side rather than by comparing ids in the
     * browser: it is the only reason the caller's own learner id would need to
     * be in the payload at all.
     */
    public record ChallengeLeaderboardRow(
            long rank,
            String name,
            int points,
            int completed,
            int bestScore,
            boolean you
    ) {}

    /** One of the caller's own finished challenge sessions. */
    public record ChallengeActivityRow(
            Long challengeSessionId,
            String mode,
            LocalDateTime startedAt,
            String status,
            Integer score
    ) {}

    /**
     * The caller's own standing.
     *
     * <p>Every figure is null-safe by construction: a learner who has never
     * played gets zeros and an empty list, never a missing field the page has
     * to guess a placeholder for.
     */
    public record ChallengeRecord(
            Long rank,
            int points,
            int completed,
            int bestScore,
            int streakDays,
            List<ChallengeActivityRow> recent
    ) {}
}
