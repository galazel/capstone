package com.capstone.rebyu.institutiongroup.dto;

import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstitutionGroupAuthorityDto {
    private Long institutionGroupAuthorityId;

    @NotNull
    private Long institutionGroupId;

    @NotNull
    private Long userId;

    // Always overwritten server-side from the caller's JWT (see
    // InstitutionGroupAuthorityController.create), so must stay nullable --
    // the client never supplies it.
    private Long assignedBy;

    private LocalDateTime assignedAt;

    private InstitutionGroupAuthority.Status status = InstitutionGroupAuthority.Status.active;

    private LocalDateTime removedAt;
}
