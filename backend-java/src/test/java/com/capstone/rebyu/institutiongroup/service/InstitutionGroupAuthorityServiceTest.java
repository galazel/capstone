package com.capstone.rebyu.institutiongroup.service;

import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupAuthorityDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import com.capstone.rebyu.institutiongroup.mapper.InstitutionGroupAuthorityMapper;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAuthorityRepository;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.organization.repository.InstitutionMemberRepository;
import com.capstone.rebyu.user.repository.UserRepository;
import com.capstone.rebyu.user.repository.UserTypeRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InstitutionGroupAuthorityServiceTest {

    private static final Long CALLER_INSTITUTION_ID = 1L;
    private static final Long OTHER_INSTITUTION_ID = 2L;
    private static final Long GROUP_ID = 10L;
    private static final Long USER_ID = 20L;
    private static final Long AUTHORITY_ID = 40L;

    private InstitutionGroupAuthorityRepository authorityRepository;
    private InstitutionGroupRepository groupRepository;
    private InstitutionGroupAuthorityMapper mapper;

    private InstitutionGroupAuthorityService service;

    @BeforeEach
    void setUp() {
        authorityRepository = mock(InstitutionGroupAuthorityRepository.class);
        groupRepository = mock(InstitutionGroupRepository.class);
        mapper = mock(InstitutionGroupAuthorityMapper.class);

        service = new InstitutionGroupAuthorityService(authorityRepository, groupRepository, mapper,
                mock(UserRepository.class), mock(UserTypeRepository.class),
                mock(InstitutionMemberRepository.class));

        when(mapper.toDto(any(InstitutionGroupAuthority.class))).thenAnswer(inv -> {
            InstitutionGroupAuthority entity = inv.getArgument(0);
            InstitutionGroupAuthorityDto dto = new InstitutionGroupAuthorityDto();
            dto.setInstitutionGroupAuthorityId(entity.getInstitutionGroupAuthorityId());
            dto.setStatus(entity.getStatus());
            return dto;
        });
        when(mapper.toEntity(any(InstitutionGroupAuthorityDto.class))).thenAnswer(inv -> {
            InstitutionGroupAuthorityDto dto = inv.getArgument(0);
            return InstitutionGroupAuthority.builder()
                    .institutionGroupAuthorityId(dto.getInstitutionGroupAuthorityId())
                    .status(dto.getStatus())
                    .build();
        });
    }

    private InstitutionGroup group(Long institutionId) {
        Institution institution = new Institution();
        institution.setInstitutionId(institutionId);
        return InstitutionGroup.builder()
                .institutionGroupId(GROUP_ID)
                .institution(institution)
                .build();
    }

    private InstitutionGroupAuthorityDto dto() {
        InstitutionGroupAuthorityDto dto = new InstitutionGroupAuthorityDto();
        dto.setInstitutionGroupId(GROUP_ID);
        dto.setUserId(USER_ID);
        dto.setAssignedBy(99L);
        return dto;
    }

    // ---- 1: cross-tenant group access is rejected ----
    @Test
    void create_groupBelongsToDifferentInstitution_throwsNotFound() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(OTHER_INSTITUTION_ID)));

        assertThrows(EntityNotFoundException.class,
                () -> service.create(dto(), CALLER_INSTITUTION_ID));
    }

    // ---- 2: brand new (user, group) pair succeeds with a fresh active row ----
    @Test
    void create_newAssignment_insertsFreshActiveRow() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_INSTITUTION_ID)));
        when(authorityRepository.findByInstitutionGroupAndUser(any(), any()))
                .thenReturn(Optional.empty());
        when(authorityRepository.save(any(InstitutionGroupAuthority.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        InstitutionGroupAuthorityDto result = service.create(dto(), CALLER_INSTITUTION_ID);

        assertEquals(InstitutionGroupAuthority.Status.active, result.getStatus());
        verify(authorityRepository, times(1)).save(any(InstitutionGroupAuthority.class));
    }

    // ---- 3: duplicate ACTIVE authority is rejected ----
    @Test
    void create_alreadyActiveAuthority_throwsBusinessRuleException() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_INSTITUTION_ID)));
        InstitutionGroupAuthority activeRow = InstitutionGroupAuthority.builder()
                .institutionGroupAuthorityId(AUTHORITY_ID)
                .status(InstitutionGroupAuthority.Status.active)
                .build();
        when(authorityRepository.findByInstitutionGroupAndUser(any(), any()))
                .thenReturn(Optional.of(activeRow));

        assertThrows(BusinessRuleException.InstitutionGroupRuleException.class,
                () -> service.create(dto(), CALLER_INSTITUTION_ID));
        verify(authorityRepository, times(0)).save(any());
    }

    // ---- 4: re-adding a previously archived authority reactivates the same row ----
    @Test
    void create_archivedAuthority_reactivatesSameRowInsteadOfInserting() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_INSTITUTION_ID)));
        InstitutionGroupAuthority archivedRow = InstitutionGroupAuthority.builder()
                .institutionGroupAuthorityId(AUTHORITY_ID)
                .status(InstitutionGroupAuthority.Status.archived)
                .removedAt(LocalDateTime.now().minusDays(1))
                .build();
        when(authorityRepository.findByInstitutionGroupAndUser(any(), any()))
                .thenReturn(Optional.of(archivedRow));
        when(authorityRepository.save(any(InstitutionGroupAuthority.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        InstitutionGroupAuthorityDto result = service.create(dto(), CALLER_INSTITUTION_ID);

        assertEquals(AUTHORITY_ID, result.getInstitutionGroupAuthorityId()); // same row, not a new one
        assertEquals(InstitutionGroupAuthority.Status.active, archivedRow.getStatus());
        assertEquals(null, archivedRow.getRemovedAt());
    }

    // ---- 5: delete rejects cross-tenant access ----
    @Test
    void delete_differentInstitution_throwsNotFound() {
        InstitutionGroupAuthority row = InstitutionGroupAuthority.builder()
                .institutionGroupAuthorityId(AUTHORITY_ID)
                .institutionGroup(group(OTHER_INSTITUTION_ID))
                .status(InstitutionGroupAuthority.Status.active)
                .build();
        when(authorityRepository.findById(AUTHORITY_ID)).thenReturn(Optional.of(row));

        assertThrows(EntityNotFoundException.class,
                () -> service.delete(AUTHORITY_ID, CALLER_INSTITUTION_ID));
    }

    // ---- 6: delete by same institution archives the row ----
    @Test
    void delete_sameInstitution_archivesRow() {
        InstitutionGroupAuthority row = InstitutionGroupAuthority.builder()
                .institutionGroupAuthorityId(AUTHORITY_ID)
                .institutionGroup(group(CALLER_INSTITUTION_ID))
                .status(InstitutionGroupAuthority.Status.active)
                .build();
        when(authorityRepository.findById(AUTHORITY_ID)).thenReturn(Optional.of(row));
        when(authorityRepository.save(any(InstitutionGroupAuthority.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(AUTHORITY_ID, CALLER_INSTITUTION_ID);

        assertEquals(InstitutionGroupAuthority.Status.archived, row.getStatus());
        org.junit.jupiter.api.Assertions.assertTrue(row.getRemovedAt() != null);
    }
}
