package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.repository.EnterpriseRepository;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.PartnershipItemDto;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.PartnershipItemRequestDto;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.PartnershipRequestTransactionDto;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.SubmitPartnershipRequestDto;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.entity.PartnershipRequestItem;
import com.capstone.rebyu.partnership.repository.PartnershipRequestItemRepository;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Transaction Three: enterprise partnership request submission.
 *
 * The request and all of its certification line items are created in one
 * atomic transaction, so a failure never leaves an orphan request. An
 * idempotency key prevents a double-submit from creating two requests.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PartnershipRequestTransactionService {

    private final PartnershipRequestRepository requestRepository;
    private final PartnershipRequestItemRepository itemRepository;
    private final EnterpriseRepository enterpriseRepository;
    private final CertificationRepository certificationRepository;

    @Transactional
    public PartnershipRequestTransactionDto submit(SubmitPartnershipRequestDto request) {
        String idempotencyKey = request.idempotencyKey();
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<PartnershipRequest> existing =
                    requestRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return toDto(existing.get());
            }
        }

        if (request.items() == null || request.items().isEmpty()) {
            throw new BusinessRuleException.InvalidPartnershipRequestException(
                    "Add at least one certification to your partnership request.");
        }

        Enterprise enterprise = enterpriseRepository.findById(request.enterpriseId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Enterprise not found: " + request.enterpriseId()));

        LocalDateTime now = LocalDateTime.now();
        PartnershipRequest partnershipRequest = PartnershipRequest.builder()
                .enterprise(enterprise)
                .submittedAt(now)
                .status(PartnershipRequest.Status.PENDING)
                .idempotencyKey(idempotencyKey != null && !idempotencyKey.isBlank()
                        ? idempotencyKey
                        : java.util.UUID.randomUUID().toString())
                .build();
        partnershipRequest = requestRepository.save(partnershipRequest);

        for (PartnershipItemRequestDto item : request.items()) {
            if (item.requestedAccessEndDate().isBefore(item.requestedAccessStartDate())) {
                throw new BusinessRuleException.InvalidPartnershipRequestException(
                        "An access end date cannot be before its start date.");
            }
            Certification certification = certificationRepository.findById(item.certificationId())
                    .orElseThrow(() -> new EntityNotFoundException(
                            "Certification not found: " + item.certificationId()));
            // Only published certifications can be inquired about -- drafts are
            // still being built (see the CertificationService publish gate).
            if (certification.getStatus() != Certification.CertificationStatus.PUBLISHED) {
                throw new BusinessRuleException.InvalidPartnershipRequestException(
                        "A selected certification is not yet available for partnership.");
            }

            PartnershipRequestItem entity = PartnershipRequestItem.builder()
                    .partnershipRequest(partnershipRequest)
                    .certification(certification)
                    .slots(item.slots())
                    .requestedAccessStartDate(item.requestedAccessStartDate())
                    .requestedAccessEndDate(item.requestedAccessEndDate())
                    .build();
            itemRepository.save(entity);
        }

        log.info("Partnership request {} submitted by enterprise {} with {} item(s)",
                partnershipRequest.getRequestId(), enterprise.getEnterpriseId(),
                request.items().size());
        return toDto(partnershipRequest);
    }

    @Transactional(readOnly = true)
    public List<PartnershipRequestTransactionDto> listForEnterprise(Long enterpriseId) {
        return requestRepository
                .findByEnterprise_EnterpriseIdOrderBySubmittedAtDesc(enterpriseId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private PartnershipRequestTransactionDto toDto(PartnershipRequest request) {
        List<PartnershipRequestItem> items =
                itemRepository.findByPartnershipRequest_RequestId(request.getRequestId());
        List<PartnershipItemDto> itemDtos = new ArrayList<>();
        int totalSlots = 0;
        for (PartnershipRequestItem item : items) {
            totalSlots += item.getSlots() == null ? 0 : item.getSlots();
            itemDtos.add(new PartnershipItemDto(
                    item.getPartnershipRequestItemId(),
                    item.getCertification().getCertificationId(),
                    item.getCertification().getTitle(),
                    item.getSlots(),
                    item.getRequestedAccessStartDate(),
                    item.getRequestedAccessEndDate()
            ));
        }
        return new PartnershipRequestTransactionDto(
                request.getRequestId(),
                request.getEnterprise().getEnterpriseId(),
                request.getEnterprise().getEnterpriseName(),
                request.getStatus().name(),
                request.getSubmittedAt(),
                totalSlots,
                itemDtos
        );
    }
}
