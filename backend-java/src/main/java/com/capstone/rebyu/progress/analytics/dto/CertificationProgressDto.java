package com.capstone.rebyu.progress.analytics.dto;

/**
 * How far a learner is through one certification, counted the way the analytics
 * board counts it: lessons read and assessments passed, over the lessons and
 * assessments the certification actually requires.
 *
 * <p>Exists so the My Learning cards and the analytics board stop disagreeing.
 * The cards used to divide completed lessons by total lessons in the browser,
 * which reported 100% on a certification whose every quiz and exam was still
 * unsat -- while the analytics board, counting both, reported 20% for the same
 * learner on the same day.
 *
 * <p>The counts are produced by {@code ProgressAnalyticsService}, which owns the
 * rules for what counts (official curriculum only, published, no tutor practice
 * sets, no diagnostic). Percentages are deliberately NOT computed here: the
 * frontend derives them from these counts with a single shared helper, so the
 * board and the cards cannot drift on the arithmetic either.
 */
public record CertificationProgressDto(
        Long certificationId,
        int completedLessons,
        int totalLessons,
        int passedAssessments,
        int totalAssessments
) {}
