package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.repository.EnterpriseRepository;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.PartnershipItemRequestDto;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.PartnershipRequestTransactionDto;
import com.capstone.rebyu.partnership.dto.PartnershipTransactionDtos.SubmitPartnershipRequestDto;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.entity.PartnershipRequestItem;
import com.capstone.rebyu.partnership.repository.PartnershipRequestItemRepository;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PartnershipRequestTransactionServiceTest {

    @Mock private PartnershipRequestRepository requestRepository;
    @Mock private PartnershipRequestItemRepository itemRepository;
    @Mock private EnterpriseRepository enterpriseRepository;
    @Mock private CertificationRepository certificationRepository;

    private PartnershipRequestTransactionService service;

    @BeforeEach
    void setUp() {
        service = new PartnershipRequestTransactionService(
                requestRepository, itemRepository, enterpriseRepository, certificationRepository);
    }

    private Enterprise enterprise() {
        Enterprise e = new Enterprise();
        e.setEnterpriseId(1L);
        e.setEnterpriseName("Cebu Institute of Technology");
        return e;
    }

    private Certification certification(long id) {
        Certification c = new Certification();
        c.setCertificationId(id);
        c.setTitle("Certification " + id);
        c.setStatus(Certification.CertificationStatus.PUBLISHED);
        return c;
    }

    private SubmitPartnershipRequestDto request(String key) {
        return new SubmitPartnershipRequestDto(1L, List.of(
                new PartnershipItemRequestDto(1L, 10,
                        LocalDate.now(), LocalDate.now().plusMonths(12))
        ), key);
    }

    @Test
    void submitsRequestAndItemsAtomically() {
        when(requestRepository.findByIdempotencyKey("k1")).thenReturn(Optional.empty());
        when(enterpriseRepository.findById(1L)).thenReturn(Optional.of(enterprise()));
        when(certificationRepository.findById(1L)).thenReturn(Optional.of(certification(1L)));
        when(requestRepository.save(any(PartnershipRequest.class))).thenAnswer(inv -> {
            PartnershipRequest r = inv.getArgument(0);
            r.setRequestId(100L);
            return r;
        });
        when(itemRepository.save(any(PartnershipRequestItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(itemRepository.findByPartnershipRequest_RequestId(100L)).thenReturn(List.of());

        PartnershipRequestTransactionDto dto = service.submit(request("k1"));

        assertEquals(100L, dto.requestId());
        assertEquals("PENDING", dto.status());
        verify(requestRepository).save(any(PartnershipRequest.class));
        verify(itemRepository, times(1)).save(any(PartnershipRequestItem.class));
    }

    @Test
    void idempotentSubmitReturnsExistingWithoutCreating() {
        PartnershipRequest existing = PartnershipRequest.builder()
                .requestId(55L)
                .enterprise(enterprise())
                .submittedAt(LocalDateTime.now())
                .status(PartnershipRequest.Status.PENDING)
                .idempotencyKey("dup")
                .build();
        when(requestRepository.findByIdempotencyKey("dup")).thenReturn(Optional.of(existing));
        when(itemRepository.findByPartnershipRequest_RequestId(55L)).thenReturn(List.of());

        PartnershipRequestTransactionDto dto = service.submit(request("dup"));

        assertEquals(55L, dto.requestId());
        verify(requestRepository, never()).save(any());
        verify(itemRepository, never()).save(any());
    }

    @Test
    void rejectsDraftCertification() {
        when(requestRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(enterpriseRepository.findById(1L)).thenReturn(Optional.of(enterprise()));
        when(requestRepository.save(any(PartnershipRequest.class))).thenAnswer(inv -> {
            PartnershipRequest r = inv.getArgument(0);
            r.setRequestId(102L);
            return r;
        });
        Certification draft = certification(1L);
        draft.setStatus(Certification.CertificationStatus.DRAFT);
        when(certificationRepository.findById(1L)).thenReturn(Optional.of(draft));

        assertThrows(BusinessRuleException.InvalidPartnershipRequestException.class,
                () -> service.submit(request("k3")));
        verify(itemRepository, never()).save(any(PartnershipRequestItem.class));
    }

    @Test
    void rejectsInvalidAccessDateRange() {
        when(requestRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(enterpriseRepository.findById(1L)).thenReturn(Optional.of(enterprise()));
        when(requestRepository.save(any(PartnershipRequest.class))).thenAnswer(inv -> {
            PartnershipRequest r = inv.getArgument(0);
            r.setRequestId(101L);
            return r;
        });

        SubmitPartnershipRequestDto bad = new SubmitPartnershipRequestDto(1L, List.of(
                new PartnershipItemRequestDto(1L, 5,
                        LocalDate.now().plusMonths(6), LocalDate.now())
        ), "k2");

        assertThrows(BusinessRuleException.InvalidPartnershipRequestException.class,
                () -> service.submit(bad));
    }
}
