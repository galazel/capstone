package com.capstone.rebyu.progress.analytics.service;

import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptAnswer;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptQuestion;
import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamType;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptAnswerRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptQuestionRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.bkt.dto.ConfidenceView;
import com.capstone.rebyu.bkt.dto.LessonPriorityView;
import com.capstone.rebyu.bkt.dto.MasteryHistoryView;
import com.capstone.rebyu.bkt.service.BktEventFactory;
import com.capstone.rebyu.bkt.service.LearnerMasteryService;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.challenge.entity.ChallengeMode;
import com.capstone.rebyu.challenge.entity.ChallengeSession;
import com.capstone.rebyu.challenge.repository.ChallengeSessionRepository;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.progress.entity.LearnerCompletedLesson;
import com.capstone.rebyu.progress.entity.LearnerCompletedLessonId;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.progress.analytics.dto.ProgressAnalyticsDtos.ProgressAnalyticsResponse;
import com.capstone.rebyu.progress.analytics.dto.ProgressAnalyticsDtos.RecommendationRow;
import com.capstone.rebyu.progress.analytics.dto.ProgressAnalyticsDtos.TopicRow;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProgressAnalyticsServiceTest {

    private static final Long LEARNER_ID = 100L;
    private static final Long CERT_ID = 1L;

    private CertificationRepository certificationRepository;
    private LearnerCertificationRepository learnerCertificationRepository;
    private AssessmentAttemptRepository assessmentAttemptRepository;
    private AssessmentAttemptQuestionRepository attemptQuestionRepository;
    private AssessmentAttemptAnswerRepository attemptAnswerRepository;
    private QuestionRepository questionRepository;
    private ChallengeSessionRepository challengeSessionRepository;
    private LessonRepository lessonRepository;
    private LearnerCompletedLessonRepository learnerCompletedLessonRepository;
    private LearnerMasteryService learnerMasteryService;
    private BktEventFactory bktEventFactory;

    private ProgressAnalyticsService service;

    @BeforeEach
    void setUp() {
        certificationRepository = mock(CertificationRepository.class);
        learnerCertificationRepository = mock(LearnerCertificationRepository.class);
        assessmentAttemptRepository = mock(AssessmentAttemptRepository.class);
        attemptQuestionRepository = mock(AssessmentAttemptQuestionRepository.class);
        attemptAnswerRepository = mock(AssessmentAttemptAnswerRepository.class);
        questionRepository = mock(QuestionRepository.class);
        challengeSessionRepository = mock(ChallengeSessionRepository.class);
        lessonRepository = mock(LessonRepository.class);
        learnerCompletedLessonRepository = mock(LearnerCompletedLessonRepository.class);
        learnerMasteryService = mock(LearnerMasteryService.class);
        bktEventFactory = mock(BktEventFactory.class);

        OrganizationCertificationLearnerRepository organizationCertificationLearnerRepository = mock(OrganizationCertificationLearnerRepository.class);

        service = new ProgressAnalyticsService(
                certificationRepository,
                learnerCertificationRepository,
                assessmentAttemptRepository,
                attemptQuestionRepository,
                attemptAnswerRepository,
                questionRepository,
                challengeSessionRepository,
                lessonRepository,
                organizationCertificationLearnerRepository,
                learnerCompletedLessonRepository,
                learnerMasteryService,
                bktEventFactory);


        // Default happy-path wiring; individual tests override as needed.
        when(certificationRepository.findById(CERT_ID)).thenReturn(Optional.of(certification(CERT_ID, "Cert")));
        when(learnerCertificationRepository.existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(LearnerCertification.Status.active))).thenReturn(true);
        when(assessmentAttemptRepository.findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(AssessmentAttempt.Status.SUBMITTED))).thenReturn(List.of());
        when(challengeSessionRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of());
        when(lessonRepository.findAllWithCategoriesByCertificationId(CERT_ID)).thenReturn(List.of());
        when(learnerCompletedLessonRepository
                .findByLearner_LearnerIdAndLesson_MiddleCategory_MajorCategory_Certification_CertificationId(
                        LEARNER_ID, CERT_ID)).thenReturn(List.of());
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(List.of(), true));
        when(learnerMasteryService.getConfidenceForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.ConfidenceResult(null, false));
        when(learnerMasteryService.getMasteryHistoryForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.MasteryHistoryResult(List.of(), true));
        when(learnerMasteryService.getReadiness(any())).thenReturn(Map.of("status", "TEMPORARILY_UNAVAILABLE"));
        when(bktEventFactory.normalizeDifficulty(any())).thenAnswer(inv -> {
            String value = inv.getArgument(0);
            return value == null ? "EASY" : value;
        });
        when(bktEventFactory.normalizeAssessmentType(anyString())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ---- helpers ----

    private Certification certification(Long id, String title) {
        Certification cert = new Certification();
        cert.setCertificationId(id);
        cert.setTitle(title);
        return cert;
    }

    private MiddleCategory middleCategory(Long id, String title, MajorCategory major) {
        MiddleCategory mc = new MiddleCategory();
        mc.setMiddleCategoryId(id);
        mc.setTitle(title);
        mc.setMajorCategory(major);
        return mc;
    }

    private MajorCategory majorCategory(Long id, String title) {
        MajorCategory major = new MajorCategory();
        major.setMajorCategoryId(id);
        major.setTitle(title);
        return major;
    }

    private Lesson lesson(Long id, String name, MiddleCategory middleCategory) {
        Lesson lesson = new Lesson();
        lesson.setLessonId(id);
        lesson.setName(name);
        lesson.setMiddleCategory(middleCategory);
        return lesson;
    }

    private ExamType examType(String text) {
        return ExamType.builder().examTypeId(1L).examTypeText(text).build();
    }

    private Exam exam(String title, String examTypeText) {
        return Exam.builder().examId(1L).title(title).examType(examType(examTypeText)).build();
    }

    private AssessmentAttempt attempt(Long id, Exam exam, BigDecimal percentage, boolean passed, LocalDateTime submittedAt) {
        return AssessmentAttempt.builder()
                .assessmentAttemptId(id)
                .exam(exam)
                .learnerId(LEARNER_ID)
                .attemptNumber(1)
                .status(AssessmentAttempt.Status.SUBMITTED)
                .startedAt(submittedAt.minusMinutes(10))
                .submittedAt(submittedAt)
                .percentage(percentage)
                .passed(passed)
                .build();
    }

    private AssessmentAttemptQuestion attemptQuestion(Long id, AssessmentAttempt attempt, Long sourceQuestionId,
                                                        String questionType, Long lessonId) {
        return AssessmentAttemptQuestion.builder()
                .attemptQuestionId(id)
                .attempt(attempt)
                .sourceQuestionId(sourceQuestionId)
                .questionType(questionType)
                .questionTextSnapshot("text")
                .displayOrder(1)
                .points(BigDecimal.ONE)
                .lessonId(lessonId)
                .build();
    }

    private AssessmentAttemptAnswer answer(AssessmentAttemptQuestion question, Boolean isCorrect, boolean pending) {
        return AssessmentAttemptAnswer.builder()
                .attemptAnswerId(question.getAttemptQuestionId() + 1000)
                .attempt(question.getAttempt())
                .attemptQuestion(question)
                .isCorrect(isCorrect)
                .pendingManualEvaluation(pending)
                .build();
    }

    private Question question(Long id, String difficulty) {
        return Question.builder().questionId(id).questionType("MULTIPLE_CHOICE")
                .difficultyLevel(difficulty).questionText("q").totalPoints(BigDecimal.ONE).build();
    }

    private LessonPriorityView priority(Long lessonId, String title, Double mastery, String tag, Integer evidenceCount) {
        return new LessonPriorityView(lessonId, title, null, null, mastery, null, null, tag, tag,
                null, List.of(), null, null, evidenceCount, null);
    }

    private ChallengeSession challengeSession(Long id, BigDecimal score, ChallengeSession.Status status, LocalDateTime endedAt) {
        return ChallengeSession.builder()
                .challengeSessionId(id)
                .challengeMode(ChallengeMode.builder().challengeModeId(1L).name("Speed Round").description("d").build())
                .startedAt(endedAt.minusMinutes(5))
                .endedAt(endedAt)
                .score(score)
                .status(status)
                .build();
    }

    private LearnerCompletedLesson completedLesson(Long lessonId, Lesson lessonEntity) {
        LearnerCompletedLessonId id = new LearnerCompletedLessonId();
        id.setLearnerId(LEARNER_ID);
        id.setLessonId(lessonId);
        return LearnerCompletedLesson.builder().id(id).lesson(lessonEntity).completedAt(LocalDateTime.now()).build();
    }

    // ---- 1: no activity ----
    @Test
    void noAssessmentsNoChallenges_returnsZerosNotFakeData() {
        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertFalse(response.hasAssessmentActivity());
        assertFalse(response.hasChallengeActivity());
        assertEquals(0, response.totalAssessmentAttempts());
        assertEquals(0, response.totalChallengeAttempts());
        assertNull(response.averageAssessmentScore());
        assertNull(response.averageChallengeScore());
        assertEquals(0, response.totalCorrectAnswers());
        assertEquals(0, response.totalIncorrectAnswers());
        assertNull(response.overallMasteryPercentage());
        assertTrue(response.weakestTopics().isEmpty());
        assertTrue(response.recentActivity().isEmpty());
    }

    // ---- 2: assessments only ----
    @Test
    void withSubmittedAttempts_computesAverageScoreAndTotals() {
        Exam examA = exam("Diagnostic", "DIAGNOSTIC");
        AssessmentAttempt a1 = attempt(1L, examA, new BigDecimal("80.00"), true, LocalDateTime.now().minusDays(1));
        AssessmentAttempt a2 = attempt(2L, examA, new BigDecimal("60.00"), false, LocalDateTime.now());
        when(assessmentAttemptRepository.findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(AssessmentAttempt.Status.SUBMITTED)))
                .thenReturn(List.of(a1, a2));
        when(attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertTrue(response.hasAssessmentActivity());
        assertEquals(2, response.totalAssessmentAttempts());
        assertEquals(70.0, response.averageAssessmentScore());
        assertEquals(2, response.scoreTrend().size());
        assertEquals(1L, response.scoreTrend().get(0).assessmentAttemptId());
    }

    // ---- 3: challenges only ----
    @Test
    void withFinishedChallengeSessions_computesGlobalChallengeStats() {
        ChallengeSession passed = challengeSession(1L, new BigDecimal("90.00"), ChallengeSession.Status.passed, LocalDateTime.now());
        ChallengeSession failed = challengeSession(2L, new BigDecimal("40.00"), ChallengeSession.Status.failed, LocalDateTime.now());
        ChallengeSession abandoned = challengeSession(3L, null, ChallengeSession.Status.abandoned, LocalDateTime.now());
        when(challengeSessionRepository.findByLearner_LearnerId(LEARNER_ID))
                .thenReturn(List.of(passed, failed, abandoned));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertTrue(response.hasChallengeActivity());
        assertEquals(2, response.totalChallengeAttempts()); // abandoned excluded
        assertEquals(65.0, response.averageChallengeScore());
        assertFalse(response.challengeStatsCertificationScoped());
    }

    // ---- 4: has mastery data ----
    @Test
    void withLessonPriorities_computesOverallMasteryFromAssessedOnly() {
        MajorCategory major = majorCategory(1L, "Major");
        MiddleCategory middle = middleCategory(1L, "Middle", major);
        Lesson lessonA = lesson(10L, "Lesson A", middle);
        Lesson lessonB = lesson(11L, "Lesson B", middle);
        when(lessonRepository.findAllWithCategoriesByCertificationId(CERT_ID)).thenReturn(List.of(lessonA, lessonB));
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(
                        List.of(priority(10L, "Lesson A", 0.9, "STRONG", 5)), true));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(90.0, response.overallMasteryPercentage());
        assertEquals(1, response.masteredTopicCount());
        assertEquals(1, response.unassessedTopicCount()); // lessonB has no priority row
    }

    // ---- 5: unassessed lessons never treated as zero mastery ----
    @Test
    void lessonsWithNoPriorityRow_countUnassessedNotZeroMastery() {
        MajorCategory major = majorCategory(1L, "Major");
        MiddleCategory middle = middleCategory(1L, "Middle", major);
        Lesson onlyLesson = lesson(20L, "Untouched", middle);
        when(lessonRepository.findAllWithCategoriesByCertificationId(CERT_ID)).thenReturn(List.of(onlyLesson));
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(List.of(), true));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(1, response.unassessedTopicCount());
        assertEquals(0, response.weakTopicCount());
        assertNull(response.overallMasteryPercentage()); // no assessed lessons -> null, not 0
    }

    // ---- 6: multiple certifications isolate data ----
    @Test
    void differentCertificationId_returnsIsolatedDataPerCertification() {
        Long otherCertId = 2L;
        when(certificationRepository.findById(otherCertId))
                .thenReturn(Optional.of(certification(otherCertId, "Other Cert")));
        when(learnerCertificationRepository.existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(otherCertId), eq(LearnerCertification.Status.active))).thenReturn(true);
        when(assessmentAttemptRepository.findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(otherCertId), eq(AssessmentAttempt.Status.SUBMITTED))).thenReturn(List.of());
        when(challengeSessionRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of());
        when(lessonRepository.findAllWithCategoriesByCertificationId(otherCertId)).thenReturn(List.of());
        when(learnerCompletedLessonRepository
                .findByLearner_LearnerIdAndLesson_MiddleCategory_MajorCategory_Certification_CertificationId(
                        LEARNER_ID, otherCertId)).thenReturn(List.of());
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, otherCertId))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(List.of(), true));
        when(learnerMasteryService.getConfidenceForAnalytics(LEARNER_ID, otherCertId))
                .thenReturn(new LearnerMasteryService.ConfidenceResult(null, false));
        when(learnerMasteryService.getMasteryHistoryForAnalytics(LEARNER_ID, otherCertId))
                .thenReturn(new LearnerMasteryService.MasteryHistoryResult(List.of(), true));

        ProgressAnalyticsResponse first = service.getProgressAnalytics(LEARNER_ID, CERT_ID);
        ProgressAnalyticsResponse second = service.getProgressAnalytics(LEARNER_ID, otherCertId);

        assertEquals(CERT_ID, first.certificationId());
        assertEquals(otherCertId, second.certificationId());
        assertEquals("Cert", first.certificationTitle());
        assertEquals("Other Cert", second.certificationTitle());
    }

    // ---- 7: category rollup averages only assessed lessons ----
    @Test
    void categoryRollup_averagesOnlyAssessedLessonsPerMiddleAndMajor() {
        MajorCategory major = majorCategory(1L, "Major");
        MiddleCategory middle = middleCategory(1L, "Middle", major);
        Lesson assessed = lesson(30L, "Assessed", middle);
        Lesson unassessed = lesson(31L, "Unassessed", middle);
        when(lessonRepository.findAllWithCategoriesByCertificationId(CERT_ID)).thenReturn(List.of(assessed, unassessed));
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(
                        List.of(priority(30L, "Assessed", 0.6, "MEDIUM_PRIORITY", 3)), true));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(1, response.categoryMastery().size()); // one major category
        var majorRow = response.categoryMastery().get(0);
        assertEquals(60.0, majorRow.masteryPercentage()); // averages only the assessed lesson
        assertEquals(2, majorRow.totalLessonCount());
        assertEquals(1, majorRow.assessedLessonCount());
        assertEquals(1, majorRow.children().size());
    }

    // ---- 8: weakest/strongest sorting ----
    @Test
    void weakestAndStrongestTopics_sortByMasteryProbabilityCorrectly() {
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(List.of(
                        priority(1L, "Highest priority weak", 0.2, "HIGHEST_PRIORITY", 3),
                        priority(2L, "Merely weak", 0.5, "MEDIUM_PRIORITY", 3),
                        priority(3L, "Strong", 0.95, "STRONG", 5),
                        priority(4L, "No evidence", 0.99, "STRONG", 0)
                ), true));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        List<TopicRow> weakest = response.weakestTopics();
        assertEquals(1L, weakest.get(0).lessonId()); // HIGHEST_PRIORITY sorts first regardless of raw value
        assertEquals(2L, weakest.get(1).lessonId());

        List<TopicRow> strongest = response.strongestTopics();
        assertEquals(3L, strongest.get(0).lessonId()); // highest mastery among lessons with evidence
        assertTrue(strongest.stream().noneMatch(t -> t.lessonId().equals(4L))); // zero-evidence topic excluded
    }

    // ---- 9 & 10: performance buckets exclude pending/unanswered, group correctly ----
    @Test
    void performanceBuckets_excludePendingAndUnansweredAndGroupByRawKeys() {
        Exam quizExam = exam("Quiz 1", "QUIZ");
        AssessmentAttempt attempt = attempt(1L, quizExam, new BigDecimal("50.00"), false, LocalDateTime.now());
        when(assessmentAttemptRepository.findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(AssessmentAttempt.Status.SUBMITTED)))
                .thenReturn(List.of(attempt));

        AssessmentAttemptQuestion correctQ = attemptQuestion(1L, attempt, 101L, "MULTIPLE_CHOICE", 10L);
        AssessmentAttemptQuestion incorrectQ = attemptQuestion(2L, attempt, 102L, "SHORT_ANSWER", 11L);
        AssessmentAttemptQuestion pendingQ = attemptQuestion(3L, attempt, 103L, "DESCRIPTIVE", 12L);
        AssessmentAttemptQuestion unansweredQ = attemptQuestion(4L, attempt, 104L, "MULTIPLE_CHOICE", 13L);
        when(attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(any()))
                .thenReturn(List.of(correctQ, incorrectQ, pendingQ, unansweredQ));

        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of(
                answer(correctQ, true, false),
                answer(incorrectQ, false, false),
                answer(pendingQ, null, true)
                // unansweredQ has no answer row at all
        ));
        when(questionRepository.findAllById(any())).thenReturn(List.of(
                question(101L, "EASY"), question(102L, "HARD"), question(103L, "EASY"), question(104L, "EASY")));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(1, response.totalCorrectAnswers());
        assertEquals(1, response.totalIncorrectAnswers());
        var difficultyBucket = response.performanceByDifficulty().stream()
                .filter(b -> b.bucketKey().equals("EASY")).findFirst().orElseThrow();
        assertEquals(1, difficultyBucket.totalAnswered()); // only the correct EASY question counts
        var assessmentTypeBucket = response.performanceByAssessmentType().stream()
                .filter(b -> b.bucketKey().equals("QUIZ")).findFirst().orElseThrow();
        assertEquals(2, assessmentTypeBucket.totalAnswered());
    }

    // ---- 11: mastery trend ----
    @Test
    void masteryTrend_mapsHistoryViewsPreservingOrder() {
        MasteryHistoryView event = new MasteryHistoryView(
                "evt-1", LEARNER_ID, CERT_ID, 10L, 0.4, 0.55, "developing", "good",
                true, "LESSON_QUIZ", "EASY", "2026-01-01T10:00:00");
        when(learnerMasteryService.getMasteryHistoryForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.MasteryHistoryResult(List.of(event), true));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(1, response.masteryTrend().size());
        assertEquals(0.4, response.masteryTrend().get(0).previousMastery());
        assertEquals(0.55, response.masteryTrend().get(0).newMastery());
    }

    // ---- 12: score trend ascending ----
    @Test
    void scoreTrend_sortsSubmittedAttemptsAscendingBySubmittedAt() {
        Exam examA = exam("Exam", "MOCK_EXAM");
        AssessmentAttempt later = attempt(2L, examA, new BigDecimal("70.00"), true, LocalDateTime.now());
        AssessmentAttempt earlier = attempt(1L, examA, new BigDecimal("60.00"), false, LocalDateTime.now().minusDays(3));
        when(assessmentAttemptRepository.findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(AssessmentAttempt.Status.SUBMITTED)))
                .thenReturn(List.of(later, earlier)); // intentionally out of order
        when(attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(1L, response.scoreTrend().get(0).assessmentAttemptId());
        assertEquals(2L, response.scoreTrend().get(1).assessmentAttemptId());
    }

    // ---- 13: recent activity merges and sorts descending ----
    @Test
    void recentActivity_mergesAssessmentsAndChallengesSortedDescending() {
        Exam examA = exam("Exam", "MOCK_EXAM");
        AssessmentAttempt oldAttempt = attempt(1L, examA, new BigDecimal("70.00"), true, LocalDateTime.now().minusDays(5));
        when(assessmentAttemptRepository.findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(AssessmentAttempt.Status.SUBMITTED)))
                .thenReturn(List.of(oldAttempt));
        when(attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());

        ChallengeSession recentChallenge = challengeSession(1L, new BigDecimal("80.00"),
                ChallengeSession.Status.passed, LocalDateTime.now());
        when(challengeSessionRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of(recentChallenge));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(2, response.recentActivity().size());
        assertEquals("CHALLENGE", response.recentActivity().get(0).activityType()); // most recent first
        assertEquals("ASSESSMENT", response.recentActivity().get(1).activityType());
    }

    // ---- 14: recommendations tiering ----
    @Test
    void recommendations_prioritizesHighestPriorityBeforeOtherTiers() {
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(List.of(
                        priority(1L, "Urgent", 0.1, "HIGHEST_PRIORITY", 3),
                        priority(2L, "High", 0.5, "HIGH_PRIORITY", 3),
                        priority(3L, "Medium", 0.6, "MEDIUM_PRIORITY", 3)
                ), true));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        List<RecommendationRow> recs = response.recommendedTopics();
        assertEquals(1L, recs.get(0).lessonId());
        assertEquals("HIGHEST_PRIORITY", recs.get(0).priorityTag());
        assertTrue(recs.stream().anyMatch(r -> r.lessonId().equals(2L)));
        assertTrue(recs.stream().anyMatch(r -> r.lessonId().equals(3L)));
    }

    // ---- 15: unauthorized / unenrolled access ----
    @Test
    void learnerNotEnrolledInCertification_throwsEntityNotFoundException() {
        when(learnerCertificationRepository.existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(LearnerCertification.Status.active))).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> service.getProgressAnalytics(LEARNER_ID, CERT_ID));
    }

    @Test
    void certificationDoesNotExist_throwsEntityNotFoundException() {
        when(certificationRepository.findById(CERT_ID)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.getProgressAnalytics(LEARNER_ID, CERT_ID));
    }

    // ---- 16: no division by zero ----
    @Test
    void zeroAttemptsAndZeroLessons_neverThrowsDivisionByZero() {
        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(0, response.totalLessonCount());
        assertNull(response.completionPercentage());
        assertTrue(response.categoryMastery().isEmpty());
        assertTrue(response.performanceByDifficulty().isEmpty());
    }

    // ---- 17: BKT unavailable vs. no observations ----
    @Test
    void bktThrowsServiceException_marksBktAvailableFalseAndTopicCountsZero() {
        when(learnerMasteryService.getLessonPrioritiesForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.LessonPrioritiesResult(List.of(), false));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertFalse(response.bktAvailable());
        assertEquals(0, response.masteredTopicCount());
        assertNull(response.overallMasteryPercentage());
    }

    // ---- 18: confidence/readiness independent null-safety ----
    @Test
    void confidenceAndReadiness_bothIndependentlyNullSafeWhenUnavailable() {
        when(learnerMasteryService.getConfidenceForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.ConfidenceResult(null, false));
        when(learnerMasteryService.getReadiness(any())).thenReturn(Map.of("status", "TEMPORARILY_UNAVAILABLE"));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertNull(response.confidencePercentage());
        assertNull(response.readinessPercentage());
    }

    @Test
    void confidence_realValueSurfacedWhenAvailable() {
        ConfidenceView confidence = new ConfidenceView(LEARNER_ID, CERT_ID, 72.5, 0.7, 2, 3, 1, 1, 7, 100.0);
        when(learnerMasteryService.getConfidenceForAnalytics(LEARNER_ID, CERT_ID))
                .thenReturn(new LearnerMasteryService.ConfidenceResult(confidence, true));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertEquals(72.5, response.confidencePercentage());
    }

    // ---- 19: challenge answer breakdown is always flagged unavailable ----
    @Test
    void challengeAnswerBreakdown_alwaysUnavailableNeverFabricated() {
        ChallengeSession passed = challengeSession(1L, new BigDecimal("90.00"), ChallengeSession.Status.passed, LocalDateTime.now());
        when(challengeSessionRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of(passed));

        ProgressAnalyticsResponse response = service.getProgressAnalytics(LEARNER_ID, CERT_ID);

        assertFalse(response.challengeAnswerBreakdownAvailable());
        assertEquals(0, response.totalCorrectAnswers()); // challenge sessions never contribute to answer totals
    }

    // ---- 20: refresh reflects newly fetched data on each call (no server-side caching) ----
    @Test
    void sameLearnerCert_secondCallReflectsNewlyAddedAttempt() {
        ProgressAnalyticsResponse before = service.getProgressAnalytics(LEARNER_ID, CERT_ID);
        assertEquals(0, before.totalAssessmentAttempts());

        Exam examA = exam("Diagnostic", "DIAGNOSTIC");
        AssessmentAttempt newAttempt = attempt(1L, examA, new BigDecimal("88.00"), true, LocalDateTime.now());
        when(assessmentAttemptRepository.findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                eq(LEARNER_ID), eq(CERT_ID), eq(AssessmentAttempt.Status.SUBMITTED)))
                .thenReturn(List.of(newAttempt));
        when(attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());
        when(attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(any())).thenReturn(List.of());

        ProgressAnalyticsResponse after = service.getProgressAnalytics(LEARNER_ID, CERT_ID);
        assertEquals(1, after.totalAssessmentAttempts());
    }
}
