package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto;
import com.capstone.rebyu.diagram.dto.DiagramGradingResultDto;
import com.capstone.rebyu.execution.dto.CodeExecutionResultDto;

import java.util.Map;

/**
 * Pre-computed results for one submission's expensive graders, one map per
 * question-type family.
 *
 * Every map is keyed by {@code attemptQuestionId}. An absent entry means
 * nothing was pre-computed for that item and the sequential scoring pass falls
 * back to calling out directly -- so this is purely an optimisation, and the
 * correctness of a mark never depends on an entry being here.
 *
 * @param aiResults      written answers marked by the AI grader
 *                       (descriptive, AI-semantic short answer, analytical
 *                       critical-thinking sets)
 * @param codeResults    programming answers executed against their test cases
 * @param diagramResults diagram answers compared to the reference diagram
 */
public record GradingBatch(
        Map<Long, AnswerGradingResultDto> aiResults,
        Map<Long, CodeExecutionResultDto> codeResults,
        Map<Long, DiagramGradingResultDto> diagramResults) {

    public static GradingBatch empty() {
        return new GradingBatch(Map.of(), Map.of(), Map.of());
    }
}
