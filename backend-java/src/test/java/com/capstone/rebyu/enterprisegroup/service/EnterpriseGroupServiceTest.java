package com.capstone.rebyu.enterprisegroup.service;

import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.mapper.EnterpriseGroupMapper;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EnterpriseGroupServiceTest {

    private static final Long CALLER_ENTERPRISE_ID = 1L;
    private static final Long OTHER_ENTERPRISE_ID = 2L;
    private static final Long GROUP_ID = 10L;
    private static final Long ORG_CERT_ID = 30L;

    private EnterpriseGroupRepository groupRepository;
    private OrganizationCertificateRepository orgCertRepository;
    private EnterpriseGroupMapper mapper;

    private EnterpriseGroupService service;

    @BeforeEach
    void setUp() {
        groupRepository = mock(EnterpriseGroupRepository.class);
        orgCertRepository = mock(OrganizationCertificateRepository.class);
        mapper = mock(EnterpriseGroupMapper.class);

        service = new EnterpriseGroupService(groupRepository, orgCertRepository, mapper);

        when(mapper.toDto(any(EnterpriseGroup.class))).thenAnswer(inv -> {
            EnterpriseGroup entity = inv.getArgument(0);
            EnterpriseGroupDto dto = new EnterpriseGroupDto();
            dto.setEnterpriseGroupId(entity.getEnterpriseGroupId());
            dto.setGroupName(entity.getGroupName());
            dto.setGroupDescription(entity.getGroupDescription());
            dto.setStatus(entity.getStatus());
            return dto;
        });
        when(mapper.toEntity(any(EnterpriseGroupDto.class))).thenAnswer(inv -> {
            EnterpriseGroupDto dto = inv.getArgument(0);
            return EnterpriseGroup.builder()
                    .enterpriseGroupId(dto.getEnterpriseGroupId())
                    .groupName(dto.getGroupName())
                    .groupDescription(dto.getGroupDescription())
                    .status(dto.getStatus())
                    .build();
        });
    }

    private EnterpriseGroup group(Long enterpriseId) {
        Enterprise enterprise = new Enterprise();
        enterprise.setEnterpriseId(enterpriseId);
        OrganizationCertificate orgCert = new OrganizationCertificate();
        orgCert.setOrgCertId(ORG_CERT_ID);
        return EnterpriseGroup.builder()
                .enterpriseGroupId(GROUP_ID)
                .enterprise(enterprise)
                .orgCert(orgCert)
                .groupName("Original Name")
                .groupDescription("Original Description")
                .status(EnterpriseGroup.Status.active)
                .build();
    }

    private OrganizationCertificate orgCert(Long enterpriseId) {
        Enterprise enterprise = new Enterprise();
        enterprise.setEnterpriseId(enterpriseId);
        return OrganizationCertificate.builder()
                .orgCertId(ORG_CERT_ID)
                .enterprise(enterprise)
                .build();
    }

    private EnterpriseGroupDto createDto(Long enterpriseId) {
        EnterpriseGroupDto dto = new EnterpriseGroupDto();
        dto.setEnterpriseId(enterpriseId);
        dto.setOrgCertId(ORG_CERT_ID);
        dto.setGroupName("New Group");
        dto.setGroupDescription("New Description");
        return dto;
    }

    // ---- create() ----

    @Test
    void create_orgCertBelongsToDifferentEnterprise_throwsNotFound() {
        when(orgCertRepository.findById(ORG_CERT_ID)).thenReturn(Optional.of(orgCert(OTHER_ENTERPRISE_ID)));

        assertThrows(EntityNotFoundException.class,
                () -> service.create(createDto(CALLER_ENTERPRISE_ID)));

        verify(groupRepository, never()).save(any());
    }

    @Test
    void create_matchingEnterprise_succeedsAndReturnsMappedDto() {
        when(orgCertRepository.findById(ORG_CERT_ID)).thenReturn(Optional.of(orgCert(CALLER_ENTERPRISE_ID)));
        when(groupRepository.save(any(EnterpriseGroup.class))).thenAnswer(inv -> {
            EnterpriseGroup entity = inv.getArgument(0);
            entity.setEnterpriseGroupId(GROUP_ID);
            return entity;
        });

        EnterpriseGroupDto result = service.create(createDto(CALLER_ENTERPRISE_ID));

        assertEquals(GROUP_ID, result.getEnterpriseGroupId());
        assertEquals("New Group", result.getGroupName());
    }

    // ---- update() ----

    @Test
    void update_differentEnterprise_throwsNotFoundAndDoesNotSave() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(OTHER_ENTERPRISE_ID)));

        EnterpriseGroupDto dto = new EnterpriseGroupDto();
        dto.setGroupName("Hacked Name");
        dto.setGroupDescription("Hacked Description");

        assertThrows(EntityNotFoundException.class,
                () -> service.update(GROUP_ID, dto, CALLER_ENTERPRISE_ID));

        verify(groupRepository, never()).save(any());
    }

    @Test
    void update_sameEnterprise_succeedsAndPersistsNewFields() {
        EnterpriseGroup existing = group(CALLER_ENTERPRISE_ID);
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(existing));
        when(groupRepository.save(any(EnterpriseGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        EnterpriseGroupDto dto = new EnterpriseGroupDto();
        dto.setGroupName("Updated Name");
        dto.setGroupDescription("Updated Description");

        EnterpriseGroupDto result = service.update(GROUP_ID, dto, CALLER_ENTERPRISE_ID);

        assertEquals("Updated Name", result.getGroupName());
        assertEquals("Updated Description", result.getGroupDescription());
        assertEquals("Updated Name", existing.getGroupName());
        assertEquals("Updated Description", existing.getGroupDescription());
    }

    // ---- delete() ----

    @Test
    void delete_differentEnterprise_throwsNotFoundAndDoesNotSave() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(OTHER_ENTERPRISE_ID)));

        assertThrows(EntityNotFoundException.class,
                () -> service.delete(GROUP_ID, CALLER_ENTERPRISE_ID));

        verify(groupRepository, never()).save(any());
    }

    @Test
    void delete_sameEnterprise_setsStatusToArchived() {
        EnterpriseGroup existing = group(CALLER_ENTERPRISE_ID);
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(existing));
        when(groupRepository.save(any(EnterpriseGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(GROUP_ID, CALLER_ENTERPRISE_ID);

        assertEquals(EnterpriseGroup.Status.archived, existing.getStatus());
        verify(groupRepository).save(existing);
    }
}
