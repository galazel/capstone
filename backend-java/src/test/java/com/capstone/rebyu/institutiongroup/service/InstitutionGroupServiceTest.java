package com.capstone.rebyu.institutiongroup.service;

import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.mapper.InstitutionGroupMapper;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAuthorityRepository;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.organization.entity.Institution;
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

class InstitutionGroupServiceTest {

    private static final Long CALLER_INSTITUTION_ID = 1L;
    private static final Long OTHER_INSTITUTION_ID = 2L;
    private static final Long GROUP_ID = 10L;
    private static final Long ORG_CERT_ID = 30L;

    private InstitutionGroupRepository groupRepository;
    private OrganizationCertificateRepository orgCertRepository;
    private InstitutionGroupMapper mapper;

    private InstitutionGroupService service;

    @BeforeEach
    void setUp() {
        groupRepository = mock(InstitutionGroupRepository.class);
        orgCertRepository = mock(OrganizationCertificateRepository.class);
        mapper = mock(InstitutionGroupMapper.class);

        service = new InstitutionGroupService(
                groupRepository, mock(InstitutionGroupAuthorityRepository.class), orgCertRepository, mapper);

        when(mapper.toDto(any(InstitutionGroup.class))).thenAnswer(inv -> {
            InstitutionGroup entity = inv.getArgument(0);
            InstitutionGroupDto dto = new InstitutionGroupDto();
            dto.setInstitutionGroupId(entity.getInstitutionGroupId());
            dto.setGroupName(entity.getGroupName());
            dto.setGroupDescription(entity.getGroupDescription());
            dto.setTotalSlots(entity.getTotalSlots());
            dto.setUsedSlots(entity.getUsedSlots());
            dto.setStatus(entity.getStatus());
            return dto;
        });
        when(mapper.toEntity(any(InstitutionGroupDto.class))).thenAnswer(inv -> {
            InstitutionGroupDto dto = inv.getArgument(0);
            return InstitutionGroup.builder()
                    .institutionGroupId(dto.getInstitutionGroupId())
                    .groupName(dto.getGroupName())
                    .groupDescription(dto.getGroupDescription())
                    .totalSlots(dto.getTotalSlots() != null ? dto.getTotalSlots() : 0)
                    .status(dto.getStatus())
                    .build();
        });
    }

    private InstitutionGroup group(Long institutionId) {
        Institution institution = new Institution();
        institution.setInstitutionId(institutionId);
        OrganizationCertificate orgCert = new OrganizationCertificate();
        orgCert.setOrgCertId(ORG_CERT_ID);
        orgCert.setTotalSlots(100);
        return InstitutionGroup.builder()
                .institutionGroupId(GROUP_ID)
                .institution(institution)
                .orgCert(orgCert)
                .groupName("Original Name")
                .groupDescription("Original Description")
                .totalSlots(10)
                .usedSlots(0)
                .status(InstitutionGroup.Status.active)
                .build();
    }

    private OrganizationCertificate orgCert(Long institutionId) {
        Institution institution = new Institution();
        institution.setInstitutionId(institutionId);
        return OrganizationCertificate.builder()
                .orgCertId(ORG_CERT_ID)
                .institution(institution)
                .totalSlots(100)
                .build();
    }

    private InstitutionGroupDto createDto(Long institutionId) {
        InstitutionGroupDto dto = new InstitutionGroupDto();
        dto.setInstitutionId(institutionId);
        dto.setOrgCertId(ORG_CERT_ID);
        dto.setGroupName("New Group");
        dto.setGroupDescription("New Description");
        dto.setTotalSlots(10);
        return dto;
    }

    // ---- create() ----

    @Test
    void create_orgCertBelongsToDifferentInstitution_throwsNotFound() {
        when(orgCertRepository.findById(ORG_CERT_ID)).thenReturn(Optional.of(orgCert(OTHER_INSTITUTION_ID)));

        assertThrows(EntityNotFoundException.class,
                () -> service.create(createDto(CALLER_INSTITUTION_ID)));

        verify(groupRepository, never()).save(any());
    }

    @Test
    void create_matchingInstitution_succeedsAndReturnsMappedDto() {
        when(orgCertRepository.findById(ORG_CERT_ID)).thenReturn(Optional.of(orgCert(CALLER_INSTITUTION_ID)));
        when(groupRepository.save(any(InstitutionGroup.class))).thenAnswer(inv -> {
            InstitutionGroup entity = inv.getArgument(0);
            entity.setInstitutionGroupId(GROUP_ID);
            return entity;
        });

        InstitutionGroupDto result = service.create(createDto(CALLER_INSTITUTION_ID));

        assertEquals(GROUP_ID, result.getInstitutionGroupId());
        assertEquals("New Group", result.getGroupName());
    }

    // ---- update() ----

    @Test
    void update_differentInstitution_throwsNotFoundAndDoesNotSave() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(OTHER_INSTITUTION_ID)));

        InstitutionGroupDto dto = new InstitutionGroupDto();
        dto.setGroupName("Hacked Name");
        dto.setGroupDescription("Hacked Description");

        assertThrows(EntityNotFoundException.class,
                () -> service.update(GROUP_ID, dto, CALLER_INSTITUTION_ID));

        verify(groupRepository, never()).save(any());
    }

    @Test
    void update_sameInstitution_succeedsAndPersistsNewFields() {
        InstitutionGroup existing = group(CALLER_INSTITUTION_ID);
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(existing));
        when(groupRepository.save(any(InstitutionGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        InstitutionGroupDto dto = new InstitutionGroupDto();
        dto.setGroupName("Updated Name");
        dto.setGroupDescription("Updated Description");

        InstitutionGroupDto result = service.update(GROUP_ID, dto, CALLER_INSTITUTION_ID);

        assertEquals("Updated Name", result.getGroupName());
        assertEquals("Updated Description", result.getGroupDescription());
        assertEquals("Updated Name", existing.getGroupName());
        assertEquals("Updated Description", existing.getGroupDescription());
    }

    // ---- delete() ----

    @Test
    void delete_differentInstitution_throwsNotFoundAndDoesNotSave() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(OTHER_INSTITUTION_ID)));

        assertThrows(EntityNotFoundException.class,
                () -> service.delete(GROUP_ID, CALLER_INSTITUTION_ID));

        verify(groupRepository, never()).save(any());
    }

    @Test
    void delete_sameInstitution_setsStatusToArchived() {
        InstitutionGroup existing = group(CALLER_INSTITUTION_ID);
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(existing));
        when(groupRepository.save(any(InstitutionGroup.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(GROUP_ID, CALLER_INSTITUTION_ID);

        assertEquals(InstitutionGroup.Status.archived, existing.getStatus());
        verify(groupRepository).save(existing);
    }
}
