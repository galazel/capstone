package com.capstone.rebyu.certification.service;


import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.dto.MajorCategoryDto;
import com.capstone.rebyu.certification.mapper.MajorCategoryMapper;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.repository.MajorCategoryRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.institutiongroup.service.InstitutionGroupService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * MajorCategory is the ROOT of the ownership chain: {@code ownerGroup} is
 * null for official, platform-wide content (admin-authored, unchanged
 * behavior) or set to one InstitutionGroup for Institution-Member-authored
 * content. MiddleCategory/Lesson don't carry their own owner column -- they
 * inherit it by walking up to their MajorCategory (see MiddleCategoryService/
 * LessonService), so ownership only ever needs to be decided in one place.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class MajorCategoryService {
    private final MajorCategoryRepository majorCategoryRepository;
    private final MajorCategoryMapper majorCategoryMapper;
    private final InstitutionGroupRepository institutionGroupRepository;
    private final InstitutionGroupService institutionGroupService;

    public List<MajorCategoryDto> getAll() {
        log.debug("Fetching all major categories");
        return majorCategoryRepository.findAll().stream().map(majorCategoryMapper::toDto).toList();
    }

    public MajorCategoryDto getById(Long id) {
        log.debug("Fetching major category id: {}", id);
        return majorCategoryMapper.toDto(findEntity(id));
    }

    /**
     * @param isAdmin            an admin creates official content; ownerGroupId
     *                           must be null in that case.
     * @param callerInstitutionId ignored when isAdmin.
     * @param callerUserId       ignored when isAdmin.
     * @param callerIsOwner      whether the caller is the institution owner
     *                           (ignored when isAdmin).
     * @param ownerGroupId       required when !isAdmin -- the group this content
     *                           belongs to. The caller must be that group's
     *                           active leader or the institution owner, and the
     *                           group's own certification allocation must match
     *                           dto.certificationId -- an Institution Member can
     *                           only add content to the certification their
     *                           group is actually under, never an unrelated one.
     */
    public MajorCategoryDto create(
            MajorCategoryDto dto, boolean isAdmin,
            Long callerInstitutionId, Long callerUserId, boolean callerIsOwner, Long ownerGroupId) {
        log.info("Creating new major category (ownerGroupId={})", ownerGroupId);
        MajorCategory entity = majorCategoryMapper.toEntity(dto);
        entity.setMajorCategoryId(null);
        entity.setOwnerGroup(resolveAndAuthorizeOwnerGroup(
                isAdmin, callerInstitutionId, callerUserId, callerIsOwner, ownerGroupId, dto.getCertificationId()));
        MajorCategoryDto result = majorCategoryMapper.toDto(majorCategoryRepository.save(entity));
        log.info("MajorCategory created with id: {}", result.getMajorCategoryId());
        return result;
    }

    public MajorCategoryDto update(
            Long id, MajorCategoryDto dto,
            boolean isAdmin, Long callerInstitutionId, Long callerUserId, boolean callerIsOwner) {
        log.info("Updating major category id: {}", id);
        MajorCategory existing = findEntity(id);
        requireCanActOn(existing.getOwnerGroup(), isAdmin, callerInstitutionId, callerUserId, callerIsOwner);
        MajorCategory entity = majorCategoryMapper.toEntity(dto);
        entity.setMajorCategoryId(id);
        entity.setOwnerGroup(existing.getOwnerGroup());
        MajorCategoryDto result = majorCategoryMapper.toDto(majorCategoryRepository.save(entity));
        log.info("MajorCategory id: {} updated", id);
        return result;
    }

    public void delete(Long id, boolean isAdmin, Long callerInstitutionId, Long callerUserId, boolean callerIsOwner) {
        log.info("Deleting major category id: {}", id);
        MajorCategory existing = findEntity(id);
        requireCanActOn(existing.getOwnerGroup(), isAdmin, callerInstitutionId, callerUserId, callerIsOwner);
        majorCategoryRepository.delete(existing);
        log.info("MajorCategory id: {} deleted", id);
    }

    /**
     * Resolves the managed InstitutionGroup for a NEW major category and checks
     * the caller may actually create content under it. Public so
     * MiddleCategoryService/LessonService (same package) and ExamService
     * (assessment package -- an Exam's ownership follows the identical rule)
     * can reuse the exact same check instead of re-implementing it.
     */
    public InstitutionGroup resolveAndAuthorizeOwnerGroup(
            boolean isAdmin, Long callerInstitutionId, Long callerUserId, boolean callerIsOwner,
            Long ownerGroupId, Long targetCertificationId) {
        if (ownerGroupId == null) {
            if (!isAdmin) {
                throw new IllegalArgumentException(
                        "Only an admin may create official (platform-wide) content.");
            }
            return null;
        }
        // Reuses the exact tenant + owner-or-active-leader check
        // InstitutionGroupController already relies on -- throws EntityNotFoundException
        // if the group belongs to a different institution, or the caller can't act on it.
        institutionGroupService.getAccessibleById(ownerGroupId, callerInstitutionId, callerUserId, callerIsOwner);

        InstitutionGroup group = institutionGroupRepository.findById(ownerGroupId)
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + ownerGroupId));
        Long groupCertificationId = group.getOrgCert() != null && group.getOrgCert().getCertification() != null
                ? group.getOrgCert().getCertification().getCertificationId() : null;
        if (!Objects.equals(groupCertificationId, targetCertificationId)) {
            throw new BusinessRuleException.InstitutionGroupRuleException(
                    "This group's certification does not match the certification you're adding content to.");
        }
        return group;
    }

    /** Same rule as {@link #resolveAndAuthorizeOwnerGroup}, for editing/deleting existing content. */
    public void requireCanActOn(
            InstitutionGroup ownerGroup, boolean isAdmin,
            Long callerInstitutionId, Long callerUserId, boolean callerIsOwner) {
        if (ownerGroup == null) {
            if (!isAdmin) {
                throw new IllegalArgumentException("Only an admin may modify official (platform-wide) content.");
            }
            return;
        }
        if (isAdmin) {
            return;
        }
        institutionGroupService.getAccessibleById(
                ownerGroup.getInstitutionGroupId(), callerInstitutionId, callerUserId, callerIsOwner);
    }

    private MajorCategory findEntity(Long id) {
        return majorCategoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("MajorCategory not found: " + id));
    }
}
