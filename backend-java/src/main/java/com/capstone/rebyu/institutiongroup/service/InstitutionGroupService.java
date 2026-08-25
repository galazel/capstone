package com.capstone.rebyu.institutiongroup.service;

import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAuthorityRepository;
import com.capstone.rebyu.institutiongroup.mapper.InstitutionGroupMapper;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
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
public class InstitutionGroupService {

    private final InstitutionGroupRepository institutionGroupRepository;
    private final InstitutionGroupAuthorityRepository institutionGroupAuthorityRepository;
    private final OrganizationCertificateRepository organizationCertificateRepository;
    private final InstitutionGroupMapper institutionGroupMapper;

    // institutionId is always the JWT-derived caller (never client-supplied and
    // never optional here) so this can never fall through to a global fetch.
    // orgCertId, when given, narrows further -- but only within that same
    // institution, so a caller can't read another tenant's groups by guessing
    // an orgCertId that belongs to a different institution.
    @Transactional(readOnly = true)
    public List<InstitutionGroupDto> getAll(Long institutionId, Long orgCertId) {
        List<InstitutionGroup> groups = institutionGroupRepository.findByInstitution_InstitutionId(institutionId);
        if (orgCertId != null) {
            groups = groups.stream()
                    .filter(g -> g.getOrgCert() != null && orgCertId.equals(g.getOrgCert().getOrgCertId()))
                    .toList();
        }
        return groups.stream().map(institutionGroupMapper::toDto).toList();
    }

