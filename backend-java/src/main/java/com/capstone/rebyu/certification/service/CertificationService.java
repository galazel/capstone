package com.capstone.rebyu.certification.service;

import com.capstone.rebyu.certification.dto.CertificationDto;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamQuestion;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.ExamRepository;
import com.capstone.rebyu.certification.dto.CertificationPublishRequirementsDto;
import com.capstone.rebyu.certification.dto.CertificationPublishRequirementsDto.InvalidRequirementDto;
import com.capstone.rebyu.certification.dto.CertificationPublishRequirementsDto.MissingRequirementDto;
import com.capstone.rebyu.certification.mapper.CertificationMapper;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class CertificationService {

    private final CertificationRepository certificationRepository;
    private final CertificationMapper certificationMapper;
    private final EntityManager entityManager;
    private final ExamRepository examRepository;
    private final ExamQuestionRepository examQuestionRepository;

    /**
     * @param includeGroupId when null, only official (platform-wide) content is
     *                       returned at every level of the curriculum tree --
     *                       today's exact behavior, since no row has a non-null
     *                       ownerGroup yet. When set, content owned by that
     *                       specific group is ALSO included (mixed in alongside
     *                       the official curriculum). The caller (controller) is
     *                       responsible for verifying the requester may actually
     *                       act on that group before passing it here.
     */
    @Transactional(readOnly = true)
    public List<CertificationDto> getAll(Long includeGroupId) {
        return certificationRepository.findAll()
                .stream()
                .map(certification -> toFilteredDto(certification, includeGroupId))
                .toList();
    }

    @Transactional(readOnly = true)
    public CertificationDto getById(Long id, Long includeGroupId) {
        Certification certification = certificationRepository.findByIdWithFullTree(id)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found with ID: " + id));
        return toFilteredDto(certification, includeGroupId);
    }

    /**
     * Strips out group-owned major categories (and everything nested under
     * them) except the one group the caller was authorized for, if any. This
     * is the ONLY place member-authored content is prevented from leaking
     * into every other organization's view of a certification.
     */
    private CertificationDto toFilteredDto(Certification certification, Long includeGroupId) {
        CertificationDto dto = certificationMapper.toDto(certification);
        if (dto.getMajorCategory() != null) {
            dto.setMajorCategory(
                    dto.getMajorCategory().stream()
                            .filter(major -> major.getOwnerGroupId() == null
                                    || major.getOwnerGroupId().equals(includeGroupId))
                            .toList()
            );
        }
        return dto;
    }

    public CertificationDto create(CertificationDto dto) {
        Certification certification = certificationMapper.toEntity(dto);

        certification.setCertificationId(null);
        certification.setDateCreated(LocalDateTime.now());
        certification.setDateUpdated(null);

        addDefaultHierarchyIfEmpty(certification);
        connectChildEntities(certification);

        Certification savedCertification =
                certificationRepository.save(certification);

        log.info(
                "Created certification with ID: {}",
                savedCertification.getCertificationId()
        );

        return certificationMapper.toDto(
                certificationRepository.findByIdWithFullTree(savedCertification.getCertificationId()).orElseThrow()
        );
    }

    public CertificationDto update(Long id, CertificationDto dto) {
        Certification existingCertification = findEntity(id);







        Certification updatedCertification = certificationMapper.toEntity(dto);

        updatedCertification.setCertificationId(
                existingCertification.getCertificationId()
        );





        updatedCertification.setDateCreated(
                existingCertification.getDateCreated()
        );




        if (!StringUtils.hasText(updatedCertification.getImageKey())) {
            updatedCertification.setImageKey(
                    existingCertification.getImageKey()
            );
        }

        updatedCertification.setDateUpdated(LocalDateTime.now());

        connectChildEntities(updatedCertification);

        Certification savedCertification =
                certificationRepository.save(updatedCertification);

        log.info(
                "Updated certification with ID: {}",
                savedCertification.getCertificationId()
        );

        return certificationMapper.toDto(
                certificationRepository.findByIdWithFullTree(savedCertification.getCertificationId()).orElseThrow()
        );
    }

    public void delete(Long id) {
        Certification certification = findEntity(id);

        deleteRelatedCertificationData(id);
        certificationRepository.delete(certification);

        log.info("Deleted certification with ID: {}", id);
    }

    private void deleteRelatedCertificationData(Long certificationId) {
        // Executions reference both attempt_questions and attempts, so they must
        // be removed before either of those tables.
        executeDelete("""
                DELETE FROM assessment_attempt_executions
                WHERE assessment_attempt_id IN (
                    SELECT aa.assessment_attempt_id
                    FROM assessment_attempts aa
                    JOIN exams e ON e.exam_id = aa.exam_id
                    WHERE e.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM assessment_attempt_answers
                WHERE assessment_attempt_id IN (
                    SELECT aa.assessment_attempt_id
                    FROM assessment_attempts aa
                    JOIN exams e ON e.exam_id = aa.exam_id
                    WHERE e.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM assessment_attempt_questions
                WHERE assessment_attempt_id IN (
                    SELECT aa.assessment_attempt_id
                    FROM assessment_attempts aa
                    JOIN exams e ON e.exam_id = aa.exam_id
                    WHERE e.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM assessment_attempts
                WHERE exam_id IN (
                    SELECT exam_id FROM exams WHERE certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_mcq_answers
                WHERE learner_exam_detail_id IN (
                    SELECT led.learner_exam_detail_id
                    FROM learner_exam_details led
                    JOIN exams e ON e.exam_id = led.exam_id
                    WHERE e.certification_id = :certificationId
                )
                OR exam_question_id IN (
                    SELECT eq.exam_question_id
                    FROM exam_questions eq
                    JOIN exams e ON e.exam_id = eq.exam_id
                    WHERE e.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_text_answers
                WHERE learner_exam_detail_id IN (
                    SELECT led.learner_exam_detail_id
                    FROM learner_exam_details led
                    JOIN exams e ON e.exam_id = led.exam_id
                    WHERE e.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_programming_answers
                WHERE learner_exam_detail_id IN (
                    SELECT led.learner_exam_detail_id
                    FROM learner_exam_details led
                    JOIN exams e ON e.exam_id = led.exam_id
                    WHERE e.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_diagram_answers
                WHERE learner_exam_detail_id IN (
                    SELECT led.learner_exam_detail_id
                    FROM learner_exam_details led
                    JOIN exams e ON e.exam_id = led.exam_id
                    WHERE e.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_exam_details
                WHERE exam_id IN (
                    SELECT exam_id FROM exams WHERE certification_id = :certificationId
                )
                OR lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM exam_results
                WHERE exam_id IN (
                    SELECT exam_id FROM exams WHERE certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM exam_choices
                WHERE exam_question_id IN (
                    SELECT eq.exam_question_id
                    FROM exam_questions eq
                    JOIN exams e ON e.exam_id = eq.exam_id
                    WHERE e.certification_id = :certificationId
                )
                OR choice_id IN (
                    SELECT ch.choice_id
                    FROM choices ch
                    JOIN questions q ON q.question_id = ch.question_id
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM exam_questions
                WHERE exam_id IN (
                    SELECT exam_id FROM exams WHERE certification_id = :certificationId
                )
                OR question_id IN (
                    SELECT q.question_id
                    FROM questions q
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM exams
                WHERE certification_id = :certificationId
                OR lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM programming_test_cases
                WHERE programming_question_config_id IN (
                    SELECT pqc.programming_question_config_id
                    FROM programming_question_configs pqc
                    JOIN questions q ON q.question_id = pqc.question_id
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM diagram_question_configs
                WHERE question_id IN (
                    SELECT q.question_id
                    FROM questions q
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM programming_question_configs
                WHERE question_id IN (
                    SELECT q.question_id
                    FROM questions q
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM text_question_configs
                WHERE question_id IN (
                    SELECT q.question_id
                    FROM questions q
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM choices
                WHERE question_id IN (
                    SELECT q.question_id
                    FROM questions q
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeUpdate("""
                UPDATE questions
                SET parent_question_id = NULL
                WHERE parent_question_id IN (
                    SELECT q.question_id
                    FROM questions q
                    JOIN lessons l ON l.lesson_id = q.lesson_id
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM questions
                WHERE lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_completed_lessons
                WHERE lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_lesson_mastery
                WHERE lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_weak_areas
                WHERE lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM lesson_images
                WHERE lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM lesson_videos
                WHERE lesson_id IN (
                    SELECT l.lesson_id
                    FROM lessons l
                    JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
                    JOIN major_categories maj ON maj.major_category_id = mc.major_category_id
                    WHERE maj.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_certifications
                WHERE certification_id = :certificationId
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_order_details
                WHERE certification_id = :certificationId
                """, certificationId);

        executeDelete("""
                DELETE FROM learner_invitations
                WHERE org_cert_id IN (
                    SELECT org_cert_id
                    FROM organization_certificates
                    WHERE certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM organization_certification_learners
                WHERE org_cert_id IN (
                    SELECT org_cert_id
                    FROM organization_certificates
                    WHERE certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM enterprise_invoice_items
                WHERE certification_id = :certificationId
                """, certificationId);

        executeUpdate("""
                UPDATE enterprise_invoices
                SET renewal_request_id = NULL
                WHERE renewal_request_id IN (
                    SELECT renewal_request_id
                    FROM enterprise_certification_renewal_requests ecrr
                    JOIN organization_certificates oc ON oc.org_cert_id = ecrr.org_cert_id
                    WHERE oc.certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM enterprise_certification_renewal_requests
                WHERE org_cert_id IN (
                    SELECT org_cert_id
                    FROM organization_certificates
                    WHERE certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM organization_certificates
                WHERE certification_id = :certificationId
                """, certificationId);

        executeDelete("""
                DELETE FROM partnership_request_items
                WHERE certification_id = :certificationId
                """, certificationId);

        executeDelete("""
                DELETE FROM knowledge_document_images
                WHERE knowledge_document_id IN (
                    SELECT knowledge_document_id
                    FROM knowledge_documents
                    WHERE certification_id = :certificationId
                )
                """, certificationId);

        executeDelete("""
                DELETE FROM knowledge_documents
                WHERE certification_id = :certificationId
                """, certificationId);
    }

    private void executeDelete(String sql, Long certificationId) {
        executeUpdate(sql, certificationId);
    }

    private int executeUpdate(String sql, Long certificationId) {
        return entityManager.createNativeQuery(sql)
                .setParameter("certificationId", certificationId)
                .executeUpdate();
    }

    private Certification findEntity(Long id) {
        return certificationRepository.findById(id)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "Certification not found with ID: " + id
                        )
                );
    }












    private void addDefaultHierarchyIfEmpty(Certification certification) {
        if (certification.getMajorCategory() != null
                && !certification.getMajorCategory().isEmpty()) {
            return;
        }

        Lesson lesson = new Lesson();
        lesson.setName("Untitled Lesson");
        lesson.setLessonComponentStructure("[]");

        MiddleCategory middleCategory = new MiddleCategory();
        middleCategory.setTitle("Untitled Middle Category");
        middleCategory.getLessons().add(lesson);

        MajorCategory majorCategory = new MajorCategory();
        majorCategory.setTitle("Untitled Major Category");
        majorCategory.getMiddleCategory().add(middleCategory);

        if (certification.getMajorCategory() == null) {
            certification.setMajorCategory(new java.util.ArrayList<>());
        }
        certification.getMajorCategory().add(majorCategory);
    }

    private void connectChildEntities(Certification certification) {
        if (certification.getMajorCategory() == null) {
            return;
        }

        for (MajorCategory majorCategory : certification.getMajorCategory()) {
            majorCategory.setCertification(certification);

            if (majorCategory.getMiddleCategory() == null) {
                continue;
            }

            for (MiddleCategory middleCategory : majorCategory.getMiddleCategory()) {
                middleCategory.setMajorCategory(majorCategory);

                if (middleCategory.getLessons() == null) {
                    continue;
                }

                for (Lesson lesson : middleCategory.getLessons()) {
                    lesson.setMiddleCategory(middleCategory);
                }
            }
        }
    }

    public void publish(Long id){
        Certification certification = certificationRepository.findByIdWithFullTree(id)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found with ID: " + id));

        // Official exams only -- a group's own assessments are separate content
        // and are neither validated nor published by the admin's publish action.
        List<Exam> exams = examRepository.findByCertification_CertificationId(id).stream()
                .filter(exam -> exam.getOwnerGroup() == null)
                .toList();

        CertificationPublishRequirementsDto requirements = buildPublishRequirements(certification, exams);
        if (!requirements.publishable()) {
            throw new BusinessRuleException.InvalidAssessmentSubmissionException(summarize(requirements));
        }

        // Atomic publish: the certification and every assessment under it flip to
        // PUBLISHED together (single transaction — all or nothing).
        LocalDateTime now = LocalDateTime.now();
        certification.setStatus(Certification.CertificationStatus.PUBLISHED);
        certification.setDateUpdated(now);
        certificationRepository.save(certification);

        for (Exam exam : exams) {
            exam.setStatus(Exam.Status.PUBLISHED);
            exam.setPublishedAt(now);
            exam.setUpdatedAt(now);
        }
        examRepository.saveAll(exams);

        log.info("Published certification ID: {} with {} assessment(s)", id, exams.size());
    }

    @Transactional(readOnly = true)
    public CertificationPublishRequirementsDto getPublishingRequirements(Long id) {
        Certification certification = certificationRepository.findByIdWithFullTree(id)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found with ID: " + id));
        List<Exam> exams = examRepository.findByCertification_CertificationId(id);
        return buildPublishRequirements(certification, exams);
    }

    /**
     * Structured publishing readiness (spec §30). `missing` = a required
     * assessment does not exist; `invalid` = an existing assessment is not ready.
     */
    private CertificationPublishRequirementsDto buildPublishRequirements(
            Certification certification, List<Exam> allExams) {

        List<MissingRequirementDto> missing = new ArrayList<>();
        List<InvalidRequirementDto> invalid = new ArrayList<>();

        // Publishing is about the OFFICIAL curriculum only. Enterprise groups
        // author their own categories, lessons, and assessments alongside it;
        // those are separate content and must never add requirements to (or
        // satisfy requirements of) the admin's publish checklist.
        List<Exam> exams = allExams.stream()
                .filter(exam -> exam.getOwnerGroup() == null)
                .toList();

        String certTitle = StringUtils.hasText(certification.getTitle())
                ? certification.getTitle() : "Certification";
        List<MajorCategory> majors = certification.getMajorCategory() == null
                ? List.of()
                : certification.getMajorCategory().stream()
                        .filter(major -> major.getOwnerGroup() == null)
                        .toList();

        // Certification-wide required assessments.
        long diagnostics = exams.stream().filter(exam -> isExamType(exam, "DIAGNOSTIC")).count();
        List<Exam> mockExams = exams.stream().filter(exam -> isExamType(exam, "MOCK_EXAM")).toList();
        if (diagnostics == 0) {
            missing.add(new MissingRequirementDto("DIAGNOSTIC", certification.getCertificationId(),
                    certTitle + " Diagnostic Exam", "ASSESSMENT_NOT_CREATED"));
        }
        if (mockExams.isEmpty()) {
            missing.add(new MissingRequirementDto("MOCK_EXAM", certification.getCertificationId(),
                    certTitle + " Mock Exam", "ASSESSMENT_NOT_CREATED"));
        } else if (mockExams.size() > 1) {
            mockExams.forEach(exam -> invalid.add(new InvalidRequirementDto(
                    exam.getExamId(), exam.getTitle(), "MOCK_EXAM_ALREADY_EXISTS", List.of())));
        }

        // Per-scope coverage: every major/middle/lesson needs its assessment.
        Set<Long> coveredMajors = exams.stream().filter(exam -> exam.getMajorCategory() != null)
                .map(exam -> exam.getMajorCategory().getMajorCategoryId()).collect(Collectors.toSet());
        Set<Long> coveredMiddles = exams.stream().filter(exam -> exam.getMiddleCategory() != null)
                .map(exam -> exam.getMiddleCategory().getMiddleCategoryId()).collect(Collectors.toSet());
        Set<Long> coveredLessons = exams.stream().filter(exam -> exam.getLesson() != null)
                .map(exam -> exam.getLesson().getLessonId()).collect(Collectors.toSet());

        boolean hasAnyLesson = false;
        for (MajorCategory major : majors) {
            if (!coveredMajors.contains(major.getMajorCategoryId())) {
                missing.add(new MissingRequirementDto("MAJOR_EXAM", major.getMajorCategoryId(),
                        major.getTitle() + " Major Exam", "ASSESSMENT_NOT_CREATED"));
            }
            List<MiddleCategory> middles = major.getMiddleCategory() == null
                    ? List.of() : major.getMiddleCategory();
            for (MiddleCategory middle : middles) {
                if (!coveredMiddles.contains(middle.getMiddleCategoryId())) {
                    missing.add(new MissingRequirementDto("MIDDLE_EXAM", middle.getMiddleCategoryId(),
                            middle.getTitle() + " Middle Exam", "ASSESSMENT_NOT_CREATED"));
                }
                List<Lesson> lessons = middle.getLessons() == null ? List.of() : middle.getLessons();
                for (Lesson lesson : lessons) {
                    hasAnyLesson = true;
                    // A lesson with no content cannot be published to learners.
                    if (!hasLessonContent(lesson)) {
                        missing.add(new MissingRequirementDto("LESSON_CONTENT", lesson.getLessonId(),
                                lesson.getName() + " Content", "LESSON_CONTENT_MISSING"));
                    }
                    if (!coveredLessons.contains(lesson.getLessonId())) {
                        missing.add(new MissingRequirementDto("LESSON_QUIZ", lesson.getLessonId(),
                                lesson.getName() + " Quiz", "ASSESSMENT_NOT_CREATED"));
                    }
                }
            }
        }

        // Per-assessment readiness: questions present, points valid, passing sane.
        for (Exam exam : exams) {
            List<ExamQuestion> examQuestions =
                    examQuestionRepository.findByExam_ExamIdOrderByDisplayOrderAsc(exam.getExamId());
            if (examQuestions.isEmpty()) {
                invalid.add(new InvalidRequirementDto(
                        exam.getExamId(), exam.getTitle(), "ASSESSMENT_HAS_NO_QUESTIONS", List.of()));
                continue;
            }
            List<Long> badPoints = new ArrayList<>();
            BigDecimal total = BigDecimal.ZERO;
            for (ExamQuestion examQuestion : examQuestions) {
                BigDecimal points = effectivePoints(examQuestion);
                if (points.signum() <= 0) {
                    badPoints.add(examQuestion.getQuestion().getQuestionId());
                } else {
                    total = total.add(points);
                }
            }
            if (!badPoints.isEmpty()) {
                invalid.add(new InvalidRequirementDto(
                        exam.getExamId(), exam.getTitle(), "QUESTION_POINTS_REQUIRED", badPoints));
            } else if (total.signum() <= 0) {
                invalid.add(new InvalidRequirementDto(
                        exam.getExamId(), exam.getTitle(), "ASSESSMENT_TOTAL_POINTS_INVALID", List.of()));
            }
            BigDecimal passing = exam.getPassingScore();
            if (passing != null && (passing.signum() < 0 || passing.compareTo(new BigDecimal("100")) > 0)) {
                invalid.add(new InvalidRequirementDto(
                        exam.getExamId(), exam.getTitle(), "PASSING_SCORE_EXCEEDS_TOTAL_POINTS", List.of()));
            }
        }

        boolean publishable = missing.isEmpty() && invalid.isEmpty()
                && StringUtils.hasText(certification.getTitle())
                && !majors.isEmpty() && hasAnyLesson;
        return new CertificationPublishRequirementsDto(publishable, missing, invalid);
    }

    /** A lesson is publishable only once it has real component content (not empty "[]"). */
    private boolean hasLessonContent(Lesson lesson) {
        String structure = lesson.getLessonComponentStructure();
        return structure != null && !structure.isBlank() && !"[]".equals(structure.trim());
    }

    private BigDecimal effectivePoints(ExamQuestion examQuestion) {
        if (examQuestion.getPoints() != null) {
            return examQuestion.getPoints();
        }
        BigDecimal fallback = examQuestion.getQuestion() == null
                ? null : examQuestion.getQuestion().getTotalPoints();
        return fallback == null ? BigDecimal.ZERO : fallback;
    }

    private String summarize(CertificationPublishRequirementsDto requirements) {
        List<String> parts = new ArrayList<>();
        requirements.missingRequirements().forEach(item -> parts.add("Missing: " + item.title()));
        requirements.invalidRequirements().forEach(item ->
                parts.add(item.title() + " — " + item.reason().replace('_', ' ').toLowerCase()));
        if (parts.isEmpty()) {
            parts.add("The certification is not ready to publish.");
        }
        return "This certification cannot be published yet: " + String.join("; ", parts);
    }

    private boolean isExamType(Exam exam, String examTypeText) {
        return exam.getExamType() != null
                && examTypeText.equalsIgnoreCase(exam.getExamType().getExamTypeText());
    }
}
