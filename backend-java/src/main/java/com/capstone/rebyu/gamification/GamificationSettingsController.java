package com.capstone.rebyu.gamification;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.gamification.dto.GamificationSettingsDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Admin-only read/update of the gamification configuration. */
@RestController
@RequestMapping("/api/admin/gamification-settings")
@RequiredArgsConstructor
public class GamificationSettingsController {

    private final GamificationSettingsService service;
    private final CognitoAuthService auth;

    @GetMapping
    public GamificationSettingsDto get(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return service.get();
    }

    @PutMapping
    public GamificationSettingsDto update(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody GamificationSettingsDto dto) {
        requireAdmin(jwt);
        return service.update(dto);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }
}
