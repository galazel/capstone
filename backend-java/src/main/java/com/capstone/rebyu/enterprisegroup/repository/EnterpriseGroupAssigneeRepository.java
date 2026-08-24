package com.capstone.rebyu.enterprisegroup.repository;

import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EnterpriseGroupAssigneeRepository extends JpaRepository<EnterpriseGroupAssignee, Long> {
    List<EnterpriseGroupAssignee> findByEnterpriseGroup_EnterpriseGroupId(Long enterpriseGroupId);

    boolean existsByEnterpriseGroupAndOrgCertLearner(
            EnterpriseGroup enterpriseGroup, OrganizationCertificationLearner orgCertLearner);

    // Regardless of status -- used to reactivate an archived assignment
    // instead of colliding with it on re-add.
    Optional<EnterpriseGroupAssignee> findByEnterpriseGroupAndOrgCertLearner(
            EnterpriseGroup enterpriseGroup, OrganizationCertificationLearner orgCertLearner);

    // --- Per-group rollups (enterprise member dashboard) -------------------

    interface GroupProgress {
        Long getEnterpriseGroupId();
        String getGroupName();
        long getLearners();
        Double getAverageProgress();
        long getCompletedLearners();
    }

    /**
     * Completion per group across one enterprise, in one query.
     *
     * Only active assignees in active groups count: an archived assignment is
     * history, and letting it drag a group's average down would misreport the
     * people actually being taught right now.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT g.enterpriseGroupId AS enterpriseGroupId,
                   g.groupName AS groupName,
                   COUNT(a) AS learners,
                   AVG(l.progressPercentage) AS averageProgress,
                   SUM(CASE WHEN l.completedAt IS NOT NULL THEN 1 ELSE 0 END) AS completedLearners
            FROM EnterpriseGroupAssignee a
            JOIN a.enterpriseGroup g
            JOIN a.orgCertLearner l
            WHERE g.enterprise.enterpriseId = :enterpriseId
              AND a.status = com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee.Status.active
              AND g.status = com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup.Status.active
            GROUP BY g.enterpriseGroupId, g.groupName
            ORDER BY g.groupName
            """)
    List<GroupProgress> groupProgressByEnterprise(
            @org.springframework.data.repository.query.Param("enterpriseId") Long enterpriseId);

    // --- Group membership per assignment (enterprise learner roster) --------

    interface AssignmentGroup {
        Long getOrgCertLearnerId();
        Long getEnterpriseGroupId();
        String getGroupName();
    }

    /**
     * The group each assignment belongs to, across one enterprise, in one query.
     *
     * Active assignees in active groups only, matching groupProgressByEnterprise
     * above: an archived membership is history, and showing it on the roster
     * would name a group the learner is no longer being taught in. A learner
     * with no active membership simply has no row here -- the roster reads that
     * as "not in a group" rather than inventing one.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT l.orgCertLearnerId AS orgCertLearnerId,
                   g.enterpriseGroupId AS enterpriseGroupId,
                   g.groupName AS groupName
            FROM EnterpriseGroupAssignee a
            JOIN a.enterpriseGroup g
            JOIN a.orgCertLearner l
            WHERE g.enterprise.enterpriseId = :enterpriseId
              AND a.status = com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee.Status.active
              AND g.status = com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup.Status.active
            """)
    List<AssignmentGroup> assignmentGroupsByEnterprise(
            @org.springframework.data.repository.query.Param("enterpriseId") Long enterpriseId);
}
