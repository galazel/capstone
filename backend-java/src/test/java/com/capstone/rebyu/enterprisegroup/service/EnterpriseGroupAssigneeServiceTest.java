package com.capstone.rebyu.enterprisegroup.service;

import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupAssigneeDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee;
import com.capstone.rebyu.enterprisegroup.mapper.EnterpriseGroupAssigneeMapper;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupAssigneeRepository;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.organization.entity.Enterprise;
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

class EnterpriseGroupAssigneeServiceTest {

    private static final Long CALLER_ENTERPRISE_ID = 1L;
    private static final Long OTHER_ENTERPRISE_ID = 2L;
    private static final Long GROUP_ID = 10L;
    private static final Long ORG_CERT_LEARNER_ID = 20L;
    private static final Long ORG_CERT_ID = 30L;
    private static final Long ASSIGNEE_ID = 40L;

    private EnterpriseGroupAssigneeRepository assigneeRepository;
    private EnterpriseGroupRepository groupRepository;
    private OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private EnterpriseGroupAssigneeMapper mapper;

    private EnterpriseGroupAssigneeService service;

    @BeforeEach
    void setUp() {
        assigneeRepository = mock(EnterpriseGroupAssigneeRepository.class);
        groupRepository = mock(EnterpriseGroupRepository.class);
        orgCertLearnerRepository = mock(OrganizationCertificationLearnerRepository.class);
        mapper = mock(EnterpriseGroupAssigneeMapper.class);

        service = new EnterpriseGroupAssigneeService(
                assigneeRepository, groupRepository, orgCertLearnerRepository, mapper);

        when(mapper.toDto(any(EnterpriseGroupAssignee.class))).thenAnswer(inv -> {
            EnterpriseGroupAssignee entity = inv.getArgument(0);
            EnterpriseGroupAssigneeDto dto = new EnterpriseGroupAssigneeDto();
            dto.setEnterpriseGroupAssigneeId(entity.getEnterpriseGroupAssigneeId());
            dto.setStatus(entity.getStatus());
            dto.setRole(entity.getRole());
            return dto;
        });
        when(mapper.toEntity(any(EnterpriseGroupAssigneeDto.class))).thenAnswer(inv -> {
            EnterpriseGroupAssigneeDto dto = inv.getArgument(0);
            return EnterpriseGroupAssignee.builder()
                    .enterpriseGroupAssigneeId(dto.getEnterpriseGroupAssigneeId())
                    .status(dto.getStatus())
                    .role(dto.getRole())
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

    private EnterpriseGroupAssigneeDto dto() {
        EnterpriseGroupAssigneeDto dto = new EnterpriseGroupAssigneeDto();
        dto.setEnterpriseGroupId(GROUP_ID);
        dto.setOrgCertLearnerId(ORG_CERT_LEARNER_ID);
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

    // ---- 2: learner from a different certification allocation is rejected ----
    @Test
    void create_learnerBelongsToDifferentOrgCert_throwsBusinessRuleException() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_ENTERPRISE_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(999L))); // different org cert than the group's

        assertThrows(BusinessRuleException.EnterpriseGroupRuleException.class,
                () -> service.create(dto(), CALLER_ENTERPRISE_ID));
    }

    // ---- 3: brand new assignment succeeds, defaults to member role ----
    @Test
    void create_newAssignment_defaultsToMemberRole() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_ENTERPRISE_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(ORG_CERT_ID)));
        when(assigneeRepository.findByEnterpriseGroupAndOrgCertLearner(any(), any()))
                .thenReturn(Optional.empty());
        when(assigneeRepository.save(any(EnterpriseGroupAssignee.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        EnterpriseGroupAssigneeDto result = service.create(dto(), CALLER_ENTERPRISE_ID);

        assertEquals(EnterpriseGroupAssignee.Role.member, result.getRole());
        assertEquals(EnterpriseGroupAssignee.Status.active, result.getStatus());
    }

    // ---- 4: duplicate ACTIVE assignment is rejected ----
    @Test
    void create_alreadyActiveAssignment_throwsBusinessRuleException() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_ENTERPRISE_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(ORG_CERT_ID)));
        EnterpriseGroupAssignee activeRow = EnterpriseGroupAssignee.builder()
                .enterpriseGroupAssigneeId(ASSIGNEE_ID)
                .status(EnterpriseGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findByEnterpriseGroupAndOrgCertLearner(any(), any()))
                .thenReturn(Optional.of(activeRow));

        assertThrows(BusinessRuleException.EnterpriseGroupRuleException.class,
                () -> service.create(dto(), CALLER_ENTERPRISE_ID));
        verify(assigneeRepository, times(0)).save(any());
    }

    // ---- 5: re-adding a previously removed (archived) learner reactivates the row ----
    @Test
    void create_archivedAssignment_reactivatesInsteadOfInserting() {
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group(CALLER_ENTERPRISE_ID)));
        when(orgCertLearnerRepository.findById(ORG_CERT_LEARNER_ID))
                .thenReturn(Optional.of(learner(ORG_CERT_ID)));
        EnterpriseGroupAssignee archivedRow = EnterpriseGroupAssignee.builder()
                .enterpriseGroupAssigneeId(ASSIGNEE_ID)
                .status(EnterpriseGroupAssignee.Status.archived)
                .removedAt(LocalDateTime.now().minusDays(1))
                .role(EnterpriseGroupAssignee.Role.lead)
                .build();
        when(assigneeRepository.findByEnterpriseGroupAndOrgCertLearner(any(), any()))
                .thenReturn(Optional.of(archivedRow));
        when(assigneeRepository.save(any(EnterpriseGroupAssignee.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        EnterpriseGroupAssigneeDto result = service.create(dto(), CALLER_ENTERPRISE_ID);

        assertEquals(ASSIGNEE_ID, result.getEnterpriseGroupAssigneeId()); // same row, not a new one
        assertEquals(EnterpriseGroupAssignee.Status.active, result.getStatus());
        assertEquals(EnterpriseGroupAssignee.Role.member, result.getRole()); // dto had no role -> defaults
    }

    // ---- 6: delete rejects cross-tenant access ----
    @Test
    void delete_differentEnterprise_throwsNotFound() {
        EnterpriseGroupAssignee row = EnterpriseGroupAssignee.builder()
                .enterpriseGroupAssigneeId(ASSIGNEE_ID)
                .enterpriseGroup(group(OTHER_ENTERPRISE_ID))
                .status(EnterpriseGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));

        assertThrows(EntityNotFoundException.class,
                () -> service.delete(ASSIGNEE_ID, CALLER_ENTERPRISE_ID));
    }

    // ---- 7: delete archives the row (soft-remove) ----
    @Test
    void delete_sameEnterprise_archivesRow() {
        EnterpriseGroupAssignee row = EnterpriseGroupAssignee.builder()
                .enterpriseGroupAssigneeId(ASSIGNEE_ID)
                .enterpriseGroup(group(CALLER_ENTERPRISE_ID))
                .status(EnterpriseGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));
        when(assigneeRepository.save(any(EnterpriseGroupAssignee.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(ASSIGNEE_ID, CALLER_ENTERPRISE_ID);

        assertEquals(EnterpriseGroupAssignee.Status.archived, row.getStatus());
        assertEquals(EnterpriseGroupAssignee.Status.archived, row.getStatus());
        org.junit.jupiter.api.Assertions.assertTrue(row.getRemovedAt() != null);
    }

    // ---- 8: role change ----
    @Test
    void changeRole_sameEnterprise_updatesRole() {
        EnterpriseGroupAssignee row = EnterpriseGroupAssignee.builder()
                .enterpriseGroupAssigneeId(ASSIGNEE_ID)
                .enterpriseGroup(group(CALLER_ENTERPRISE_ID))
                .status(EnterpriseGroupAssignee.Status.active)
                .role(EnterpriseGroupAssignee.Role.member)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));
        when(assigneeRepository.save(any(EnterpriseGroupAssignee.class))).thenAnswer(inv -> inv.getArgument(0));

        EnterpriseGroupAssigneeDto result =
                service.changeRole(ASSIGNEE_ID, EnterpriseGroupAssignee.Role.lead, CALLER_ENTERPRISE_ID);

        assertEquals(EnterpriseGroupAssignee.Role.lead, result.getRole());
    }

    @Test
    void changeRole_differentEnterprise_throwsNotFound() {
        EnterpriseGroupAssignee row = EnterpriseGroupAssignee.builder()
                .enterpriseGroupAssigneeId(ASSIGNEE_ID)
                .enterpriseGroup(group(OTHER_ENTERPRISE_ID))
                .status(EnterpriseGroupAssignee.Status.active)
                .build();
        when(assigneeRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(row));

        assertThrows(EntityNotFoundException.class,
                () -> service.changeRole(ASSIGNEE_ID, EnterpriseGroupAssignee.Role.lead, CALLER_ENTERPRISE_ID));
    }
}
