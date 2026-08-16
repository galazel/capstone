package com.capstone.rebyu.challenge.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.challenge.dto.ChallengeStandingsDtos.ChallengeLeaderboardRow;
import com.capstone.rebyu.challenge.dto.ChallengeStandingsDtos.ChallengeRecord;
import com.capstone.rebyu.challenge.service.ChallengeStandingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The challenge board and the caller's own record.
 *
 * <p>Both were assembled in the browser from {@code /api/challenge-sessions}
 * (every session on the platform) and {@code /api/learners} (every learner),
 * which handed a learner far more than the ten rows the page shows and named
 * everyone from records they had no reason to hold. The learner id here comes
 * from the validated token, never from the request, so "you" on the board is
 * always the caller.
 */
@RestController
@RequestMapping("/api/challenges")
@RequiredArgsConstructor
public class ChallengeStandingsController {

    private final ChallengeStandingsService challengeStandingsService;
    private final CognitoAuthService auth;

    /** Top challenge scorers. Open to any signed-in learner: it is a public board. */
    @GetMapping("/leaderboard")
    public List<ChallengeLeaderboardRow> leaderboard(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "10") int limit) {
        return challengeStandingsService.leaderboard(learnerId(jwt), limit);
    }

    /** The caller's own rank, totals, streak and recent sessions. */
    @GetMapping("/me/record")
    public ChallengeRecord myRecord(@AuthenticationPrincipal Jwt jwt) {
        Long learnerId = learnerId(jwt);
        if (learnerId == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return challengeStandingsService.record(learnerId);
    }

    /**
     * The caller's learner id, or null.
     *
     * <p>Null rather than a 400 on the board: an admin or an enterprise manager
     * signing in can legitimately look at the leaderboard, they simply are not
     * on it, and nothing there is theirs to highlight.
     */
    private Long learnerId(Jwt jwt) {
        if (jwt == null) {
            return null;
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        return user.learnerId();
    }
}
