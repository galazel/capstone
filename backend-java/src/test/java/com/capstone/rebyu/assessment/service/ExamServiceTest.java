package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.assessment.dto.ExamDto;
import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamQuestion;
import com.capstone.rebyu.assessment.entity.ExamType;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.mapper.ExamMapper;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.ExamRepository;
import com.capstone.rebyu.assessment.repository.ExamTypeRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.certification.repository.MajorCategoryRepository;
import com.capstone.rebyu.certification.repository.MiddleCategoryRepository;
import com.capstone.rebyu.certification.service.MajorCategoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamServiceTest {

    @Mock private ExamRepository examRepository;
    @Mock private ExamQuestionRepository examQuestionRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private ExamTypeRepository examTypeRepository;
    @Mock private CertificationRepository certificationRepository;
    @Mock private MajorCategoryRepository majorCategoryRepository;
    @Mock private MiddleCategoryRepository middleCategoryRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private ExamMapper examMapper;
    @Mock private MajorCategoryService majorCategoryService;

    private ExamService service;

    @BeforeEach
    void setUp() {
        service = new ExamService(
                examRepository, examQuestionRepository, questionRepository,
                examTypeRepository, certificationRepository, majorCategoryRepository,
                middleCategoryRepository, lessonRepository, examMapper, majorCategoryService);
    }

    @Test
    void createPersistsExactlySelectedQuestionsWithTheirPointsAndOrder() {
        ExamDto request = new ExamDto();
        request.setCertificationId(1L);
        request.setExamTypeId(2L);
        request.setTitle("TOPCIT Mock Exam 1");
        request.setTargetScope("CERTIFICATION");
        request.setTotalQuestions(2);
        // Two selected questions with distinct per-question points.
        request.setQuestions(List.of(
                new ExamDto.ExamQuestionInput(10L, new BigDecimal("3"), 1),
                new ExamDto.ExamQuestionInput(11L, new BigDecimal("5"), 2)));

        Exam mapped = exam();
        when(examMapper.toEntity(request)).thenReturn(mapped);
        when(examRepository.save(any(Exam.class))).thenAnswer(invocation -> {
            Exam saved = invocation.getArgument(0);
            saved.setExamId(100L);
            return saved;
        });
        when(questionRepository.findAllById(List.of(10L, 11L)))
                .thenReturn(List.of(question(10L), question(11L)));

        // Title generation + uniqueness lookups for a certification-scoped mock.
        ExamType mockType = new ExamType();
        mockType.setExamTypeId(2L);
        mockType.setExamTypeText("MOCK_EXAM");
        lenient().when(examTypeRepository.findById(2L)).thenReturn(Optional.of(mockType));
        lenient().when(examRepository
                .existsByCertification_CertificationIdAndExamType_ExamTypeText(anyLong(), anyString()))
                .thenReturn(false);
        Certification cert = new Certification();
        cert.setCertificationId(1L);
        cert.setTitle("TOPCIT");
        lenient().when(certificationRepository.findById(1L)).thenReturn(Optional.of(cert));

        lenient().when(examQuestionRepository.findByExam_ExamIdOrderByDisplayOrderAsc(anyLong()))
                .thenReturn(List.of());
        when(examMapper.toDto(any(Exam.class))).thenAnswer(invocation -> {
            Exam saved = invocation.getArgument(0);
            ExamDto dto = new ExamDto();
            dto.setExamId(saved.getExamId());
            dto.setTotalQuestions(saved.getTotalQuestions());
            return dto;
        });

        ExamDto result = service.create(request, true, null, null, false, null);

        assertEquals(100L, result.getExamId());
        assertEquals(2, result.getTotalQuestions());

        // The whole set is replaced (no orphans) and each row keeps its points/order.
        verify(examQuestionRepository).deleteByExam_ExamId(100L);
        ArgumentCaptor<ExamQuestion> captor = ArgumentCaptor.forClass(ExamQuestion.class);
        verify(examQuestionRepository, times(2)).save(captor.capture());
        List<ExamQuestion> saved = captor.getAllValues();

        assertEquals(10L, saved.get(0).getQuestion().getQuestionId());
        assertEquals(1, saved.get(0).getDisplayOrder());
        assertEquals(new BigDecimal("3"), saved.get(0).getPoints());

        assertEquals(11L, saved.get(1).getQuestion().getQuestionId());
        assertEquals(2, saved.get(1).getDisplayOrder());
        assertEquals(new BigDecimal("5"), saved.get(1).getPoints());
    }

    @Test
    void createDoesNotTouchQuestionsWhenNoneSelected() {
        ExamDto request = new ExamDto();
        request.setCertificationId(1L);
        request.setExamTypeId(2L);
        request.setTitle("TOPCIT Mock Exam 1");
        request.setTargetScope("CERTIFICATION");
        request.setTotalQuestions(0);
        // No questions / questionIds -> the service must not auto-attach anything.

        Exam mapped = exam();
        when(examMapper.toEntity(request)).thenReturn(mapped);
        when(examRepository.save(any(Exam.class))).thenAnswer(invocation -> {
            Exam saved = invocation.getArgument(0);
            saved.setExamId(100L);
            return saved;
        });

        ExamType mockType = new ExamType();
        mockType.setExamTypeId(2L);
        mockType.setExamTypeText("MOCK_EXAM");
        lenient().when(examTypeRepository.findById(2L)).thenReturn(Optional.of(mockType));
        lenient().when(examRepository
                .existsByCertification_CertificationIdAndExamType_ExamTypeText(anyLong(), anyString()))
                .thenReturn(false);
        Certification cert = new Certification();
        cert.setCertificationId(1L);
        cert.setTitle("TOPCIT");
        lenient().when(certificationRepository.findById(1L)).thenReturn(Optional.of(cert));
        lenient().when(examQuestionRepository.findByExam_ExamIdOrderByDisplayOrderAsc(anyLong()))
                .thenReturn(List.of());
        when(examMapper.toDto(any(Exam.class))).thenAnswer(invocation -> {
            Exam saved = invocation.getArgument(0);
            ExamDto dto = new ExamDto();
            dto.setExamId(saved.getExamId());
            return dto;
        });

        service.create(request, true, null, null, false, null);

        // Never deletes or inserts exam_questions when nothing was selected.
        verify(examQuestionRepository, times(0)).deleteByExam_ExamId(anyLong());
        verify(examQuestionRepository, times(0)).save(any(ExamQuestion.class));
    }

    private Exam exam() {
        Certification certification = new Certification();
        certification.setCertificationId(1L);

        ExamType examType = new ExamType();
        examType.setExamTypeId(2L);
        examType.setExamTypeText("MOCK_EXAM");

        Exam exam = new Exam();
        exam.setCertification(certification);
        exam.setExamType(examType);
        return exam;
    }

    private Question question(long questionId) {
        Certification certification = new Certification();
        certification.setCertificationId(1L);

        MajorCategory majorCategory = new MajorCategory();
        majorCategory.setCertification(certification);

        MiddleCategory middleCategory = new MiddleCategory();
        middleCategory.setMajorCategory(majorCategory);

        Lesson lesson = new Lesson();
        lesson.setLessonId(5L);
        lesson.setMiddleCategory(middleCategory);

        Question question = new Question();
        question.setQuestionId(questionId);
        question.setLesson(lesson);
        return question;
    }
}
