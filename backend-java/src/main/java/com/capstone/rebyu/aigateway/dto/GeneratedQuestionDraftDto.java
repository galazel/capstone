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
        List<String> acceptedVariations,
        /*
         * The item's parts: the blanks of a fill-in-the-blank, or the questions
         * asked about a programming or diagram artifact.
         *
         * Absent from this record, they were dropped at the Java boundary --
         * the generator produced them and the admin reviewing the draft never
         * saw them. A fill-in-the-blank arrived as a passage with no blanks; a
         * modelling task arrived with no parts. Silently, because a missing
         * field reads the same as a question that never had any.
         *
         * A certification run is unaffected either way: it persists straight
         * from Python and never passes through here.
         */
        List<GeneratedSubQuestionDraftDto> subQuestions
) {
    /**
     * One part of a question.
     *
     * <p>{@code expectedAnswer} is the term for a fill-in-the-blank blank, and
     * the rubric for a written part -- which of the two it is follows from the
     * parent's type, exactly as it does once persisted.
     */
    public record GeneratedSubQuestionDraftDto(
            String question,
            String expectedAnswer,
            java.math.BigDecimal points
    ) {
    }

    /** Convenience constructor for callers that predate subQuestions. */
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
            String authoringNotes,
            String imageKey,
            List<String> acceptedVariations
    ) {
        this(questionType, suggestedLessonId, suggestedLessonTitle, question,
                difficulty, choices, correctChoiceIndex, correctAnswer,
                checkingMethod, rubricBasedAnswer, starterCode, testCases,
                diagramType, instructions, authoringNotes, imageKey,
                acceptedVariations, List.of());
    }

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
                diagramType, instructions, authoringNotes, null, null, List.of());
    }
}
