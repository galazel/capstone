package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.assessment.dto.QuestionDto;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.mapper.QuestionMapper;
import com.capstone.rebyu.assessment.repository.ChoiceRepository;
import com.capstone.rebyu.assessment.repository.DiagramQuestionConfigRepository;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.LearnerExamDetailRepository;
import com.capstone.rebyu.assessment.repository.ProgrammingQuestionConfigRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.assessment.repository.TextQuestionConfigRepository;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class QuestionService {
    private final QuestionRepository questionRepository;
    private final LessonRepository lessonRepository;
    private final ChoiceRepository choiceRepository;
    private final TextQuestionConfigRepository textQuestionConfigRepository;
    private final ProgrammingQuestionConfigRepository programmingQuestionConfigRepository;
    private final DiagramQuestionConfigRepository diagramQuestionConfigRepository;
    private final ExamQuestionRepository examQuestionRepository;
    private final LearnerExamDetailRepository learnerExamDetailRepository;
    private final QuestionMapper questionMapper;
    private final OrganizationCertificateRepository organizationCertificateRepository;

    public List<QuestionDto> getAll() {
        log.debug("Fetching all questions");
        return questionRepository.findAll().stream().map(questionMapper::toDto).toList();
    }

    public List<QuestionDto> getByLessonId(Long lessonId) {
        log.debug("Fetching questions for lesson id: {}", lessonId);
        return questionRepository.findByLesson_LessonId(lessonId).stream().map(questionMapper::toDto).toList();
    }

    public QuestionDto getById(Long id) {
        log.debug("Fetching question id: {}", id);
        return questionMapper.toDto(findEntity(id));
    }

    /**
     * @param creatorUserId        the authenticated caller who authored this question.
     * @param restrictToEnterpriseId non-null for an ENTERPRISE caller (owner or group
     *                             leader): the question's lesson must belong to a
     *                             certification this organization has purchased
     *                             access to. Null for an ADMIN caller (no restriction).
     */
    public QuestionDto create(QuestionDto dto, Long creatorUserId, Long restrictToEnterpriseId) {
        log.info("Creating new question");
        validateLesson(dto, restrictToEnterpriseId);
        if (dto.getParentQuestionId() == null && dto.getQuestionText() != null) {
            if (questionRepository.findDuplicate(dto.getLessonId(), dto.getQuestionText(), dto.getQuestionType()).isPresent()) {
                throw new IllegalArgumentException("A question with this text already exists in this lesson");
            }
        }
        Question entity = questionMapper.toEntity(dto);
        entity.setQuestionId(null);
        entity.setCreatedBy(User.builder().userId(creatorUserId).build());
        entity.setCreatedAt(LocalDateTime.now());
        resolveParent(entity, dto.getParentQuestionId());
        QuestionDto result = questionMapper.toDto(questionRepository.save(entity));
        log.info("Question created with id: {} by userId={}", result.getQuestionId(), creatorUserId);
        return result;
    }

    /**
     * @param isAdmin              an admin may edit any question; an ENTERPRISE
     *                             caller (owner or group leader) may only edit
     *                             questions they themselves created.
     * @param restrictToEnterpriseId non-null for an ENTERPRISE caller -- same
     *                             certification-access check as {@link #create}.
     */
    public QuestionDto update(
            Long id, QuestionDto dto, Long callerUserId, boolean isAdmin, Long restrictToEnterpriseId) {
        log.info("Updating question id: {}", id);
        validateLesson(dto, restrictToEnterpriseId);
        Question entity = findEntity(id);
        if (!isAdmin) {
            requireOwnAuthorship(entity, callerUserId);
        }
        entity.setQuestionType(dto.getQuestionType());
        entity.setDifficultyLevel(dto.getDifficultyLevel());
        entity.setQuestionText(dto.getQuestionText());
        entity.setImageKey(dto.getImageKey());
        entity.setTotalPoints(dto.getTotalPoints());
        entity.setLesson(lessonRepository.getReferenceById(dto.getLessonId()));
        resolveParent(entity, dto.getParentQuestionId());
        QuestionDto result = questionMapper.toDto(questionRepository.save(entity));
        log.info("Question id: {} updated", id);
        return result;
    }

    /**
     * Guarantees a question is anchored to a real lesson, and — when the client
     * supplies a certificationId — that the lesson actually belongs to that
     * certification. This backs the rule that every generated or manually
     * created question must carry a lessonId within the selected certification.
     * When restrictToEnterpriseId is set, also enforces that the organization
     * actually has purchased access to that certification.
     */
    private void validateLesson(QuestionDto dto, Long restrictToEnterpriseId) {
        if (dto.getLessonId() == null) {
            throw new IllegalArgumentException("A lessonId is required to save a question.");
        }
        Lesson lesson = lessonRepository.findById(dto.getLessonId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Lesson not found: " + dto.getLessonId()));

        Long resolvedCertificationId = Optional.ofNullable(lesson.getMiddleCategory())
                .map(MiddleCategory::getMajorCategory)
                .map(MajorCategory::getCertification)
                .map(Certification::getCertificationId)
                .orElse(null);

        if (dto.getCertificationId() != null
                && !dto.getCertificationId().equals(resolvedCertificationId)) {
            throw new IllegalArgumentException(
                    "Lesson " + dto.getLessonId() + " does not belong to certification "
                            + dto.getCertificationId() + ".");
        }

        if (restrictToEnterpriseId != null) {
            boolean hasAccess = resolvedCertificationId != null
                    && organizationCertificateRepository.findByEnterprise_EnterpriseIdAndCertification_CertificationId(
                            restrictToEnterpriseId, resolvedCertificationId).isPresent();
            if (!hasAccess) {
                throw new BusinessRuleException.QuestionAccessException(
                        "Your organization does not have access to this certification.");
            }
        }
    }

    private void requireOwnAuthorship(Question entity, Long callerUserId) {
        if (entity.getCreatedBy() == null
                || !entity.getCreatedBy().getUserId().equals(callerUserId)) {
            throw new BusinessRuleException.QuestionAccessException(
                    "You can only modify questions you created.");
        }
    }

    public void delete(Long id, Long callerUserId, boolean isAdmin) {
        log.info("Deleting question id: {}", id);
        Question entity = findEntity(id);
        if (!isAdmin) {
            requireOwnAuthorship(entity, callerUserId);
        }
        validateQuestionTreeCanBeDeleted(id);
        deleteQuestionTree(id);
        log.info("Question id: {} deleted", id);
    }

    private void validateQuestionTreeCanBeDeleted(Long id) {
        findEntity(id);

        if (examQuestionRepository.existsByQuestion_QuestionId(id)) {
            throw new IllegalStateException("Question cannot be deleted because it is already used in an exam.");
        }

        if (learnerExamDetailRepository.existsByQuestion_QuestionId(id)) {
            throw new IllegalStateException("Question cannot be deleted because learners have already answered it.");
        }

        questionRepository.findByParentQuestion_QuestionId(id)
                .forEach(childQuestion -> validateQuestionTreeCanBeDeleted(childQuestion.getQuestionId()));
    }

    private void deleteQuestionTree(Long id) {
        questionRepository.findByParentQuestion_QuestionId(id)
                .forEach(childQuestion -> deleteQuestionTree(childQuestion.getQuestionId()));

        deleteQuestionDependents(id);
        questionRepository.deleteByQuestionId(id);
    }

    private void deleteQuestionDependents(Long questionId) {
        textQuestionConfigRepository.findByQuestion_QuestionId(questionId)
                .ifPresent(textQuestionConfigRepository::delete);
        programmingQuestionConfigRepository.findByQuestion_QuestionId(questionId)
                .ifPresent(programmingQuestionConfigRepository::delete);
        diagramQuestionConfigRepository.findByQuestion_QuestionId(questionId)
                .ifPresent(diagramQuestionConfigRepository::delete);
        choiceRepository.deleteByQuestion_QuestionId(questionId);
    }

    private void resolveParent(Question entity, Long parentId) {
        entity.setParentQuestion(parentId != null ? findEntity(parentId) : null);
    }

    private Question findEntity(Long id) {
        return questionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Question not found: " + id));
    }
}
