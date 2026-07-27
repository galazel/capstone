package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.client.AiServiceClient;
import com.capstone.rebyu.aigateway.dto.AnswerGradingRequestDto;
import com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Thin trigger: descriptive/critical-thinking answer grading is performed
 * entirely by the Python AI backend. Empty means the AI could not produce a
 * trustworthy score — the caller leaves the answer pending rather than
 * fabricating one.
 */
@Service
@RequiredArgsConstructor
public class AiAnswerGradingService {

    private final AiServiceClient aiServiceClient;

    public Optional<AnswerGradingResultDto> grade(AnswerGradingRequestDto request) {
        return aiServiceClient.gradeAnswer(request);
    }
}
