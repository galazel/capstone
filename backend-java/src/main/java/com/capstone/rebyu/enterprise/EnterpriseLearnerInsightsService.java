package com.capstone.rebyu.enterprise;

import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupAssigneeRepository;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.enterprisegroup.service.EnterpriseGroupService;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.ProgressAnalyticsResponse;
import com.capstone.rebyu.progressanalytics.service.ProgressAnalyticsService;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * Lets a group's leader monitor the learners assigned to that group.
 *
 * Every existing analytics entry point resolves the learner from the caller's
 * own token, so none of them can answer "how is one of my learners doing".
 * These methods take a learner id explicitly and gate it on the caller
 * genuinely leading a group that learner belongs to -- reusing
 * {@link EnterpriseGroupService#getAccessibleById} for the tenant + owner-or-
 * active-leader check rather than re-implementing it, so this surface can never
 * drift from the one the rest of the group endpoints enforce.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnterpriseLearnerInsightsService {

    /**
     * One row of the group's learner table.
     *
     * Carries a real completed-lesson count rather than the enrollment's
     * progress_percentage / the learner's readiness_score and confidence_level:
     * nothing in the codebase ever writes those three columns, so a table built
     * on them would show 0% for every learner and read as "everyone is
     * failing" instead of "not measured". Readiness and confidence appear on
     * the per-learner page, where ProgressAnalyticsService computes them live.
     */
    public record GroupLearnerRow(
            Long enterpriseGroupAssigneeId,
            Long learnerId,
            Long orgCertLearnerId,
            String name,
            String username,
            String email,
            String status,
            LocalDateTime assignedAt,
            int completedLessonCount,
            int totalLessonCount,
            Double completionPercentage
    ) {}

    private final EnterpriseGroupRepository enterpriseGroupRepository;
    private final EnterpriseGroupAssigneeRepository enterpriseGroupAssigneeRepository;
    private final EnterpriseGroupService enterpriseGroupService;
    private final ProgressAnalyticsService progressAnalyticsService;
    private final LessonRepository lessonRepository;
    private final LearnerCompletedLessonRepository learnerCompletedLessonRepository;

    /**
     * The group's active learners with the cheap per-learner figures the table
     * shows. Deliberately avoids the full analytics computation -- that runs
     * per learner and is far too heavy to fan out across a whole roster.
     */
    @Transactional(readOnly = true)
    public List<GroupLearnerRow> groupRoster(
            Long groupId, Long enterpriseId, Long callerUserId, boolean callerIsOwner) {
        EnterpriseGroup group = requireGroupAccess(groupId, enterpriseId, callerUserId, callerIsOwner);

        // Counted once for the whole roster rather than per learner.
        Long certificationId = certificationIdOf(group);
        int totalLessons = certificationId == null ? 0 : lessonRepository
                .findByMiddleCategory_MajorCategory_Certification_CertificationId(certificationId)
                .size();

        return enterpriseGroupAssigneeRepository
                .findByEnterpriseGroup_EnterpriseGroupId(groupId).stream()
                .filter(assignee -> assignee.getStatus() == EnterpriseGroupAssignee.Status.active)
                .map(assignee -> toRow(assignee, certificationId, totalLessons))
                .sorted(Comparator.comparing(
                        GroupLearnerRow::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    /**
     * Full analytics for one learner -- weak topics, curriculum progress,
     * readiness and confidence. The certification is taken from the group's own
     * allocation rather than the caller, so a leader can only ever pull figures
     * for the certification their group is actually enrolled in.
     */
    @Transactional(readOnly = true)
    public ProgressAnalyticsResponse learnerAnalytics(
            Long groupId, Long learnerId, Long enterpriseId, Long callerUserId, boolean callerIsOwner) {
        EnterpriseGroup group = requireGroupAccess(groupId, enterpriseId, callerUserId, callerIsOwner);
        requireAssignedToGroup(groupId, learnerId);

        Long certificationId = certificationIdOf(group);
        if (certificationId == null) {
            throw new EntityNotFoundException(
                    "This group has no certification allocation: " + groupId);
        }
        return progressAnalyticsService.getProgressAnalytics(learnerId, certificationId);
    }

    /**
     * Unassigns a learner from the group and returns their reserved slot. The
     * account, its enrollment, and all progress history are left untouched --
     * removing someone from a group is an organizational change, not a reason
     * to destroy their record, and they can be added back later.
     */
    @Transactional
    public void removeFromGroup(
            Long groupId, Long learnerId, Long enterpriseId, Long callerUserId, boolean callerIsOwner) {
        EnterpriseGroup group = requireGroupAccess(groupId, enterpriseId, callerUserId, callerIsOwner);

        EnterpriseGroupAssignee assignee = activeAssignee(groupId, learnerId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Learner not assigned to this group: " + learnerId));

        assignee.setStatus(EnterpriseGroupAssignee.Status.archived);
        assignee.setRemovedAt(LocalDateTime.now());
        enterpriseGroupAssigneeRepository.save(assignee);

        // Mirrors how a cancelled invitation restores its slot; never negative.
        group.setUsedSlots(Math.max(0, group.getUsedSlots() - 1));
        enterpriseGroupRepository.save(group);

        log.info("Learner {} removed from group {} by userId={}; 1 slot restored",
                learnerId, groupId, callerUserId);
    }

    // ------------------------------------------------------------------------

    /**
     * Throws EntityNotFoundException unless the caller owns this enterprise or
     * actively leads this group -- reported as "not found" so a caller can't
     * probe which group ids exist in other tenants.
     */
    private EnterpriseGroup requireGroupAccess(
            Long groupId, Long enterpriseId, Long callerUserId, boolean callerIsOwner) {
        enterpriseGroupService.getAccessibleById(groupId, enterpriseId, callerUserId, callerIsOwner);
        return enterpriseGroupRepository.findById(groupId)
                .orElseThrow(() -> new EntityNotFoundException("EnterpriseGroup not found: " + groupId));
    }

    /** A leader may only read learners actually assigned to the group they lead. */
    private void requireAssignedToGroup(Long groupId, Long learnerId) {
        if (activeAssignee(groupId, learnerId).isEmpty()) {
            throw new EntityNotFoundException("Learner not assigned to this group: " + learnerId);
        }
    }

    private java.util.Optional<EnterpriseGroupAssignee> activeAssignee(Long groupId, Long learnerId) {
        return enterpriseGroupAssigneeRepository
                .findByEnterpriseGroup_EnterpriseGroupId(groupId).stream()
                .filter(assignee -> assignee.getStatus() == EnterpriseGroupAssignee.Status.active)
                .filter(assignee -> {
                    Learner learner = learnerOf(assignee);
                    return learner != null && learner.getLearnerId().equals(learnerId);
                })
                .findFirst();
    }

    private GroupLearnerRow toRow(
            EnterpriseGroupAssignee assignee, Long certificationId, int totalLessons) {
        OrganizationCertificationLearner enrollment = assignee.getOrgCertLearner();
        Learner learner = learnerOf(assignee);

        int completedLessons = 0;
        if (learner != null && certificationId != null) {
            completedLessons = learnerCompletedLessonRepository
                    .findByLearner_LearnerIdAndLesson_MiddleCategory_MajorCategory_Certification_CertificationId(
                            learner.getLearnerId(), certificationId)
                    .size();
        }
        Double completionPercentage = totalLessons > 0
                ? (completedLessons * 100.0) / totalLessons
                : null;

        return new GroupLearnerRow(
                assignee.getEnterpriseGroupAssigneeId(),
                learner != null ? learner.getLearnerId() : null,
                enrollment != null ? enrollment.getOrgCertLearnerId() : null,
                displayName(learner),
                learner != null ? learner.getUsername() : null,
                learner != null && learner.getUser() != null ? learner.getUser().getEmail() : null,
                assignee.getStatus() != null ? assignee.getStatus().name() : null,
                assignee.getAssignedAt(),
                completedLessons,
                totalLessons,
                completionPercentage
        );
    }

    /** Name first, username as the fallback -- never the raw e-mail address. */
    private String displayName(Learner learner) {
        if (learner == null) {
            return "Unknown learner";
        }
        String first = learner.getFirstName() == null ? "" : learner.getFirstName().trim();
        String last = learner.getLastName() == null ? "" : learner.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) {
            return full;
        }
        return learner.getUsername() != null && !learner.getUsername().isBlank()
                ? learner.getUsername()
                : "Unknown learner";
    }

    private Learner learnerOf(EnterpriseGroupAssignee assignee) {
        return assignee.getOrgCertLearner() != null ? assignee.getOrgCertLearner().getLearner() : null;
    }

    private Long certificationIdOf(EnterpriseGroup group) {
        if (group.getOrgCert() == null || group.getOrgCert().getCertification() == null) {
            return null;
        }
        return group.getOrgCert().getCertification().getCertificationId();
    }
}
