package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.partnership.dto.PublicPartnershipDtos.PublicPartnershipItemRequest;
import com.capstone.rebyu.partnership.dto.PublicPartnershipDtos.PublicPartnershipRequestResponse;
import com.capstone.rebyu.partnership.dto.PublicPartnershipDtos.SubmitPublicPartnershipRequest;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.entity.PartnershipRequestItem;
import com.capstone.rebyu.partnership.repository.PartnershipRequestItemRepository;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PublicPartnershipServiceTest {

    private static final Long CERT_ID = 5L;

    private PartnershipRequestRepository requestRepository;
    private PartnershipRequestItemRepository itemRepository;
    private CertificationRepository certificationRepository;
    private UserRepository userRepository;
    private NotificationService notificationService;

    private PublicPartnershipService service;

    @BeforeEach
    void setUp() {
        requestRepository = mock(PartnershipRequestRepository.class);
        itemRepository = mock(PartnershipRequestItemRepository.class);
        certificationRepository = mock(CertificationRepository.class);
        userRepository = mock(UserRepository.class);
        notificationService = mock(NotificationService.class);

        service = new PublicPartnershipService(
                requestRepository, itemRepository, certificationRepository, userRepository, notificationService);

        Certification certification = new Certification();
        certification.setCertificationId(CERT_ID);
        certification.setStatus(Certification.CertificationStatus.PUBLISHED);
        when(certificationRepository.findById(CERT_ID)).thenReturn(Optional.of(certification));

        when(requestRepository.findByReferenceNumber(anyString())).thenReturn(Optional.empty());
        when(requestRepository.existsByOrganizationEmailIgnoreCaseAndStatus(anyString(), any()))
                .thenReturn(false);
        when(requestRepository.save(any(PartnershipRequest.class))).thenAnswer(inv -> {
            PartnershipRequest req = inv.getArgument(0);
            req.setRequestId(1L);
            return req;
        });
        when(itemRepository.save(any(PartnershipRequestItem.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private SubmitPublicPartnershipRequest request(String organizationName) {
        return new SubmitPublicPartnershipRequest(
                organizationName,
                "contact@example.com",
                "Jane Doe",
                "0917-000-0000",
                "123 Main St",
                "A tutoring organization.",
                List.of(new PublicPartnershipItemRequest(CERT_ID, 10))
        );
    }

    // ---- 1: same-day resubmission with identical email+org resolves to the existing request ----
    @Test
    void submit_duplicateWithinSameDay_returnsExistingRequestWithoutSaving() {
        PartnershipRequest existing = PartnershipRequest.builder()
                .requestId(99L)
                .referenceNumber("PR-EXISTING1")
                .organizationName("Acme Corp")
                .organizationEmail("contact@example.com")
                .status(PartnershipRequest.Status.PENDING)
                .build();

        when(requestRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.of(existing));
        when(itemRepository.findByPartnershipRequest_RequestId(99L)).thenReturn(List.of(
                PartnershipRequestItem.builder().slots(10).build()
        ));

        PublicPartnershipRequestResponse response = service.submit(request("Acme Corp"));

        assertEquals("PR-EXISTING1", response.referenceNumber());
        verify(requestRepository, never()).save(any(PartnershipRequest.class));
    }

    // ---- 2: first-time submission inserts a new request ----
    @Test
    void submit_firstTimeSubmission_savesNewRequest() {
        when(requestRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        PublicPartnershipRequestResponse response = service.submit(request("Acme Corp"));

        verify(requestRepository, times(1)).save(any(PartnershipRequest.class));
        assertNotEquals(null, response.referenceNumber());
        assertEquals("Acme Corp", response.organizationName());
        assertEquals(PartnershipRequest.Status.PENDING.name(), response.status());
    }

    // ---- 3: different organizationName produces a different idempotency key, so both are fresh inserts ----
    @Test
    void submit_sameEmailDifferentOrganizationName_doesNotCollide() {
        when(requestRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        service.submit(request("Acme Corp"));
        service.submit(request("Beta Inc"));

        verify(requestRepository, times(2)).save(any(PartnershipRequest.class));
    }

    // ---- 4: an organization cannot inquire about a draft (unpublished) certification ----
    @Test
    void submit_draftCertification_isRejected() {
        when(requestRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        Certification draft = new Certification();
        draft.setCertificationId(CERT_ID);
        draft.setStatus(Certification.CertificationStatus.DRAFT);
        when(certificationRepository.findById(CERT_ID)).thenReturn(Optional.of(draft));

        org.junit.jupiter.api.Assertions.assertThrows(
                com.capstone.rebyu.common.BusinessRuleException.InvalidPartnershipRequestException.class,
                () -> service.submit(request("Acme Corp")));
        verify(itemRepository, never()).save(any(PartnershipRequestItem.class));
    }
}
