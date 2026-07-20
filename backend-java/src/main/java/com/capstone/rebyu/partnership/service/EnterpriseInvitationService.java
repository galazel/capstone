package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAuthority;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupAuthorityRepository;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.notification.entity.LearnerInvitation;
import com.capstone.rebyu.notification.repository.LearnerInvitationRepository;
import com.capstone.rebyu.notification.service.EmailService;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.CertificationAccessDto;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.InvitationDto;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.InvitedLearner;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.SendInvitationsRequest;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.SendInvitationsResponse;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Transaction Three: a group leader invites learners into their own assigned
 * group, against the group's certification allocation slots.
 *
 * The enterprise account itself does not send invitations -- only the leader
 * (an active EnterpriseGroupAuthority) of the target group may. The owner
 * retains read-only visibility via {@link #listInvitations} and
 * {@link #certificationAccess}.
 *
 * Slot reservation is protected against oversubscription by the optimistic
 * lock (@Version) on OrganizationCertificate: two concurrent invitation
 * batches that both try to consume the last slots will conflict, and the
 * loser's transaction rolls back instead of driving remaining_slots negative.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnterpriseInvitationService {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final int INVITATION_VALID_DAYS = 14;

    private final OrganizationCertificateRepository organizationCertificateRepository;
    private final LearnerInvitationRepository invitationRepository;
    private final EmailService emailService;
    private final com.capstone.rebyu.notification.service.InvitationTokenService invitationTokenService;
    private final EnterpriseGroupRepository enterpriseGroupRepository;
    private final EnterpriseGroupAuthorityRepository enterpriseGroupAuthorityRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;


    @Transactional(readOnly = true)
    public List<CertificationAccessDto> certificationAccess(Long enterpriseId) {
        return organizationCertificateRepository.findByEnterprise_EnterpriseId(enterpriseId)
                .stream()
                .map(this::toAccessDto)
                .toList();
    }

    @Transactional
    public List<InvitationDto> listInvitations(Long enterpriseId) {
        List<LearnerInvitation> invitations = invitationRepository
                .findByOrgCert_Enterprise_EnterpriseIdOrderBySentAtDesc(enterpriseId);

        // Lazy expiration: no scheduler in this codebase, so overdue PENDING
        // invitations are expired (and their reserved slot restored) whenever
        // they are read. Acceptance applies the same rule (see LearnerService).
        LocalDateTime now = LocalDateTime.now();
        for (LearnerInvitation invitation : invitations) {
            if (invitation.getStatus() == LearnerInvitation.Status.PENDING
                    && invitation.getExpiresAt() != null
                    && invitation.getExpiresAt().isBefore(now)) {
                invitation.setStatus(LearnerInvitation.Status.EXPIRED);
                invitationRepository.save(invitation);
                OrganizationCertificate orgCert = invitation.getOrgCert();
                orgCert.setUsedSlots(Math.max(0, orgCert.getUsedSlots() - 1));
                organizationCertificateRepository.save(orgCert);
                restoreGroupSlot(invitation.getEnterpriseGroup());
                log.info("Invitation {} expired; 1 slot restored on orgCert {}",
                        invitation.getInvitationId(), orgCert.getOrgCertId());
            }
        }

        return invitations.stream().map(this::toInvitationDto).toList();
    }

    @Transactional
    public SendInvitationsResponse sendInvitations(SendInvitationsRequest request) throws Exception {
        EnterpriseGroup group = enterpriseGroupRepository.findById(request.enterpriseGroupId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Group not found: " + request.enterpriseGroupId()));

        // Ownership: the group must belong to the caller's organization.
        if (group.getEnterprise() == null
                || !group.getEnterprise().getEnterpriseId().equals(request.enterpriseId())) {
            throw new EntityNotFoundException("Group not found: " + request.enterpriseGroupId());
        }
        requireActiveLeader(group, request.invitedByUserId());

        OrganizationCertificate orgCert = group.getOrgCert();
        if (orgCert.getStatus() != OrganizationCertificate.Status.active) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "This certification access is not active.");
        }

        // De-duplicate and validate emails; skip ones already invited. The
        // first entry seen for an email wins (keeps its name), later dups skip.
        List<String> skipped = new ArrayList<>();
        LinkedHashMap<String, InvitedLearner> toInvite = new LinkedHashMap<>();
        for (InvitedLearner entry : request.learners()) {
            if (entry == null || entry.email() == null) continue;
            String email = entry.email().trim().toLowerCase(Locale.ROOT);
            if (email.isEmpty()) continue;
            if (!EMAIL.matcher(email).matches()) {
                skipped.add(entry.email() + " (invalid email)");
                continue;
            }
            if (toInvite.containsKey(email)) {
                continue;
            }
            if (invitationRepository.existsByOrgCert_OrgCertIdAndEmailIgnoreCaseAndStatus(
                    orgCert.getOrgCertId(), email, LearnerInvitation.Status.PENDING)) {
                skipped.add(email + " (already invited)");
                continue;
            }
            toInvite.put(email, new InvitedLearner(
                    trimToNull(entry.firstName()), trimToNull(entry.lastName()), email));
        }

        if (toInvite.isEmpty()) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "No new valid learner emails to invite.");
        }

        int remaining = orgCert.getTotalSlots() - orgCert.getUsedSlots();
        if (toInvite.size() > remaining) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "The number of invitations exceeds the available slots. "
                            + remaining + " slot(s) remaining.");
        }

        // The group's OWN cap -- a sub-limit within the certification's pool,
        // set by the owner when the group was created (or edited since).
        int remainingInGroup = group.getTotalSlots() - group.getUsedSlots();
        if (toInvite.size() > remainingInGroup) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "The number of invitations exceeds this group's own slot limit. "
                            + remainingInGroup + " slot(s) remaining in this group.");
        }

        LocalDateTime now = LocalDateTime.now();
        List<InvitationDto> created = new ArrayList<>();
        for (InvitedLearner entry : toInvite.values()) {
            String email = entry.email();

            // Raw token is emailed only; the DB stores SHA-256(rawToken).
            String rawToken = invitationTokenService.generateRawToken();
            String tokenHash = invitationTokenService.hashToken(rawToken);

            LearnerInvitation invitation = LearnerInvitation.builder()
                    .orgCert(orgCert)
                    .enterpriseGroup(group)
                    .invitedBy(User.builder().userId(request.invitedByUserId()).build())
                    .email(email)
                    .firstName(entry.firstName())
                    .lastName(entry.lastName())
                    .tokenHash(tokenHash)
                    .sentAt(now)
                    .expiresAt(now.plusDays(INVITATION_VALID_DAYS))
                    .status(LearnerInvitation.Status.PENDING)
                    .build();

            LearnerInvitation savedInvitation =
                    invitationRepository.save(invitation);

            created.add(toInvitationDto(savedInvitation));

            log.debug("Invitation created id={} tokenFingerprint={}",
                    savedInvitation.getInvitationId(),
                    invitationTokenService.fingerprint(rawToken));

            emailService.sendEnterpriseInvitation(
                    savedInvitation.getEmail(),
                    orgCert.getEnterprise().getEnterpriseName(),
                    orgCert.getCertification().getTitle(),
                    rawToken
            );

            // The invite itself is always email + token (accepting requires the
            // token, which only the email carries). If the invited address
            // already belongs to a REBYU account, also drop them an in-app
            // notification so they see it without having to check email first.
            userRepository.findByEmailIgnoreCase(email).ifPresent(existingUser ->
                    notificationService.notify(
                            existingUser,
                            "You've been invited",
                            orgCert.getEnterprise().getEnterpriseName() + " invited you to "
                                    + orgCert.getCertification().getTitle() + ". Check your email to accept.",
                            null));
        }

        // Reserve slots. The @Version lock makes this safe under concurrency;
        // remaining_slots is a DB-computed column, so only used_slots changes.
        orgCert.setUsedSlots(orgCert.getUsedSlots() + toInvite.size());
        organizationCertificateRepository.save(orgCert);
        group.setUsedSlots(group.getUsedSlots() + toInvite.size());
        enterpriseGroupRepository.save(group);

        log.info("Enterprise {} sent {} invitation(s) for orgCert {} ({} skipped)",
                request.enterpriseId(), created.size(), orgCert.getOrgCertId(), skipped.size());
        return new SendInvitationsResponse(created.size(), skipped, created);
    }

    @Transactional
    public InvitationDto cancelInvitation(Long invitationId, Long enterpriseId, Long callerUserId) {
        LearnerInvitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Invitation not found: " + invitationId));

        OrganizationCertificate orgCert = invitation.getOrgCert();
        if (!orgCert.getEnterprise().getEnterpriseId().equals(enterpriseId)) {
            throw new EntityNotFoundException("Invitation not found: " + invitationId);
        }
        EnterpriseGroup group = invitation.getEnterpriseGroup();
        if (group == null) {
            // Pre-group-scoping invitation; no leader to attribute cancellation to.
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "This invitation predates group scoping and cannot be cancelled here.");
        }
        requireActiveLeader(group, callerUserId);

        // Only a still-pending invitation frees a slot; accepted/expired/already
        // revoked invitations must not restore slots or go negative.
        if (invitation.getStatus() == LearnerInvitation.Status.PENDING) {
            invitation.setStatus(LearnerInvitation.Status.REVOKED);
            invitationRepository.save(invitation);
            orgCert.setUsedSlots(Math.max(0, orgCert.getUsedSlots() - 1));
            organizationCertificateRepository.save(orgCert);
            restoreGroupSlot(group);
            log.info("Invitation {} cancelled; 1 slot restored on orgCert {}",
                    invitationId, orgCert.getOrgCertId());
        } else {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "Only a pending invitation can be cancelled.");
        }
        return toInvitationDto(invitation);
    }

    /** Trims a string to null when blank, so empty name fields aren't stored as "". */
    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Restores exactly one reserved slot on the group; used_slots never goes negative. */
    private void restoreGroupSlot(EnterpriseGroup group) {
        if (group == null) {
            return;
        }
        group.setUsedSlots(Math.max(0, group.getUsedSlots() - 1));
        enterpriseGroupRepository.save(group);
    }

    /** Only an active authority (leader) of this group may send/cancel its invitations. */
    private void requireActiveLeader(EnterpriseGroup group, Long userId) {
        if (userId == null || !enterpriseGroupAuthorityRepository.existsByEnterpriseGroupAndUserAndStatus(
                group, User.builder().userId(userId).build(), EnterpriseGroupAuthority.Status.active)) {
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "Only this group's leader can manage its invitations.");
        }
    }

    private CertificationAccessDto toAccessDto(OrganizationCertificate orgCert) {
        int remaining = orgCert.getTotalSlots() - orgCert.getUsedSlots();
        return new CertificationAccessDto(
                orgCert.getOrgCertId(),
                orgCert.getCertification().getCertificationId(),
                orgCert.getCertification().getTitle(),
                orgCert.getStatus().name(),
                orgCert.getTotalSlots(),
                orgCert.getUsedSlots(),
                remaining
        );
    }

    private InvitationDto toInvitationDto(LearnerInvitation invitation) {
        OrganizationCertificate orgCert = invitation.getOrgCert();
        EnterpriseGroup group = invitation.getEnterpriseGroup();
        return new InvitationDto(
                invitation.getInvitationId(),
                orgCert.getOrgCertId(),
                orgCert.getCertification().getCertificationId(),
                orgCert.getCertification().getTitle(),
                group != null ? group.getEnterpriseGroupId() : null,
                group != null ? group.getGroupName() : null,
                invitation.getEmail(),
                invitation.getFirstName(),
                invitation.getLastName(),
                invitation.getStatus().name(),
                invitation.getSentAt(),
                invitation.getExpiresAt()
        );
    }
}
