package com.capstone.rebyu.organization.entity;


import com.capstone.rebyu.certification.entity.Certification;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "organization_certificates")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrganizationCertificate {

    public enum Status {
        pending, active, expired, suspended, cancelled
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long orgCertId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certification_id", nullable = false)
    private Certification certification;

    @Column(name = "total_slots", nullable = false)
    private Integer totalSlots;

    @Column(name = "used_slots", nullable = false)
    private Integer usedSlots = 0;

    @Column(name = "remaining_slots", insertable = false, updatable = false)
    private Integer remainingSlots;

    @Column(name = "access_start_date", nullable = false)
    private LocalDate accessStartDate;

    @Column(name = "access_expiry_date", nullable = false)
    private LocalDate accessExpiryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.active;

    // Optimistic lock guarding concurrent slot reservation (Transaction 3) so
    // two simultaneous invitation batches cannot oversubscribe the allocation.
    @Version
    @Column(name = "version")
    private Long version;
}
