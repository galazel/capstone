package com.capstone.rebyu.institutiongroup.service;

import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupAssigneeDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAssignee;
import com.capstone.rebyu.institutiongroup.mapper.InstitutionGroupAssigneeMapper;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAssigneeRepository;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
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

class InstitutionGroupAssigneeServiceTest {

    private static final Long CALLER_INSTITUTION_ID = 1L;
    private static final Long OTHER_INSTITUTION_ID = 2L;
    private static final Long GROUP_ID = 10L;
    private static final Long ORG_CERT_LEARNER_ID = 20L;
    private static final Long ORG_CERT_ID = 30L;
    private static final Long ASSIGNEE_ID = 40L;

    private InstitutionGroupAssigneeRepository assigneeRepository;
    private InstitutionGroupRepository groupRepository;
    private OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private InstitutionGroupAssigneeMapper mapper;

    private InstitutionGroupAssigneeService service;

    @BeforeEach
    void setUp() {
        assigneeRepository = mock(InstitutionGroupAssigneeRepository.class);
        groupRepository = mock(InstitutionGroupRepository.class);
        orgCertLearnerRepository = mock(OrganizationCertificationLearnerRepository.class);
        mapper = mock(InstitutionGroupAssigneeMapper.class);

        service = new InstitutionGroupAssigneeService(
                assigneeRepository, groupRepository, orgCertLearnerRepository, mapper);

        when(mapper.toDto(any(InstitutionGroupAssignee.class))).thenAnswer(inv -> {
            InstitutionGroupAssignee entity = inv.getArgument(0);
            InstitutionGroupAssigneeDto dto = new InstitutionGroupAssigneeDto();
            dto.setInstitutionGroupAssigneeId(entity.getInstitutionGroupAssigneeId());
            dto.setStatus(entity.getStatus());
            dto.setRole(entity.getRole());
            return dto;
        });
        when(mapper.toEntity(any(InstitutionGroupAssigneeDto.class))).thenAnswer(inv -> {
            InstitutionGroupAssigneeDto dto = inv.getArgument(0);
            return InstitutionGroupAssignee.builder()
                    .institutionGroupAssigneeId(dto.getInstitutionGroupAssigneeId())
                    .status(dto.getStatus())
                    .role(dto.getRole())
                    .build();
        });
    }

    private InstitutionGroup group(Long institutionId) {
        Institution institution = new Institution();
        institution.setInstitutionId(institutionId);
        OrganizationCertificate orgCert = new OrganizationCertificate();
        orgCert.setOrgCertId(ORG_CERT_ID);
        return InstitutionGroup.builder()
                .institutionGroupId(GROUP_ID)
                .institution(institution)
                .orgCert(orgCert)
                .build();
    }

    private OrganizationCertificationLearner learner(Long orgCertId) {
        OrganizationCertificate orgCert = new OrganizationCertificate();
        orgCert.setOrgCertId(orgCertId);
        return OrganizationCertificationLearner.builder()
                .orgCertLearnerId(ORG_CERT_LEARNER_ID)
                .orgCert(orgCert)
                .build();
    }

