package com.capstone.rebyu.partnership.dto;

import java.time.LocalDateTime;
import java.util.List;

/** DTOs for Transaction Two: admin review (approve / reject) of requests. */
public final class AdminPartnershipDtos {

    private AdminPartnershipDtos() {
    }

    public record PartnershipItemDetailDto(
            Long partnershipRequestItemId,
            Long certificationId,
            String certificationTitle,
            Integer requestedSlots
    ) {
    }

    /** Row shown in the admin list. */
    public record PartnershipRequestSummaryDto(
            Long requestId,
            String referenceNumber,
            String organizationName,
            String organizationEmail,
            String status,
            LocalDateTime submittedAt,
            Integer certificationCount,
            Integer totalRequestedSlots
    ) {
    }

    /** Full detail shown in the admin review dialog. */
    public record PartnershipRequestDetailDto(
            Long requestId,
            String referenceNumber,
            String organizationName,
            String organizationEmail,
            String contactPersonName,
            String contactNumber,
            String organizationAddress,
            String businessDescription,
            String status,
            LocalDateTime submittedAt,
            LocalDateTime reviewedAt,
            String reviewedBy,
            String adminRemarks,
            Long institutionId,
            List<PartnershipItemDetailDto> items,
            // Populated on the approve response so the admin sees whether the
            // institution's login credentials were emailed. Null on list/detail.
            Boolean institutionAccountEmailed,
            String institutionAccountNote
    ) {
    }

    /** Optional remarks supplied by the admin on approve or reject. */
    public record ReviewPartnershipRequest(
            String remarks
    ) {
    }
}
