package com.capstone.rebyu.certification.service;


import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.dto.MiddleCategoryDto;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.mapper.MiddleCategoryMapper;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.repository.MajorCategoryRepository;
import com.capstone.rebyu.certification.repository.MiddleCategoryRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * MiddleCategory has no owner column of its own -- it inherits ownership from
 * its parent MajorCategory (see MajorCategoryService's javadoc), so every
 * write here is authorized against that parent via
 * MajorCategoryService.requireCanActOn -- the exact same rule used for
 * MajorCategory itself, reused rather than re-implemented.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class MiddleCategoryService {
    private final MiddleCategoryRepository middleCategoryRepository;
    private final MiddleCategoryMapper middleCategoryMapper;
    private final MajorCategoryRepository majorCategoryRepository;
    private final MajorCategoryService majorCategoryService;

    public List<MiddleCategoryDto> getAll() {
        log.debug("Fetching all middle categories");
        return middleCategoryRepository.findAll().stream().map(middleCategoryMapper::toDto).toList();
    }

    public MiddleCategoryDto getById(Long id) {
        log.debug("Fetching middle category id: {}", id);
        return middleCategoryMapper.toDto(findEntity(id));
    }

    public MiddleCategoryDto create(
            MiddleCategoryDto dto, boolean isAdmin, Long callerInstitutionId, Long callerUserId, boolean callerIsOwner) {
        log.info("Creating new middle category under majorCategoryId={}", dto.getMajorCategoryId());
        MajorCategory parent = findParent(dto.getMajorCategoryId());
        majorCategoryService.requireCanActOn(parent.getOwnerGroup(), isAdmin, callerInstitutionId, callerUserId, callerIsOwner);

        MiddleCategory entity = middleCategoryMapper.toEntity(dto);
        entity.setMiddleCategoryId(null);
        entity.setMajorCategory(parent);
        MiddleCategoryDto result = middleCategoryMapper.toDto(middleCategoryRepository.save(entity));
        log.info("MiddleCategory created with id: {}", result.getMiddleCategoryId());
        return result;
    }

    public MiddleCategoryDto update(
            Long id, MiddleCategoryDto dto,
            boolean isAdmin, Long callerInstitutionId, Long callerUserId, boolean callerIsOwner) {
        log.info("Updating middle category id: {}", id);
        MiddleCategory existing = findEntity(id);
        majorCategoryService.requireCanActOn(
                existing.getMajorCategory().getOwnerGroup(), isAdmin, callerInstitutionId, callerUserId, callerIsOwner);

        // A middle category can't be moved to a major category with a
        // DIFFERENT owner -- that would silently change who owns it.
        MajorCategory targetParent = findParent(dto.getMajorCategoryId());
        if (!Objects.equals(ownerGroupId(existing.getMajorCategory()), ownerGroupId(targetParent))) {
            throw new BusinessRuleException.InstitutionGroupRuleException(
                    "This content can't be moved to a major category owned by someone else.");
        }

        MiddleCategory entity = middleCategoryMapper.toEntity(dto);
        entity.setMiddleCategoryId(id);
        entity.setMajorCategory(targetParent);
        MiddleCategoryDto result = middleCategoryMapper.toDto(middleCategoryRepository.save(entity));
        log.info("MiddleCategory id: {} updated", id);
        return result;
    }

    public void delete(Long id, boolean isAdmin, Long callerInstitutionId, Long callerUserId, boolean callerIsOwner) {
        log.info("Deleting middle category id: {}", id);
        MiddleCategory existing = findEntity(id);
        majorCategoryService.requireCanActOn(
                existing.getMajorCategory().getOwnerGroup(), isAdmin, callerInstitutionId, callerUserId, callerIsOwner);
        middleCategoryRepository.delete(existing);
        log.info("MiddleCategory id: {} deleted", id);
    }

    private Long ownerGroupId(MajorCategory major) {
        return major.getOwnerGroup() != null ? major.getOwnerGroup().getInstitutionGroupId() : null;
    }

    private MajorCategory findParent(Long majorCategoryId) {
        return majorCategoryRepository.findById(majorCategoryId)
                .orElseThrow(() -> new EntityNotFoundException("MajorCategory not found: " + majorCategoryId));
    }

    private MiddleCategory findEntity(Long id) {
        return middleCategoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("MiddleCategory not found: " + id));
    }
}
