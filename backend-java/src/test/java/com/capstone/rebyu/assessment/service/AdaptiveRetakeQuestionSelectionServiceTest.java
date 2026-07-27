package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.assessment.config.RetakeProperties;
import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptAnswer;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptQuestion;
import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamQuestion;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptAnswerRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptQuestionRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.bkt.config.BktProperties;
import com.capstone.rebyu.bkt.service.BktEventFactory;
import com.capstone.rebyu.certification.entity.Lesson;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdaptiveRetakeQuestionSelectionServiceTest {

    private static final Long LESSON_ID = 100L;

    @Mock private AssessmentAttemptRepository attemptRepository;
    @Mock private AssessmentAttemptQuestionRepository attemptQuestionRepository;
    @Mock private AssessmentAttemptAnswerRepository attemptAnswerRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private EligibleQuestionService eligibleQuestionService;

    private AdaptiveRetakeQuestionSelectionService service;
    private Lesson lesson;

    @BeforeEach
    void setUp() {
        service = new AdaptiveRetakeQuestionSelectionService(
                attemptRepository, attemptQuestionRepository, attemptAnswerRepository,
                questionRepository, eligibleQuestionService,
                new BktEventFactory(new BktProperties()),
                new RetakeProperties(),
                new ObjectMapper());

        lesson = new Lesson();
        lesson.setLessonId(LESSON_ID);
    }

    private Question question(long id, String difficulty) {
        return Question.builder()
                .questionId(id)
                .questionType("MCQ")
                .difficultyLevel(difficulty)
                .questionText("q" + id)
                .lesson(lesson)
                .totalPoints(BigDecimal.ONE)
                .build();
    }

    @Test
    void boostsTheWeakDifficultyTierAndReducesTheStrongOne() {
        // Baseline exam: 2 EASY + 2 AVERAGE questions.
        Question baselineEasy1 = question(1L, "EASY");
        Question baselineEasy2 = question(2L, "EASY");
        Question baselineAvg1 = question(3L, "AVERAGE");
        Question baselineAvg2 = question(4L, "AVERAGE");
        List<ExamQuestion> baseline = List.of(
                ExamQuestion.builder().examQuestionId(1L).question(baselineEasy1).displayOrder(1).build(),
                ExamQuestion.builder().examQuestionId(2L).question(baselineEasy2).displayOrder(2).build(),
                ExamQuestion.builder().examQuestionId(3L).question(baselineAvg1).displayOrder(3).build(),
                ExamQuestion.builder().examQuestionId(4L).question(baselineAvg2).displayOrder(4).build());

        Exam exam = Exam.builder().examId(9L).lesson(lesson).totalQuestions(4).build();

        // Past attempt: got both EASY questions right, both AVERAGE questions wrong.
        AssessmentAttempt pastAttempt = AssessmentAttempt.builder()
                .assessmentAttemptId(500L).exam(exam).learnerId(2L)
                .attemptNumber(1).status(AssessmentAttempt.Status.SUBMITTED)
                .build();
        when(attemptRepository.findByExam_ExamIdAndLearnerIdAndStatus(9L, 2L, AssessmentAttempt.Status.SUBMITTED))
                .thenReturn(List.of(pastAttempt));

        List<AssessmentAttemptQuestion> pastAttemptQuestions = List.of(
                attemptQuestion(101L, pastAttempt, 1L),
                attemptQuestion(102L, pastAttempt, 2L),
                attemptQuestion(103L, pastAttempt, 3L),
                attemptQuestion(104L, pastAttempt, 4L));
        when(attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(List.of(500L)))
                .thenReturn(pastAttemptQuestions);

        List<AssessmentAttemptAnswer> pastAnswers = List.of(
                answer(pastAttemptQuestions.get(0), true),
                answer(pastAttemptQuestions.get(1), true),
                answer(pastAttemptQuestions.get(2), false),
                answer(pastAttemptQuestions.get(3), false));
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(List.of(500L)))
                .thenReturn(pastAnswers);

        when(questionRepository.findAllById(any()))
                .thenReturn(List.of(baselineEasy1, baselineEasy2, baselineAvg1, baselineAvg2));

        // Question bank has a real surplus pool to draw fresh questions from.
        List<Question> pool = List.of(
                question(1L, "EASY"), question(2L, "EASY"), question(10L, "EASY"), question(11L, "EASY"),
                question(3L, "AVERAGE"), question(4L, "AVERAGE"), question(12L, "AVERAGE"), question(13L, "AVERAGE"),
                question(14L, "HARD"), question(15L, "HARD"));
        when(eligibleQuestionService.resolveScope(any(), any(), any(), anyLong())).thenReturn(pool);

        AdaptiveRetakeQuestionSelectionService.Selection selection = service.select(exam, 2L, baseline);

        assertEquals(4, selection.questions().size(), "must always assemble exactly the exam's configured question count");

        Map<String, Long> byDifficulty = selection.questions().stream()
                .collect(Collectors.groupingBy(Question::getDifficultyLevel, Collectors.counting()));
        long averageCount = byDifficulty.getOrDefault("AVERAGE", 0L);
        long easyCount = byDifficulty.getOrDefault("EASY", 0L);

        assertTrue(averageCount > 2, "the weak (0% accuracy) AVERAGE tier should get MORE than baseline's 2 questions, got " + averageCount);
        assertTrue(easyCount < 2, "the strong (100% accuracy) EASY tier should get FEWER than baseline's 2 questions, got " + easyCount);
        assertTrue(selection.retakeBasisJson() != null && selection.retakeBasisJson().contains("AVERAGE"));
    }

    @Test
    void neverFailsToFillTheTargetCountWhenTheWeakTierHasNoFreshSupply() {
        // Baseline: 2 EASY + 2 AVERAGE. Only the exact same 4 questions exist
        // anywhere -- no surplus pool at all.
        Question e1 = question(1L, "EASY");
        Question e2 = question(2L, "EASY");
        Question a1 = question(3L, "AVERAGE");
        Question a2 = question(4L, "AVERAGE");
        List<ExamQuestion> baseline = List.of(
                ExamQuestion.builder().examQuestionId(1L).question(e1).displayOrder(1).build(),
                ExamQuestion.builder().examQuestionId(2L).question(e2).displayOrder(2).build(),
                ExamQuestion.builder().examQuestionId(3L).question(a1).displayOrder(3).build(),
                ExamQuestion.builder().examQuestionId(4L).question(a2).displayOrder(4).build());

        Exam exam = Exam.builder().examId(9L).lesson(lesson).totalQuestions(4).build();

        AssessmentAttempt pastAttempt = AssessmentAttempt.builder()
                .assessmentAttemptId(500L).exam(exam).learnerId(2L)
                .attemptNumber(1).status(AssessmentAttempt.Status.SUBMITTED)
                .build();
        when(attemptRepository.findByExam_ExamIdAndLearnerIdAndStatus(9L, 2L, AssessmentAttempt.Status.SUBMITTED))
                .thenReturn(List.of(pastAttempt));

        List<AssessmentAttemptQuestion> pastAttemptQuestions = List.of(
                attemptQuestion(101L, pastAttempt, 1L),
                attemptQuestion(102L, pastAttempt, 2L),
                attemptQuestion(103L, pastAttempt, 3L),
                attemptQuestion(104L, pastAttempt, 4L));
        when(attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(List.of(500L)))
                .thenReturn(pastAttemptQuestions);
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(List.of(500L)))
                .thenReturn(List.of(
                        answer(pastAttemptQuestions.get(0), false),
                        answer(pastAttemptQuestions.get(1), false),
                        answer(pastAttemptQuestions.get(2), false),
                        answer(pastAttemptQuestions.get(3), false)));
        when(questionRepository.findAllById(any())).thenReturn(List.of(e1, e2, a1, a2));
        when(eligibleQuestionService.resolveScope(any(), any(), any(), anyLong())).thenReturn(List.of(e1, e2, a1, a2));

        AdaptiveRetakeQuestionSelectionService.Selection selection = service.select(exam, 2L, baseline);

        assertEquals(4, selection.questions().size(),
                "must still assemble exactly 4 questions by repeating/falling back to baseline even with zero fresh supply");
    }

    private static AssessmentAttemptQuestion attemptQuestion(long id, AssessmentAttempt attempt, long sourceQuestionId) {
        return AssessmentAttemptQuestion.builder()
                .attemptQuestionId(id)
                .attempt(attempt)
                .sourceQuestionId(sourceQuestionId)
                .questionType("MCQ")
                .questionTextSnapshot("q")
                .displayOrder((int) id)
                .lessonId(LESSON_ID)
                .build();
    }

    private static AssessmentAttemptAnswer answer(AssessmentAttemptQuestion attemptQuestion, boolean correct) {
        return AssessmentAttemptAnswer.builder()
                .attemptQuestion(attemptQuestion)
                .isCorrect(correct)
                .pendingManualEvaluation(false)
                .build();
    }
}
