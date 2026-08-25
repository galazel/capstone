package com.capstone.rebyu.institutiongroup.repository;

import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAssignee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstitutionGroupAssigneeRepository extends JpaRepository<InstitutionGroupAssignee, Long> {
    List<InstitutionGroupAssignee> findByInstitutionGroup_InstitutionGroupId(Long institutionGroupId);

    boolean existsByInstitutionGroupAndOrgCertLearner(
            InstitutionGroup institutionGroup, OrganizationCertificationLearner orgCertLearner);

    // Regardless of status -- used to reactivate an archived assignment
    // instead of colliding with it on re-add.
    Optional<InstitutionGroupAssignee> findByInstitutionGroupAndOrgCertLearner(
            InstitutionGroup institutionGroup, OrganizationCertificationLearner orgCertLearner);

    // --- Per-group rollups (institution member dashboard) -------------------

    interface GroupProgress {
        Long getInstitutionGroupId();
        String getGroupName();
        long getLearners();
        Double getAverageProgress();
        long getCompletedLearners();
    }

    /**
     * Completion per group across one institution, in one query.
     *
     * Only active assignees in active groups count: an archived assignment is
     * history, and letting it drag a group's average down would misreport the
     * people actually being taught right now.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT g.institutionGroupId AS institutionGroupId,
                   g.groupName AS groupName,
                   COUNT(a) AS learners,
                   AVG(l.progressPercentage) AS averageProgress,
                   SUM(CASE WHEN l.completedAt IS NOT NULL THEN 1 ELSE 0 END) AS completedLearners
            FROM InstitutionGroupAssignee a
            JOIN a.institutionGroup g
            JOIN a.orgCertLearner l
            WHERE g.institution.institutionId = :institutionId
              AND a.status = com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAssignee.Status.active
              AND g.status = com.capstone.rebyu.institutiongroup.entity.InstitutionGroup.Status.active
            GROUP BY g.institutionGroupId, g.groupName
            ORDER BY g.groupName
            """)
    List<GroupProgress> groupProgressByInstitution(
            @org.springframework.data.repository.query.Param("institutionId") Long institutionId);

    // --- Group membership per assignment (institution learner roster) --------

    interface AssignmentGroup {
        Long getOrgCertLearnerId();
        Long getInstitutionGroupId();
        String getGroupName();
    }

    /**
     * The group each assignment belongs to, across one institution, in one query.
     *
     * Active assignees in active groups only, matching groupProgressByInstitution
     * above: an archived membership is history, and showing it on the roster
     * would name a group the learner is no longer being taught in. A learner
     * with no active membership simply has no row here -- the roster reads that
     * as "not in a group" rather than inventing one.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT l.orgCertLearnerId AS orgCertLearnerId,
                   g.institutionGroupId AS institutionGroupId,
                   g.groupName AS groupName
            FROM InstitutionGroupAssignee a
            JOIN a.institutionGroup g
            JOIN a.orgCertLearner l
            WHERE g.institution.institutionId = :institutionId
              AND a.status = com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAssignee.Status.active
              AND g.status = com.capstone.rebyu.institutiongroup.entity.InstitutionGroup.Status.active
            """)
    List<AssignmentGroup> assignmentGroupsByInstitution(
            @org.springframework.data.repository.query.Param("institutionId") Long institutionId);
}
