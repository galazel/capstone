package com.capstone.rebyu.progress.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.progress.dto.LearnerAchievementDto;
import com.capstone.rebyu.progress.dto.LearnerAchievementViewDto;
import com.capstone.rebyu.progress.service.AchievementAwardService;
import com.capstone.rebyu.progress.service.LearnerAchievementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/learner-achievements")
@RequiredArgsConstructor
public class LearnerAchievementController {
    private final LearnerAchievementService learnerAchievementService;
    private final AchievementAwardService achievementAwardService;
    private final CognitoAuthService auth;

    /**
     * The signed-in learner's own badge wall: the whole catalog, with the ones
     * they have unlocked flagged. The learner is resolved from the JWT -- an
     * id in the path would let anyone read (and, before this, write) somebody
     * else's progress.
     */
    @GetMapping("/me")
    public List<LearnerAchievementViewDto> myAchievements(@AuthenticationPrincipal Jwt jwt) {
        return achievementAwardService.catalogFor(me(jwt));
    }

    // ------------------------------------------------------------------
    // Admin-only maintenance. Achievements are awarded server-side by
    // AchievementAwardService as learners earn them; these endpoints exist to
    // correct data, never as the way a badge is normally granted. An open POST
    // here let any learner hand themselves any achievement, and an open GET by
    // path id let them read anyone else's.
    //
    // Gated with the explicit requireAdmin() check the rest of this codebase
    // uses (CertificationController, ExamController, ...) rather than
    // @PreAuthorize: method security is not enabled in SecurityConfig, so the
    // annotation would look like a guard while enforcing nothing.
    // ------------------------------------------------------------------

    @GetMapping
    public List<LearnerAchievementDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return learnerAchievementService.getAll();
    }

    @GetMapping("/{learnerId}/{achievementId}")
    public LearnerAchievementDto getById(@AuthenticationPrincipal Jwt jwt,
                                         @PathVariable Long learnerId, @PathVariable Long achievementId) {
        requireAdmin(jwt);
        return learnerAchievementService.getById(learnerId, achievementId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerAchievementDto create(@AuthenticationPrincipal Jwt jwt,
                                        @Valid @RequestBody LearnerAchievementDto dto) {
        requireAdmin(jwt);
        return learnerAchievementService.create(dto);
    }

    @PutMapping("/{learnerId}/{achievementId}")
    public LearnerAchievementDto update(@AuthenticationPrincipal Jwt jwt,
                                        @PathVariable Long learnerId, @PathVariable Long achievementId,
                                        @Valid @RequestBody LearnerAchievementDto dto) {
        requireAdmin(jwt);
        return learnerAchievementService.update(learnerId, achievementId, dto);
    }

    @DeleteMapping("/{learnerId}/{achievementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt,
                       @PathVariable Long learnerId, @PathVariable Long achievementId) {
        requireAdmin(jwt);
        learnerAchievementService.delete(learnerId, achievementId);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) {
            throw new IllegalArgumentException("Admin access is required");
        }
    }

    private Long me(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return user.learnerId();
    }
}
