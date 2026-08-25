package com.capstone.rebyu.partnership.entity;

import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "institution_certification_renewal_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionCertificationRenewalRequest {

    public enum Status {
        pending, approved, rejected, cancelled
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long renewalRequestId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_cert_id", nullable = false)
    private OrganizationCertificate orgCert;

    @Column(name = "requested_validity_months", nullable = false)
    private Integer requestedValidityMonths;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.pending;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;
}
