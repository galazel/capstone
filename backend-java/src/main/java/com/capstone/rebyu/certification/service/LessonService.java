package com.capstone.rebyu.certification.service;

import com.capstone.rebyu.certification.dto.LessonComponentResponseDto;
import com.capstone.rebyu.certification.dto.LessonDto;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.mapper.LessonMapper;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.certification.repository.MiddleCategoryRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * Lesson has no owner column of its own -- like MiddleCategory, it inherits
 * ownership by walking up to its MiddleCategory's parent MajorCategory, and
 * every write (including the lesson body/component editing methods, which
 * are how an Enterprise Member actually authors their own lesson content) is
 * authorized through MajorCategoryService.requireCanActOn.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class LessonService {

    private final LessonRepository lessonRepository;
    private final LessonMapper lessonMapper;
    private final MiddleCategoryRepository middleCategoryRepository;
    private final LessonImageService lessonImageService;
    private final LessonVideoService lessonVideoService;
    private final MajorCategoryService majorCategoryService;

    public List<LessonDto> getAll() {
        return lessonRepository.findAll()
                .stream()
                .map(lessonMapper::toDto)
                .toList();
    }

    public List<LessonDto> getByMiddleCategoryId(Long middleCategoryId) {
        return lessonRepository
                .findByMiddleCategory_MiddleCategoryId(middleCategoryId)
                .stream()
                .map(lessonMapper::toDto)
                .toList();
    }

    public LessonDto getById(Long id) {
        return lessonMapper.toDto(findEntity(id));
    }

    public LessonDto create(
            LessonDto dto, boolean isAdmin, Long callerEnterpriseId, Long callerUserId, boolean callerIsOwner) {
        MiddleCategory middleCategory = findMiddleCategory(dto.getMiddleCategoryId());
        majorCategoryService.requireCanActOn(
                middleCategory.getMajorCategory().getOwnerGroup(), isAdmin, callerEnterpriseId, callerUserId, callerIsOwner);

        Lesson entity = lessonMapper.toEntity(dto);
        entity.setLessonId(null);
        entity.setMiddleCategory(middleCategory);
        // lesson_component_structure is NOT NULL; the create form only sends
        // a name, so default the (empty) body here just like saveLessonComponent.
        entity.setLessonComponentStructure(normalizeStructure(entity.getLessonComponentStructure()));

        return lessonMapper.toDto(lessonRepository.save(entity));
    }

    public LessonDto update(
            Long id, LessonDto dto, boolean isAdmin, Long callerEnterpriseId, Long callerUserId, boolean callerIsOwner) {
        Lesson existing = findEntity(id);
        majorCategoryService.requireCanActOn(
                existing.getMiddleCategory().getMajorCategory().getOwnerGroup(),
                isAdmin, callerEnterpriseId, callerUserId, callerIsOwner);

        MiddleCategory targetMiddleCategory = findMiddleCategory(dto.getMiddleCategoryId());
        if (!Objects.equals(ownerGroupId(existing.getMiddleCategory()), ownerGroupId(targetMiddleCategory))) {
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "This lesson can't be moved to a module owned by someone else.");
        }

        Lesson entity = lessonMapper.toEntity(dto);
        entity.setLessonId(id);
        entity.setMiddleCategory(targetMiddleCategory);
        // Never wipe an existing body to NULL when the edit form omits it --
        // fall back to the existing structure, then to an empty document.
        String structure = entity.getLessonComponentStructure();
        entity.setLessonComponentStructure(normalizeStructure(
                structure != null ? structure : existing.getLessonComponentStructure()));

        return lessonMapper.toDto(lessonRepository.save(entity));
    }

    public void delete(Long id, boolean isAdmin, Long callerEnterpriseId, Long callerUserId, boolean callerIsOwner) {
        Lesson existing = findEntity(id);
        majorCategoryService.requireCanActOn(
                existing.getMiddleCategory().getMajorCategory().getOwnerGroup(),
                isAdmin, callerEnterpriseId, callerUserId, callerIsOwner);
        lessonRepository.delete(existing);
    }

    public void saveLessonComponent(
            Long id, LessonDto lessonDto,
            boolean isAdmin, Long callerEnterpriseId, Long callerUserId, boolean callerIsOwner) {
        Lesson lesson = findEntity(id);
        majorCategoryService.requireCanActOn(
                lesson.getMiddleCategory().getMajorCategory().getOwnerGroup(),
                isAdmin, callerEnterpriseId, callerUserId, callerIsOwner);

        String structure = lessonDto.getLessonComponentStructure();

        lesson.setLessonComponentStructure(
                structure == null || structure.isBlank()
                        ? "[]"
                        : structure
        );

        lessonRepository.save(lesson);
    }

    @Transactional(readOnly = true)
    public LessonComponentResponseDto getLessonComponent(Long id) {
        Lesson lesson = findEntity(id);

        String structure = lesson.getLessonComponentStructure();

        if (structure == null || structure.isBlank()) {
            structure = "[]";
        }

        return new LessonComponentResponseDto(
                structure,
                lessonImageService.getImageKeysByLessonId(id),
                lessonVideoService.getVideoKeysByLessonId(id)
        );
    }

    /** An empty JSON document ("[]") for a null/blank lesson body. */
    private String normalizeStructure(String structure) {
        return structure == null || structure.isBlank() ? "[]" : structure;
    }

    private Long ownerGroupId(MiddleCategory middleCategory) {
        return middleCategory.getMajorCategory().getOwnerGroup() != null
                ? middleCategory.getMajorCategory().getOwnerGroup().getEnterpriseGroupId() : null;
    }

    private MiddleCategory findMiddleCategory(Long middleCategoryId) {
        return middleCategoryRepository
                .findById(middleCategoryId)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "MiddleCategory not found: "
                                        + middleCategoryId
                        )
                );
    }

    private Lesson findEntity(Long id) {
        return lessonRepository.findById(id)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "Lesson not found: " + id
                        )
                );
    }
}