    private InstitutionGroupAssigneeDto dto() {
        InstitutionGroupAssigneeDto dto = new InstitutionGroupAssigneeDto();
        dto.setInstitutionGroupId(GROUP_ID);
        dto.setOrgCertLearnerId(ORG_CERT_LEARNER_ID);
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

    // ---- 2: learner from a different certification allocation is rejected ----
    @Test
    void create_learnerBelongsToDifferentOrgCert_throwsBusinessRuleException() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_INSTITUTION_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(999L))); // different org cert than the group's

        assertThrows(BusinessRuleException.InstitutionGroupRuleException.class,
                () -> service.create(dto(), CALLER_INSTITUTION_ID));
    }

    // ---- 3: brand new assignment succeeds, defaults to member role ----
    @Test
    void create_newAssignment_defaultsToMemberRole() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_INSTITUTION_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(ORG_CERT_ID)));
        when(assigneeRepository.findByInstitutionGroupAndOrgCertLearner(any(), any()))
                .thenReturn(Optional.empty());
        when(assigneeRepository.save(any(InstitutionGroupAssignee.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        InstitutionGroupAssigneeDto result = service.create(dto(), CALLER_INSTITUTION_ID);

        assertEquals(InstitutionGroupAssignee.Role.member, result.getRole());
        assertEquals(InstitutionGroupAssignee.Status.active, result.getStatus());
    }

    // ---- 4: duplicate ACTIVE assignment is rejected ----
    @Test
    void create_alreadyActiveAssignment_throwsBusinessRuleException() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_INSTITUTION_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(ORG_CERT_ID)));
        InstitutionGroupAssignee activeRow = InstitutionGroupAssignee.builder()
                .institutionGroupAssigneeId(ASSIGNEE_ID)
                .status(InstitutionGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findByInstitutionGroupAndOrgCertLearner(any(), any()))
                .thenReturn(Optional.of(activeRow));

        assertThrows(BusinessRuleException.InstitutionGroupRuleException.class,
                () -> service.create(dto(), CALLER_INSTITUTION_ID));
        verify(assigneeRepository, times(0)).save(any());
    }

    // ---- 5: re-adding a previously removed (archived) learner reactivates the row ----
    @Test
    void create_archivedAssignment_reactivatesInsteadOfInserting() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_INSTITUTION_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(ORG_CERT_ID)));
        InstitutionGroupAssignee archivedRow = InstitutionGroupAssignee.builder()
                .institutionGroupAssigneeId(ASSIGNEE_ID)
                .status(InstitutionGroupAssignee.Status.archived)
                .removedAt(LocalDateTime.now().minusDays(1))
                .role(InstitutionGroupAssignee.Role.lead)
                .build();
        when(assigneeRepository.findByInstitutionGroupAndOrgCertLearner(any(), any()))
                .thenReturn(Optional.of(archivedRow));
        when(assigneeRepository.save(any(InstitutionGroupAssignee.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        InstitutionGroupAssigneeDto result = service.create(dto(), CALLER_INSTITUTION_ID);

        assertEquals(ASSIGNEE_ID, result.getInstitutionGroupAssigneeId()); // same row, not a new one
        assertEquals(InstitutionGroupAssignee.Status.active, result.getStatus());
        assertEquals(InstitutionGroupAssignee.Role.member, result.getRole()); // dto had no role -> defaults
    }

    // ---- 6: delete rejects cross-tenant access ----
    @Test
    void delete_differentInstitution_throwsNotFound() {
        InstitutionGroupAssignee row = InstitutionGroupAssignee.builder()
                .institutionGroupAssigneeId(ASSIGNEE_ID)
                .institutionGroup(group(OTHER_INSTITUTION_ID))
                .status(InstitutionGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));

        assertThrows(EntityNotFoundException.class,
                () -> service.delete(ASSIGNEE_ID, CALLER_INSTITUTION_ID));
    }

    // ---- 7: delete archives the row (soft-remove) ----
    @Test
    void delete_sameInstitution_archivesRow() {
        InstitutionGroupAssignee row = InstitutionGroupAssignee.builder()
                .institutionGroupAssigneeId(ASSIGNEE_ID)
                .institutionGroup(group(CALLER_INSTITUTION_ID))
                .status(InstitutionGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));
        when(assigneeRepository.save(any(InstitutionGroupAssignee.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(ASSIGNEE_ID, CALLER_INSTITUTION_ID);

        assertEquals(InstitutionGroupAssignee.Status.archived, row.getStatus());
        assertEquals(InstitutionGroupAssignee.Status.archived, row.getStatus());
        org.junit.jupiter.api.Assertions.assertTrue(row.getRemovedAt() != null);
    }

    // ---- 8: role change ----
    @Test
    void changeRole_sameInstitution_updatesRole() {
        InstitutionGroupAssignee row = InstitutionGroupAssignee.builder()
                .institutionGroupAssigneeId(ASSIGNEE_ID)
                .institutionGroup(group(CALLER_INSTITUTION_ID))
                .status(InstitutionGroupAssignee.Status.active)
                .role(InstitutionGroupAssignee.Role.member)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));
        when(assigneeRepository.save(any(InstitutionGroupAssignee.class))).thenAnswer(inv -> inv.getArgument(0));

        InstitutionGroupAssigneeDto result =
                service.changeRole(ASSIGNEE_ID, InstitutionGroupAssignee.Role.lead, CALLER_INSTITUTION_ID);

        assertEquals(InstitutionGroupAssignee.Role.lead, result.getRole());
    }

    @Test
    void changeRole_differentInstitution_throwsNotFound() {
        InstitutionGroupAssignee row = InstitutionGroupAssignee.builder()
                .institutionGroupAssigneeId(ASSIGNEE_ID)
                .institutionGroup(group(OTHER_INSTITUTION_ID))
                .status(InstitutionGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));

        assertThrows(EntityNotFoundException.class,
                () -> service.changeRole(ASSIGNEE_ID, InstitutionGroupAssignee.Role.lead, CALLER_INSTITUTION_ID));
    }
}
