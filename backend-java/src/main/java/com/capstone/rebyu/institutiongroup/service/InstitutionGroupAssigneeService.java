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
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class InstitutionGroupAssigneeService {

    private final InstitutionGroupAssigneeRepository institutionGroupAssigneeRepository;
    private final InstitutionGroupRepository institutionGroupRepository;
    private final OrganizationCertificationLearnerRepository organizationCertificationLearnerRepository;
    private final InstitutionGroupAssigneeMapper institutionGroupAssigneeMapper;

    @Transactional(readOnly = true)
    public List<InstitutionGroupAssigneeDto> getAll(Long groupId) {
        List<InstitutionGroupAssignee> assignees = groupId != null
                ? institutionGroupAssigneeRepository.findByInstitutionGroup_InstitutionGroupId(groupId)
                : institutionGroupAssigneeRepository.findAll();
        return assignees.stream().map(institutionGroupAssigneeMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public InstitutionGroupAssigneeDto getById(Long id) {
        return institutionGroupAssigneeMapper.toDto(findEntity(id));
    }

    public InstitutionGroupAssigneeDto create(InstitutionGroupAssigneeDto dto, Long callerInstitutionId) {
        log.info("Adding learner (orgCertLearnerId={}) to groupId={}",
                dto.getOrgCertLearnerId(), dto.getInstitutionGroupId());

        InstitutionGroup group = institutionGroupRepository.findById(dto.getInstitutionGroupId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "InstitutionGroup not found: " + dto.getInstitutionGroupId()));

        if (group.getInstitution() == null
                || !group.getInstitution().getInstitutionId().equals(callerInstitutionId)) {
            throw new EntityNotFoundException(
                    "InstitutionGroup not found: " + dto.getInstitutionGroupId());
        }

        OrganizationCertificationLearner learner = organizationCertificationLearnerRepository
                .findById(dto.getOrgCertLearnerId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "OrganizationCertificationLearner not found: " + dto.getOrgCertLearnerId()));

        // The learner must already hold org_cert access for the SAME allocation the
        // group belongs to — you cannot group a learner into another certification.
        Long groupOrgCertId = group.getOrgCert() != null ? group.getOrgCert().getOrgCertId() : null;
        Long learnerOrgCertId = learner.getOrgCert() != null ? learner.getOrgCert().getOrgCertId() : null;
        if (!Objects.equals(groupOrgCertId, learnerOrgCertId)) {
            throw new BusinessRuleException.InstitutionGroupRuleException(
                    "This learner does not have access to the certification this group belongs to.");
        }

        // Reactivate an archived assignment instead of colliding with it — the
        // partial unique index (uq_institution_group_assignee_active) only
        // guards active rows, so a stale archived row must be found and
        // revived explicitly rather than inserted alongside.
        var existing = institutionGroupAssigneeRepository.findByInstitutionGroupAndOrgCertLearner(group, learner);
        if (existing.isPresent()) {
            InstitutionGroupAssignee row = existing.get();
            if (row.getStatus() == InstitutionGroupAssignee.Status.active) {
                throw new BusinessRuleException.InstitutionGroupRuleException(
                        "This learner is already assigned to this group.");
            }
            row.setStatus(InstitutionGroupAssignee.Status.active);
            row.setRemovedAt(null);
            row.setAssignedAt(LocalDateTime.now());
            row.setAssignedBy(com.capstone.rebyu.user.entity.User.builder().userId(dto.getAssignedBy()).build());
            row.setRole(dto.getRole() != null ? dto.getRole() : InstitutionGroupAssignee.Role.member);
            InstitutionGroupAssigneeDto reactivated =
                    institutionGroupAssigneeMapper.toDto(institutionGroupAssigneeRepository.save(row));
            log.info("Reactivated institution group assignee id: {}", reactivated.getInstitutionGroupAssigneeId());
            return reactivated;
        }

        InstitutionGroupAssignee entity = institutionGroupAssigneeMapper.toEntity(dto);
        entity.setInstitutionGroupAssigneeId(null);
        entity.setAssignedAt(dto.getAssignedAt() != null ? dto.getAssignedAt() : LocalDateTime.now());
        entity.setStatus(InstitutionGroupAssignee.Status.active);
        entity.setRole(dto.getRole() != null ? dto.getRole() : InstitutionGroupAssignee.Role.member);
        entity.setRemovedAt(null);
        InstitutionGroupAssigneeDto result =
                institutionGroupAssigneeMapper.toDto(institutionGroupAssigneeRepository.save(entity));
        log.info("Institution group assignee created with id: {}", result.getInstitutionGroupAssigneeId());
        return result;
    }

    /** Archive (soft-remove) a learner from a group. */
    public void delete(Long id, Long callerInstitutionId) {
        log.info("Removing institution group assignee id: {}", id);
        InstitutionGroupAssignee entity = findEntity(id);
        requireSameInstitution(entity, callerInstitutionId);
        entity.setStatus(InstitutionGroupAssignee.Status.archived);
        entity.setRemovedAt(LocalDateTime.now());
        institutionGroupAssigneeRepository.save(entity);
    }

    /** Change a learner's standing within the group (peer lead vs. regular member). */
    public InstitutionGroupAssigneeDto changeRole(
            Long id, InstitutionGroupAssignee.Role newRole, Long callerInstitutionId) {
        InstitutionGroupAssignee entity = findEntity(id);
        requireSameInstitution(entity, callerInstitutionId);
        entity.setRole(newRole);
        return institutionGroupAssigneeMapper.toDto(institutionGroupAssigneeRepository.save(entity));
    }

    private void requireSameInstitution(InstitutionGroupAssignee entity, Long callerInstitutionId) {
        InstitutionGroup group = entity.getInstitutionGroup();
        if (group == null || group.getInstitution() == null
                || !group.getInstitution().getInstitutionId().equals(callerInstitutionId)) {
            throw new EntityNotFoundException(
                    "InstitutionGroupAssignee not found: " + entity.getInstitutionGroupAssigneeId());
        }
    }

    private InstitutionGroupAssignee findEntity(Long id) {
        return institutionGroupAssigneeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionGroupAssignee not found: " + id));
    }
}
