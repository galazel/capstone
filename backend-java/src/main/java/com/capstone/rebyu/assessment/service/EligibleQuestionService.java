package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.assessment.dto.EligibleQuestionDto;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves the questions eligible for an assessment from its curriculum scope
 * (lesson / middle / major / certification), excluding those already assigned
 * to the given exam. Scope is derived server-side from the most specific id
 * provided — arbitrary frontend lesson lists are never trusted.
 */
@Service
@RequiredArgsConstructor
public class EligibleQuestionService {

    private final QuestionRepository questionRepository;
    private final ExamQuestionRepository examQuestionRepository;

    /**
     * @param includeGroupId omitted -> official questions only (unchanged
     *                       behavior); passed -> that group's own questions are
     *                       offered too. Another group's questions are never
     *                       eligible. The caller's access to the group is
     *                       checked in the controller.
     */
    @Transactional(readOnly = true)
    public List<EligibleQuestionDto> getEligible(
            Long certificationId, Long majorId, Long middleId, Long lessonId, Long examId,
            Long includeGroupId) {

        List<Question> scoped = resolveScope(certificationId, majorId, middleId, lessonId);

        Set<Long> assigned = examId == null
                ? Set.of()
                : examQuestionRepository.findByExam_ExamIdOrderByDisplayOrderAsc(examId).stream()
                        .map(examQuestion -> examQuestion.getQuestion().getQuestionId())
                        .collect(Collectors.toSet());

        return scoped.stream()
                .filter(question -> !assigned.contains(question.getQuestionId()))
                .filter(question -> question.getOwnerGroup() == null
                        || question.getOwnerGroup().getEnterpriseGroupId().equals(includeGroupId))
                .map(this::toDto)
                .toList();
    }

    private List<Question> resolveScope(Long certificationId, Long majorId, Long middleId, Long lessonId) {
        if (lessonId != null) {
            return questionRepository
                    .findByParentQuestionIsNullAndLesson_LessonIdOrderByQuestionIdAsc(lessonId);
        }
        if (middleId != null) {
            return questionRepository
                    .findByParentQuestionIsNullAndLesson_MiddleCategory_MiddleCategoryIdOrderByQuestionIdAsc(middleId);
        }
        if (majorId != null) {
            return questionRepository
                    .findByParentQuestionIsNullAndLesson_MiddleCategory_MajorCategory_MajorCategoryIdOrderByQuestionIdAsc(majorId);
        }
        if (certificationId != null) {
            return questionRepository
                    .findByParentQuestionIsNullAndLesson_MiddleCategory_MajorCategory_Certification_CertificationIdOrderByQuestionIdAsc(certificationId);
        }
        throw new IllegalArgumentException(
                "Provide a certificationId, majorId, middleId, or lessonId to resolve eligible questions.");
    }

    private EligibleQuestionDto toDto(Question question) {
        Lesson lesson = question.getLesson();
        MiddleCategory middle = lesson != null ? lesson.getMiddleCategory() : null;
        MajorCategory major = middle != null ? middle.getMajorCategory() : null;
        return new EligibleQuestionDto(
                question.getQuestionId(),
                question.getQuestionType(),
                question.getDifficultyLevel(),
                question.getQuestionText(),
                lesson != null ? lesson.getLessonId() : null,
                lesson != null ? lesson.getName() : null,
                middle != null ? middle.getTitle() : null,
                major != null ? major.getTitle() : null,
                question.getTotalPoints());
    }
}
