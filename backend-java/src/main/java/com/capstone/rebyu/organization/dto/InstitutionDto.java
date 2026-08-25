package com.capstone.rebyu.organization.dto;

import com.capstone.rebyu.organization.entity.Institution;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstitutionDto {
    private Long institutionId;

    @NotBlank
    @Size(max = 150)
    private String institutionName;

    @NotNull
    private Institution.OrganizationType organizationType;

    @NotBlank
    @Size(max = 100)
    private String industry;

    private boolean isVerified = false;

    private String address;

    @Size(max = 150)
    private String primaryContactName;

    @Size(max = 254)
    private String primaryContactEmail;

    @Size(max = 30)
    private String primaryContactPhone;

    private LocalDateTime joinedAt;

    // Display-only aggregates for the admin organizations list; computed in
    // InstitutionService, never accepted on create/update.
    private Integer learnerCount;
    private Integer certificationCount;
    private String status;
}
