package com.capstone.rebyu.aigateway.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * One learner answer submitted to {@code AiAnswerGradingService}. Omit
 * {@code subQuestions} for a plain descriptive answer; populate it for a
 * critical-thinking answer, one entry per sub-question.
 */
public record AnswerGradingRequestDto(
        String questionText,
        BigDecimal maxPoints,
        String rubricGuidance,
        List<RubricCriterionDto> rubricCriteria,
        String learnerAnswer,
        List<SubQuestionGradingRequestDto> subQuestions
) {
    public record RubricCriterionDto(String name, BigDecimal maxPoints) {}

    public record SubQuestionGradingRequestDto(
            Long subQuestionId,
            String questionText,
            BigDecimal maxPoints,
            String rubricGuidance,
            List<RubricCriterionDto> rubricCriteria,
            String learnerAnswer
    ) {}
}
