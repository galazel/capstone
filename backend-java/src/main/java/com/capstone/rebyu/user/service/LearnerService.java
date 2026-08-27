package com.capstone.rebyu.user.service;

import com.capstone.rebyu.common.InvitationAcceptanceException;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAssignee;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAssigneeRepository;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.notification.entity.LearnerInvitation;
import com.capstone.rebyu.notification.repository.LearnerInvitationRepository;
import com.capstone.rebyu.notification.service.InvitationTokenService;
import com.capstone.rebyu.notification.service.NotificationService;
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
import java.util.Map;
import java.util.stream.Collectors;

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
    private final LearnerCertificationRepository learnerCertificationRepository;
    private final InvitationTokenService invitationTokenService;
    private final InstitutionGroupAssigneeRepository institutionGroupAssigneeRepository;
    private final LearnerDeletionService learnerDeletionService;
    private final InstitutionGroupRepository institutionGroupRepository;
    private final NotificationService notificationService;

    public List<LearnerDto> getAll() {
        List<Learner> learners = learnerRepository.findAll();

        /*
         * Enrolments are read in two queries for the whole list, not one pair
         * per learner. The admin table shows every learner on the platform, so
         * a per-learner lookup here is the list length in round trips to a
         * remote database -- and it is the page an admin opens first.
         */
        Map<Long, List<OrganizationCertificationLearner>> orgEnrolmentsByLearner =
                organizationCertificationLearnerRepository.findAll().stream()
                        .filter(row -> row.getLearner() != null)
                        .collect(Collectors.groupingBy(
                                row -> row.getLearner().getLearnerId()));

        Map<Long, Long> individualEnrolmentsByLearner =
                learnerCertificationRepository.findAll().stream()
                        .filter(row -> row.getLearner() != null)
                        .collect(Collectors.groupingBy(
                                row -> row.getLearner().getLearnerId(),
                                Collectors.counting()));

        return learners.stream()
                .map(learner -> enrich(
                        learnerMapper.toDto(learner),
                        learner,
                        orgEnrolmentsByLearner.getOrDefault(
                                learner.getLearnerId(), List.of()),
                        individualEnrolmentsByLearner.getOrDefault(
                                learner.getLearnerId(), 0L)))
                .toList();
    }

    public LearnerDto getById(Long id) {
        Learner learner = findEntity(id);

        return enrich(
                learnerMapper.toDto(learner),
                learner,
                organizationCertificationLearnerRepository
                        .findByLearner_LearnerId(id),
                (long) learnerCertificationRepository
                        .findByLearner_LearnerId(id).size());
    }

    /**
     * Fills the descriptive half of a learner: who they are on the user record,
     * and what they are enrolled in.
     *
     * <p>Organisation membership comes from the enrolments rather than from a
     * field on the learner, because that is where it actually lives -- a
     * learner is "institutional" by having been assigned a seat on one of an
     * institution's certificates, and stops being so when the last one ends.
     * Reading it off a stored flag would let the two disagree.
     */
    private LearnerDto enrich(
            LearnerDto dto,
            Learner learner,
            List<OrganizationCertificationLearner> orgEnrolments,
            long individualEnrolments) {

        if (learner.getUser() != null) {
            dto.setEmail(learner.getUser().getEmail());
            dto.setJoinedAt(learner.getUser().getJoinedAt());
            dto.setStatus(learner.getUser().getAccountStatus() == null
                    ? null
                    : learner.getUser().getAccountStatus().name());
        }

        String organizationName = orgEnrolments.stream()
                .map(OrganizationCertificationLearner::getOrgCert)
                .filter(orgCert -> orgCert != null && orgCert.getInstitution() != null)
                .map(orgCert -> orgCert.getInstitution().getInstitutionName())
                .filter(name -> name != null && !name.isBlank())
                .findFirst()
                .orElse(null);

        dto.setOrganizationName(organizationName);
        dto.setLearnerType(organizationName == null ? "individual" : "institution");
        dto.setCertificationCount((int) (orgEnrolments.size() + individualEnrolments));

        /*
         * Progress is the mean of the seats an institution tracks. Individual
         * enrolments carry no stored percentage -- their progress is derived
         * from mastery elsewhere -- so a learner with none reports 0 rather
         * than a number this query cannot honestly produce.
         */
        dto.setProgressPercentage(orgEnrolments.stream()
                .map(OrganizationCertificationLearner::getProgressPercentage)
                .filter(java.util.Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average()
                .orElse(0.0));

        return dto;
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
     * Accepts an institution invitation for the authenticated learner. The
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
            restoreGroupSlot(invitation.getInstitutionGroup());
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
        InstitutionGroup group = invitation.getInstitutionGroup();
        if (group != null && invitation.getInvitedBy() != null) {
            InstitutionGroupAssignee assignee = InstitutionGroupAssignee.builder()
                    .institutionGroup(group)
                    .orgCertLearner(enrollment)
                    .assignedBy(invitation.getInvitedBy())
                    .assignedAt(LocalDateTime.now())
                    .status(InstitutionGroupAssignee.Status.active)
                    .role(InstitutionGroupAssignee.Role.member)
                    .build();
            institutionGroupAssigneeRepository.save(assignee);
            log.info("Learner {} placed into group {} via invitation {}",
                    learner.getLearnerId(), group.getInstitutionGroupId(), invitation.getInvitationId());

            notificationService.notify(
                    invitation.getInvitedBy(),
                    "Invitation accepted",
                    displayNameFor(learner, invitation)
                            + " accepted your invitation to " + group.getGroupName() + ".",
                    // Straight to the group's learners tab -- the leader opens
                    // this to look at who just joined.
                    "/institution/groups/" + group.getInstitutionGroupId() + "?tab=learners");
        }

        // Backfill the learner's profile name from the invitation when the
        // inviter provided one and the learner hasn't set their own yet.
        boolean learnerChanged = false;
        if (isBlank(learner.getFirstName()) && !isBlank(invitation.getFirstName())) {
            learner.setFirstName(invitation.getFirstName().trim());
            learnerChanged = true;
        }
        if (isBlank(learner.getLastName()) && !isBlank(invitation.getLastName())) {
            learner.setLastName(invitation.getLastName().trim());
            learnerChanged = true;
        }
        if (learnerChanged) {
            learnerRepository.save(learner);
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

    /** Restores exactly one reserved slot on the group; used_slots never goes negative. */
    private void restoreGroupSlot(InstitutionGroup group) {
        if (group == null) {
            return;
        }
        group.setUsedSlots(Math.max(0, group.getUsedSlots() - 1));
        institutionGroupRepository.save(group);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    /**
     * How to refer to a learner in a notification: their name, never their
     * e-mail address. The learner's own profile name wins, but this runs before
     * the name backfill further down, so a first-time acceptance falls back to
     * the name the inviter typed. Username is the last resort -- the e-mail is
     * deliberately not used at all.
     */
    private String displayNameFor(Learner learner, LearnerInvitation invitation) {
        String profileName = joinName(learner.getFirstName(), learner.getLastName());
        if (!isBlank(profileName)) {
            return profileName;
        }
        String invitedName = joinName(invitation.getFirstName(), invitation.getLastName());
        if (!isBlank(invitedName)) {
            return invitedName;
        }
        return isBlank(learner.getUsername()) ? "A learner" : learner.getUsername().trim();
    }

    private String joinName(String firstName, String lastName) {
        return ((isBlank(firstName) ? "" : firstName.trim())
                + " "
                + (isBlank(lastName) ? "" : lastName.trim())).trim();
    }

    /** Restores exactly one reserved slot; used_slots never goes negative. */
    private void restoreSlot(OrganizationCertificate orgCert) {
        if (orgCert == null) {
            return;
        }
        orgCert.setUsedSlots(Math.max(0, orgCert.getUsedSlots() - 1));
        organizationCertificateRepository.save(orgCert);
    }

    /**
     * Deleting a learner erases everything of theirs -- posts, attempts, files,
     * account and sign-in -- rather than just the row. See LearnerDeletionService.
     */
    public void delete(Long id) {
        findEntity(id); // 404 for an unknown id, before anything is removed
        learnerDeletionService.deleteLearner(id);
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