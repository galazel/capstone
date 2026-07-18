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
public class EnterpriseGroupAssigneeService {

    private final EnterpriseGroupAssigneeRepository enterpriseGroupAssigneeRepository;
    private final EnterpriseGroupRepository enterpriseGroupRepository;
    private final OrganizationCertificationLearnerRepository organizationCertificationLearnerRepository;
    private final EnterpriseGroupAssigneeMapper enterpriseGroupAssigneeMapper;

    @Transactional(readOnly = true)
    public List<EnterpriseGroupAssigneeDto> getAll(Long groupId) {
        List<EnterpriseGroupAssignee> assignees = groupId != null
                ? enterpriseGroupAssigneeRepository.findByEnterpriseGroup_EnterpriseGroupId(groupId)
                : enterpriseGroupAssigneeRepository.findAll();
        return assignees.stream().map(enterpriseGroupAssigneeMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public EnterpriseGroupAssigneeDto getById(Long id) {
        return enterpriseGroupAssigneeMapper.toDto(findEntity(id));
    }

    public EnterpriseGroupAssigneeDto create(EnterpriseGroupAssigneeDto dto, Long callerEnterpriseId) {
        log.info("Adding learner (orgCertLearnerId={}) to groupId={}",
                dto.getOrgCertLearnerId(), dto.getEnterpriseGroupId());

        EnterpriseGroup group = enterpriseGroupRepository.findById(dto.getEnterpriseGroupId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "EnterpriseGroup not found: " + dto.getEnterpriseGroupId()));

        if (group.getEnterprise() == null
                || !group.getEnterprise().getEnterpriseId().equals(callerEnterpriseId)) {
            throw new EntityNotFoundException(
                    "EnterpriseGroup not found: " + dto.getEnterpriseGroupId());
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
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "This learner does not have access to the certification this group belongs to.");
        }

        // Reactivate an archived assignment instead of colliding with it — the
        // partial unique index (uq_enterprise_group_assignee_active) only
        // guards active rows, so a stale archived row must be found and
        // revived explicitly rather than inserted alongside.
        var existing = enterpriseGroupAssigneeRepository.findByEnterpriseGroupAndOrgCertLearner(group, learner);
        if (existing.isPresent()) {
            EnterpriseGroupAssignee row = existing.get();
            if (row.getStatus() == EnterpriseGroupAssignee.Status.active) {
                throw new BusinessRuleException.EnterpriseGroupRuleException(
                        "This learner is already assigned to this group.");
            }
            row.setStatus(EnterpriseGroupAssignee.Status.active);
            row.setRemovedAt(null);
            row.setAssignedAt(LocalDateTime.now());
            row.setAssignedBy(com.capstone.rebyu.user.entity.User.builder().userId(dto.getAssignedBy()).build());
            row.setRole(dto.getRole() != null ? dto.getRole() : EnterpriseGroupAssignee.Role.member);
            EnterpriseGroupAssigneeDto reactivated =
                    enterpriseGroupAssigneeMapper.toDto(enterpriseGroupAssigneeRepository.save(row));
            log.info("Reactivated enterprise group assignee id: {}", reactivated.getEnterpriseGroupAssigneeId());
            return reactivated;
        }

        EnterpriseGroupAssignee entity = enterpriseGroupAssigneeMapper.toEntity(dto);
        entity.setEnterpriseGroupAssigneeId(null);
        entity.setAssignedAt(dto.getAssignedAt() != null ? dto.getAssignedAt() : LocalDateTime.now());
        entity.setStatus(EnterpriseGroupAssignee.Status.active);
        entity.setRole(dto.getRole() != null ? dto.getRole() : EnterpriseGroupAssignee.Role.member);
        entity.setRemovedAt(null);
        EnterpriseGroupAssigneeDto result =
                enterpriseGroupAssigneeMapper.toDto(enterpriseGroupAssigneeRepository.save(entity));
        log.info("Enterprise group assignee created with id: {}", result.getEnterpriseGroupAssigneeId());
        return result;
    }

    /** Archive (soft-remove) a learner from a group. */
    public void delete(Long id, Long callerEnterpriseId) {
        log.info("Removing enterprise group assignee id: {}", id);
        EnterpriseGroupAssignee entity = findEntity(id);
        requireSameEnterprise(entity, callerEnterpriseId);
        entity.setStatus(EnterpriseGroupAssignee.Status.archived);
        entity.setRemovedAt(LocalDateTime.now());
        enterpriseGroupAssigneeRepository.save(entity);
    }

    /** Change a learner's standing within the group (peer lead vs. regular member). */
    public EnterpriseGroupAssigneeDto changeRole(
            Long id, EnterpriseGroupAssignee.Role newRole, Long callerEnterpriseId) {
        EnterpriseGroupAssignee entity = findEntity(id);
        requireSameEnterprise(entity, callerEnterpriseId);
        entity.setRole(newRole);
        return enterpriseGroupAssigneeMapper.toDto(enterpriseGroupAssigneeRepository.save(entity));
    }

    private void requireSameEnterprise(EnterpriseGroupAssignee entity, Long callerEnterpriseId) {
        EnterpriseGroup group = entity.getEnterpriseGroup();
        if (group == null || group.getEnterprise() == null
                || !group.getEnterprise().getEnterpriseId().equals(callerEnterpriseId)) {
            throw new EntityNotFoundException(
                    "EnterpriseGroupAssignee not found: " + entity.getEnterpriseGroupAssigneeId());
        }
    }

    private EnterpriseGroupAssignee findEntity(Long id) {
        return enterpriseGroupAssigneeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("EnterpriseGroupAssignee not found: " + id));
    }
}
