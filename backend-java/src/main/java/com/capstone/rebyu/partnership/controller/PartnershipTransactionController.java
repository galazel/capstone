package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.PartnershipRequestTransactionDto;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.SubmitPartnershipRequestDto;
import com.capstone.rebyu.partnership.service.PartnershipRequestTransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Transaction Three: partnership request submission and lookup. */
@RestController
@RequestMapping("/api/enterprise/partnership-requests")
@RequiredArgsConstructor
public class PartnershipTransactionController {

    private final PartnershipRequestTransactionService transactionService;
    private final CognitoAuthService auth;

    @PostMapping
    public PartnershipRequestTransactionDto submit(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SubmitPartnershipRequestDto request) {
        Long enterpriseId = myEnterpriseId(jwt);
        SubmitPartnershipRequestDto trusted = new SubmitPartnershipRequestDto(
                enterpriseId, request.items(), request.idempotencyKey());
        return transactionService.submit(trusted);
    }

    @GetMapping
    public List<PartnershipRequestTransactionDto> list(@AuthenticationPrincipal Jwt jwt) {
        return transactionService.listForEnterprise(myEnterpriseId(jwt));
    }

    private Long myEnterpriseId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.enterpriseId() == null) {
            throw new IllegalArgumentException("An enterprise account is required");
        }
        return user.enterpriseId();
    }
}
