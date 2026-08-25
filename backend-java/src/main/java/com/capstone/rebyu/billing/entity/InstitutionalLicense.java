package com.capstone.rebyu.billing.entity;

import com.capstone.rebyu.organization.entity.Institution;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** An institution's (B2B) institutional license to an institution plan. */
@Entity
@Table(name = "institutional_licenses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionalLicense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionalLicenseId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subscription_plan_id", nullable = false)
    private SubscriptionPlan subscriptionPlan;

    @Column(length = 30)
    private String provider;

    @Column(name = "provider_customer_id", length = 100)
    private String providerCustomerId;

    @Column(name = "provider_subscription_id", length = 100)
    private String providerSubscriptionId;

    @Column(name = "contract_number", length = 60)
    private String contractNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "license_status", nullable = false, length = 20)
    private BillingStatus licenseStatus = BillingStatus.PENDING;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "current_period_start")
    private LocalDateTime currentPeriodStart;

    @Column(name = "current_period_end")
    private LocalDateTime currentPeriodEnd;

    @Column(name = "cancel_at_period_end", nullable = false)
    private boolean cancelAtPeriodEnd = false;

    @Column(name = "canceled_at")
    private LocalDateTime canceledAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    // Custom contract overrides (null = use the plan's limit).
    @Column(name = "custom_seat_limit")
    private Integer customSeatLimit;

    @Column(name = "custom_group_limit")
    private Integer customGroupLimit;

    @Column(name = "custom_authority_limit")
    private Integer customAuthorityLimit;

    @Column(name = "custom_certification_limit")
    private Integer customCertificationLimit;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public boolean isCurrentlyActive() {
        if (!licenseStatus.grantsAccess()) {
            return false;
        }
        return currentPeriodEnd == null || currentPeriodEnd.isAfter(LocalDateTime.now());
    }
}
