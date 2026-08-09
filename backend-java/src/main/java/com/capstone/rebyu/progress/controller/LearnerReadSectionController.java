package com.capstone.rebyu.progress.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.progress.dto.LearnerReadSectionDto;
import com.capstone.rebyu.progress.service.LearnerReadSectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Per-section lesson-read progress for the signed-in learner. The learner id is
 * always resolved from the validated Cognito access token, mirroring
 * LearnerPortalController, so a learner can only ever read or write their own
 * progress.
 */
@RestController
@RequestMapping("/api/learners/me/read-sections")
@RequiredArgsConstructor
public class LearnerReadSectionController {
    private final LearnerReadSectionService readSectionService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<String> list(@RequestParam Long lessonId, @AuthenticationPrincipal Jwt jwt) {
        return readSectionService.listReadSectionKeys(requireLearner(jwt).getLearnerId(), lessonId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@Valid @RequestBody LearnerReadSectionDto dto, @AuthenticationPrincipal Jwt jwt) {
        readSectionService.markRead(requireLearner(jwt).getLearnerId(), dto.getLessonId(), dto.getSectionKey());
    }

    @DeleteMapping("/{lessonId}/{sectionKey}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markUnread(@PathVariable Long lessonId, @PathVariable String sectionKey, @AuthenticationPrincipal Jwt jwt) {
        readSectionService.markUnread(requireLearner(jwt).getLearnerId(), lessonId, sectionKey);
    }

    private CurrentUserDto requireLearner(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.getLearnerId() == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return user;
    }
}
