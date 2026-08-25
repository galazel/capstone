package com.capstone.rebyu.notification.entity;


import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "learner_invitations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerInvitation {

    public enum Status {
        PENDING, ACCEPTED, EXPIRED, REVOKED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invitationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_cert_id", nullable = false)
    private OrganizationCertificate orgCert;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id")
    private Learner learner;

    // The group this invitation places the learner into on acceptance. Nullable
    // only for invitations sent before groups scoped this flow; every new
    // invitation is sent by (and requires) a group leader.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_group_id")
    private InstitutionGroup institutionGroup;

    // The group leader who sent this invitation -- used to attribute the
    // resulting InstitutionGroupAssignee row on acceptance.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by")
    private User invitedBy;

    @Column(nullable = false, length = 254)
    private String email;

    // Optional: captured when the inviter provides the learner's name (like
    // NetAcad's first/last/email invite). Used to greet the invite and to
    // backfill the learner's profile name on acceptance if it's still blank.
    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(name = "token_hash", nullable = false, unique = true, length = 255)
    private String tokenHash;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;
}
