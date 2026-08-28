package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.service.CurriculumGenerationService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.certification.dto.CertificationDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/ai/curriculum")
@RequiredArgsConstructor
public class CurriculumGenerationController {

    private final CurriculumGenerationService curriculumGenerationService;
    private final CognitoAuthService auth;

    @PostMapping("/generate")
    public ResponseEntity<CertificationDto> generate(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("certificationId") Long certificationId,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "additionalInstructions", required = false) String additionalInstructions,
            @RequestParam(value = "reviewMode", required = false) String reviewMode
    ) throws IOException {
        Long triggeredByUserId = resolveUserId(jwt);
        log.info("Curriculum generation requested for certificationId={}", certificationId);
        CertificationDto result = curriculumGenerationService.generateForExistingCertification(
                certificationId, files, additionalInstructions, triggeredByUserId, reviewMode
        );
        return ResponseEntity.ok(result);
    }

    private Long resolveUserId(Jwt jwt) {
        if (jwt == null) {
            return null;
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        return user.userId();
    }
}
