package com.capstone.rebyu.institutiongroup.entity;

import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "institution_groups")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionGroup {

    public enum Status {
        active, archived
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionGroupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_cert_id", nullable = false)
    private OrganizationCertificate orgCert;

    @Column(name = "group_name", nullable = false, length = 150)
    private String groupName;

    @Column(name = "group_description", length = 500)
    private String groupDescription;

    // A sub-allocation carved out of (and capped by) the org cert's own
    // totalSlots -- the group's own leader can only invite learners up to
    // this limit, not the whole certification allocation's remaining pool.
    @Column(name = "total_slots", nullable = false)
    private Integer totalSlots = 0;

    @Column(name = "used_slots", nullable = false)
    private Integer usedSlots = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.active;
}
