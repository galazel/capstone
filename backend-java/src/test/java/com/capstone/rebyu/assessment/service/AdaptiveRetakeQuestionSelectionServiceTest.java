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
import com.capstone.rebyu.assessment.repository.QuestionSelectionView;
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
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
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

    /**
     * Every question this test has invented, by id. The selector now sifts
     * projections and only loads whole entities for what it picked, so the
     * mocks have to be able to answer both ways for the same question.
     */
    private final Map<Long, Question> bank = new LinkedHashMap<>();

    @BeforeEach
    void setUp() {
        service = newService(new RetakeProperties());

        lesson = new Lesson();
        lesson.setLessonId(LESSON_ID);
    }

    private AdaptiveRetakeQuestionSelectionService newService(RetakeProperties properties) {
        return new AdaptiveRetakeQuestionSelectionService(
                attemptRepository, attemptQuestionRepository, attemptAnswerRepository,
                questionRepository, eligibleQuestionService,
                new BktEventFactory(new BktProperties()),
                properties,
                new ObjectMapper());
    }

    /** Registers a question in the bank so both mocks can resolve it later. */
    private Question question(long id, String difficulty) {
        Question question = Question.builder()
                .questionId(id)
                .questionType("MCQ")
                .difficultyLevel(difficulty)
                .questionText("q" + id)
                .lesson(lesson)
                .totalPoints(BigDecimal.ONE)
                .build();
        bank.put(id, question);
        return question;
    }

    /** Flat projection over a registered question, as the repository would return. */
    private QuestionSelectionView view(long id) {
        return new TestView(bank.get(id));
    }

    private List<QuestionSelectionView> views(long... ids) {
        List<QuestionSelectionView> result = new ArrayList<>();
        for (long id : ids) {
            result.add(view(id));
        }
        return result;
    }

    /**
     * Stubs both id-driven lookups off {@link #bank}, so a test only has to say
     * which questions exist rather than which query returns what.
     */
    @SuppressWarnings("unchecked")
    private void stubBankLookups() {
        when(questionRepository.findSelectionViewsByIdIn(any())).thenAnswer(invocation ->
                ((Collection<Long>) invocation.getArgument(0)).stream()
                        .filter(bank::containsKey)
                        .map(this::view)
                        .toList());
        when(questionRepository.findForAttemptByIdIn(any())).thenAnswer(invocation ->
                ((Collection<Long>) invocation.getArgument(0)).stream()
                        .filter(bank::containsKey)
                        .map(bank::get)
                        .toList());
    }

    @Test
    void boostsTheWeakDifficultyTierAndReducesTheStrongOne() {
        // Baseline exam: 2 EASY + 2 AVERAGE questions.
        List<ExamQuestion> baseline = List.of(
                ExamQuestion.builder().examQuestionId(1L).question(question(1L, "EASY")).displayOrder(1).build(),
                ExamQuestion.builder().examQuestionId(2L).question(question(2L, "EASY")).displayOrder(2).build(),
                ExamQuestion.builder().examQuestionId(3L).question(question(3L, "AVERAGE")).displayOrder(3).build(),
                ExamQuestion.builder().examQuestionId(4L).question(question(4L, "AVERAGE")).displayOrder(4).build());

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

        // Question bank has a real surplus pool to draw fresh questions from.
        question(10L, "EASY");
        question(11L, "EASY");
        question(12L, "AVERAGE");
        question(13L, "AVERAGE");
        question(14L, "HARD");
        question(15L, "HARD");
        stubBankLookups();
        when(eligibleQuestionService.resolveScopeViews(any(), any(), any(), anyLong()))
                .thenReturn(views(1L, 2L, 10L, 11L, 3L, 4L, 12L, 13L, 14L, 15L));

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
        List<ExamQuestion> baseline = List.of(
                ExamQuestion.builder().examQuestionId(1L).question(question(1L, "EASY")).displayOrder(1).build(),
                ExamQuestion.builder().examQuestionId(2L).question(question(2L, "EASY")).displayOrder(2).build(),
                ExamQuestion.builder().examQuestionId(3L).question(question(3L, "AVERAGE")).displayOrder(3).build(),
                ExamQuestion.builder().examQuestionId(4L).question(question(4L, "AVERAGE")).displayOrder(4).build());

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
        stubBankLookups();
        when(eligibleQuestionService.resolveScopeViews(any(), any(), any(), anyLong()))
                .thenReturn(views(1L, 2L, 3L, 4L));

        AdaptiveRetakeQuestionSelectionService.Selection selection = service.select(exam, 2L, baseline);

        assertEquals(4, selection.questions().size(),
                "must still assemble exactly 4 questions by repeating/falling back to baseline even with zero fresh supply");
    }

    /**
     * The paper's order is decided before the entities are fetched, and an
     * {@code IN} query returns rows in whatever order it likes. If the selector
     * ever trusts the repository's order, a retake's shuffle silently becomes
     * primary-key order -- which looks fine in every count-based assertion
     * above and is wrong on the learner's screen.
     */
    @Test
    void keepsTheChosenOrderRatherThanTheOrderTheDatabaseReturns() {
        List<ExamQuestion> baseline = List.of(
                ExamQuestion.builder().examQuestionId(1L).question(question(3L, "EASY")).displayOrder(1).build(),
                ExamQuestion.builder().examQuestionId(2L).question(question(1L, "EASY")).displayOrder(2).build(),
                ExamQuestion.builder().examQuestionId(3L).question(question(2L, "AVERAGE")).displayOrder(3).build());

        Exam exam = Exam.builder().examId(9L).lesson(lesson).totalQuestions(3).build();

        // Adaptive selection off: select() returns the baseline list straight
        // through, so the only thing under test is the ordering guarantee.
        RetakeProperties disabled = new RetakeProperties();
        disabled.setEnabled(false);

        // The repository answers in ascending id order -- deliberately NOT the
        // order the exam asked for.
        when(questionRepository.findForAttemptByIdIn(any())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Collection<Long> ids = invocation.getArgument(0);
            return ids.stream().sorted().map(bank::get).toList();
        });

        AdaptiveRetakeQuestionSelectionService.Selection selection =
                newService(disabled).select(exam, 2L, baseline);

        assertEquals(List.of(3L, 1L, 2L),
                selection.questions().stream().map(Question::getQuestionId).toList(),
                "questions must come back in the exam's order, not the database's");
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

    /** Stands in for the interface projection Spring Data would materialize. */
    private record TestView(Question question) implements QuestionSelectionView {
        @Override
        public Long getQuestionId() {
            return question.getQuestionId();
        }

        @Override
        public Long getLessonId() {
            return question.getLesson().getLessonId();
        }

        @Override
        public String getDifficultyLevel() {
            return question.getDifficultyLevel();
        }

        @Override
        public String getQuestionText() {
            return question.getQuestionText();
        }

        @Override
        public Long getOwnerGroupId() {
            return null;
        }
    }
}
