package com.capstone.rebyu.enterprisegroup.dto;

import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAuthority;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnterpriseGroupAuthorityDto {
    private Long enterpriseGroupAuthorityId;

    @NotNull
    private Long enterpriseGroupId;

    @NotNull
    private Long userId;

    // Always overwritten server-side from the caller's JWT (see
    // EnterpriseGroupAuthorityController.create), so must stay nullable --
    // the client never supplies it.
    private Long assignedBy;

    private LocalDateTime assignedAt;

    private EnterpriseGroupAuthority.Status status = EnterpriseGroupAuthority.Status.active;

    private LocalDateTime removedAt;
}
