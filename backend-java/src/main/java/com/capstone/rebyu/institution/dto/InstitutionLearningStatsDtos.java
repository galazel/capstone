package com.capstone.rebyu.institution.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Learning statistics for one organization: a roster-wide rollup plus a row per
 * member.
 *
 * Every figure is derived from the organization's own assignments, attempts and
 * completed lessons -- nothing here is sampled or projected. A member with no
 * activity yet reports nulls for the score fields rather than zeros, because
 * "has not been graded" is not the same fact as "scored zero" and the dashboard
 * must not draw them the same way.
 */
public final class InstitutionLearningStatsDtos {

    private InstitutionLearningStatsDtos() {
    }

    public record MemberLearningStatsDto(
            Long learnerId,
            String name,
            String username,
            /** Assignment rows for this member, active or otherwise. */
            int assignedCertifications,
            int activeCertifications,
            int completedCertifications,
            /** Mean of this member's assignment progress, 0-100. */
            BigDecimal averageProgress,
            long lessonsCompleted,
            long gradedAttempts,
            long passedAttempts,
            Integer passRate,
            Integer averageScore,
            LocalDateTime lastActivityAt) {}

    public record LearningStatsSummaryDto(
            int members,
            /** Members with at least one graded attempt or finished lesson. */
            int activeMembers,
            int membersNotStarted,
            BigDecimal averageProgress,
            long lessonsCompleted,
            long gradedAttempts,
            Integer passRate,
            Integer averageScore,
            int seatsTotal,
            int seatsUsed) {}

    public record GroupProgressDto(
            Long institutionGroupId,
            String groupName,
            long learners,
            BigDecimal averageProgress,
            long completedLearners) {}

    public record InstitutionLearningStatsDto(
            LearningStatsSummaryDto summary,
            List<MemberLearningStatsDto> members) {}
}
