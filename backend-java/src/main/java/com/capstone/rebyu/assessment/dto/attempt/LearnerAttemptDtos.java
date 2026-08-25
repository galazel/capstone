package com.capstone.rebyu.assessment.dto.attempt;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Learner-safe attempt DTOs. Nothing in this file may ever carry a correct
 * answer, correct-choice flag, rubric, reference diagram, or authoring note
 * before submission.
 */
public final class LearnerAttemptDtos {

    private LearnerAttemptDtos() {
    }

    public record LearnerAssessmentDto(
            Long assessmentId,
            String title,
            String assessmentType,
            String description,
            String instructions,
            Integer durationMinutes,
            Integer totalItems,
            BigDecimal passingScore,
            Boolean canStart,
            String lockReason
    ) {
    }

    public record LearnerChoiceDto(
            Long choiceId,
            String choiceText,
            String imageKey
    ) {
    }

    public record LearnerSubQuestionDto(
            Long subQuestionId,
            String questionText
    ) {
    }

    public record LearnerAttemptQuestionDto(
            Long attemptQuestionId,
            Integer displayOrder,
            String questionType,
            String criticalThinkingType,
            String question,
            String questionImageKey,
            List<LearnerChoiceDto> choices,
            String starterCode,
            String diagramType,
            String instructions,
            List<LearnerSubQuestionDto> subQuestions,
            BigDecimal points,
            List<ProgrammingAttemptDtos.LearnerTestCaseDto> testCases,
            List<DiagramAttemptDtos.RubricCriterionDto> rubric
    ) {
    }

    public record AssessmentAttemptStartRequestDto(
            @NotNull Long learnerId,
            String idempotencyKey
    ) {
    }

    public record AssessmentAttemptStartResponseDto(
            Long assessmentAttemptId,
            Long assessmentId,
            String assessmentTitle,
            String assessmentType,
            Integer attemptNumber,
            OffsetDateTime startedAt,
            OffsetDateTime expiresAt,
            boolean resumed,
            List<LearnerAttemptQuestionDto> questions,
            Map<Long, AttemptAnswerDraftDto> savedAnswers,
            Long currentAttemptQuestionId,
            List<Long> flaggedAttemptQuestionIds,
            List<Long> skippedAttemptQuestionIds
    ) {
    }

    public record FlagRequestDto(
            @NotNull Long learnerId,
            boolean flagged
    ) {
    }

    public record SkipRequestDto(
            @NotNull Long learnerId,
            boolean skipped
    ) {
    }

    public record CurrentItemRequestDto(
            @NotNull Long learnerId,
            @NotNull Long attemptQuestionId
    ) {
    }

    public record AttemptAnswerDraftDto(
            Long attemptQuestionId,
            String learnerAnswer,
            Long selectedChoiceId,
            String submittedCode,
            String programmingLanguage,
            String diagramSubmissionData
    ) {
    }

    public record AutosaveAnswersRequestDto(
            @NotNull Long learnerId,
            List<AttemptAnswerDraftDto> answers
    ) {
    }

    public record SubmitAssessmentAttemptRequestDto(
            @NotNull Long learnerId,
            List<AttemptAnswerDraftDto> answers
    ) {
    }

    public record SubQuestionAnswerReviewDto(
            Long subQuestionId,
            String questionText,
            String learnerAnswer,
            BigDecimal earnedPoints,
            BigDecimal maxPoints,
            String feedback
    ) {
    }

    /**
     * One required diagram element (node or relationship) compared against
     * what the learner actually drew — so a learner can see exactly which
     * required parts were found or missing, not just a final score. Gated
     * by the exam's release-answers setting, same as the MCQ answer key.
     */
    public record DiagramElementReviewDto(
            String kind,                 // NODE | EDGE
            String expectedDescription,
            boolean matched,
            String matchQuality,         // STRONG | PARTIAL | WEAK | NONE
            String learnerDescription,   // what the learner drew that matched; null when missing
            BigDecimal earnedPoints,
            BigDecimal maxPoints
    ) {
    }

    public record AttemptAnswerReviewDto(
            Long attemptQuestionId,
            Integer displayOrder,
            String questionType,
            String question,
            Boolean isCorrect,
            boolean pendingManualEvaluation,
            BigDecimal earnedPoints,
            BigDecimal points,
            String learnerAnswer,
            Long selectedChoiceId,
            String selectedChoiceText,
            String correctChoiceText,
            String explanation,
            String submittedCode,
            String programmingLanguage,
            boolean diagramSubmitted,
            String feedback,
            List<SubQuestionAnswerReviewDto> subQuestionAnswers,
            List<DiagramElementReviewDto> diagramElements
    ) {
    }

    public record LessonPerformanceDto(
            Long lessonId,
            String lessonTitle,
            BigDecimal possiblePoints,
            BigDecimal earnedPoints,
            BigDecimal percentage,
            Integer pendingCount
    ) {
    }

    public record AssessmentAttemptResultDto(
            Long assessmentAttemptId,
            Long assessmentId,
            String assessmentTitle,
            String assessmentType,
            Integer attemptNumber,
            LocalDateTime submittedAt,
            Integer durationSeconds,
            BigDecimal percentage,
            Boolean passed,
            BigDecimal passingScore,
            BigDecimal totalPoints,
            BigDecimal earnedPoints,
            Integer correctCount,
            Integer incorrectCount,
            Integer pendingCount,
            Integer unansweredCount,
            List<AttemptAnswerReviewDto> answers,
            List<LessonPerformanceDto> lessonBreakdown,
            Long certificationId
    ) {
    }

    /**
     * One row of an assessment's attempt history — every retake, never
     * overwritten. Used to list/compare all of a learner's attempts on one
     * assessment before opening a specific one for full review.
     */
    public record AttemptSummaryDto(
            Long assessmentAttemptId,
            Long assessmentId,
            String assessmentTitle,
            Integer attemptNumber,
            String status,
            LocalDateTime startedAt,
            LocalDateTime submittedAt,
            Integer durationSeconds,
            BigDecimal totalPoints,
            BigDecimal earnedPoints,
            BigDecimal percentage,
            Boolean passed
    ) {
    }
}
