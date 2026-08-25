package com.capstone.rebyu.institution.service;

import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository.LearnerAttemptStats;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.institution.dto.InstitutionLearningStatsDtos.InstitutionLearningStatsDto;
import com.capstone.rebyu.institution.dto.InstitutionLearningStatsDtos.GroupProgressDto;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAssigneeRepository;
import com.capstone.rebyu.institution.dto.InstitutionLearningStatsDtos.LearningStatsSummaryDto;
import com.capstone.rebyu.institution.dto.InstitutionLearningStatsDtos.MemberLearningStatsDto;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository.LessonsDone;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * How the organization's own people are actually doing.
 *
 * Scoped to one institution throughout -- the roster is derived from that
 * institution's assignment rows, and every rollup is keyed on those learner ids,
 * so a member of another tenant cannot appear here even by accident.
 *
 * The rollups (attempts, lessons) are each a single batched query over the whole
 * roster rather than a query per member. A per-member loop is the obvious way to
 * write this and it is what makes a large organization's dashboard crawl.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InstitutionLearningStatsService {

    private final OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private final OrganizationCertificateRepository orgCertRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final LearnerCompletedLessonRepository completedLessonRepository;
    private final LearnerRepository learnerRepository;
    private final InstitutionGroupAssigneeRepository groupAssigneeRepository;

    public InstitutionLearningStatsDto learningStats(Long institutionId) {
        List<OrganizationCertificationLearner> assignments =
                orgCertLearnerRepository.findByOrgCert_Institution_InstitutionId(institutionId);

        // Insertion-ordered so the roster is stable between reloads even before
        // the sort below, which makes diffing a dashboard by eye possible.
        Set<Long> learnerIds = assignments.stream()
                .map(assignment -> assignment.getLearner().getLearnerId())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        int seatsTotal = 0;
        int seatsUsed = 0;
        for (var orgCert : orgCertRepository.findByInstitution_InstitutionId(institutionId)) {
            seatsTotal += orgCert.getTotalSlots() == null ? 0 : orgCert.getTotalSlots();
            seatsUsed += orgCert.getUsedSlots() == null ? 0 : orgCert.getUsedSlots();
        }

        if (learnerIds.isEmpty()) {
            return new InstitutionLearningStatsDto(
                    new LearningStatsSummaryDto(0, 0, 0, null, 0, 0, null, null, seatsTotal, seatsUsed),
                    List.of());
        }

        Map<Long, LearnerAttemptStats> attemptStats = attemptRepository
                .statsByLearnerIds(learnerIds, AssessmentAttempt.Status.SUBMITTED).stream()
                .collect(Collectors.toMap(LearnerAttemptStats::getLearnerId, Function.identity()));

        Map<Long, Long> lessonsDone = completedLessonRepository
                .lessonsCompletedByLearnerIds(learnerIds).stream()
                .collect(Collectors.toMap(LessonsDone::getLearnerId, LessonsDone::getLessonsCompleted));

        Map<Long, Learner> learnerById = learnerRepository.findByLearnerIdIn(learnerIds).stream()
                .collect(Collectors.toMap(Learner::getLearnerId, Function.identity()));

        Map<Long, List<OrganizationCertificationLearner>> assignmentsByLearner = assignments.stream()
                .collect(Collectors.groupingBy(a -> a.getLearner().getLearnerId()));

        List<MemberLearningStatsDto> members = new ArrayList<>();
        for (Long learnerId : learnerIds) {
            members.add(member(
                    learnerId,
                    learnerById.get(learnerId),
                    assignmentsByLearner.getOrDefault(learnerId, List.of()),
                    attemptStats.get(learnerId),
                    lessonsDone.getOrDefault(learnerId, 0L)));
        }

        // Least progress first: the dashboard exists to find who needs help, and
        // that reading should not require sorting the table by hand every visit.
        members.sort(Comparator.comparing(
                        (MemberLearningStatsDto m) -> m.averageProgress() == null
                                ? BigDecimal.ZERO
                                : m.averageProgress())
                .thenComparing(MemberLearningStatsDto::name,
                        Comparator.nullsLast(String::compareToIgnoreCase)));

        return new InstitutionLearningStatsDto(summary(members, seatsTotal, seatsUsed), members);
    }

    /**
     * Completion per learning group, for the group-analytics panels.
     *
     * A group with assignees but no recorded progress reports a real 0, not a
     * null: the rows exist and their progress genuinely is zero, which is a
     * different situation from a group nobody has been assigned to.
     */
    public List<GroupProgressDto> groupProgress(Long institutionId) {
        return groupAssigneeRepository.groupProgressByInstitution(institutionId).stream()
                .map(row -> new GroupProgressDto(
                        row.getInstitutionGroupId(),
                        row.getGroupName(),
                        row.getLearners(),
                        row.getAverageProgress() == null
                                ? BigDecimal.ZERO
                                : BigDecimal.valueOf(row.getAverageProgress())
                                        .setScale(1, RoundingMode.HALF_UP),
                        row.getCompletedLearners()))
                .toList();
    }

    private MemberLearningStatsDto member(
            Long learnerId,
            Learner learner,
            List<OrganizationCertificationLearner> assignments,
            LearnerAttemptStats stats,
            long lessonsCompleted) {

        int active = 0;
        int completed = 0;
        BigDecimal progressSum = BigDecimal.ZERO;
        for (OrganizationCertificationLearner assignment : assignments) {
            if (assignment.getStatus() == OrganizationCertificationLearner.Status.active) {
                active++;
            }
            if (assignment.getCompletedAt() != null) {
                completed++;
            }
            progressSum = progressSum.add(
                    assignment.getProgressPercentage() == null
                            ? BigDecimal.ZERO
                            : assignment.getProgressPercentage());
        }

        BigDecimal averageProgress = assignments.isEmpty() ? null
                : progressSum.divide(BigDecimal.valueOf(assignments.size()), 1, RoundingMode.HALF_UP);

        long attempts = stats == null ? 0 : stats.getAttempts();
        long passed = stats == null ? 0 : stats.getPassedAttempts();
        Double average = stats == null ? null : stats.getAverageScore();
        LocalDateTime lastActivity = stats == null ? null : stats.getLastSubmittedAt();

        return new MemberLearningStatsDto(
                learnerId,
                displayName(learner, learnerId),
                learner == null ? null : learner.getUsername(),
                assignments.size(),
                active,
                completed,
                averageProgress,
                lessonsCompleted,
                attempts,
                passed,
                attempts == 0 ? null : (int) Math.round(passed * 100.0 / attempts),
                average == null ? null : (int) Math.round(average),
                lastActivity);
    }

    private LearningStatsSummaryDto summary(
            List<MemberLearningStatsDto> members, int seatsTotal, int seatsUsed) {

        long gradedAttempts = 0;
        long passedAttempts = 0;
        long lessonsCompleted = 0;
        long scoreWeight = 0;
        double scoreTotal = 0;
        int activeMembers = 0;
        int withProgress = 0;
        BigDecimal progressSum = BigDecimal.ZERO;

        for (MemberLearningStatsDto member : members) {
            gradedAttempts += member.gradedAttempts();
            passedAttempts += member.passedAttempts();
            lessonsCompleted += member.lessonsCompleted();
            if (member.gradedAttempts() > 0 || member.lessonsCompleted() > 0) {
                activeMembers++;
            }
            if (member.averageScore() != null) {
                // Weighted by attempts so a member with one graded attempt does
                // not move the organization's average as much as one with forty.
                scoreTotal += member.averageScore() * member.gradedAttempts();
                scoreWeight += member.gradedAttempts();
            }
            if (member.averageProgress() != null) {
                progressSum = progressSum.add(member.averageProgress());
                withProgress++;
            }
        }

        return new LearningStatsSummaryDto(
                members.size(),
                activeMembers,
                members.size() - activeMembers,
                withProgress == 0 ? null
                        : progressSum.divide(BigDecimal.valueOf(withProgress), 1, RoundingMode.HALF_UP),
                lessonsCompleted,
                gradedAttempts,
                gradedAttempts == 0 ? null : (int) Math.round(passedAttempts * 100.0 / gradedAttempts),
                scoreWeight == 0 ? null : (int) Math.round(scoreTotal / scoreWeight),
                seatsTotal,
                seatsUsed);
    }

    private String displayName(Learner learner, Long learnerId) {
        if (learner == null) {
            return "Learner #" + learnerId;
        }
        String full = ((learner.getFirstName() == null ? "" : learner.getFirstName()) + " "
                + (learner.getLastName() == null ? "" : learner.getLastName())).trim();
        if (!full.isEmpty()) {
            return full;
        }
        return learner.getUsername() == null ? "Learner #" + learnerId : learner.getUsername();
    }
}
