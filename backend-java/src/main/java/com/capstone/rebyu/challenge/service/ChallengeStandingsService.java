package com.capstone.rebyu.challenge.service;

import com.capstone.rebyu.challenge.dto.ChallengeStandingsDtos.ChallengeActivityRow;
import com.capstone.rebyu.challenge.dto.ChallengeStandingsDtos.ChallengeLeaderboardRow;
import com.capstone.rebyu.challenge.dto.ChallengeStandingsDtos.ChallengeRecord;
import com.capstone.rebyu.challenge.entity.ChallengeSession;
import com.capstone.rebyu.challenge.repository.ChallengeSessionRepository;
import com.capstone.rebyu.user.entity.Learner;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

/**
 * Challenge standings, computed server-side.
 *
 * <p>Scoring is the same rule the portal has always drawn: a finished session
 * contributes its score to the learner's total, and an unfinished one
 * contributes nothing. Sessions still in progress are excluded rather than
 * counted as zero -- a challenge you are part-way through is not a result.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChallengeStandingsService {

    /** Nobody reads past the first page of a leaderboard; the cap is the API's. */
    private static final int MAX_LEADERBOARD_ROWS = 50;
    private static final int RECENT_ACTIVITY_ROWS = 8;

    private final ChallengeSessionRepository challengeSessionRepository;

    private record Standing(Long learnerId, String name, int points, int completed, int bestScore) {}

    public List<ChallengeLeaderboardRow> leaderboard(Long viewerLearnerId, int limit) {
        List<Standing> standings = standings();
        int size = Math.min(Math.max(limit, 1), MAX_LEADERBOARD_ROWS);

        List<ChallengeLeaderboardRow> rows = new ArrayList<>();
        for (int index = 0; index < standings.size() && index < size; index++) {
            Standing standing = standings.get(index);
            rows.add(new ChallengeLeaderboardRow(
                    index + 1L,
                    standing.name(),
                    standing.points(),
                    standing.completed(),
                    standing.bestScore(),
                    standing.learnerId().equals(viewerLearnerId)));
        }
        return rows;
    }

    public ChallengeRecord record(Long learnerId) {
        List<Standing> standings = standings();
        Long rank = null;
        Standing mine = null;
        for (int index = 0; index < standings.size(); index++) {
            if (standings.get(index).learnerId().equals(learnerId)) {
                rank = index + 1L;
                mine = standings.get(index);
                break;
            }
        }

        List<ChallengeSession> sessions = challengeSessionRepository.findByLearner_LearnerId(learnerId);

        List<ChallengeActivityRow> recent = sessions.stream()
                .sorted(Comparator.comparing(
                        ChallengeSession::getStartedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(RECENT_ACTIVITY_ROWS)
                .map(session -> new ChallengeActivityRow(
                        session.getChallengeSessionId(),
                        session.getChallengeMode() == null ? null : session.getChallengeMode().getName(),
                        session.getStartedAt(),
                        session.getStatus() == null ? null : session.getStatus().name(),
                        session.getScore() == null ? null : session.getScore().intValue()))
                .toList();

        return new ChallengeRecord(
                rank,
                mine == null ? 0 : mine.points(),
                mine == null ? 0 : mine.completed(),
                mine == null ? 0 : mine.bestScore(),
                streakDays(sessions),
                recent);
    }

    /**
     * Every learner who has finished at least one challenge, best first.
     *
     * <p>Ties break on best single score, then on the learner id -- without the
     * last one two learners on identical figures could swap places between two
     * requests, which reads as the board being unstable rather than tied.
     */
    private List<Standing> standings() {
        Map<Long, Standing> byLearner = new LinkedHashMap<>();

        for (ChallengeSession session : challengeSessionRepository.findAll()) {
            if (session.getScore() == null
                    || session.getStatus() == ChallengeSession.Status.in_progress) {
                continue;
            }
            Learner learner = session.getLearner();
            if (learner == null) {
                continue;
            }

            int score = session.getScore().intValue();
            Standing current = byLearner.get(learner.getLearnerId());
            if (current == null) {
                byLearner.put(learner.getLearnerId(), new Standing(
                        learner.getLearnerId(), displayName(learner), score, 1, score));
            } else {
                byLearner.put(learner.getLearnerId(), new Standing(
                        current.learnerId(),
                        current.name(),
                        current.points() + score,
                        current.completed() + 1,
                        Math.max(current.bestScore(), score)));
            }
        }

        return byLearner.values().stream()
                .sorted(Comparator.comparingInt(Standing::points).reversed()
                        .thenComparing(Comparator.comparingInt(Standing::bestScore).reversed())
                        .thenComparing(Standing::learnerId))
                .toList();
    }

    /**
     * A display name, never an email.
     *
     * <p>A leaderboard is the one learner-facing surface that shows other
     * learners, so it shows the least it can: a chosen username, or a first
     * name and last initial. Falling through to the email address -- which the
     * old browser-side version could do, since it had the whole learner record
     * -- would publish it to every other learner on the platform.
     */
    private String displayName(Learner learner) {
        String username = learner.getUsername();
        if (username != null && !username.isBlank()) {
            return username;
        }
        String first = learner.getFirstName() == null ? "" : learner.getFirstName().trim();
        String last = learner.getLastName() == null ? "" : learner.getLastName().trim();
        if (!first.isEmpty() && !last.isEmpty()) {
            return first + " " + last.charAt(0) + ".";
        }
        if (!first.isEmpty()) {
            return first;
        }
        return "Learner " + learner.getLearnerId();
    }

    /** Consecutive days up to today (or yesterday) with at least one session. */
    private int streakDays(List<ChallengeSession> sessions) {
        Set<LocalDate> days = new HashSet<>();
        for (ChallengeSession session : sessions) {
            if (session.getStartedAt() != null) {
                days.add(session.getStartedAt().toLocalDate());
            }
        }
        if (days.isEmpty()) {
            return 0;
        }

        // Starting at yesterday when today is empty is deliberate: a streak is
        // only broken once a whole day passes with nothing in it, so playing
        // yesterday and not yet today still reads as a live streak.
        LocalDate cursor = LocalDate.now();
        if (!days.contains(cursor)) {
            cursor = cursor.minusDays(1);
        }

        int streak = 0;
        while (days.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
