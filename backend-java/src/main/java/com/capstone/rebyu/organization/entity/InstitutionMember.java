package com.capstone.rebyu.organization.entity;

import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "institution_members",
        uniqueConstraints = @UniqueConstraint(columnNames = {"institution_id", "user_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionMember {

    public enum MemberRole {
        owner, manager, staff
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionMemberId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "member_role", nullable = false, length = 20)
    private MemberRole memberRole = MemberRole.manager;

    // Captured when the institution provisions this person's account. The users
    // table has no name columns, so without these a member can only ever be
    // labelled by email.
    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(name = "is_primary_contact", nullable = false)
    private boolean isPrimaryContact = false;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;
}
