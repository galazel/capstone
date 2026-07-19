package com.capstone.rebyu.partnership.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

/** DTOs for Transaction Three: enterprise learner invitations. */
public final class EnterpriseInvitationDtos {

    private EnterpriseInvitationDtos() {
    }

    /** Organization certification access + live slot counts. */
    public record CertificationAccessDto(
            Long orgCertId,
            Long certificationId,
            String certificationTitle,
            String status,
            Integer totalSlots,
            Integer usedSlots,
            Integer remainingSlots
    ) {
    }

    // enterpriseId/invitedByUserId are always overwritten server-side from the
    // caller's JWT (see EnterpriseInvitationController.send) before this reaches
    // the service, so they must stay nullable here -- the client never supplies
    // them. Invitations are sent by a group's leader, not the enterprise at
    // large, so the group (and the certification/slots it belongs to) is
    // derived from enterpriseGroupId rather than an org-cert-wide picker.
    public record SendInvitationsRequest(
            Long enterpriseId,
            Long invitedByUserId,
            @NotNull Long enterpriseGroupId,
            @NotEmpty List<String> emails
    ) {
    }

    public record InvitationDto(
            Long invitationId,
            Long orgCertId,
            Long certificationId,
            String certificationTitle,
            Long enterpriseGroupId,
            String groupName,
            String email,
            String status,
            LocalDateTime sentAt,
            LocalDateTime expiresAt
    ) {
    }

    public record SendInvitationsResponse(
            Integer created,
            List<String> skipped,
            List<InvitationDto> invitations
    ) {
    }
}
