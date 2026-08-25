package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.partnership.dto.PartnershipRequestDto;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.mapper.PartnershipRequestMapper;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PartnershipRequestServiceTest {

    private static final Long REQUEST_ID = 1L;
    private static final Long INSTITUTION_ID = 10L;

    private PartnershipRequestRepository partnershipRequestRepository;
    private PartnershipRequestMapper partnershipRequestMapper;

    private PartnershipRequestService service;

    @BeforeEach
    void setUp() {
        partnershipRequestRepository = mock(PartnershipRequestRepository.class);
        partnershipRequestMapper = mock(PartnershipRequestMapper.class);

        service = new PartnershipRequestService(partnershipRequestRepository, partnershipRequestMapper);

        when(partnershipRequestMapper.toDto(any(PartnershipRequest.class))).thenAnswer(inv -> {
            PartnershipRequest entity = inv.getArgument(0);
            PartnershipRequestDto dto = new PartnershipRequestDto();
            dto.setRequestId(entity.getRequestId());
            dto.setSubmittedAt(entity.getSubmittedAt());
            dto.setStatus(entity.getStatus());
            if (entity.getInstitution() != null) {
                dto.setInstitutionId(entity.getInstitution().getInstitutionId());
            }
            return dto;
        });
        when(partnershipRequestMapper.toEntity(any(PartnershipRequestDto.class))).thenAnswer(inv -> {
            PartnershipRequestDto dto = inv.getArgument(0);
            Institution institution = null;
            if (dto.getInstitutionId() != null) {
                institution = new Institution();
                institution.setInstitutionId(dto.getInstitutionId());
            }
            return PartnershipRequest.builder()
                    .requestId(dto.getRequestId())
                    .institution(institution)
                    .submittedAt(dto.getSubmittedAt())
                    .status(dto.getStatus())
                    .build();
        });
    }

    private PartnershipRequest existing(PartnershipRequest.Status status) {
        Institution institution = new Institution();
        institution.setInstitutionId(INSTITUTION_ID);
        return PartnershipRequest.builder()
                .requestId(REQUEST_ID)
                .institution(institution)
                .submittedAt(LocalDateTime.of(2026, 1, 1, 0, 0, 0))
                .status(status)
                .build();
    }

    private PartnershipRequestDto dto(PartnershipRequest.Status status) {
        PartnershipRequestDto dto = new PartnershipRequestDto();
        dto.setRequestId(REQUEST_ID);
        dto.setInstitutionId(INSTITUTION_ID);
        dto.setSubmittedAt(LocalDateTime.of(2026, 1, 1, 0, 0, 0));
        dto.setStatus(status);
        return dto;
    }

    // ---- 1: client-supplied status that differs from the persisted status is discarded ----
    @Test
    void update_dtoStatusDiffersFromExisting_preservesOriginalStatus() {
        when(partnershipRequestRepository.findById(REQUEST_ID))
                .thenReturn(Optional.of(existing(PartnershipRequest.Status.PENDING)));
        when(partnershipRequestRepository.save(any(PartnershipRequest.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        PartnershipRequestDto result = service.update(REQUEST_ID, dto(PartnershipRequest.Status.APPROVED));

        assertEquals(PartnershipRequest.Status.PENDING, result.getStatus());

        org.mockito.ArgumentCaptor<PartnershipRequest> captor =
                org.mockito.ArgumentCaptor.forClass(PartnershipRequest.class);
        org.mockito.Mockito.verify(partnershipRequestRepository).save(captor.capture());
        assertEquals(PartnershipRequest.Status.PENDING, captor.getValue().getStatus());
    }

    // ---- 2: normal case, dto status matches existing status ----
    @Test
    void update_dtoStatusMatchesExisting_savesSameStatus() {
        when(partnershipRequestRepository.findById(REQUEST_ID))
                .thenReturn(Optional.of(existing(PartnershipRequest.Status.UNDER_REVIEW)));
        when(partnershipRequestRepository.save(any(PartnershipRequest.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        PartnershipRequestDto result = service.update(REQUEST_ID, dto(PartnershipRequest.Status.UNDER_REVIEW));

        assertEquals(PartnershipRequest.Status.UNDER_REVIEW, result.getStatus());
    }

    // ---- 3: updating a non-existent id throws EntityNotFoundException ----
    @Test
    void update_nonExistentId_throwsEntityNotFoundException() {
        when(partnershipRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class,
                () -> service.update(REQUEST_ID, dto(PartnershipRequest.Status.APPROVED)));
    }
}