    /**
     * Owners may see every group in their institution. Other Institution Members
     * receive only the groups for which they are an active authority.
     */
    @Transactional(readOnly = true)
    public List<InstitutionGroupDto> getAccessible(
            Long institutionId, Long userId, boolean owner, Long orgCertId) {
        List<InstitutionGroup> groups = owner
                ? institutionGroupRepository.findByInstitution_InstitutionId(institutionId)
                : institutionGroupRepository.findActiveAuthorizedGroups(
                        institutionId,
                        userId,
                        InstitutionGroup.Status.active,
                        InstitutionGroupAuthority.Status.active);
        return groups.stream()
                .filter(group -> orgCertId == null || Objects.equals(group.getOrgCert().getOrgCertId(), orgCertId))
                .map(institutionGroupMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public InstitutionGroupDto getAccessibleById(Long id, Long institutionId, Long userId, boolean owner) {
        InstitutionGroup entity = findEntity(id);
        requireSameInstitution(entity, institutionId);
        boolean hasAccess = owner || institutionGroupAuthorityRepository.existsByInstitutionGroupAndUserAndStatus(
                entity,
                com.capstone.rebyu.user.entity.User.builder().userId(userId).build(),
                InstitutionGroupAuthority.Status.active);
        if (!hasAccess) {
            throw new EntityNotFoundException("InstitutionGroup not found: " + id);
        }
        return institutionGroupMapper.toDto(entity);
    }

    @Transactional(readOnly = true)
    public InstitutionGroupDto getById(Long id, Long callerInstitutionId) {
        InstitutionGroup entity = findEntity(id);
        requireSameInstitution(entity, callerInstitutionId);
        return institutionGroupMapper.toDto(entity);
    }

    public InstitutionGroupDto create(InstitutionGroupDto dto) {
        log.info("Creating institution group '{}' for orgCertId={}", dto.getGroupName(), dto.getOrgCertId());

        OrganizationCertificate orgCert = organizationCertificateRepository.findById(dto.getOrgCertId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "OrganizationCertificate not found: " + dto.getOrgCertId()));

        // The org cert allocation referenced by the group must belong to the
        // SAME institution the caller was resolved to -- otherwise a caller
        // could create a group under an allocation owned by another tenant.
        Long orgCertInstitutionId = orgCert.getInstitution() != null
                ? orgCert.getInstitution().getInstitutionId() : null;
        if (!Objects.equals(dto.getInstitutionId(), orgCertInstitutionId)) {
            throw new EntityNotFoundException("OrganizationCertificate not found: " + dto.getOrgCertId());
        }

        // A single group can't be handed more slots than the certification
        // allocation itself has -- a real (if generous) sanity bound. It does
        // NOT sum across sibling groups; that would require re-validating every
        // other group whenever one changes.
        if (dto.getTotalSlots() > orgCert.getTotalSlots()) {
            throw new BusinessRuleException.InstitutionGroupRuleException(
                    "This group can have at most " + orgCert.getTotalSlots()
                            + " slot(s) -- the certification's own allocation limit.");
        }

        InstitutionGroup entity = institutionGroupMapper.toEntity(dto);
        entity.setInstitutionGroupId(null);
        // The mapper builds DETACHED stubs for the orgCert/institution FKs (id
        // set, @Version null). Persisting the group against those stubs throws
        // "uninitialized version value 'null'". Attach the managed orgCert we
        // already loaded (and its managed institution) instead.
        entity.setOrgCert(orgCert);
        entity.setInstitution(orgCert.getInstitution());
        entity.setCreatedAt(dto.getCreatedAt() != null ? dto.getCreatedAt() : LocalDateTime.now());
        entity.setStatus(dto.getStatus() != null ? dto.getStatus() : InstitutionGroup.Status.active);
        entity.setUsedSlots(0);
        InstitutionGroupDto result = institutionGroupMapper.toDto(institutionGroupRepository.save(entity));
        log.info("Institution group created with id: {}", result.getInstitutionGroupId());
        return result;
    }

    public InstitutionGroupDto update(Long id, InstitutionGroupDto dto, Long callerInstitutionId) {
        log.info("Updating institution group id: {}", id);
        // Mutate editable fields only; createdBy/createdAt/institution/orgCert/
        // usedSlots are immutable here -- usedSlots only changes via invitations.
        InstitutionGroup entity = findEntity(id);
        requireSameInstitution(entity, callerInstitutionId);
        entity.setGroupName(dto.getGroupName());
        entity.setGroupDescription(dto.getGroupDescription());
        if (dto.getTotalSlots() != null) {
            if (dto.getTotalSlots() < entity.getUsedSlots()) {
                throw new BusinessRuleException.InstitutionGroupRuleException(
                        "This group already has " + entity.getUsedSlots()
                                + " slot(s) in use -- lower the limit no further than that.");
            }
            OrganizationCertificate orgCert = entity.getOrgCert();
            if (orgCert != null && dto.getTotalSlots() > orgCert.getTotalSlots()) {
                throw new BusinessRuleException.InstitutionGroupRuleException(
                        "This group can have at most " + orgCert.getTotalSlots()
                                + " slot(s) -- the certification's own allocation limit.");
            }
            entity.setTotalSlots(dto.getTotalSlots());
        }
        if (dto.getStatus() != null) {
            entity.setStatus(dto.getStatus());
        }
        return institutionGroupMapper.toDto(institutionGroupRepository.save(entity));
    }

    public void delete(Long id, Long callerInstitutionId) {
        log.info("Archiving institution group id: {}", id);
        InstitutionGroup entity = findEntity(id);
        requireSameInstitution(entity, callerInstitutionId);
        entity.setStatus(InstitutionGroup.Status.archived);
        institutionGroupRepository.save(entity);
    }

    private void requireSameInstitution(InstitutionGroup entity, Long callerInstitutionId) {
        Long ownerInstitutionId = entity.getInstitution() != null
                ? entity.getInstitution().getInstitutionId() : null;
        if (!Objects.equals(ownerInstitutionId, callerInstitutionId)) {
            throw new EntityNotFoundException("InstitutionGroup not found: " + entity.getInstitutionGroupId());
        }
    }

    private InstitutionGroup findEntity(Long id) {
        return institutionGroupRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionGroup not found: " + id));
    }
}
