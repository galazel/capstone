package com.capstone.rebyu.progress.analytics.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Response shapes for GET /api/learners/me/certifications/{certificationId}/progress-analytics.
 * Grouped as nested records in one holder class, matching the billing package's DTO convention.
 */
public final class ProgressAnalyticsDtos {

    private ProgressAnalyticsDtos() {
    }

    public record ProgressAnalyticsResponse(
            Long learnerId,
            Long certificationId,
            String certificationTitle,
            LocalDateTime generatedAt,

            boolean bktAvailable,
            boolean hasAssessmentActivity,
            boolean hasChallengeActivity,

            Double overallMasteryPercentage,
            Double confidencePercentage,
            Double readinessPercentage,

            int masteredTopicCount,
            int weakTopicCount,
            int unassessedTopicCount,
            int highestPriorityTopicCount,

            int totalLessonCount,
            int completedLessonCount,
            Double completionPercentage,

            int totalAssessmentAttempts,
            int totalChallengeAttempts,
            boolean challengeStatsCertificationScoped,

            Double averageAssessmentScore,
            Double averageChallengeScore,

            int totalCorrectAnswers,
            int totalIncorrectAnswers,
            boolean challengeAnswerBreakdownAvailable,

            int studyStreakDays,

            List<RecentActivityItem> recentActivity,
            List<MasteryTrendPoint> masteryTrend,
            List<ScoreTrendPoint> scoreTrend,

            List<PerformanceBucket> performanceByDifficulty,
            List<PerformanceBucket> performanceByQuestionType,
            List<PerformanceBucket> performanceByAssessmentType,

            List<CategoryMasteryRow> categoryMastery,

            List<TopicRow> weakestTopics,
            List<TopicRow> strongestTopics,
            List<RecommendationRow> recommendedTopics,

            // Every lesson the BKT service has an opinion on, unfiltered and
            // uncapped -- weakestTopics/strongestTopics are curated top-N lists
            // for the analytics page, but a per-lesson priority tag in the
            // curriculum UI needs every lesson, not just the extremes.
            List<TopicRow> lessonPriorities
    ) {
    }

    public record RecentActivityItem(
            String activityType, // "ASSESSMENT" | "CHALLENGE"
            String title,
            LocalDateTime occurredAt,
            Double scorePercentage,
            Boolean passed
    ) {
    }

    public record MasteryTrendPoint(
            LocalDateTime occurredAt,
            Long lessonId,
            String lessonTitle,
            Double previousMastery,
            Double newMastery,
            String newMasteryLevel,
            String assessmentType
    ) {
    }

    public record ScoreTrendPoint(
            Long assessmentAttemptId,
            LocalDateTime submittedAt,
            String assessmentTitle,
            String assessmentType,
            BigDecimal percentage,
            Boolean passed
    ) {
    }

    public record PerformanceBucket(
            String bucketKey,
            int totalAnswered,
            int correctAnswers,
            int incorrectAnswers,
            Double accuracyPercentage
    ) {
    }

    public record CategoryMasteryRow(
            Long categoryId,
            String title,
            String categoryLevel, // "MAJOR" | "MIDDLE"
            Double masteryPercentage,
            String masteryLevel,
            String priorityCode,
            int assessedLessonCount,
            int totalLessonCount,
            int completedLessonCount,
            int weakLessonCount,
            int highestPriorityLessonCount,
            List<CategoryMasteryRow> children
    ) {
    }

    public record TopicRow(
            Long lessonId,
            String lessonTitle,
            Long categoryId,
            String categoryTitle,
            Double masteryPercentage,
            String priorityTag,
            Integer evidenceCount,
            String lastUpdated
    ) {
    }

    public record RecommendationRow(
            Long lessonId,
            String lessonTitle,
            String reason,
            String recommendedAction,
            String priorityTag
    ) {
    }
}
