package com.capstone.rebyu.organization.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "institutions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Institution {

    public enum OrganizationType {
        school, university, review_center, company, government, training_center, other
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionId;

    @Column(name = "institution_name", nullable = false, unique = true, length = 150)
    private String institutionName;

    @Enumerated(EnumType.STRING)
    @Column(name = "organization_type", nullable = false, length = 50)
    private OrganizationType organizationType;

    @Column(nullable = false, length = 100)
    private String industry;

    @Column(name = "primary_contact_name", nullable = false, length = 100)
    private String primaryContactName;

    @Column(name = "primary_contact_email", nullable = false, length = 254)
    private String primaryContactEmail;

    @Column(name = "primary_contact_phone", length = 30)
    private String primaryContactPhone;

    @Column(name = "is_verified", nullable = false)
    private boolean isVerified = false;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;
}
