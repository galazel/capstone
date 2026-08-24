package com.capstone.rebyu.certification.service;

import com.capstone.rebyu.aigateway.client.WorkflowClient;
import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamType;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.ExamRepository;
import com.capstone.rebyu.certification.dto.CertificationDto;
import com.capstone.rebyu.certification.dto.LessonDto;
import com.capstone.rebyu.certification.dto.MajorCategoryDto;
import com.capstone.rebyu.certification.dto.MiddleCategoryDto;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.mapper.CertificationMapper;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CertificationServiceExamLinkingTest {

    @Mock private CertificationRepository certificationRepository;
    @Mock private CertificationMapper certificationMapper;
    @Mock private EntityManager entityManager;
    @Mock private ExamRepository examRepository;
    @Mock private ExamQuestionRepository examQuestionRepository;
    @Mock private WorkflowClient workflowClient;

    private CertificationService service;

    @BeforeEach
    void setUp() {
        service = new CertificationService(
                certificationRepository, certificationMapper, entityManager,
                examRepository, examQuestionRepository, workflowClient);
    }

    @Test
    void attachesEachExamToItsMatchingCurriculumNodeByScope() {
        Long certId = 1L, majorId = 10L, middleId = 20L, lessonId = 30L;

        Certification certification = new Certification();
        certification.setCertificationId(certId);
        when(certificationRepository.findByIdWithFullTree(certId)).thenReturn(Optional.of(certification));

        // DTO tree the mapper would normally produce.
        LessonDto lessonDto = new LessonDto();
        lessonDto.setLessonId(lessonId);
        MiddleCategoryDto middleDto = new MiddleCategoryDto();
        middleDto.setMiddleCategoryId(middleId);
        middleDto.setLessons(List.of(lessonDto));
        MajorCategoryDto majorDto = new MajorCategoryDto();
        majorDto.setMajorCategoryId(majorId);
        majorDto.setMiddleCategory(List.of(middleDto));
        CertificationDto dto = new CertificationDto();
        dto.setCertificationId(certId);
        dto.setMajorCategory(List.of(majorDto));
        when(certificationMapper.toDto(certification)).thenReturn(dto);

        MajorCategory major = new MajorCategory();
        major.setMajorCategoryId(majorId);
        MiddleCategory middle = new MiddleCategory();
        middle.setMiddleCategoryId(middleId);
        Lesson lesson = new Lesson();
        lesson.setLessonId(lessonId);

        ExamType quizType = new ExamType();
        quizType.setExamTypeText("LESSON_QUIZ");
        ExamType middleExamType = new ExamType();
        middleExamType.setExamTypeText("MIDDLE_EXAM");
        ExamType majorExamType = new ExamType();
        majorExamType.setExamTypeText("MOCK_EXAM");
        ExamType mockType = new ExamType();
        mockType.setExamTypeText("MOCK_EXAM");

        Exam lessonQuiz = Exam.builder().examId(100L).title("Lesson Quiz").examType(quizType)
                .lesson(lesson).totalQuestions(5).status(Exam.Status.PUBLISHED).build();
        Exam middleExam = Exam.builder().examId(101L).title("Middle Exam").examType(middleExamType)
                .middleCategory(middle).totalQuestions(20).status(Exam.Status.PUBLISHED).build();
        Exam majorExam = Exam.builder().examId(102L).title("Major Exam").examType(majorExamType)
                .majorCategory(major).totalQuestions(50).status(Exam.Status.PUBLISHED).build();
        Exam mockExam = Exam.builder().examId(103L).title("Mock Exam").examType(mockType)
                .totalQuestions(60).status(Exam.Status.PUBLISHED).build();

        when(examRepository.findByCertification_CertificationId(certId))
                .thenReturn(List.of(lessonQuiz, middleExam, majorExam, mockExam));

        CertificationDto result = service.getById(certId, null);

        assertEquals(1, result.getMajorCategory().get(0).getMiddleCategory().get(0).getLessons().get(0)
                .getExams().size());
        assertEquals(100L, result.getMajorCategory().get(0).getMiddleCategory().get(0).getLessons().get(0)
                .getExams().get(0).getExamId());

        assertEquals(1, result.getMajorCategory().get(0).getMiddleCategory().get(0).getExams().size());
        assertEquals(101L, result.getMajorCategory().get(0).getMiddleCategory().get(0).getExams().get(0).getExamId());

        assertEquals(1, result.getMajorCategory().get(0).getExams().size());
        assertEquals(102L, result.getMajorCategory().get(0).getExams().get(0).getExamId());

        assertEquals(1, result.getExams().size());
        assertEquals(103L, result.getExams().get(0).getExamId());
    }
}
