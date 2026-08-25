package com.capstone.rebyu.partnership.dto;

import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PartnershipRequestDto {
    private Long requestId;

    @NotNull
    private Long institutionId;

    @NotNull
    private LocalDateTime submittedAt;

    @NotNull
    private PartnershipRequest.Status status = PartnershipRequest.Status.PENDING;
}
