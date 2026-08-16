package com.capstone.rebyu.user.dto;

import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.enrollment.dto.LearnerCertificationDto;
import com.capstone.rebyu.enrollment.dto.OrganizationCertificationLearnerDto;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.progress.dto.ActivityLogDto;
import com.capstone.rebyu.progress.dto.LearnerAchievementViewDto;
import com.capstone.rebyu.progress.dto.LearnerCompletedLessonDto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Learner-scoped portal snapshot. Every list is filtered to the authenticated learner
 * server-side, replacing the old browser-side filtering of global lists (all learners,
 * all users, all completed lessons, all exam results, all org allocations).
 *
 * Includes gamification (XP, coins) and BKT mastery state.
 */
public record LearnerPortalDto(
        LearnerDto learner,
        UserDto user,
        List<LearnerCertificationDto> learnerCertifications,
        List<LearnerCompletedLessonDto> completedLessons,
        List<ActivityLogDto> activityLogs,
        List<ExamResultDto> examResults,
        List<OrganizationCertificationLearnerDto> orgCertLearners,
        List<OrganizationCertificateDto> orgCertificates,
        // The whole achievement catalog with this learner's earned ones flagged,
        // so the portal can show both what they have and what is left to chase.
        List<LearnerAchievementViewDto> achievements,
        // Gamification
        Long totalXp,
        BigDecimal coinBalance,
        Long aiCreditsRemaining,
        // BKT mastery per certification (certificationId -> mastery level 0-4)
        Map<Long, Integer> masteryByMasteryByCertification
) {
    // Convenience constructor without gamification (backwards compatible)
    public LearnerPortalDto(
            LearnerDto learner,
            UserDto user,
            List<LearnerCertificationDto> learnerCertifications,
            List<LearnerCompletedLessonDto> completedLessons,
            List<ActivityLogDto> activityLogs,
            List<ExamResultDto> examResults,
            List<OrganizationCertificationLearnerDto> orgCertLearners,
            List<OrganizationCertificateDto> orgCertificates) {
        this(learner, user, learnerCertifications, completedLessons, activityLogs,
             examResults, orgCertLearners, orgCertificates, List.of(), 0L, BigDecimal.ZERO, 0L, Map.of());
    }
}
