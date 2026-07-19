package com.capstone.rebyu.enterprisegroup.dto;

import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import jakarta.validation.constraints.Min;
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
public class EnterpriseGroupDto {
    private Long enterpriseGroupId;

    // Always overwritten server-side from the caller's JWT (see
    // EnterpriseGroupController.create), so must stay nullable -- the client
    // never supplies it.
    private Long enterpriseId;

    @NotNull
    private Long orgCertId;

    /** Read-only certification behind the group's organization allocation. */
    private Long certificationId;

    @NotBlank
    @Size(max = 150)
    private String groupName;

    @Size(max = 500)
    private String groupDescription;

    @NotNull
    @Min(1)
    private Integer totalSlots;

    // Read-only: how many of totalSlots are already reserved by this group's
    // own pending/accepted invitations.
    private Integer usedSlots;

    // Same as enterpriseId: always overwritten server-side, must stay nullable.
    private Long createdBy;

    private LocalDateTime createdAt;

    private EnterpriseGroup.Status status = EnterpriseGroup.Status.active;
}
