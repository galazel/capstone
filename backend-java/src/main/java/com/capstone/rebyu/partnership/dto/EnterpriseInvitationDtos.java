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

    // enterpriseId is always overwritten server-side from the caller's JWT
    // (see EnterpriseInvitationController.send) before this reaches the
    // service, so it must stay nullable here -- the client never supplies it.
    public record SendInvitationsRequest(
            Long enterpriseId,
            @NotNull Long orgCertId,
            @NotEmpty List<String> emails
    ) {
    }

    public record InvitationDto(
            Long invitationId,
            Long orgCertId,
            Long certificationId,
            String certificationTitle,
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
