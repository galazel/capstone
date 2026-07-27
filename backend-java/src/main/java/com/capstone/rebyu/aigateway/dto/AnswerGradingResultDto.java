package com.capstone.rebyu.aigateway.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Parsed result of AI-grading one descriptive or critical-thinking answer.
 * {@code subScores} is empty for a plain descriptive answer and one entry per
 * sub-question for a critical-thinking answer.
 */
public record AnswerGradingResultDto(
        BigDecimal earnedPoints,
        String feedback,
        List<SubAnswerGradeDto> subScores
) {
    public record SubAnswerGradeDto(
            Long subQuestionId,
            BigDecimal earnedPoints,
            String feedback
    ) {}
}
