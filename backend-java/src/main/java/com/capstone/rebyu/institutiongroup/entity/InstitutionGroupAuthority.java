package com.capstone.rebyu.institutiongroup.entity;

import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Uniqueness is enforced by a partial index (uq_institution_group_authority_active,
// scoped to status='active') rather than a @Table-level constraint here, so a
// user removed as an authority can be re-assigned without colliding with their
// own archived row. Do not add a uniqueConstraints attribute back -- Hibernate's
// ddl-auto=update would create its own non-partial constraint alongside it.
@Entity
@Table(name = "institution_group_authorities")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionGroupAuthority {

    public enum Status {
        active, archived
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionGroupAuthorityId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_group_id", nullable = false)
    private InstitutionGroup institutionGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by", nullable = false)
    private User assignedBy;

    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.active;

    @Column(name = "removed_at")
    private LocalDateTime removedAt;
}
