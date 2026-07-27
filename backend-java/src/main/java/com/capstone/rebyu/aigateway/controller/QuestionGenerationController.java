package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.dto.AiQuestionGenerationRequest;
import com.capstone.rebyu.aigateway.dto.GeneratedQuestionDraftResponseDto;
import com.capstone.rebyu.aigateway.dto.QuestionGenerationSourceMode;
import com.capstone.rebyu.aigateway.service.QuestionGenerationService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/questions")
@RequiredArgsConstructor
public class QuestionGenerationController {

    private final QuestionGenerationService questionGenerationService;
    private final ObjectMapper objectMapper;
    private final CognitoAuthService auth;

    @PostMapping(value = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public GeneratedQuestionDraftResponseDto generate(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("certificationId") Long certificationId,
            @RequestParam(value = "questionCountsJson", required = false) String questionCountsJson,
            @RequestParam(value = "sourceMode", required = false) String sourceMode,
            @RequestParam(value = "targetQuestionCount", required = false) Integer targetQuestionCount,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "additionalInstructions", required = false) String additionalInstructions
    ) throws IOException {
        Map<String, Integer> questionCounts = null;
        if (questionCountsJson != null && !questionCountsJson.isBlank()) {
            try {
                questionCounts = objectMapper.readValue(
                        questionCountsJson.replaceAll("[\r\n\t]", " ").trim(),
                        new TypeReference<>() {}
                );
            } catch (Exception e) {
                throw new IllegalArgumentException(
                        "questionCountsJson must be a JSON object mapping question types to counts."
                );
            }
        }

        QuestionGenerationSourceMode mode = null;
        if (sourceMode != null && !sourceMode.isBlank()) {
            try {
                mode = QuestionGenerationSourceMode.valueOf(
                        sourceMode.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException(
                        "sourceMode must be CERTIFICATION_KNOWLEDGE, UPLOADED_FILES, or COMBINED.");
            }
        }

        AiQuestionGenerationRequest request = new AiQuestionGenerationRequest(
                certificationId, questionCounts, additionalInstructions, mode, targetQuestionCount
        );

        Long triggeredByUserId = jwt == null ? null : auth.syncCurrentUser(jwt, jwt.getTokenValue()).userId();
        return questionGenerationService.generateDrafts(request, files, triggeredByUserId);
    }
}
