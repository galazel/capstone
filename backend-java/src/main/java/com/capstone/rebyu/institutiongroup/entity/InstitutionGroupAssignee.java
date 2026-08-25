package com.capstone.rebyu.institutiongroup.entity;

import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Uniqueness is enforced by a partial index (uq_institution_group_assignee_active,
// scoped to status='active') rather than a @Table-level constraint here, so a
// learner removed from a group can be re-added without colliding with their
// own archived row. Do not add a uniqueConstraints attribute back -- Hibernate's
// ddl-auto=update would create its own non-partial constraint alongside it.
@Entity
@Table(name = "institution_group_assignees")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionGroupAssignee {

    public enum Status {
        active, archived
    }

    public enum Role {
        lead, member
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionGroupAssigneeId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_group_id", nullable = false)
    private InstitutionGroup institutionGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_cert_learner_id", nullable = false)
    private OrganizationCertificationLearner orgCertLearner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by", nullable = false)
    private User assignedBy;

    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.active;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.member;

    @Column(name = "removed_at")
    private LocalDateTime removedAt;
}
