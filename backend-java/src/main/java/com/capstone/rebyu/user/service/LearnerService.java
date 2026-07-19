package com.capstone.rebyu.user.service;

import com.capstone.rebyu.common.InvitationAcceptanceException;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupAssigneeRepository;
import com.capstone.rebyu.notification.entity.LearnerInvitation;
import com.capstone.rebyu.notification.repository.LearnerInvitationRepository;
import com.capstone.rebyu.notification.service.InvitationTokenService;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.user.dto.AcceptInvitationResponse;
import com.capstone.rebyu.user.dto.LearnerDto;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.mapper.LearnerMapper;
import com.capstone.rebyu.user.repository.LearnerRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class LearnerService {

    private final LearnerRepository learnerRepository;
    private final LearnerMapper learnerMapper;
    private final LearnerInvitationRepository learnerInvitationRepository;
    private final OrganizationCertificationLearnerRepository
            organizationCertificationLearnerRepository;
    private final OrganizationCertificateRepository organizationCertificateRepository;
    private final InvitationTokenService invitationTokenService;
    private final EnterpriseGroupAssigneeRepository enterpriseGroupAssigneeRepository;

    public List<LearnerDto> getAll() {
        return learnerRepository.findAll()
                .stream()
                .map(learnerMapper::toDto)
                .toList();
    }

    public LearnerDto getById(Long id) {
        return learnerMapper.toDto(findEntity(id));
    }

    public LearnerDto create(LearnerDto dto) {
        Learner entity = learnerMapper.toEntity(dto);

        entity.setLearnerId(null);

        return learnerMapper.toDto(
                learnerRepository.save(entity)
        );
    }

    public LearnerDto update(Long id, LearnerDto dto) {
        findEntity(id);

        Learner entity = learnerMapper.toEntity(dto);

        entity.setLearnerId(id);

        return learnerMapper.toDto(
                learnerRepository.save(entity)
        );
    }

    /**
     * Accepts an enterprise invitation for the authenticated learner. The
     * caller (controller) resolves the learner from the validated JWT — a
     * learnerId is NEVER accepted from the client. Runs in one transaction.
     *
     * @param authLearnerId learnerId of the authenticated account
     * @param authEmail     verified email of the authenticated account
     * @param rawToken      raw token from the email link
     */
    public AcceptInvitationResponse acceptInvitation(
            Long authLearnerId, String authEmail, String rawToken) {

        // 1-3. Validate + hash the raw token (never compared or stored raw).
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.INVALID_TOKEN,
                    "Invitation token is required.");
        }
        String tokenHash = invitationTokenService.hashToken(rawToken.trim());
        log.debug("Accept invitation lookup for token fingerprint={}",
                invitationTokenService.fingerprint(rawToken));

        // 4-5. Find the invitation by hash.
        LearnerInvitation invitation = learnerInvitationRepository
                .findByTokenHash(tokenHash)
                .orElseThrow(() -> new InvitationAcceptanceException(
                        InvitationAcceptanceException.Code.INVALID_TOKEN,
                        "This invitation link is invalid."));

        log.debug("Invitation found id={} status={} email={} expiresAt={}",
                invitation.getInvitationId(), invitation.getStatus(),
                invitation.getEmail(), invitation.getExpiresAt());

        // 6. Distinct errors per non-pending status.
        switch (invitation.getStatus()) {
            case ACCEPTED -> throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.ALREADY_ACCEPTED,
                    "This invitation has already been accepted.");
            case REVOKED -> throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.INVITATION_REVOKED,
                    "This invitation was cancelled by the organization.");
            case EXPIRED -> throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.INVITATION_EXPIRED,
                    "This invitation has expired.");
            case PENDING -> { /* continue */ }
        }

        // 7-8. Expire a pending-but-overdue invitation and restore one slot.
        if (invitation.getExpiresAt() != null
                && invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            invitation.setStatus(LearnerInvitation.Status.EXPIRED);
            learnerInvitationRepository.save(invitation);
            restoreSlot(invitation.getOrgCert());
            throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.INVITATION_EXPIRED,
                    "This invitation has expired.");
        }

        // 9-10. Resolve + verify the authenticated learner.
        if (authLearnerId == null) {
            throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.EMAIL_MISMATCH,
                    "Sign in with a learner account to accept this invitation.");
        }
        Learner learner = learnerRepository.findById(authLearnerId)
                .orElseThrow(() -> new InvitationAcceptanceException(
                        InvitationAcceptanceException.Code.NOT_AUTHENTICATED,
                        "Your learner account could not be found."));

        // 11-12. Email must match the invitation, case-insensitively.
        if (authEmail == null
                || !authEmail.trim().equalsIgnoreCase(invitation.getEmail())) {
            throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.EMAIL_MISMATCH,
                    "This invitation was sent to a different email address.");
        }

        // 13. Certification access must exist.
        OrganizationCertificate orgCert = invitation.getOrgCert();
        if (orgCert == null) {
            throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.INVALID_TOKEN,
                    "This invitation is no longer valid.");
        }

        // 14-15. Reject duplicate enrollment.
        if (organizationCertificationLearnerRepository
                .existsByOrgCertAndLearner(orgCert, learner)) {
            throw new InvitationAcceptanceException(
                    InvitationAcceptanceException.Code.ALREADY_ENROLLED,
                    "You already have access to this certification.");
        }

        // 16-17. Create the enrollment.
        OrganizationCertificationLearner enrollment =
                OrganizationCertificationLearner.builder()
                        .orgCert(orgCert)
                        .learner(learner)
                        .assignedAt(LocalDateTime.now())
                        .progressPercentage(BigDecimal.ZERO)
                        .completedAt(null)
                        .status(OrganizationCertificationLearner.Status.active)
                        .build();
        enrollment = organizationCertificationLearnerRepository.save(enrollment);

        // The invitation was sent by a group leader for a specific group --
        // place the newly-enrolled learner directly into it, so no separate
        // "add to group" step is needed.
        EnterpriseGroup group = invitation.getEnterpriseGroup();
        if (group != null && invitation.getInvitedBy() != null) {
            EnterpriseGroupAssignee assignee = EnterpriseGroupAssignee.builder()
                    .enterpriseGroup(group)
                    .orgCertLearner(enrollment)
                    .assignedBy(invitation.getInvitedBy())
                    .assignedAt(LocalDateTime.now())
                    .status(EnterpriseGroupAssignee.Status.active)
                    .role(EnterpriseGroupAssignee.Role.member)
                    .build();
            enterpriseGroupAssigneeRepository.save(assignee);
            log.info("Learner {} placed into group {} via invitation {}",
                    learner.getLearnerId(), group.getEnterpriseGroupId(), invitation.getInvitationId());
        }

        // 18-19. Attach the learner and mark the invitation accepted.
        invitation.setLearner(learner);
        invitation.setAcceptedAt(LocalDateTime.now());
        invitation.setStatus(LearnerInvitation.Status.ACCEPTED);
        learnerInvitationRepository.save(invitation);

        // 20. usedSlots is unchanged — the slot was reserved when the
        //     invitation was sent.

        log.info("Learner {} accepted invitation {} for certification {}",
                learner.getLearnerId(), invitation.getInvitationId(),
                orgCert.getCertification().getCertificationId());

        // 21. Return the result shape.
        return new AcceptInvitationResponse(
                "Invitation accepted successfully.",
                orgCert.getCertification().getCertificationId(),
                orgCert.getCertification().getTitle(),
                enrollment.getOrgCertLearnerId());
    }

    /** Restores exactly one reserved slot; used_slots never goes negative. */
    private void restoreSlot(OrganizationCertificate orgCert) {
        if (orgCert == null) {
            return;
        }
        orgCert.setUsedSlots(Math.max(0, orgCert.getUsedSlots() - 1));
        organizationCertificateRepository.save(orgCert);
    }

    public void delete(Long id) {
        learnerRepository.delete(findEntity(id));
    }

    private Learner findEntity(Long id) {
        return learnerRepository.findById(id)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "Learner not found: " + id
                        )
                );
    }
}