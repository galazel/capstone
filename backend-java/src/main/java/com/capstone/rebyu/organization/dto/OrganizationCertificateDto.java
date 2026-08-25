package com.capstone.rebyu.organization.dto;

import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationCertificateDto {
    private Long orgCertId;

    @NotNull
    private Long institutionId;

    @NotNull
    private Long certificationId;

    @NotNull
    @Min(0)
    private Integer totalSlots;

    @Min(0)
    private Integer usedSlots = 0;

    private Integer remainingSlots;

    @NotNull
    private LocalDate accessStartDate;

    @NotNull
    private LocalDate accessExpiryDate;

    private OrganizationCertificate.Status status = OrganizationCertificate.Status.active;
}
