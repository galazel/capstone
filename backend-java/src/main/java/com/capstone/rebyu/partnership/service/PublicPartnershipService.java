package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.partnership.dto.PublicPartnershipDtos.PublicPartnershipItemRequest;
import com.capstone.rebyu.partnership.dto.PublicPartnershipDtos.PublicPartnershipRequestResponse;
import com.capstone.rebyu.partnership.dto.PublicPartnershipDtos.PublicPartnershipStatusResponse;
import com.capstone.rebyu.partnership.dto.PublicPartnershipDtos.SubmitPublicPartnershipRequest;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.entity.PartnershipRequestItem;
import com.capstone.rebyu.partnership.repository.PartnershipRequestItemRepository;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Transaction One (public): an organization representative — with no account —
 * submits a partnership request from the landing page. The request stores the
 * organization details and requested certification slots, is saved atomically
 * as PENDING, and grants NO institution account, role, or access. The Institution
 * record is created only when an admin approves (Transaction Two).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicPartnershipService {

    private static final String ADMIN_USER_TYPE = "ADMIN";

    private final PartnershipRequestRepository requestRepository;
    private final PartnershipRequestItemRepository itemRepository;
    private final CertificationRepository certificationRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public PublicPartnershipRequestResponse submit(SubmitPublicPartnershipRequest request) {
        if (request.items() == null || request.items().isEmpty()) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "Select at least one certification for your partnership request.");
        }

        String email = request.organizationEmail().trim().toLowerCase(Locale.ROOT);
        String organizationName = request.organizationName().trim();
        LocalDateTime now = LocalDateTime.now();

        // This is a public, unauthenticated endpoint: there is no client session to
        // persist a client-supplied key across retries the way
        // PartnershipRequestTransactionService.submit() does for authenticated
        // institution clients. Instead, derive a deterministic key from the
        // submission content itself (organization email + name + the current day
        // bucket), so a genuine double-click or network retry within the same day
        // collides with the first request, while the same organization submitting
        // again days later is treated as a new, legitimate request.
        String idempotencyKey = computeIdempotencyKey(email, organizationName, now);
        Optional<PartnershipRequest> existingByKey = requestRepository.findByIdempotencyKey(idempotencyKey);
        if (existingByKey.isPresent()) {
            // Idempotent retry: return the original request's response as if this
            // call had succeeded, rather than treating it as a conflict.
            return toResponse(existingByKey.get());
        }

        // Prevent stacking duplicate pending requests from the same organization.
        // Best-effort check-then-act guard only: two concurrent submissions with
        // DIFFERENT content (so they don't collide on the idempotency key above)
        // could both pass this check before either commits. Fully closing that race
        // would need a partial unique index on (organization_email) WHERE status =
        // 'PENDING', added in a future migration.
        if (requestRepository.existsByOrganizationEmailIgnoreCaseAndStatus(
                email, PartnershipRequest.Status.PENDING)) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "A partnership request from this organization is already pending review.");
        }

        PartnershipRequest partnershipRequest = PartnershipRequest.builder()
                .referenceNumber(generateReferenceNumber())
                .organizationName(organizationName)
                .organizationEmail(email)
                .contactPersonName(request.contactPersonName().trim())
                .contactNumber(request.contactNumber().trim())
                .organizationAddress(request.organizationAddress().trim())
                .businessDescription(request.businessDescription().trim())
                .submittedAt(now)
                .status(PartnershipRequest.Status.PENDING)
                .idempotencyKey(idempotencyKey)
                .build();
        partnershipRequest = requestRepository.save(partnershipRequest);

        int totalSlots = 0;
        for (PublicPartnershipItemRequest item : request.items()) {
            if (item.requestedSlots() == null || item.requestedSlots() < 1) {
                throw new BusinessRuleException.InvalidPartnershipRequestException(
                        "Each certification needs at least one requested learner slot.");
            }
            Certification certification = certificationRepository.findById(item.certificationId())
                    .orElseThrow(() -> new BusinessRuleException.InvalidPartnershipRequestException(
                            "A selected certification is no longer available."));
            // Only published certifications (fully built -- lessons, content, and
            // the required assessments -- see CertificationService publish gate)
            // can be inquired about; drafts aren't offered to organizations yet.
            if (certification.getStatus() != Certification.CertificationStatus.PUBLISHED) {
                throw new BusinessRuleException.InvalidPartnershipRequestException(
                        "A selected certification is not yet available for partnership.");
            }

            PartnershipRequestItem entity = PartnershipRequestItem.builder()
                    .partnershipRequest(partnershipRequest)
                    .certification(certification)
                    .slots(item.requestedSlots())
                    .build();
            itemRepository.save(entity);
            totalSlots += item.requestedSlots();
        }

        log.info("Public partnership request {} submitted by '{}' ({} certifications, {} slots)",
                partnershipRequest.getReferenceNumber(), partnershipRequest.getOrganizationName(),
                request.items().size(), totalSlots);

        notifyAdmins(partnershipRequest);

        return new PublicPartnershipRequestResponse(
                partnershipRequest.getReferenceNumber(),
                partnershipRequest.getOrganizationName(),
                partnershipRequest.getSubmittedAt(),
                partnershipRequest.getStatus().name(),
                request.items().size(),
                totalSlots
        );
    }

    @Transactional(readOnly = true)
    public PublicPartnershipStatusResponse lookupStatus(String referenceNumber, String organizationEmail) {
        PartnershipRequest request = requestRepository
                .findByReferenceNumberAndOrganizationEmailIgnoreCase(
                        referenceNumber.trim(), organizationEmail.trim())
                .orElseThrow(() -> new EntityNotFoundException(
                        "No partnership request matches that reference number and email."));

        // Only surface admin remarks once a decision has been made.
        boolean decided = request.getStatus() == PartnershipRequest.Status.APPROVED
                || request.getStatus() == PartnershipRequest.Status.REJECTED;

        return new PublicPartnershipStatusResponse(
                request.getReferenceNumber(),
                request.getOrganizationName(),
                request.getSubmittedAt(),
                request.getStatus().name(),
                decided ? request.getAdminRemarks() : null
        );
    }

    /** Every admin gets an in-app notification -- this is the only new-request signal admins have today. */
    private void notifyAdmins(PartnershipRequest request) {
        for (var admin : userRepository.findByUserType_UserTypeText(ADMIN_USER_TYPE)) {
            notificationService.notify(
                    admin,
                    "New partnership request",
                    request.getOrganizationName() + " submitted a partnership request ("
                            + request.getReferenceNumber() + ").",
                    "/admin/partnership-requests");
        }
    }

    private String generateReferenceNumber() {
        String candidate;
        do {
            candidate = "PR-" + UUID.randomUUID().toString()
                    .substring(0, 8).toUpperCase(Locale.ROOT);
        } while (requestRepository.findByReferenceNumber(candidate).isPresent());
        return candidate;
    }

    /**
     * Deterministic idempotency key for a public submission: a SHA-256 hex digest
     * of the normalized organization email, organization name, and a coarse
     * day-level time bucket. Same-day resubmissions of the same organization
     * details collide (recognized as a repeat); resubmissions on a later day do
     * not (treated as a new request).
     */
    private String computeIdempotencyKey(String normalizedEmail, String organizationName, LocalDateTime submittedAt) {
        String dayBucket = submittedAt.toLocalDate().toString();
        String normalized = normalizedEmail + "|" + organizationName + "|" + dayBucket;
        return sha256Hex(normalized);
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm is not available", e);
        }
    }

    /** Maps an existing request to the same response shape as a successful submission. */
    private PublicPartnershipRequestResponse toResponse(PartnershipRequest partnershipRequest) {
        List<PartnershipRequestItem> items =
                itemRepository.findByPartnershipRequest_RequestId(partnershipRequest.getRequestId());
        int totalSlots = 0;
        for (PartnershipRequestItem item : items) {
            totalSlots += item.getSlots() == null ? 0 : item.getSlots();
        }
        return new PublicPartnershipRequestResponse(
                partnershipRequest.getReferenceNumber(),
                partnershipRequest.getOrganizationName(),
                partnershipRequest.getSubmittedAt(),
                partnershipRequest.getStatus().name(),
                items.size(),
                totalSlots
        );
    }
}
