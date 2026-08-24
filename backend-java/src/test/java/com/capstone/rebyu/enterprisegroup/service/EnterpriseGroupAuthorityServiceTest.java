package com.capstone.rebyu.enterprisegroup.service;

import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupAuthorityDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAuthority;
import com.capstone.rebyu.enterprisegroup.mapper.EnterpriseGroupAuthorityMapper;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupAuthorityRepository;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.repository.EnterpriseMemberRepository;
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

class EnterpriseGroupAuthorityServiceTest {

    private static final Long CALLER_ENTERPRISE_ID = 1L;
    private static final Long OTHER_ENTERPRISE_ID = 2L;
    private static final Long GROUP_ID = 10L;
    private static final Long USER_ID = 20L;
    private static final Long AUTHORITY_ID = 40L;

    private EnterpriseGroupAuthorityRepository authorityRepository;
    private EnterpriseGroupRepository groupRepository;
    private EnterpriseGroupAuthorityMapper mapper;

    private EnterpriseGroupAuthorityService service;

    @BeforeEach
    void setUp() {
        authorityRepository = mock(EnterpriseGroupAuthorityRepository.class);
        groupRepository = mock(EnterpriseGroupRepository.class);
        mapper = mock(EnterpriseGroupAuthorityMapper.class);

        service = new EnterpriseGroupAuthorityService(authorityRepository, groupRepository, mapper,
                mock(UserRepository.class), mock(UserTypeRepository.class),
                mock(EnterpriseMemberRepository.class));

        when(mapper.toDto(any(EnterpriseGroupAuthority.class))).thenAnswer(inv -> {
            EnterpriseGroupAuthority entity = inv.getArgument(0);
            EnterpriseGroupAuthorityDto dto = new EnterpriseGroupAuthorityDto();
            dto.setEnterpriseGroupAuthorityId(entity.getEnterpriseGroupAuthorityId());
            dto.setStatus(entity.getStatus());
            return dto;
        });
        when(mapper.toEntity(any(EnterpriseGroupAuthorityDto.class))).thenAnswer(inv -> {
            EnterpriseGroupAuthorityDto dto = inv.getArgument(0);
            return EnterpriseGroupAuthority.builder()
                    .enterpriseGroupAuthorityId(dto.getEnterpriseGroupAuthorityId())
                    .status(dto.getStatus())
                    .build();
        });
    }

    private EnterpriseGroup group(Long enterpriseId) {
        Enterprise enterprise = new Enterprise();
        enterprise.setEnterpriseId(enterpriseId);
        return EnterpriseGroup.builder()
                .enterpriseGroupId(GROUP_ID)
                .enterprise(enterprise)
                .build();
    }

    private EnterpriseGroupAuthorityDto dto() {
        EnterpriseGroupAuthorityDto dto = new EnterpriseGroupAuthorityDto();
        dto.setEnterpriseGroupId(GROUP_ID);
        dto.setUserId(USER_ID);
        dto.setAssignedBy(99L);
        return dto;
    }

    // ---- 1: cross-tenant group access is rejected ----
    @Test
    void create_groupBelongsToDifferentEnterprise_throwsNotFound() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(OTHER_ENTERPRISE_ID)));

        assertThrows(EntityNotFoundException.class,
                () -> service.create(dto(), CALLER_ENTERPRISE_ID));
    }

    // ---- 2: brand new (user, group) pair succeeds with a fresh active row ----
    @Test
    void create_newAssignment_insertsFreshActiveRow() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_ENTERPRISE_ID)));
        when(authorityRepository.findByEnterpriseGroupAndUser(any(), any()))
                .thenReturn(Optional.empty());
        when(authorityRepository.save(any(EnterpriseGroupAuthority.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        EnterpriseGroupAuthorityDto result = service.create(dto(), CALLER_ENTERPRISE_ID);

        assertEquals(EnterpriseGroupAuthority.Status.active, result.getStatus());
        verify(authorityRepository, times(1)).save(any(EnterpriseGroupAuthority.class));
    }

    // ---- 3: duplicate ACTIVE authority is rejected ----
    @Test
    void create_alreadyActiveAuthority_throwsBusinessRuleException() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_ENTERPRISE_ID)));
        EnterpriseGroupAuthority activeRow = EnterpriseGroupAuthority.builder()
                .enterpriseGroupAuthorityId(AUTHORITY_ID)
                .status(EnterpriseGroupAuthority.Status.active)
                .build();
        when(authorityRepository.findByEnterpriseGroupAndUser(any(), any()))
                .thenReturn(Optional.of(activeRow));

        assertThrows(BusinessRuleException.EnterpriseGroupRuleException.class,
                () -> service.create(dto(), CALLER_ENTERPRISE_ID));
        verify(authorityRepository, times(0)).save(any());
    }

    // ---- 4: re-adding a previously archived authority reactivates the same row ----
    @Test
    void create_archivedAuthority_reactivatesSameRowInsteadOfInserting() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_ENTERPRISE_ID)));
        EnterpriseGroupAuthority archivedRow = EnterpriseGroupAuthority.builder()
                .enterpriseGroupAuthorityId(AUTHORITY_ID)
                .status(EnterpriseGroupAuthority.Status.archived)
                .removedAt(LocalDateTime.now().minusDays(1))
                .build();
        when(authorityRepository.findByEnterpriseGroupAndUser(any(), any()))
                .thenReturn(Optional.of(archivedRow));
        when(authorityRepository.save(any(EnterpriseGroupAuthority.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        EnterpriseGroupAuthorityDto result = service.create(dto(), CALLER_ENTERPRISE_ID);

        assertEquals(AUTHORITY_ID, result.getEnterpriseGroupAuthorityId()); // same row, not a new one
        assertEquals(EnterpriseGroupAuthority.Status.active, archivedRow.getStatus());
        assertEquals(null, archivedRow.getRemovedAt());
    }

    // ---- 5: delete rejects cross-tenant access ----
    @Test
    void delete_differentEnterprise_throwsNotFound() {
        EnterpriseGroupAuthority row = EnterpriseGroupAuthority.builder()
                .enterpriseGroupAuthorityId(AUTHORITY_ID)
                .enterpriseGroup(group(OTHER_ENTERPRISE_ID))
                .status(EnterpriseGroupAuthority.Status.active)
                .build();
        when(authorityRepository.findById(AUTHORITY_ID)).thenReturn(Optional.of(row));

        assertThrows(EntityNotFoundException.class,
                () -> service.delete(AUTHORITY_ID, CALLER_ENTERPRISE_ID));
    }

    // ---- 6: delete by same enterprise archives the row ----
    @Test
    void delete_sameEnterprise_archivesRow() {
        EnterpriseGroupAuthority row = EnterpriseGroupAuthority.builder()
                .enterpriseGroupAuthorityId(AUTHORITY_ID)
                .enterpriseGroup(group(CALLER_ENTERPRISE_ID))
                .status(EnterpriseGroupAuthority.Status.active)
                .build();
        when(authorityRepository.findById(AUTHORITY_ID)).thenReturn(Optional.of(row));
        when(authorityRepository.save(any(EnterpriseGroupAuthority.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(AUTHORITY_ID, CALLER_ENTERPRISE_ID);

        assertEquals(EnterpriseGroupAuthority.Status.archived, row.getStatus());
        org.junit.jupiter.api.Assertions.assertTrue(row.getRemovedAt() != null);
    }
}
