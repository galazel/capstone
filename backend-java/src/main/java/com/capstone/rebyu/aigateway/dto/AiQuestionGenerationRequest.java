package com.capstone.rebyu.aigateway.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiQuestionGenerationRequest {
    private Long certificationId;

    /**
     * Optional explicit per-type counts (legacy strict mode). When absent the
     * AI chooses suitable question types from the grounded source material.
     */
    private Map<String, Integer> questionCounts;

    private String additionalInstructions;

    /** Where grounded source material comes from; resolved when null. */
    private QuestionGenerationSourceMode sourceMode;

    /** Internal generation target when no explicit counts are given. */
    private Integer targetQuestionCount;
}
