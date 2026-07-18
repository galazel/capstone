package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.PartnershipRequestDto;
import com.capstone.rebyu.partnership.service.PartnershipRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/partnership-requests")
@RequiredArgsConstructor
public class PartnershipRequestController {
    private final PartnershipRequestService partnershipRequestService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<PartnershipRequestDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestService.getAll();
    }

    @GetMapping("/{id}")
    public PartnershipRequestDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PartnershipRequestDto create(@Valid @RequestBody PartnershipRequestDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestService.create(dto);
    }

    @PutMapping("/{id}")
    public PartnershipRequestDto update(@PathVariable Long id, @Valid @RequestBody PartnershipRequestDto dto,
                                         @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        partnershipRequestService.delete(id);
    }

    // Only admins may reach this generic CRUD path's update/delete: status
    // transitions and request removal must go through the real admin
    // approval workflow in AdminPartnershipService, not this scaffolding.
    private void requireAdmin(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) {
            throw new IllegalArgumentException("Admin access is required");
        }
    }
}
