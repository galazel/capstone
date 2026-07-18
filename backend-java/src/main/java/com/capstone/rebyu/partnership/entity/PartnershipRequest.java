package com.capstone.rebyu.partnership.entity;


import com.capstone.rebyu.organization.entity.Enterprise;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "partnership_requests", indexes = {
        @Index(name = "idx_partnership_request_status", columnList = "status"),
        @Index(name = "idx_partnership_request_org_email", columnList = "organization_email"),
        @Index(name = "idx_partnership_request_reference", columnList = "reference_number")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnershipRequest {

    public enum Status {
        PENDING, UNDER_REVIEW, MEETING_SCHEDULED, APPROVED, REJECTED, CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long requestId;

    // Public reference number returned to the requester for status lookup.
    @Column(name = "reference_number", unique = true, length = 32)
    private String referenceNumber;

    // Null until the request is approved and an Enterprise record is created.
    // A public organization representative has no account when they submit.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enterprise_id")
    private Enterprise enterprise;

    // Organization details captured on the public request (denormalized so no
    // unverified organization pollutes the enterprises table before approval).
    @Column(name = "organization_name", length = 150)
    private String organizationName;

    @Column(name = "organization_email", length = 254)
    private String organizationEmail;

    @Column(name = "contact_person_name", length = 150)
    private String contactPersonName;

    @Column(name = "contact_number", length = 40)
    private String contactNumber;

    @Column(name = "organization_address", columnDefinition = "text")
    private String organizationAddress;

    @Column(name = "business_description", columnDefinition = "text")
    private String businessDescription;

    @Column(name = "submitted_at", nullable = false)
    private LocalDateTime submittedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private Status status = Status.PENDING;

    // Review audit fields, populated when an admin approves or rejects.
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewed_by", length = 150)
    private String reviewedBy;

    @Column(name = "admin_remarks", columnDefinition = "text")
    private String adminRemarks;

    // Prevents duplicate submissions of the same partnership request.
    @Column(name = "idempotency_key", unique = true, length = 64)
    private String idempotencyKey;

    // Optimistic lock so two near-simultaneous approve/reject calls on the
    // same request can't both succeed (mirrors OrganizationCertificate.version).
    @Version
    @Column(name = "version")
    private Long version;
}
