package com.capstone.rebyu.assessment.mapper;



import com.capstone.rebyu.assessment.dto.ExamDto;
import com.capstone.rebyu.assessment.entity.Exam;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring")
public interface ExamMapper {
    @Mapping(source = "certification.certificationId", target = "certificationId")
    @Mapping(source = "examType.examTypeId", target = "examTypeId")
    @Mapping(source = "lesson.lessonId", target = "lessonId")
    @Mapping(source = "middleCategory.middleCategoryId", target = "middleCategoryId")
    @Mapping(source = "majorCategory.majorCategoryId", target = "majorCategoryId")
    @Mapping(source = "entity", target = "status", qualifiedByName = "effectiveStatus")
    @Mapping(source = "ownerGroup.enterpriseGroupId", target = "ownerGroupId")
    ExamDto toDto(Exam entity);

    @Mapping(source = "certificationId", target = "certification.certificationId")
    @Mapping(source = "examTypeId", target = "examType.examTypeId")
    @Mapping(source = "lessonId", target = "lesson", qualifiedByName = "lessonFromId")
    @Mapping(source = "middleCategoryId", target = "middleCategory", qualifiedByName = "middleCategoryFromId")
    @Mapping(source = "majorCategoryId", target = "majorCategory", qualifiedByName = "majorCategoryFromId")
    @Mapping(source = "status", target = "status", qualifiedByName = "statusFromString")
    @Mapping(target = "ownerGroup", ignore = true)
    Exam toEntity(ExamDto dto);

    @Named("effectiveStatus")
    default String effectiveStatus(Exam entity) {
        return entity.effectiveStatus().name();
    }

    @Named("statusFromString")
    default Exam.Status statusFromString(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return Exam.Status.valueOf(status.trim().toUpperCase());
    }

    @Named("lessonFromId")
    default com.capstone.rebyu.certification.entity.Lesson lessonFromId(Long lessonId) {
        if (lessonId == null) {
            return null;
        }
        com.capstone.rebyu.certification.entity.Lesson lesson =
                new com.capstone.rebyu.certification.entity.Lesson();
        lesson.setLessonId(lessonId);
        return lesson;
    }

    @Named("middleCategoryFromId")
    default com.capstone.rebyu.certification.entity.MiddleCategory middleCategoryFromId(Long middleCategoryId) {
        if (middleCategoryId == null) {
            return null;
        }
        com.capstone.rebyu.certification.entity.MiddleCategory middleCategory =
                new com.capstone.rebyu.certification.entity.MiddleCategory();
        middleCategory.setMiddleCategoryId(middleCategoryId);
        return middleCategory;
    }

    @Named("majorCategoryFromId")
    default com.capstone.rebyu.certification.entity.MajorCategory majorCategoryFromId(Long majorCategoryId) {
        if (majorCategoryId == null) {
            return null;
        }
        com.capstone.rebyu.certification.entity.MajorCategory majorCategory =
                new com.capstone.rebyu.certification.entity.MajorCategory();
        majorCategory.setMajorCategoryId(majorCategoryId);
        return majorCategory;
    }
}
