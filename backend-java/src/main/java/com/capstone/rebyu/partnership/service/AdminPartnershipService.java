package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.auth.service.CognitoAdminService;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.organization.entity.InstitutionMember;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.repository.InstitutionMemberRepository;
import com.capstone.rebyu.organization.repository.InstitutionRepository;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.entity.UserType;
import com.capstone.rebyu.user.repository.UserRepository;
import com.capstone.rebyu.user.repository.UserTypeRepository;
import com.capstone.rebyu.partnership.dto.AdminPartnershipDtos.PartnershipItemDetailDto;
import com.capstone.rebyu.partnership.dto.AdminPartnershipDtos.PartnershipRequestDetailDto;
import com.capstone.rebyu.partnership.dto.AdminPartnershipDtos.PartnershipRequestSummaryDto;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.entity.PartnershipRequestItem;
import com.capstone.rebyu.partnership.repository.PartnershipRequestItemRepository;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Transaction Two: an admin approves or rejects a partnership request.
 *
 * Approval is atomic: it creates the Organization (Institution) record if it
 * does not exist yet, then creates or tops up an OrganizationCertificate slot
 * allocation for every requested certification. Existing allocations are
 * increased, never overwritten. Rejection records the decision only and grants
 * no access.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminPartnershipService {

    private static final int DEFAULT_ACCESS_MONTHS = 12;
    private static final String INSTITUTION_USER_TYPE = "INSTITUTION";

    private final PartnershipRequestRepository requestRepository;
    private final PartnershipRequestItemRepository itemRepository;
    private final InstitutionRepository institutionRepository;
    private final OrganizationCertificateRepository organizationCertificateRepository;
    private final InstitutionMemberRepository institutionMemberRepository;
    private final UserRepository userRepository;
    private final UserTypeRepository userTypeRepository;
    private final CognitoAdminService cognitoAdminService;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<PartnershipRequestSummaryDto> list(String statusFilter) {
        List<PartnershipRequest> requests = requestRepository.findAllByOrderBySubmittedAtDesc();
        return requests.stream()
                .filter(request -> statusFilter == null || statusFilter.isBlank()
                        || request.getStatus().name().equalsIgnoreCase(statusFilter))
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public PartnershipRequestDetailDto getDetail(Long requestId) {
        return toDetail(loadRequest(requestId));
    }

    @Transactional
    public PartnershipRequestDetailDto approve(Long requestId, String remarks, String reviewedBy) {
        PartnershipRequest request = loadRequest(requestId);
        requireReviewable(request);

        Institution institution = resolveOrCreateInstitution(request);
        LocalDate today = LocalDate.now();

        for (PartnershipRequestItem item : itemRepository
                .findByPartnershipRequest_RequestId(requestId)) {
            int requestedSlots = item.getSlots() == null ? 0 : item.getSlots();
            OrganizationCertificate existing = organizationCertificateRepository
                    .findByInstitution_InstitutionIdAndCertification_CertificationId(
                            institution.getInstitutionId(),
                            item.getCertification().getCertificationId())
                    .orElse(null);

            if (existing == null) {
                OrganizationCertificate access = OrganizationCertificate.builder()
                        .institution(institution)
                        .certification(item.getCertification())
                        .totalSlots(requestedSlots)
                        .usedSlots(0)
                        .accessStartDate(today)
                        .accessExpiryDate(today.plusMonths(DEFAULT_ACCESS_MONTHS))
                        .status(OrganizationCertificate.Status.active)
                        .build();
                organizationCertificateRepository.save(access);
            } else {
                // Top up the existing allocation; never overwrite. remaining_slots
                // is a DB-computed column, so only total_slots changes here.
                existing.setTotalSlots(existing.getTotalSlots() + requestedSlots);
                existing.setStatus(OrganizationCertificate.Status.active);
                organizationCertificateRepository.save(existing);
            }
        }

        request.setInstitution(institution);
        request.setStatus(PartnershipRequest.Status.APPROVED);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(reviewedBy);
        request.setAdminRemarks(remarks);
        requestRepository.save(request);

        // Provision the institution login account and email their credentials.
        CognitoAdminService.ProvisionResult provision = provisionInstitutionAccount(institution, request);

        log.info("Partnership request {} APPROVED (institution {}); account emailed={}",
                request.getReferenceNumber(), institution.getInstitutionId(), provision.emailed());

        notifyInstitutionOwners(institution,
                "Partnership request approved",
                "Your partnership request (" + request.getReferenceNumber() + ") was approved.",
                "/institution/dashboard");

        return toDetail(request, provision.emailed(), provision.note());
    }

    /**
     * Creates the institution's login account (Cognito emails the credentials)
     * and links a primary-contact InstitutionMember. Best-effort: if the
     * account was already provisioned, or Cognito is unavailable, approval
     * still stands and a note explains what happened.
     */
    private CognitoAdminService.ProvisionResult provisionInstitutionAccount(
            Institution institution, PartnershipRequest request) {
        boolean alreadyLinked = !institutionMemberRepository
                .findByInstitution_InstitutionId(institution.getInstitutionId()).isEmpty();
        if (alreadyLinked) {
            return new CognitoAdminService.ProvisionResult(false, null,
                    "This organization already has an institution account.");
        }

        String[] name = splitName(request.getContactPersonName());
        CognitoAdminService.ProvisionResult result = cognitoAdminService
                .createInstitutionAccount(request.getOrganizationEmail(), name[0], name[1]);

        // Link a local INSTITUTION user only when a Cognito identity exists, so
        // sign-in and role resolution work. If the sub is unknown (existing
        // account), CognitoAuthService links it on first sign-in by email.
        if (result.cognitoSub() != null || result.emailed()) {
            UserType institutionType = userTypeRepository.findByUserTypeText(INSTITUTION_USER_TYPE)
                    .orElseGet(() -> {
                        UserType type = new UserType();
                        type.setUserTypeText(INSTITUTION_USER_TYPE);
                        return userTypeRepository.save(type);
                    });

            User user = userRepository.findByEmailIgnoreCase(request.getOrganizationEmail())
                    .orElseGet(() -> User.builder()
                            .userType(institutionType)
                            .email(request.getOrganizationEmail())
                            .passwordHash("COGNITO")
                            .accountStatus(User.AccountStatus.active)
                            .joinedAt(LocalDateTime.now())
                            .cognitoSub(result.cognitoSub())
                            .build());
            user.setUserType(institutionType);
            if (user.getCognitoSub() == null && result.cognitoSub() != null) {
                user.setCognitoSub(result.cognitoSub());
            }
            user = userRepository.save(user);

            InstitutionMember member = InstitutionMember.builder()
                    .institution(institution)
                    .user(user)
                    .memberRole(InstitutionMember.MemberRole.owner)
                    .isPrimaryContact(true)
                    .joinedAt(LocalDateTime.now())
                    .build();
            institutionMemberRepository.save(member);
        } else {
            // Cognito reported the account already exists (UsernameExistsException
            // was caught upstream: no new sub was minted and nothing was emailed).
            // The institution and its certificate slots were still created above --
            // without linking an owner here, the institution would be permanently
            // orphaned with nobody able to manage it. Link the existing local User
            // for that email if one exists; CognitoAuthService will already
            // resolve sign-in for that account by its Cognito sub/email.
            User existingUser = userRepository.findByEmailIgnoreCase(request.getOrganizationEmail())
                    .orElse(null);
            if (existingUser != null) {
                InstitutionMember member = InstitutionMember.builder()
                        .institution(institution)
                        .user(existingUser)
                        .memberRole(InstitutionMember.MemberRole.owner)
                        .isPrimaryContact(true)
                        .joinedAt(LocalDateTime.now())
                        .build();
                institutionMemberRepository.save(member);
            } else {
                log.warn("Cognito account already exists for {} but no local User is linked to it; "
                                + "institution {} was created with no owner and requires manual linking.",
                        request.getOrganizationEmail(), institution.getInstitutionId());
            }
        }
        return result;
    }

    private String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return new String[]{"", ""};
        }
        String[] parts = fullName.trim().split("\\s+", 2);
        return new String[]{parts[0], parts.length > 1 ? parts[1] : ""};
    }

    @Transactional
    public PartnershipRequestDetailDto reject(Long requestId, String remarks, String reviewedBy) {
        PartnershipRequest request = loadRequest(requestId);
        requireReviewable(request);

        request.setStatus(PartnershipRequest.Status.REJECTED);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(reviewedBy);
        request.setAdminRemarks(remarks);
        requestRepository.save(request);

        log.info("Partnership request {} REJECTED", request.getReferenceNumber());

        // Only an already-signed-in institution (re-requesting more slots) has an
        // account to notify at this point -- a first-time public request has no
        // institution/account yet when rejected.
        if (request.getInstitution() != null) {
            notifyInstitutionOwners(request.getInstitution(),
                    "Partnership request rejected",
                    "Your partnership request (" + request.getReferenceNumber() + ") was not approved.",
                    "/institution/partnership");
        }

        return toDetail(request);
    }

    /** Notifies every owner/primary-contact User linked to this institution. */
    private void notifyInstitutionOwners(Institution institution, String title, String body, String href) {
        institutionMemberRepository.findByInstitution_InstitutionId(institution.getInstitutionId()).stream()
                .filter(member -> member.isPrimaryContact() || member.getMemberRole() == InstitutionMember.MemberRole.owner)
                .map(InstitutionMember::getUser)
                .distinct()
                .forEach(user -> notificationService.notify(user, title, body, href));
    }

    // ------------------------------------------------------------------------

    private PartnershipRequest loadRequest(Long requestId) {
        return requestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Partnership request not found: " + requestId));
    }

    private void requireReviewable(PartnershipRequest request) {
        if (request.getStatus() != PartnershipRequest.Status.PENDING
                && request.getStatus() != PartnershipRequest.Status.UNDER_REVIEW) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "This request has already been " + request.getStatus().name().toLowerCase(Locale.ROOT) + ".");
        }
    }

    private Institution resolveOrCreateInstitution(PartnershipRequest request) {
        if (request.getInstitution() != null) {
            return request.getInstitution();
        }
        // Reuse the existing Institution that shares this contact email, so an
        // approved partnership provisions the login account on the SAME
        // organization the admin already set up — never a duplicate. (Restored
        // 2026-07-19: a prior change ALSO required an exact organization-name
        // match here, which created duplicate institutions on approval and left
        // the original one with no account — the "I approved but can't get an
        // account for that institution" bug.)
        Institution byEmail = institutionRepository
                .findByPrimaryContactEmailIgnoreCase(request.getOrganizationEmail())
                .orElse(null);
        if (byEmail != null) {
            return byEmail;
        }

        // Ensure the unique institution_name does not collide.
        String name = request.getOrganizationName();
        if (institutionRepository.findByInstitutionNameIgnoreCase(name).isPresent()) {
            name = name + " (" + request.getReferenceNumber() + ")";
        }

        Institution institution = Institution.builder()
                .institutionName(name)
                // The public form does not collect these; use safe defaults an
                // admin can refine later on the organization page.
                .organizationType(Institution.OrganizationType.other)
                .industry("General")
                .primaryContactName(request.getContactPersonName())
                .primaryContactEmail(request.getOrganizationEmail())
                .primaryContactPhone(request.getContactNumber())
                .address(request.getOrganizationAddress())
                .isVerified(true)
                .joinedAt(LocalDateTime.now())
                .build();
        return institutionRepository.save(institution);
    }

    private PartnershipRequestSummaryDto toSummary(PartnershipRequest request) {
        List<PartnershipRequestItem> items =
                itemRepository.findByPartnershipRequest_RequestId(request.getRequestId());
        int totalSlots = items.stream()
                .mapToInt(item -> item.getSlots() == null ? 0 : item.getSlots())
                .sum();
        return new PartnershipRequestSummaryDto(
                request.getRequestId(),
                request.getReferenceNumber(),
                request.getOrganizationName(),
                request.getOrganizationEmail(),
                request.getStatus().name(),
                request.getSubmittedAt(),
                items.size(),
                totalSlots
        );
    }

    private PartnershipRequestDetailDto toDetail(PartnershipRequest request) {
        return toDetail(request, null, null);
    }

    private PartnershipRequestDetailDto toDetail(
            PartnershipRequest request, Boolean accountEmailed, String accountNote) {
        List<PartnershipItemDetailDto> items = itemRepository
                .findByPartnershipRequest_RequestId(request.getRequestId())
                .stream()
                .map(item -> new PartnershipItemDetailDto(
                        item.getPartnershipRequestItemId(),
                        item.getCertification().getCertificationId(),
                        item.getCertification().getTitle(),
                        item.getSlots()))
                .toList();
        return new PartnershipRequestDetailDto(
                request.getRequestId(),
                request.getReferenceNumber(),
                request.getOrganizationName(),
                request.getOrganizationEmail(),
                request.getContactPersonName(),
                request.getContactNumber(),
                request.getOrganizationAddress(),
                request.getBusinessDescription(),
                request.getStatus().name(),
                request.getSubmittedAt(),
                request.getReviewedAt(),
                request.getReviewedBy(),
                request.getAdminRemarks(),
                request.getInstitution() != null ? request.getInstitution().getInstitutionId() : null,
                items,
                accountEmailed,
                accountNote
        );
    }
}
