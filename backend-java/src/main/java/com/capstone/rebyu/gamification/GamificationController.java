package com.capstone.rebyu.gamification;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/api/gamification")
@RequiredArgsConstructor
public class GamificationController {
    private final RewardService rewards;
    private final CognitoAuthService auth;

    @GetMapping("/me/balance")
    public RewardService.Balance balance(@AuthenticationPrincipal Jwt jwt) { return rewards.balance(me(jwt)); }

    @GetMapping("/me/ledger")
    public java.util.List<RewardService.LedgerEntry> ledger(@AuthenticationPrincipal Jwt jwt) { return rewards.recentLedger(me(jwt)); }

    @GetMapping("/leaderboard")
    public java.util.List<RewardService.LeaderboardEntry> leaderboard(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "overall") String scope, @RequestParam(defaultValue = "all") String period) {
        return rewards.leaderboard(me(jwt), scope, period);
    }

    public record CoinConversionRequest(int coins, String idempotencyKey) {}

    @PostMapping("/me/convert-coins")
    public RewardService.Conversion convertCoins(@AuthenticationPrincipal Jwt jwt, @RequestBody CoinConversionRequest request) {
        return rewards.convertCoinsToAiCredits(me(jwt), request.coins(), request.idempotencyKey());
    }

    private Long me(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) throw new IllegalArgumentException("A learner account is required");
        return user.learnerId();
    }
}
