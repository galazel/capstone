package com.capstone.rebyu.aigateway.dto;

import java.util.List;

public record GeneratedQuestionDraftDto(
        GeneratedQuestionType questionType,
        Long suggestedLessonId,
        String suggestedLessonTitle,
        String question,
        GeneratedQuestionDifficulty difficulty,
        List<GeneratedChoiceDto> choices,
        Integer correctChoiceIndex,
        String correctAnswer,
        GeneratedCheckingMethod checkingMethod,
        String rubricBasedAnswer,
        String starterCode,
        List<GeneratedTestCaseDto> testCases,
        GeneratedDiagramType diagramType,
        String instructions,
        String authoringNotes,
        String imageKey,
        // Optional exact-match alternatives for SHORT_ANSWER, e.g. "SQL" and
        // "Structured Query Language".
        List<String> acceptedVariations
) {
    /** Convenience constructor for callers that predate imageKey/acceptedVariations. */
    public GeneratedQuestionDraftDto(
            GeneratedQuestionType questionType,
            Long suggestedLessonId,
            String suggestedLessonTitle,
            String question,
            GeneratedQuestionDifficulty difficulty,
            List<GeneratedChoiceDto> choices,
            Integer correctChoiceIndex,
            String correctAnswer,
            GeneratedCheckingMethod checkingMethod,
            String rubricBasedAnswer,
            String starterCode,
            List<GeneratedTestCaseDto> testCases,
            GeneratedDiagramType diagramType,
            String instructions,
            String authoringNotes
    ) {
        this(questionType, suggestedLessonId, suggestedLessonTitle, question,
                difficulty, choices, correctChoiceIndex, correctAnswer,
                checkingMethod, rubricBasedAnswer, starterCode, testCases,
                diagramType, instructions, authoringNotes, null, null);
    }
}
