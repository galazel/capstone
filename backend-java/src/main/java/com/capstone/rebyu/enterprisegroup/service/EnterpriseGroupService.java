package com.capstone.rebyu.enterprisegroup.service;

import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAuthority;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupAuthorityRepository;
import com.capstone.rebyu.enterprisegroup.mapper.EnterpriseGroupMapper;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
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
public class EnterpriseGroupService {

    private final EnterpriseGroupRepository enterpriseGroupRepository;
    private final EnterpriseGroupAuthorityRepository enterpriseGroupAuthorityRepository;
    private final OrganizationCertificateRepository organizationCertificateRepository;
    private final EnterpriseGroupMapper enterpriseGroupMapper;

    // enterpriseId is always the JWT-derived caller (never client-supplied and
    // never optional here) so this can never fall through to a global fetch.
    // orgCertId, when given, narrows further -- but only within that same
    // enterprise, so a caller can't read another tenant's groups by guessing
    // an orgCertId that belongs to a different enterprise.
    @Transactional(readOnly = true)
    public List<EnterpriseGroupDto> getAll(Long enterpriseId, Long orgCertId) {
        List<EnterpriseGroup> groups = enterpriseGroupRepository.findByEnterprise_EnterpriseId(enterpriseId);
        if (orgCertId != null) {
            groups = groups.stream()
                    .filter(g -> g.getOrgCert() != null && orgCertId.equals(g.getOrgCert().getOrgCertId()))
                    .toList();
        }
        return groups.stream().map(enterpriseGroupMapper::toDto).toList();
    }

    /**
     * Owners may see every group in their institution. Other Enterprise Members
     * receive only the groups for which they are an active authority.
     */
    @Transactional(readOnly = true)
    public List<EnterpriseGroupDto> getAccessible(
            Long enterpriseId, Long userId, boolean owner, Long orgCertId) {
        List<EnterpriseGroup> groups = owner
                ? enterpriseGroupRepository.findByEnterprise_EnterpriseId(enterpriseId)
                : enterpriseGroupRepository.findActiveAuthorizedGroups(
                        enterpriseId,
                        userId,
                        EnterpriseGroup.Status.active,
                        EnterpriseGroupAuthority.Status.active);
        return groups.stream()
                .filter(group -> orgCertId == null || Objects.equals(group.getOrgCert().getOrgCertId(), orgCertId))
                .map(enterpriseGroupMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public EnterpriseGroupDto getAccessibleById(Long id, Long enterpriseId, Long userId, boolean owner) {
        EnterpriseGroup entity = findEntity(id);
        requireSameEnterprise(entity, enterpriseId);
        boolean hasAccess = owner || enterpriseGroupAuthorityRepository.existsByEnterpriseGroupAndUserAndStatus(
                entity,
                com.capstone.rebyu.user.entity.User.builder().userId(userId).build(),
                EnterpriseGroupAuthority.Status.active);
        if (!hasAccess) {
            throw new EntityNotFoundException("EnterpriseGroup not found: " + id);
        }
        return enterpriseGroupMapper.toDto(entity);
    }

    @Transactional(readOnly = true)
    public EnterpriseGroupDto getById(Long id, Long callerEnterpriseId) {
        EnterpriseGroup entity = findEntity(id);
        requireSameEnterprise(entity, callerEnterpriseId);
        return enterpriseGroupMapper.toDto(entity);
    }

    public EnterpriseGroupDto create(EnterpriseGroupDto dto) {
        log.info("Creating enterprise group '{}' for orgCertId={}", dto.getGroupName(), dto.getOrgCertId());

        OrganizationCertificate orgCert = organizationCertificateRepository.findById(dto.getOrgCertId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "OrganizationCertificate not found: " + dto.getOrgCertId()));

        // The org cert allocation referenced by the group must belong to the
        // SAME enterprise the caller was resolved to -- otherwise a caller
        // could create a group under an allocation owned by another tenant.
        Long orgCertEnterpriseId = orgCert.getEnterprise() != null
                ? orgCert.getEnterprise().getEnterpriseId() : null;
        if (!Objects.equals(dto.getEnterpriseId(), orgCertEnterpriseId)) {
            throw new EntityNotFoundException("OrganizationCertificate not found: " + dto.getOrgCertId());
        }

        // A single group can't be handed more slots than the certification
        // allocation itself has -- a real (if generous) sanity bound. It does
        // NOT sum across sibling groups; that would require re-validating every
        // other group whenever one changes.
        if (dto.getTotalSlots() > orgCert.getTotalSlots()) {
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "This group can have at most " + orgCert.getTotalSlots()
                            + " slot(s) -- the certification's own allocation limit.");
        }

        EnterpriseGroup entity = enterpriseGroupMapper.toEntity(dto);
        entity.setEnterpriseGroupId(null);
        // The mapper builds DETACHED stubs for the orgCert/enterprise FKs (id
        // set, @Version null). Persisting the group against those stubs throws
        // "uninitialized version value 'null'". Attach the managed orgCert we
        // already loaded (and its managed enterprise) instead.
        entity.setOrgCert(orgCert);
        entity.setEnterprise(orgCert.getEnterprise());
        entity.setCreatedAt(dto.getCreatedAt() != null ? dto.getCreatedAt() : LocalDateTime.now());
        entity.setStatus(dto.getStatus() != null ? dto.getStatus() : EnterpriseGroup.Status.active);
        entity.setUsedSlots(0);
        EnterpriseGroupDto result = enterpriseGroupMapper.toDto(enterpriseGroupRepository.save(entity));
        log.info("Enterprise group created with id: {}", result.getEnterpriseGroupId());
        return result;
    }

