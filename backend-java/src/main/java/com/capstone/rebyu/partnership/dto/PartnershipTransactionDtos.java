package com.capstone.rebyu.partnership.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** DTOs for Transaction Three: enterprise partnership request submission. */
public final class PartnershipTransactionDtos {

    private PartnershipTransactionDtos() {
    }

    public record PartnershipItemRequestDto(
            @NotNull Long certificationId,
            @NotNull @Min(1) Integer slots,
            @NotNull LocalDate requestedAccessStartDate,
            @NotNull LocalDate requestedAccessEndDate
    ) {
    }

    // enterpriseId is always overwritten server-side from the caller's JWT
    // (see PartnershipTransactionController.submit) before this reaches the
    // service, so it must stay nullable here -- the client never supplies it.
    public record SubmitPartnershipRequestDto(
            Long enterpriseId,
            @NotEmpty List<PartnershipItemRequestDto> items,
            String idempotencyKey
    ) {
    }

    public record PartnershipItemDto(
            Long partnershipRequestItemId,
            Long certificationId,
            String certificationTitle,
            Integer slots,
            LocalDate requestedAccessStartDate,
            LocalDate requestedAccessEndDate
    ) {
    }

    public record PartnershipRequestTransactionDto(
            Long requestId,
            Long enterpriseId,
            String enterpriseName,
            String status,
            LocalDateTime submittedAt,
            Integer totalSlots,
            List<PartnershipItemDto> items
    ) {
    }
}
