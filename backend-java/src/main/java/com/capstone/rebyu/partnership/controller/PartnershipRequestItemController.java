package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.PartnershipRequestItemDto;
import com.capstone.rebyu.partnership.service.PartnershipRequestItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/partnership-request-items")
@RequiredArgsConstructor
public class PartnershipRequestItemController {
    private final PartnershipRequestItemService partnershipRequestItemService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<PartnershipRequestItemDto> getAll(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestItemService.getAll();
    }

    @GetMapping("/{id}")
    public PartnershipRequestItemDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestItemService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PartnershipRequestItemDto create(
            @Valid @RequestBody PartnershipRequestItemDto dto, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestItemService.create(dto);
    }

    @PutMapping("/{id}")
    public PartnershipRequestItemDto update(@PathVariable Long id, @Valid @RequestBody PartnershipRequestItemDto dto,
                                             @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return partnershipRequestItemService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        partnershipRequestItemService.delete(id);
    }

    // Only admins may reach this generic CRUD path's update/delete for the
    // same reason as PartnershipRequestController: line items belong to a
    // request under active admin review, not to arbitrary callers.
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