    public EnterpriseGroupDto update(Long id, EnterpriseGroupDto dto, Long callerEnterpriseId) {
        log.info("Updating enterprise group id: {}", id);
        // Mutate editable fields only; createdBy/createdAt/enterprise/orgCert/
        // usedSlots are immutable here -- usedSlots only changes via invitations.
        EnterpriseGroup entity = findEntity(id);
        requireSameEnterprise(entity, callerEnterpriseId);
        entity.setGroupName(dto.getGroupName());
        entity.setGroupDescription(dto.getGroupDescription());
        if (dto.getTotalSlots() != null) {
            if (dto.getTotalSlots() < entity.getUsedSlots()) {
                throw new BusinessRuleException.EnterpriseGroupRuleException(
                        "This group already has " + entity.getUsedSlots()
                                + " slot(s) in use -- lower the limit no further than that.");
            }
            OrganizationCertificate orgCert = entity.getOrgCert();
            if (orgCert != null && dto.getTotalSlots() > orgCert.getTotalSlots()) {
                throw new BusinessRuleException.EnterpriseGroupRuleException(
                        "This group can have at most " + orgCert.getTotalSlots()
                                + " slot(s) -- the certification's own allocation limit.");
            }
            entity.setTotalSlots(dto.getTotalSlots());
        }
        if (dto.getStatus() != null) {
            entity.setStatus(dto.getStatus());
        }
        return enterpriseGroupMapper.toDto(enterpriseGroupRepository.save(entity));
    }

    public void delete(Long id, Long callerEnterpriseId) {
        log.info("Archiving enterprise group id: {}", id);
        EnterpriseGroup entity = findEntity(id);
        requireSameEnterprise(entity, callerEnterpriseId);
        entity.setStatus(EnterpriseGroup.Status.archived);
        enterpriseGroupRepository.save(entity);
    }

    private void requireSameEnterprise(EnterpriseGroup entity, Long callerEnterpriseId) {
        Long ownerEnterpriseId = entity.getEnterprise() != null
                ? entity.getEnterprise().getEnterpriseId() : null;
        if (!Objects.equals(ownerEnterpriseId, callerEnterpriseId)) {
            throw new EntityNotFoundException("EnterpriseGroup not found: " + entity.getEnterpriseGroupId());
        }
    }

    private EnterpriseGroup findEntity(Long id) {
        return enterpriseGroupRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("EnterpriseGroup not found: " + id));
    }
}
