package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.aigateway.service.AiAnswerGradingService;
import com.capstone.rebyu.assessment.dto.attempt.LearnerAttemptDtos.*;
import com.capstone.rebyu.assessment.dto.attempt.ProgrammingAttemptDtos.*;
import com.capstone.rebyu.assessment.entity.*;
import com.capstone.rebyu.assessment.repository.*;
import com.capstone.rebyu.billing.service.LearnerEntitlementService;
import com.capstone.rebyu.bkt.service.BktOutboxService;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.diagram.service.DiagramGradingService;
import com.capstone.rebyu.gamification.RewardService;
import com.capstone.rebyu.gamification.service.StreakService;
import com.capstone.rebyu.progress.service.AchievementAwardService;
import com.capstone.rebyu.diagram.service.DiagramGraphExtractor;
import com.capstone.rebyu.execution.dto.CodeExecutionResultDto;
import com.capstone.rebyu.execution.service.CodeExecutionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AssessmentAttemptServiceTest {

    @Mock private ExamRepository examRepository;
    @Mock private ExamQuestionRepository examQuestionRepository;
    @Mock private QuestionRepository questionRepository;
    @Mock private TextQuestionConfigRepository textQuestionConfigRepository;
    @Mock private ProgrammingQuestionConfigRepository programmingQuestionConfigRepository;
    @Mock private DiagramQuestionConfigRepository diagramQuestionConfigRepository;
    @Mock private AssessmentAttemptRepository attemptRepository;
    @Mock private AssessmentAttemptQuestionRepository attemptQuestionRepository;
    @Mock private AssessmentAttemptAnswerRepository attemptAnswerRepository;
    @Mock private LearnerCertificationRepository learnerCertificationRepository;
    /* The institution-sponsored route into an assessment. Left unstubbed on
       purpose: Mockito's default `false` is "not sponsored", so these tests keep
       reaching the gate through their own direct enrollment, which is what they
       are about. */
    @Mock private OrganizationCertificationLearnerRepository organizationCertificationLearnerRepository;
    @Mock private ExamResultRepository examResultRepository;
    @Mock private AssessmentAttemptExecutionRepository attemptExecutionRepository;
    @Mock private QuestionRubricCriterionRepository questionRubricCriterionRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private LearnerEntitlementService learnerEntitlementService;
    @Mock private BktOutboxService bktOutboxService;
    @Mock private AiAnswerGradingService aiAnswerGradingService;
    @Mock private CodeExecutionService codeExecutionService;
    @Mock private AdaptiveRetakeQuestionSelectionService adaptiveRetakeQuestionSelectionService;
    @Mock private AssessmentEventProducer assessmentEventProducer;
    @Mock private RewardService rewardService;
    @Mock private StreakService streakService;
    @Mock private AchievementAwardService achievementAwardService;

    private AssessmentAttemptService service;

    private Exam exam;
    private Question mcqQuestion;

    @BeforeEach
    void setUp() {
        service = new AssessmentAttemptService(
                examRepository, examQuestionRepository, questionRepository,
                textQuestionConfigRepository, programmingQuestionConfigRepository,
                diagramQuestionConfigRepository, attemptRepository,
                attemptQuestionRepository, attemptAnswerRepository,
                learnerCertificationRepository, organizationCertificationLearnerRepository,
                examResultRepository,
                attemptExecutionRepository, questionRubricCriterionRepository,
                lessonRepository, learnerEntitlementService, bktOutboxService,
                new ObjectMapper(), aiAnswerGradingService, codeExecutionService,
                new DiagramGradingService(new DiagramGraphExtractor()),
                new AttemptGradingBatchService(8, 4, 4),
                adaptiveRetakeQuestionSelectionService, assessmentEventProducer,
                rewardService, streakService, achievementAwardService);

        Certification certification = new Certification();
        certification.setCertificationId(1L);

        ExamType type = new ExamType();
        type.setExamTypeId(1L);
        type.setExamTypeText("MOCK_EXAM");

        exam = Exam.builder()
                .examId(5L)
                .certification(certification)
                .examType(type)
                .title("Mock Exam 1")
                .totalQuestions(1)
                .passingScore(new BigDecimal("50"))
                .status(Exam.Status.PUBLISHED)
                .build()
        ;

        Lesson lesson = new Lesson();
        lesson.setLessonId(7L);

        mcqQuestion = new Question();
        mcqQuestion.setQuestionId(100L);
        mcqQuestion.setQuestionType("MULTIPLE_CHOICE");
        mcqQuestion.setDifficultyLevel("EASY");
        mcqQuestion.setQuestionText("What does PDCA stand for?");
        mcqQuestion.setLesson(lesson);
        mcqQuestion.setTotalPoints(BigDecimal.ONE);
        Choice correct = new Choice();
        correct.setChoiceId(1000L);
        correct.setChoiceText("Plan Do Check Act");
        correct.setCorrect(true);
        Choice wrong = new Choice();
        wrong.setChoiceId(1001L);
        wrong.setChoiceText("Plan Design Create Analyze");
        wrong.setCorrect(false);
        mcqQuestion.setChoices(new ArrayList<>(List.of(correct, wrong)));
    }

    private void stubActiveEnrollment() {
        LearnerCertification enrollment = LearnerCertification.builder()
                .learnerCertificationId(40L)
                .status(LearnerCertification.Status.active)
                .diagnosticCompletedAt(LocalDateTime.now())
                .build();
        lenient().when(learnerCertificationRepository
                .findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        anyLong(), anyLong(), any()))
                .thenReturn(Optional.of(enrollment));
        // The shared exam fixture is a MOCK_EXAM, which resolveLockReason gates
        // behind a Pro/institutional entitlement; grant it so these tests can
        // exercise start/submit without also modeling billing.
        lenient().when(learnerEntitlementService.hasLearnerEntitlement(anyLong(), any(), anyLong()))
                .thenReturn(true);
    }

    @Test
    void startSnapshotsQuestionsWithoutAnswerKeys() {
        stubActiveEnrollment();
        when(examRepository.findById(5L)).thenReturn(Optional.of(exam));
        lenient().when(examRepository.findAll()).thenReturn(List.of(exam));
        when(attemptRepository.findFirstByExam_ExamIdAndLearnerIdAndStatus(
                5L, 2L, AssessmentAttempt.Status.IN_PROGRESS))
                .thenReturn(Optional.empty());
        when(attemptRepository.findTopByExam_ExamIdAndLearnerIdOrderByAttemptNumberDesc(5L, 2L))
                .thenReturn(Optional.empty());
        ExamQuestion link = ExamQuestion.builder()
                .examQuestionId(50L).exam(exam).question(mcqQuestion).displayOrder(1).build();
        when(examQuestionRepository.findByExam_ExamIdOrderByDisplayOrderAsc(5L))
                .thenReturn(List.of(link));
        // A first attempt now fetches its questions whole in one query rather
        // than walking each ExamQuestion's lazy proxy (Question drags three
        // EAGER one-to-one configs behind it, so the proxy walk cost three
        // extra round trips per question).
        when(questionRepository.findForAttemptByIdIn(List.of(100L)))
                .thenReturn(List.of(mcqQuestion));
        when(attemptRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttempt attempt = inv.getArgument(0);
            attempt.setAssessmentAttemptId(77L);
            return attempt;
        });
        List<AssessmentAttemptQuestion> savedSnapshots = new ArrayList<>();
        when(attemptQuestionRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttemptQuestion snapshot = inv.getArgument(0);
            snapshot.setAttemptQuestionId((long) (savedSnapshots.size() + 1));
            savedSnapshots.add(snapshot);
            return snapshot;
        });
        when(attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(77L))
                .thenAnswer(inv -> savedSnapshots);
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptId(77L))
                .thenReturn(List.of());

        AssessmentAttemptStartResponseDto response =
                service.startAttempt(5L, 2L, "start-key");

        assertEquals(1, response.questions().size());
        assertEquals(2, response.questions().get(0).choices().size());
        // The snapshot JSON must not leak correctness flags or explanations.
        String snapshotJson = savedSnapshots.get(0).getQuestionDataSnapshot();
        assertFalse(snapshotJson.contains("correct"));
        assertFalse(snapshotJson.contains("explanation"));
    }

    @Test
    void submitScoresMcqServerSideAndIsIdempotent() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(77L)
                .exam(exam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(LocalDateTime.now().minusMinutes(5))
                .build();
        when(attemptRepository.findById(77L)).thenReturn(Optional.of(attempt));

        AssessmentAttemptQuestion snapshot = AssessmentAttemptQuestion.builder()
                .attemptQuestionId(1L)
                .attempt(attempt)
                .sourceQuestionId(100L)
                .questionType("MULTIPLE_CHOICE")
                .questionTextSnapshot(mcqQuestion.getQuestionText())
                .displayOrder(1)
                .points(BigDecimal.ONE)
                .lessonId(7L)
                .build();
        when(attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(77L))
                .thenReturn(List.of(snapshot));
        when(attemptQuestionRepository.findById(1L)).thenReturn(Optional.of(snapshot));
        lenient().when(questionRepository.findById(100L)).thenReturn(Optional.of(mcqQuestion));
        // getResult loads the paper's source questions in ONE batched query now,
        // not findById per item -- see AssessmentAttemptService.getResult.
        lenient().when(questionRepository.findForAttemptByIdIn(List.of(100L)))
                .thenReturn(List.of(mcqQuestion));

        List<AssessmentAttemptAnswer> answers = new ArrayList<>();
        when(attemptAnswerRepository
                .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(77L, 1L))
                .thenAnswer(inv -> answers.stream().findFirst());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptId(77L))
                .thenAnswer(inv -> answers);
        when(attemptAnswerRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttemptAnswer answer = inv.getArgument(0);
            answer.setAttemptAnswerId(500L);
            if (!answers.contains(answer)) answers.add(answer);
            return answer;
        });
        when(attemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(examResultRepository.existsById(any())).thenReturn(false);

        // Learner picks the correct choice; the client sends no scores.
        SubmitAssessmentAttemptRequestDto request =
                new SubmitAssessmentAttemptRequestDto(2L, List.of(
                        new AttemptAnswerDraftDto(1L, null, 1000L, null, null, null)));

        AssessmentAttemptResultDto result = service.submitAttempt(77L, request);

        assertEquals(0, new BigDecimal("100.00").compareTo(result.percentage()));
        assertTrue(result.passed());
        assertEquals(1, result.correctCount());
        assertEquals(AssessmentAttempt.Status.SUBMITTED, attempt.getStatus());

        // A second submit returns the existing result without re-scoring.
        AssessmentAttemptResultDto again = service.submitAttempt(77L, request);
        assertEquals(result.percentage(), again.percentage());
        verify(examResultRepository, times(1)).save(any());
    }

    @Test
    void getResultHidesCorrectAnswerWhenReleaseAnswersIsDisabled() {
        Certification certification = new Certification();
        certification.setCertificationId(1L);
        ExamType type = new ExamType();
        type.setExamTypeId(1L);
        type.setExamTypeText("MOCK_EXAM");
        Exam noReleaseExam = Exam.builder()
                .examId(6L)
                .certification(certification)
                .examType(type)
                .title("Locked Answers Exam")
                .totalQuestions(1)
                .passingScore(new BigDecimal("50"))
                .status(Exam.Status.PUBLISHED)
                .releaseAnswersAfterSubmit(false)
                .build();

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(82L)
                .exam(noReleaseExam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.SUBMITTED)
                .startedAt(LocalDateTime.now().minusMinutes(5))
                .submittedAt(LocalDateTime.now())
                .totalPoints(BigDecimal.ONE)
                .earnedPoints(BigDecimal.ONE)
                .percentage(new BigDecimal("100.00"))
                .passed(true)
                .build();
        when(attemptRepository.findById(82L)).thenReturn(Optional.of(attempt));

        AssessmentAttemptQuestion snapshot = AssessmentAttemptQuestion.builder()
                .attemptQuestionId(6L)
                .attempt(attempt)
                .sourceQuestionId(100L)
                .questionType("MULTIPLE_CHOICE")
                .questionTextSnapshot(mcqQuestion.getQuestionText())
                .displayOrder(1)
                .points(BigDecimal.ONE)
                .lessonId(7L)
                .build();
        when(attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(82L))
                .thenReturn(List.of(snapshot));
        lenient().when(questionRepository.findById(100L)).thenReturn(Optional.of(mcqQuestion));
        // getResult loads the paper's source questions in ONE batched query now,
        // not findById per item -- see AssessmentAttemptService.getResult.
        lenient().when(questionRepository.findForAttemptByIdIn(List.of(100L)))
                .thenReturn(List.of(mcqQuestion));

        AssessmentAttemptAnswer answer = AssessmentAttemptAnswer.builder()
                .attemptAnswerId(900L)
                .attempt(attempt)
                .attemptQuestion(snapshot)
                .selectedChoiceId(1000L)
                .isCorrect(true)
                .earnedPoints(BigDecimal.ONE)
                .pendingManualEvaluation(false)
                .build();
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptId(82L))
                .thenReturn(List.of(answer));

        AssessmentAttemptResultDto result = service.getResult(82L, 2L);

        assertNull(result.answers().get(0).correctChoiceText());
        assertNull(result.answers().get(0).explanation());
        // The learner's own selection is always visible, regardless of the
        // release setting — only the answer key is gated.
        assertEquals("Plan Do Check Act", result.answers().get(0).selectedChoiceText());
    }

    @Test
    void listAttemptsForAssessmentReturnsAllRetakesNewestFirst() {
        AssessmentAttempt older = AssessmentAttempt.builder()
                .assessmentAttemptId(10L).exam(exam).learnerId(2L).attemptNumber(1)
                .status(AssessmentAttempt.Status.SUBMITTED)
                .startedAt(LocalDateTime.now().minusDays(2))
                .submittedAt(LocalDateTime.now().minusDays(2))
                .percentage(new BigDecimal("60.00")).passed(false)
                .totalPoints(BigDecimal.TEN).earnedPoints(new BigDecimal("6.00"))
                .durationSeconds(300)
                .build();
        AssessmentAttempt newer = AssessmentAttempt.builder()
                .assessmentAttemptId(11L).exam(exam).learnerId(2L).attemptNumber(2)
                .status(AssessmentAttempt.Status.SUBMITTED)
                .startedAt(LocalDateTime.now())
                .submittedAt(LocalDateTime.now())
                .percentage(new BigDecimal("90.00")).passed(true)
                .totalPoints(BigDecimal.TEN).earnedPoints(new BigDecimal("9.00"))
                .durationSeconds(280)
                .build();
        // Retakes never remove or overwrite earlier attempts — both rows
        // must come back, most recent attempt number first.
        when(attemptRepository.findByExam_ExamIdAndLearnerIdOrderByAttemptNumberDesc(5L, 2L))
                .thenReturn(List.of(newer, older));

        List<AttemptSummaryDto> summaries = service.listAttemptsForAssessment(5L, 2L);

        assertEquals(2, summaries.size());
        assertEquals(2, summaries.get(0).attemptNumber());
        assertTrue(summaries.get(0).passed());
        assertEquals(1, summaries.get(1).attemptNumber());
        assertFalse(summaries.get(1).passed());
    }

    @Test
    void submitGradesDescriptiveAnswerWithAiAndAppliesPartialCredit() {
        Question descriptiveQuestion = new Question();
        descriptiveQuestion.setQuestionId(200L);
        descriptiveQuestion.setQuestionType("DESCRIPTIVE");
        descriptiveQuestion.setQuestionText("Justify your database indexing choice for this workload.");

        TextQuestionConfig config = TextQuestionConfig.builder()
                .textQuestionConfigId(9L)
                .correctAnswer("Must mention B-tree vs hash trade-offs and query pattern.")
                .checkingMethod("AI_SEMANTIC")
                .build();
        when(textQuestionConfigRepository.findByQuestion_QuestionId(200L))
                .thenReturn(Optional.of(config));
        when(questionRubricCriterionRepository
                .findByQuestion_QuestionIdOrderByDisplayOrderAsc(200L))
                .thenReturn(List.of());

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(78L)
                .exam(exam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(LocalDateTime.now().minusMinutes(5))
                .build();
        when(attemptRepository.findById(78L)).thenReturn(Optional.of(attempt));

        AssessmentAttemptQuestion snapshot = AssessmentAttemptQuestion.builder()
                .attemptQuestionId(2L)
                .attempt(attempt)
                .sourceQuestionId(200L)
                .questionType("DESCRIPTIVE")
                .questionTextSnapshot(descriptiveQuestion.getQuestionText())
                .displayOrder(1)
                .points(new BigDecimal("10.00"))
                .lessonId(7L)
                .build();
        when(attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(78L))
                .thenReturn(List.of(snapshot));
        when(attemptQuestionRepository.findById(2L)).thenReturn(Optional.of(snapshot));
        lenient().when(questionRepository.findById(200L)).thenReturn(Optional.of(descriptiveQuestion));
        // getResult loads the paper's source questions in ONE batched query now,
        // not findById per item -- see AssessmentAttemptService.getResult.
        lenient().when(questionRepository.findForAttemptByIdIn(List.of(200L)))
                .thenReturn(List.of(descriptiveQuestion));

        List<AssessmentAttemptAnswer> answers = new ArrayList<>();
        when(attemptAnswerRepository
                .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(78L, 2L))
                .thenAnswer(inv -> answers.stream().findFirst());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptId(78L))
                .thenAnswer(inv -> answers);
        when(attemptAnswerRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttemptAnswer answer = inv.getArgument(0);
            answer.setAttemptAnswerId(600L);
            if (!answers.contains(answer)) answers.add(answer);
            return answer;
        });
        when(attemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(examResultRepository.existsById(any())).thenReturn(false);

        // The AI grader awards partial credit and feedback — auto-finalized,
        // no admin review step.
        when(aiAnswerGradingService.grade(any())).thenReturn(Optional.of(
                new com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto(
                        new BigDecimal("7.00"),
                        "Good reasoning but missing the query-pattern trade-off.",
                        List.of())));

        SubmitAssessmentAttemptRequestDto request =
                new SubmitAssessmentAttemptRequestDto(2L, List.of(
                        new AttemptAnswerDraftDto(2L,
                                "B-trees are faster for range scans.", null, null, null, null)));

        AssessmentAttemptResultDto result = service.submitAttempt(78L, request);

        // Partial credit must reach the total even though isCorrect isn't
        // TRUE for a partially-graded descriptive answer (regression guard
        // for the earlier isCorrect-gated sum bug).
        assertEquals(0, new BigDecimal("7.00").compareTo(result.earnedPoints()));
        assertEquals(0, new BigDecimal("70.00").compareTo(result.percentage()));
        assertEquals(0, result.pendingCount());
        assertEquals("Good reasoning but missing the query-pattern trade-off.",
                result.answers().get(0).feedback());
    }

    @Test
    void checkProgrammingGradesWithJudge0AndAppliesPartialCreditNoAi() {
        Question programmingParent = new Question();
        programmingParent.setQuestionId(300L);
        programmingParent.setQuestionType("CRITICAL_THINKING");

        ProgrammingTestCase sample = ProgrammingTestCase.builder()
                .programmingTestCaseId(1L).inputData("2 3").expectedOutput("5").isSample(true).build();
        ProgrammingTestCase hidden = ProgrammingTestCase.builder()
                .programmingTestCaseId(2L).inputData("10 20").expectedOutput("30").isSample(false).build();
        ProgrammingQuestionConfig config = ProgrammingQuestionConfig.builder()
                .programmingQuestionConfigId(5L)
                .testCases(new ArrayList<>(List.of(sample, hidden)))
                .build();
        when(programmingQuestionConfigRepository.findByQuestion_QuestionId(300L))
                .thenReturn(Optional.of(config));
        lenient().when(questionRepository.findById(300L)).thenReturn(Optional.of(programmingParent));
        // getResult loads the paper's source questions in ONE batched query now,
        // not findById per item -- see AssessmentAttemptService.getResult.
        lenient().when(questionRepository.findForAttemptByIdIn(List.of(300L)))
                .thenReturn(List.of(programmingParent));
        // Neither config resolves for the diagram check, so this parent is
        // correctly routed to Judge0 (analytical/diagram detection in
        // resolveCriticalThinkingType only trips on the diagram config).
        lenient().when(diagramQuestionConfigRepository.findByQuestion_QuestionId(300L))
                .thenReturn(Optional.empty());

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(79L)
                .exam(exam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(LocalDateTime.now().minusMinutes(2))
                .build();
        when(attemptRepository.findById(79L)).thenReturn(Optional.of(attempt));

        String snapshotJson = "{\"testCases\":["
                + "{\"index\":1,\"label\":\"Sample 1\",\"sample\":true,\"input\":\"2 3\"},"
                + "{\"index\":2,\"label\":\"Hidden 1\",\"sample\":false,\"input\":null}]}";
        AssessmentAttemptQuestion snapshot = AssessmentAttemptQuestion.builder()
                .attemptQuestionId(3L)
                .attempt(attempt)
                .sourceQuestionId(300L)
                .questionType("CRITICAL_THINKING")
                .questionTextSnapshot("Sum two integers read from stdin.")
                .questionDataSnapshot(snapshotJson)
                .displayOrder(1)
                .points(new BigDecimal("10.00"))
                .build();
        when(attemptQuestionRepository.findById(3L)).thenReturn(Optional.of(snapshot));

        List<AssessmentAttemptAnswer> answers = new ArrayList<>();
        when(attemptAnswerRepository
                .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(79L, 3L))
                .thenAnswer(inv -> answers.stream().findFirst());
        when(attemptAnswerRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttemptAnswer answer = inv.getArgument(0);
            if (answer.getAttemptAnswerId() == null) answer.setAttemptAnswerId(700L);
            answers.removeIf(existing -> existing.getAttemptAnswerId().equals(answer.getAttemptAnswerId()));
            answers.add(answer);
            return answer;
        });
        when(attemptExecutionRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttemptExecution execution = inv.getArgument(0);
            execution.setExecutionId(900L);
            return execution;
        });

        // Judge0 (via CodeExecutionService) is deterministic and not AI: one
        // sample test passes, one hidden test fails — partial credit only.
        CodeExecutionResultDto judge0Result = new CodeExecutionResultDto(
                "COMPLETED", "5", null, 12L, 3456L, 1, 2,
                List.of(
                        new CodeExecutionResultDto.TestCaseResultDto(1, true, true, "PASSED", "5"),
                        new CodeExecutionResultDto.TestCaseResultDto(2, false, false, "FAILED", "31")));
        when(codeExecutionService.execute(any())).thenReturn(judge0Result);

        ProgrammingRunRequestDto request = new ProgrammingRunRequestDto(
                2L, "print(sum(map(int, input().split())))", "Python");

        ExecutionResultDto response = service.checkProgramming(79L, 3L, request);

        assertEquals("COMPLETED", response.status());
        assertEquals(1, response.passedTests());
        assertEquals(2, response.totalTests());

        AssessmentAttemptAnswer saved = answers.get(0);
        // Half the tests passed on a 10-point item: deterministic 5.00, no AI.
        assertEquals(0, new BigDecimal("5.00").compareTo(saved.getEarnedPoints()));
        assertFalse(saved.isPendingManualEvaluation());
        assertFalse(saved.getIsCorrect());
        assertNotNull(saved.getExecutionResult());
        assertTrue(saved.getExecutionResult().contains("\"passedTests\":1"));
        verify(aiAnswerGradingService, never()).grade(any());
    }

    private static String diagramXml(String label1, String label2, String edgeLabel) {
        return "<mxGraphModel><root>"
                + "<mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>"
                + "<mxCell id=\"2\" value=\"" + label1 + "\" style=\"rounded=0;\" vertex=\"1\" parent=\"1\">"
                + "<mxGeometry x=\"0\" y=\"0\" width=\"80\" height=\"40\" as=\"geometry\"/></mxCell>"
                + "<mxCell id=\"3\" value=\"" + label2 + "\" style=\"rounded=0;\" vertex=\"1\" parent=\"1\">"
                + "<mxGeometry x=\"200\" y=\"0\" width=\"80\" height=\"40\" as=\"geometry\"/></mxCell>"
                + "<mxCell id=\"4\" value=\"" + edgeLabel + "\" edge=\"1\" parent=\"1\" source=\"2\" target=\"3\">"
                + "<mxGeometry relative=\"1\" as=\"geometry\"/></mxCell>"
                + "</root></mxGraphModel>";
    }

    @Test
    void submitGradesDiagramStructurallyWithNoAiAndFinalizesTheScore() {
        Question diagramParent = new Question();
        diagramParent.setQuestionId(400L);
        diagramParent.setQuestionType("CRITICAL_THINKING");

        DiagramQuestionConfig diagramConfig = DiagramQuestionConfig.builder()
                .diagramQuestionConfigId(11L)
                .diagramType("ERD")
                .referenceDiagramXml(diagramXml("Student", "Course", "enrolls in 1..*"))
                .referenceDiagramJson("{}")
                .build();
        // The config has to be ON the entity, not only behind the repository.
        // resolveCriticalThinkingType reads source.getDiagramQuestionConfig()
        // to decide this is a DIAGRAM item at all, and in production the entity
        // arrives carrying it -- findForAttemptByIdIn fetches it in its graph.
        // Stubbing only the repository left the config invisible to that check,
        // so the item was never queued for structural grading and came back
        // unscored with no element breakdown.
        diagramParent.setDiagramQuestionConfig(diagramConfig);
        lenient().when(diagramQuestionConfigRepository.findByQuestion_QuestionId(400L))
                .thenReturn(Optional.of(diagramConfig));
        lenient().when(programmingQuestionConfigRepository.findByQuestion_QuestionId(400L))
                .thenReturn(Optional.empty());
        lenient().when(questionRepository.findById(400L)).thenReturn(Optional.of(diagramParent));
        // getResult loads the paper's source questions in ONE batched query now,
        // not findById per item -- see AssessmentAttemptService.getResult.
        lenient().when(questionRepository.findForAttemptByIdIn(List.of(400L)))
                .thenReturn(List.of(diagramParent));

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(81L)
                .exam(exam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(LocalDateTime.now().minusMinutes(3))
                .build();
        when(attemptRepository.findById(81L)).thenReturn(Optional.of(attempt));

        AssessmentAttemptQuestion snapshot = AssessmentAttemptQuestion.builder()
                .attemptQuestionId(5L)
                .attempt(attempt)
                .sourceQuestionId(400L)
                .questionType("CRITICAL_THINKING")
                .questionTextSnapshot("Model the Student/Course enrollment relationship as an ERD.")
                .displayOrder(1)
                .points(new BigDecimal("10.00"))
                .build();
        when(attemptQuestionRepository.findById(5L)).thenReturn(Optional.of(snapshot));
        when(attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(81L))
                .thenReturn(List.of(snapshot));

        List<AssessmentAttemptAnswer> answers = new ArrayList<>();
        when(attemptAnswerRepository
                .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(81L, 5L))
                .thenAnswer(inv -> answers.stream().findFirst());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptId(81L))
                .thenAnswer(inv -> answers);
        when(attemptAnswerRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttemptAnswer answer = inv.getArgument(0);
            if (answer.getAttemptAnswerId() == null) answer.setAttemptAnswerId(800L);
            answers.removeIf(existing -> existing.getAttemptAnswerId().equals(answer.getAttemptAnswerId()));
            answers.add(answer);
            return answer;
        });
        when(attemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(examResultRepository.existsById(any())).thenReturn(false);

        // Learner draws a structurally identical (exact-match) diagram.
        SubmitAssessmentAttemptRequestDto request = new SubmitAssessmentAttemptRequestDto(2L, List.of(
                new AttemptAnswerDraftDto(5L, null, null, null, null,
                        diagramXml("Student", "Course", "enrolls in 1..*"))));

        AssessmentAttemptResultDto result = service.submitAttempt(81L, request);

        assertEquals(0, new BigDecimal("10.00").compareTo(result.earnedPoints()));
        assertEquals(0, result.pendingCount());
        assertNotNull(result.answers().get(0).feedback());
        verify(aiAnswerGradingService, never()).grade(any());

        // Learners must see WHICH required elements matched, and what they
        // themselves drew for each — not just the final score.
        List<DiagramElementReviewDto> elements = result.answers().get(0).diagramElements();
        assertEquals(3, elements.size()); // 2 required nodes + 1 required edge
        assertTrue(elements.stream().allMatch(DiagramElementReviewDto::matched));
        assertTrue(elements.stream()
                .anyMatch(e -> "Student".equals(e.expectedDescription())
                        && "Student".equals(e.learnerDescription())));
        assertTrue(elements.stream()
                .anyMatch(e -> "Course".equals(e.expectedDescription())
                        && "Course".equals(e.learnerDescription())));
    }

    @Test
    void submitReportsMissingDiagramElementsWhenTheLearnerOmitsARequiredNode() {
        Question diagramParent = new Question();
        diagramParent.setQuestionId(401L);
        diagramParent.setQuestionType("CRITICAL_THINKING");

        DiagramQuestionConfig diagramConfig = DiagramQuestionConfig.builder()
                .diagramQuestionConfigId(12L)
                .diagramType("ERD")
                .referenceDiagramXml(diagramXml("Student", "Course", "enrolls in 1..*"))
                .referenceDiagramJson("{}")
                .build();
        // The config has to be ON the entity, not only behind the repository.
        // resolveCriticalThinkingType reads source.getDiagramQuestionConfig()
        // to decide this is a DIAGRAM item at all, and in production the entity
        // arrives carrying it -- findForAttemptByIdIn fetches it in its graph.
        // Stubbing only the repository left the config invisible to that check,
        // so the item was never queued for structural grading and came back
        // unscored with no element breakdown.
        diagramParent.setDiagramQuestionConfig(diagramConfig);
        lenient().when(diagramQuestionConfigRepository.findByQuestion_QuestionId(401L))
                .thenReturn(Optional.of(diagramConfig));
        lenient().when(programmingQuestionConfigRepository.findByQuestion_QuestionId(401L))
                .thenReturn(Optional.empty());
        lenient().when(questionRepository.findById(401L)).thenReturn(Optional.of(diagramParent));
        // getResult loads the paper's source questions in ONE batched query now,
        // not findById per item -- see AssessmentAttemptService.getResult.
        lenient().when(questionRepository.findForAttemptByIdIn(List.of(401L)))
                .thenReturn(List.of(diagramParent));

        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(83L)
                .exam(exam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(LocalDateTime.now().minusMinutes(3))
                .build();
        when(attemptRepository.findById(83L)).thenReturn(Optional.of(attempt));

        AssessmentAttemptQuestion snapshot = AssessmentAttemptQuestion.builder()
                .attemptQuestionId(7L)
                .attempt(attempt)
                .sourceQuestionId(401L)
                .questionType("CRITICAL_THINKING")
                .questionTextSnapshot("Model the Student/Course enrollment relationship as an ERD.")
                .displayOrder(1)
                .points(new BigDecimal("10.00"))
                .build();
        when(attemptQuestionRepository.findById(7L)).thenReturn(Optional.of(snapshot));
        when(attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(83L))
                .thenReturn(List.of(snapshot));

        List<AssessmentAttemptAnswer> answers = new ArrayList<>();
        when(attemptAnswerRepository
                .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(83L, 7L))
                .thenAnswer(inv -> answers.stream().findFirst());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptId(83L))
                .thenAnswer(inv -> answers);
        when(attemptAnswerRepository.save(any())).thenAnswer(inv -> {
            AssessmentAttemptAnswer answer = inv.getArgument(0);
            if (answer.getAttemptAnswerId() == null) answer.setAttemptAnswerId(801L);
            answers.removeIf(existing -> existing.getAttemptAnswerId().equals(answer.getAttemptAnswerId()));
            answers.add(answer);
            return answer;
        });
        when(attemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(examResultRepository.existsById(any())).thenReturn(false);

        // Learner draws only "Student" — "Course" and the relationship are missing.
        String learnerXml = "<mxGraphModel><root>"
                + "<mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>"
                + "<mxCell id=\"2\" value=\"Student\" style=\"rounded=0;\" vertex=\"1\" parent=\"1\">"
                + "<mxGeometry x=\"0\" y=\"0\" width=\"80\" height=\"40\" as=\"geometry\"/></mxCell>"
                + "</root></mxGraphModel>";
        SubmitAssessmentAttemptRequestDto request = new SubmitAssessmentAttemptRequestDto(2L, List.of(
                new AttemptAnswerDraftDto(7L, null, null, null, null, learnerXml)));

        AssessmentAttemptResultDto result = service.submitAttempt(83L, request);

        List<DiagramElementReviewDto> elements = result.answers().get(0).diagramElements();
        DiagramElementReviewDto courseNode = elements.stream()
                .filter(e -> "Course".equals(e.expectedDescription()))
                .findFirst().orElseThrow();
        assertFalse(courseNode.matched());
        assertNull(courseNode.learnerDescription());

        DiagramElementReviewDto studentNode = elements.stream()
                .filter(e -> "Student".equals(e.expectedDescription()))
                .findFirst().orElseThrow();
        assertTrue(studentNode.matched());
        assertEquals("Student", studentNode.learnerDescription());

        // The relationship can't exist without both endpoints.
        DiagramElementReviewDto edge = elements.stream()
                .filter(e -> "EDGE".equals(e.kind()))
                .findFirst().orElseThrow();
        assertFalse(edge.matched());

        assertTrue(result.earnedPoints().compareTo(new BigDecimal("10.00")) < 0);
    }

    @Test
    void codeChangeClearsStaleExecutionResult() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(80L)
                .exam(exam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .build();
        when(attemptRepository.findById(80L)).thenReturn(Optional.of(attempt));

        AssessmentAttemptQuestion snapshot = AssessmentAttemptQuestion.builder()
                .attemptQuestionId(4L)
                .attempt(attempt)
                .sourceQuestionId(300L)
                .questionType("CRITICAL_THINKING")
                .questionTextSnapshot("Sum two integers read from stdin.")
                .displayOrder(1)
                .points(new BigDecimal("10.00"))
                .build();
        when(attemptQuestionRepository.findById(4L)).thenReturn(Optional.of(snapshot));

        AssessmentAttemptAnswer existing = AssessmentAttemptAnswer.builder()
                .attemptAnswerId(701L)
                .attempt(attempt)
                .attemptQuestion(snapshot)
                .submittedCode("old code")
                .executionResult("{\"status\":\"COMPLETED\"}")
                .earnedPoints(new BigDecimal("10.00"))
                .isCorrect(true)
                .pendingManualEvaluation(false)
                .build();
        when(attemptAnswerRepository
                .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(80L, 4L))
                .thenReturn(Optional.of(existing));
        when(attemptAnswerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.autosaveAnswers(80L, new AutosaveAnswersRequestDto(2L, List.of(
                new AttemptAnswerDraftDto(4L, null, null, "new code", "Python", null))));

        assertNull(existing.getExecutionResult());
        assertNull(existing.getEarnedPoints());
        assertNull(existing.getIsCorrect());
        assertTrue(existing.isPendingManualEvaluation());
    }

    @Test
    void submitRejectsAnswersFromAnotherLearner() {
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .assessmentAttemptId(77L)
                .exam(exam)
                .learnerId(2L)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .build();
        when(attemptRepository.findById(77L)).thenReturn(Optional.of(attempt));

        assertThrows(
                jakarta.persistence.EntityNotFoundException.class,
                () -> service.submitAttempt(77L,
                        new SubmitAssessmentAttemptRequestDto(999L, List.of())));
    }
}
