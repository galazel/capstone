package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.auth.service.CognitoAdminService;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.entity.EnterpriseMember;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.repository.EnterpriseMemberRepository;
import com.capstone.rebyu.organization.repository.EnterpriseRepository;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
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
 * Approval is atomic: it creates the Organization (Enterprise) record if it
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
    private static final String ENTERPRISE_USER_TYPE = "ENTERPRISE";

    private final PartnershipRequestRepository requestRepository;
    private final PartnershipRequestItemRepository itemRepository;
    private final EnterpriseRepository enterpriseRepository;
    private final OrganizationCertificateRepository organizationCertificateRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final UserRepository userRepository;
    private final UserTypeRepository userTypeRepository;
    private final CognitoAdminService cognitoAdminService;

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

        Enterprise enterprise = resolveOrCreateEnterprise(request);
        LocalDate today = LocalDate.now();

        for (PartnershipRequestItem item : itemRepository
                .findByPartnershipRequest_RequestId(requestId)) {
            int requestedSlots = item.getSlots() == null ? 0 : item.getSlots();
            OrganizationCertificate existing = organizationCertificateRepository
                    .findByEnterprise_EnterpriseIdAndCertification_CertificationId(
                            enterprise.getEnterpriseId(),
                            item.getCertification().getCertificationId())
                    .orElse(null);

            if (existing == null) {
                OrganizationCertificate access = OrganizationCertificate.builder()
                        .enterprise(enterprise)
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

        request.setEnterprise(enterprise);
        request.setStatus(PartnershipRequest.Status.APPROVED);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(reviewedBy);
        request.setAdminRemarks(remarks);
        requestRepository.save(request);

        // Provision the enterprise login account and email their credentials.
        CognitoAdminService.ProvisionResult provision = provisionEnterpriseAccount(enterprise, request);

        log.info("Partnership request {} APPROVED (enterprise {}); account emailed={}",
                request.getReferenceNumber(), enterprise.getEnterpriseId(), provision.emailed());
        return toDetail(request, provision.emailed(), provision.note());
    }

    /**
     * Creates the enterprise's login account (Cognito emails the credentials)
     * and links a primary-contact EnterpriseMember. Best-effort: if the
     * account was already provisioned, or Cognito is unavailable, approval
     * still stands and a note explains what happened.
     */
    private CognitoAdminService.ProvisionResult provisionEnterpriseAccount(
            Enterprise enterprise, PartnershipRequest request) {
        boolean alreadyLinked = !enterpriseMemberRepository
                .findByEnterprise_EnterpriseId(enterprise.getEnterpriseId()).isEmpty();
        if (alreadyLinked) {
            return new CognitoAdminService.ProvisionResult(false, null,
                    "This organization already has an enterprise account.");
        }

        String[] name = splitName(request.getContactPersonName());
        CognitoAdminService.ProvisionResult result = cognitoAdminService
                .createEnterpriseAccount(request.getOrganizationEmail(), name[0], name[1]);

        // Link a local ENTERPRISE user only when a Cognito identity exists, so
        // sign-in and role resolution work. If the sub is unknown (existing
        // account), CognitoAuthService links it on first sign-in by email.
        if (result.cognitoSub() != null || result.emailed()) {
            UserType enterpriseType = userTypeRepository.findByUserTypeText(ENTERPRISE_USER_TYPE)
                    .orElseGet(() -> {
                        UserType type = new UserType();
                        type.setUserTypeText(ENTERPRISE_USER_TYPE);
                        return userTypeRepository.save(type);
                    });

            User user = userRepository.findByEmailIgnoreCase(request.getOrganizationEmail())
                    .orElseGet(() -> User.builder()
                            .userType(enterpriseType)
                            .email(request.getOrganizationEmail())
                            .passwordHash("COGNITO")
                            .accountStatus(User.AccountStatus.active)
                            .joinedAt(LocalDateTime.now())
                            .cognitoSub(result.cognitoSub())
                            .build());
            user.setUserType(enterpriseType);
            if (user.getCognitoSub() == null && result.cognitoSub() != null) {
                user.setCognitoSub(result.cognitoSub());
            }
            user = userRepository.save(user);

            EnterpriseMember member = EnterpriseMember.builder()
                    .enterprise(enterprise)
                    .user(user)
                    .memberRole(EnterpriseMember.MemberRole.owner)
                    .isPrimaryContact(true)
                    .joinedAt(LocalDateTime.now())
                    .build();
            enterpriseMemberRepository.save(member);
        } else {
            // Cognito reported the account already exists (UsernameExistsException
            // was caught upstream: no new sub was minted and nothing was emailed).
            // The enterprise and its certificate slots were still created above --
            // without linking an owner here, the enterprise would be permanently
            // orphaned with nobody able to manage it. Link the existing local User
            // for that email if one exists; CognitoAuthService will already
            // resolve sign-in for that account by its Cognito sub/email.
            User existingUser = userRepository.findByEmailIgnoreCase(request.getOrganizationEmail())
                    .orElse(null);
            if (existingUser != null) {
                EnterpriseMember member = EnterpriseMember.builder()
                        .enterprise(enterprise)
                        .user(existingUser)
                        .memberRole(EnterpriseMember.MemberRole.owner)
                        .isPrimaryContact(true)
                        .joinedAt(LocalDateTime.now())
                        .build();
                enterpriseMemberRepository.save(member);
            } else {
                log.warn("Cognito account already exists for {} but no local User is linked to it; "
                                + "enterprise {} was created with no owner and requires manual linking.",
                        request.getOrganizationEmail(), enterprise.getEnterpriseId());
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
        return toDetail(request);
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

    private Enterprise resolveOrCreateEnterprise(PartnershipRequest request) {
        if (request.getEnterprise() != null) {
            return request.getEnterprise();
        }
        Enterprise byEmail = enterpriseRepository
                .findByPrimaryContactEmailIgnoreCase(request.getOrganizationEmail())
                .orElse(null);
        if (byEmail != null
                && byEmail.getEnterpriseName() != null
                && byEmail.getEnterpriseName().trim().equalsIgnoreCase(
                        request.getOrganizationName() == null ? "" : request.getOrganizationName().trim())) {
            return byEmail;
        }
        // Either no existing Enterprise shares this contact email, or one does
        // but its name doesn't match this request's organization name -- that
        // means a different organization simply reuses the same contact
        // email, so it must not be silently merged into the existing one.
        // Fall through to create a new Enterprise below.

        // Ensure the unique enterprise_name does not collide.
        String name = request.getOrganizationName();
        if (enterpriseRepository.findByEnterpriseNameIgnoreCase(name).isPresent()) {
            name = name + " (" + request.getReferenceNumber() + ")";
        }

        Enterprise enterprise = Enterprise.builder()
                .enterpriseName(name)
                // The public form does not collect these; use safe defaults an
                // admin can refine later on the organization page.
                .organizationType(Enterprise.OrganizationType.other)
                .industry("General")
                .primaryContactName(request.getContactPersonName())
                .primaryContactEmail(request.getOrganizationEmail())
                .primaryContactPhone(request.getContactNumber())
                .address(request.getOrganizationAddress())
                .isVerified(true)
                .joinedAt(LocalDateTime.now())
                .build();
        return enterpriseRepository.save(enterprise);
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
                request.getEnterprise() != null ? request.getEnterprise().getEnterpriseId() : null,
                items,
                accountEmailed,
                accountNote
        );
    }
}
