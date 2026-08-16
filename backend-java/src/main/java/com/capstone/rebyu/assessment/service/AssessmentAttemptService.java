package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.aigateway.dto.AnswerGradingRequestDto;
import com.capstone.rebyu.aigateway.dto.AnswerGradingRequestDto.SubQuestionGradingRequestDto;
import com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto;
import com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto.SubAnswerGradeDto;
import com.capstone.rebyu.aigateway.service.AiAnswerGradingService;
import com.capstone.rebyu.assessment.dto.attempt.DiagramAttemptDtos.*;
import com.capstone.rebyu.assessment.dto.attempt.LearnerAttemptDtos.*;
import com.capstone.rebyu.assessment.dto.attempt.ProgrammingAttemptDtos.*;
import com.capstone.rebyu.assessment.entity.*;
import com.capstone.rebyu.assessment.repository.*;
import com.capstone.rebyu.billing.entitlement.Entitlements;
import com.capstone.rebyu.billing.service.LearnerEntitlementService;
import com.capstone.rebyu.bkt.service.BktOutboxService;
import com.capstone.rebyu.gamification.RewardService;
import com.capstone.rebyu.gamification.service.StreakService;
import com.capstone.rebyu.progress.service.AchievementAwardService;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.execution.dto.CodeExecutionRequestDto;
import com.capstone.rebyu.execution.dto.CodeExecutionRequestDto.TestCaseInputDto;
import com.capstone.rebyu.execution.dto.CodeExecutionResultDto;
import com.capstone.rebyu.execution.dto.CodeExecutionResultDto.TestCaseResultDto;
import com.capstone.rebyu.execution.service.CodeExecutionService;
import com.capstone.rebyu.diagram.dto.DiagramGradingRequestDto;
import com.capstone.rebyu.diagram.dto.DiagramGradingResultDto;
import com.capstone.rebyu.diagram.service.DiagramGradingService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;

/**
 * Transaction Two: assessment attempt lifecycle. Starts snapshot-based
 * attempts, autosaves drafts, and scores submissions server-side. Learner
 * input is never trusted for correctness or points.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentAttemptService {

    private static final Duration SUBMIT_GRACE = Duration.ofSeconds(30);
    private static final String TYPE_DIAGNOSTIC = "DIAGNOSTIC";
    private static final String TYPE_QUIZ = "QUIZ";
    private static final String TYPE_MOCK = "MOCK_EXAM";

    private final ExamRepository examRepository;
    private final ExamQuestionRepository examQuestionRepository;
    private final QuestionRepository questionRepository;
    private final TextQuestionConfigRepository textQuestionConfigRepository;
    private final ProgrammingQuestionConfigRepository programmingQuestionConfigRepository;
    private final DiagramQuestionConfigRepository diagramQuestionConfigRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAttemptQuestionRepository attemptQuestionRepository;
    private final AssessmentAttemptAnswerRepository attemptAnswerRepository;
    private final LearnerCertificationRepository learnerCertificationRepository;
    private final ExamResultRepository examResultRepository;
    private final AssessmentAttemptExecutionRepository executionRepository;
    private final QuestionRubricCriterionRepository rubricCriterionRepository;
    private final LessonRepository lessonRepository;
    private final LearnerEntitlementService learnerEntitlementService;
    private final BktOutboxService bktOutboxService;
    private final ObjectMapper objectMapper;
    private final AiAnswerGradingService aiAnswerGradingService;
    private final CodeExecutionService codeExecutionService;
    private final DiagramGradingService diagramGradingService;
    private final AdaptiveRetakeQuestionSelectionService adaptiveRetakeQuestionSelectionService;
    private final AssessmentEventProducer assessmentEventProducer;
    private final RewardService rewardService;
    private final StreakService streakService;
    private final AchievementAwardService achievementAwardService;

    /**
     * Outcome-based assessment XP: 30 for finishing, 100 for passing, 200 for
     * a perfect score.
     *
     * <p>Paid as three separate one-time awards that TOP UP to those totals
     * rather than one award whose size depends on the outcome. That matters
     * because retakes are unlimited: with a single award the first attempt's
     * result would lock in forever, so a learner who failed, studied, and came
     * back to ace the exam would keep the 30 and earn nothing for the
     * improvement -- the opposite of what the retake loop is for. Topping up
     * pays the difference instead (30, then +70 on a later pass, then +100 on
     * a later perfect), so the total always reflects the learner's BEST
     * result while each tier still pays at most once per exam.
     */
    private static final int ASSESSMENT_ATTEMPTED_XP = 30;
    private static final int ASSESSMENT_PASSED_TOPUP_XP = 70;
    private static final int ASSESSMENT_PERFECT_TOPUP_XP = 100;

    /** Percentage is stored 0-100 (scale 2), so a perfect score is 100.00. */
    private static final BigDecimal PERFECT_PERCENTAGE = new BigDecimal("100");

    private static final int MAX_EXECUTION_HISTORY = 20;

    // ------------------------------------------------------------------
    // Learner-safe assessment listing
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public LearnerAssessmentDto getLearnerAssessment(Long examId, Long learnerId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new EntityNotFoundException("Assessment not found: " + examId));
        if (exam.effectiveStatus() != Exam.Status.PUBLISHED) {
            throw new BusinessRuleException.AssessmentNotPublishedException();
        }
        String lockReason = resolveLockReason(exam, learnerId);
        long questionCount = examQuestionRepository.countByExam_ExamId(examId);
        return new LearnerAssessmentDto(
                exam.getExamId(),
                exam.getTitle(),
                exam.getExamType().getExamTypeText(),
                exam.getDescription(),
                exam.getInstructions(),
                exam.getDurationMinutes(),
                (int) questionCount,
                exam.getPassingScore(),
                lockReason == null,
                lockReason
        );
    }

    // ------------------------------------------------------------------
    // Start
    // ------------------------------------------------------------------

    @Transactional
    public AssessmentAttemptStartResponseDto startAttempt(
            Long examId, Long learnerId, String idempotencyKey) {

        if (learnerId == null) {
            throw new BusinessRuleException.InvalidAssessmentSubmissionException(
                    "A learner profile is required to start an assessment.");
        }

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<AssessmentAttempt> byKey = attemptRepository.findByIdempotencyKey(idempotencyKey);
            if (byKey.isPresent()) {
                return buildStartResponse(byKey.get(), true);
            }
        }

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new EntityNotFoundException("Assessment not found: " + examId));
        if (exam.effectiveStatus() != Exam.Status.PUBLISHED) {
            throw new BusinessRuleException.AssessmentNotPublishedException();
        }

        // Mock exams are a premium feature: require personal Pro or an
        // institution-sponsored MOCK_EXAM_ACCESS entitlement for this
        // certification before an attempt can be created (structured 403).
        if (TYPE_MOCK.equals(exam.getExamType().getExamTypeText())) {
            learnerEntitlementService.requireLearnerEntitlement(
                    learnerId, Entitlements.MOCK_EXAM_ACCESS,
                    exam.getCertification().getCertificationId());
        }

        String lockReason = resolveLockReason(exam, learnerId);
        if (lockReason != null) {
            throw new BusinessRuleException.AssessmentLockedException(lockReason);
        }

        // Resume an open attempt instead of forking a second one.
        Optional<AssessmentAttempt> inProgress = attemptRepository
                .findFirstByExam_ExamIdAndLearnerIdAndStatus(
                        examId, learnerId, AssessmentAttempt.Status.IN_PROGRESS);
        if (inProgress.isPresent()) {
            AssessmentAttempt attempt = inProgress.get();
            if (attempt.getExpiresAt() == null
                    || LocalDateTime.now().isBefore(attempt.getExpiresAt())) {
                return buildStartResponse(attempt, true);
            }
            attempt.setStatus(AssessmentAttempt.Status.EXPIRED);
            attemptRepository.save(attempt);
        }

        List<ExamQuestion> examQuestions =
                examQuestionRepository.findByExam_ExamIdOrderByDisplayOrderAsc(examId);
        if (examQuestions.isEmpty()) {
            throw new BusinessRuleException.AssessmentNotPublishedException();
        }

        int nextAttemptNumber = attemptRepository
                .findTopByExam_ExamIdAndLearnerIdOrderByAttemptNumberDesc(examId, learnerId)
                .map(previous -> previous.getAttemptNumber() + 1)
                .orElse(1);

        // Retakes (attempt #2+) get a fresh, weakness-targeted question set
        // instead of replaying the fixed exam template; attempt #1 always
        // uses the exam's authored question list, unshuffled.
        List<Question> questionsToUse;
        Map<Long, BigDecimal> pointOverrideByQuestionId = new HashMap<>();
        for (ExamQuestion examQuestion : examQuestions) {
            if (examQuestion.getPoints() != null) {
                pointOverrideByQuestionId.put(examQuestion.getQuestion().getQuestionId(), examQuestion.getPoints());
            }
        }
        String retakeBasisJson = null;
        if (nextAttemptNumber > 1) {
            AdaptiveRetakeQuestionSelectionService.Selection selection =
                    adaptiveRetakeQuestionSelectionService.select(exam, learnerId, examQuestions);
            questionsToUse = selection.questions();
            retakeBasisJson = selection.retakeBasisJson();
        } else {
            questionsToUse = examQuestions.stream().map(ExamQuestion::getQuestion).toList();
        }

        LocalDateTime now = LocalDateTime.now();
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .exam(exam)
                .learnerId(learnerId)
                .enrollmentId(findEnrollmentId(exam, learnerId))
                .attemptNumber(nextAttemptNumber)
                .status(AssessmentAttempt.Status.IN_PROGRESS)
                .startedAt(now)
                .expiresAt(exam.getDurationMinutes() != null
                        ? now.plusMinutes(exam.getDurationMinutes())
                        : null)
                .idempotencyKey(idempotencyKey != null && !idempotencyKey.isBlank()
                        ? idempotencyKey
                        : UUID.randomUUID().toString())
                .retakeBasis(retakeBasisJson)
                .build();
        attempt = attemptRepository.save(attempt);

        int order = 1;
        for (Question question : questionsToUse) {
            // Snapshot the per-assessment point value so this attempt scores by
            // what the question is worth in THIS exam; fall back to the
            // question's own total when no override was set (always the case
            // for a question the adaptive retake pulled in from outside the
            // exam's original authored list).
            BigDecimal points = pointOverrideByQuestionId.getOrDefault(
                    question.getQuestionId(), question.getTotalPoints());
            attemptQuestionRepository.save(AssessmentAttemptQuestion.builder()
                    .attempt(attempt)
                    .sourceQuestionId(question.getQuestionId())
                    .questionType(normalizeQuestionType(question.getQuestionType()))
                    .questionTextSnapshot(question.getQuestionText())
                    .questionDataSnapshot(buildLearnerSafeSnapshot(question))
                    .displayOrder(order++)
                    .points(points)
                    .lessonId(question.getLesson().getLessonId())
                    .build());
        }

        if (nextAttemptNumber > 1) {
            // Lightweight RabbitMQ trigger (ids only) alongside the
            // synchronous adaptive-retake selection above -- Phase 6 wires
            // the consumer.
            assessmentEventProducer.publishAssessmentRetakeRequested(attempt.getAssessmentAttemptId());
        }

        log.info("Started attempt {} (#{}) of exam {} for learner {}",
                attempt.getAssessmentAttemptId(), nextAttemptNumber, examId, learnerId);
        return buildStartResponse(attempt, false);
    }

    // ------------------------------------------------------------------
    // Autosave
    // ------------------------------------------------------------------

    @Transactional
    public void autosaveAnswers(Long attemptId, AutosaveAnswersRequestDto request) {
        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, request.learnerId());
        requireEditable(attempt);
        upsertAnswers(attempt, request.answers());
    }

    // ------------------------------------------------------------------
    // Per-item learner actions: flag, skip, current item
    // ------------------------------------------------------------------

    @Transactional
    public void setFlag(Long attemptId, Long attemptQuestionId, Long learnerId, boolean flagged) {
        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, learnerId);
        requireEditable(attempt);
        AssessmentAttemptQuestion question = requireAttemptQuestion(attempt, attemptQuestionId);
        question.setFlagged(flagged);
        attemptQuestionRepository.save(question);
    }

    @Transactional
    public void setSkip(Long attemptId, Long attemptQuestionId, Long learnerId, boolean skipped) {
        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, learnerId);
        requireEditable(attempt);
        AssessmentAttemptQuestion question = requireAttemptQuestion(attempt, attemptQuestionId);
        question.setSkipped(skipped);
        attemptQuestionRepository.save(question);
    }

    @Transactional
    public void setCurrentItem(Long attemptId, Long attemptQuestionId, Long learnerId) {
        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, learnerId);
        requireEditable(attempt);
        // Validate the item belongs to this attempt before recording it.
        requireAttemptQuestion(attempt, attemptQuestionId);
        attempt.setCurrentQuestionId(attemptQuestionId);
        attemptRepository.save(attempt);
    }

    private AssessmentAttemptQuestion requireAttemptQuestion(AssessmentAttempt attempt, Long attemptQuestionId) {
        AssessmentAttemptQuestion question = attemptQuestionRepository.findById(attemptQuestionId)
                .orElseThrow(() -> new BusinessRuleException.InvalidAssessmentSubmissionException(
                        "That item does not belong to this attempt."));
        if (!question.getAttempt().getAssessmentAttemptId().equals(attempt.getAssessmentAttemptId())) {
            throw new BusinessRuleException.InvalidAssessmentSubmissionException(
                    "That item does not belong to this attempt.");
        }
        return question;
    }

    /** Rejects edits once an attempt is submitted or its server clock expired. */
    private void requireEditable(AssessmentAttempt attempt) {
        if (attempt.getStatus() != AssessmentAttempt.Status.IN_PROGRESS) {
            throw new BusinessRuleException.AssessmentAttemptAlreadySubmittedException();
        }
        if (attempt.getExpiresAt() != null
                && LocalDateTime.now().isAfter(attempt.getExpiresAt().plus(SUBMIT_GRACE))) {
            throw new BusinessRuleException.AssessmentLockedException(
                    "The time limit for this assessment has passed.");
        }
    }

    // ------------------------------------------------------------------
    // Submit
    // ------------------------------------------------------------------

    @Transactional
    public AssessmentAttemptResultDto submitAttempt(
            Long attemptId, SubmitAssessmentAttemptRequestDto request) {

        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, request.learnerId());

        // Idempotent second submit returns the existing result.
        if (attempt.getStatus() == AssessmentAttempt.Status.SUBMITTED) {
            return getResult(attemptId, request.learnerId());
        }
        if (attempt.getStatus() != AssessmentAttempt.Status.IN_PROGRESS) {
            throw new BusinessRuleException.AssessmentAttemptAlreadySubmittedException();
        }
        if (attempt.getExpiresAt() != null
                && LocalDateTime.now().isAfter(attempt.getExpiresAt().plus(SUBMIT_GRACE))) {
            attempt.setStatus(AssessmentAttempt.Status.EXPIRED);
        }

        if (request.answers() != null && !request.answers().isEmpty()) {
            upsertAnswers(attempt, request.answers());
        }

        List<AssessmentAttemptQuestion> questions = attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(attemptId);
        Map<Long, AssessmentAttemptAnswer> answersByQuestion = new HashMap<>();
        for (AssessmentAttemptAnswer answer :
                attemptAnswerRepository.findByAttempt_AssessmentAttemptId(attemptId)) {
            answersByQuestion.put(answer.getAttemptQuestion().getAttemptQuestionId(), answer);
        }

        /* Every expensive grader for this paper, run per family and
           concurrently within each, before a single answer is scored. The loop
           below then reads the results instead of making the calls itself. */
        GradingBatch gradingBatch = prepareGradingBatch(questions, answersByQuestion);

        BigDecimal totalPoints = BigDecimal.ZERO;
        BigDecimal earnedPoints = BigDecimal.ZERO;

        for (AssessmentAttemptQuestion attemptQuestion : questions) {
            BigDecimal points = attemptQuestion.getPoints() == null
                    ? BigDecimal.ONE
                    : attemptQuestion.getPoints();
            totalPoints = totalPoints.add(points);

            AssessmentAttemptAnswer answer =
                    answersByQuestion.get(attemptQuestion.getAttemptQuestionId());
            if (answer == null) {
                continue;
            }
            scoreAnswer(attemptQuestion, answer, points, gradingBatch);
            attemptAnswerRepository.save(answer);
            // Partial credit (AI-graded descriptive/critical-thinking, future
            // diagram grading) sets earnedPoints without isCorrect=TRUE, so
            // gating the sum on isCorrect would silently drop that credit.
            if (answer.getEarnedPoints() != null) {
                earnedPoints = earnedPoints.add(answer.getEarnedPoints());
            }
        }

        BigDecimal percentage = totalPoints.signum() > 0
                ? earnedPoints.multiply(BigDecimal.valueOf(100))
                        .divide(totalPoints, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal passingScore = attempt.getExam().getPassingScore() == null
                ? BigDecimal.ZERO
                : attempt.getExam().getPassingScore();

        LocalDateTime now = LocalDateTime.now();
        attempt.setStatus(AssessmentAttempt.Status.SUBMITTED);
        attempt.setSubmittedAt(now);
        attempt.setTotalPoints(totalPoints);
        attempt.setEarnedPoints(earnedPoints);
        attempt.setPercentage(percentage);
        attempt.setPassed(percentage.compareTo(passingScore) >= 0);
        attempt.setDurationSeconds((int) Duration
                .between(attempt.getStartedAt(), now).getSeconds());
        attemptRepository.save(attempt);

        awardAssessmentXp(attempt);
        streakService.recordActivity(attempt.getLearnerId());
        // First Quiz / First Perfect Score / Exam Ready all hang off a submitted
        // attempt, and the evaluation reads this one back from the row saved
        // above. Idempotent, so a retake awards nothing twice.
        achievementAwardService.evaluate(attempt.getLearnerId());

        recordLegacyExamResult(attempt);
        completeDiagnosticGateIfApplicable(attempt);

        // Transactional outbox: enqueue final, lesson-mapped BKT evidence in the
        // SAME commit as the result. Dispatched to FastAPI asynchronously; an
        // unavailable BKT service can never fail or roll back this submission.
        bktOutboxService.enqueueForAttempt(attempt, questions, answersByQuestion);

        // Lightweight RabbitMQ trigger (ids only) alongside the synchronous
        // flow above -- Phase 6 wires the consumer.
        assessmentEventProducer.publishAssessmentSubmitted(attemptId);

        log.info("Attempt {} submitted: {}% ({} / {} points)",
                attemptId, percentage, earnedPoints, totalPoints);
        return getResult(attemptId, request.learnerId());
    }

    /**
     * Pays this attempt's outcome tier, topping up whatever the learner has
     * already earned on this exam (see the XP constants for why).
     *
     * <p>Every award is keyed by examId rather than attemptId: retakes are
     * unlimited, so an attempt-keyed award would let a learner farm XP by
     * resubmitting the same exam.
     */
    private void awardAssessmentXp(AssessmentAttempt attempt) {
        Long learnerId = attempt.getLearnerId();
        Long examId = attempt.getExam().getExamId();

        // Existing key and reason, so learners already paid the previous flat
        // award are not paid again for simply finishing this exam.
        rewardService.awardXp(learnerId, ASSESSMENT_ATTEMPTED_XP, "ASSESSMENT_COMPLETED",
                "assessment-completed:" + examId);

        if (!Boolean.TRUE.equals(attempt.getPassed())) {
            return;
        }
        rewardService.awardXp(learnerId, ASSESSMENT_PASSED_TOPUP_XP, "ASSESSMENT_PASSED",
                "assessment-passed:" + examId);

        if (attempt.getPercentage() != null
                && attempt.getPercentage().compareTo(PERFECT_PERCENTAGE) >= 0) {
            rewardService.awardXp(learnerId, ASSESSMENT_PERFECT_TOPUP_XP, "ASSESSMENT_PERFECT",
                    "assessment-perfect:" + examId);
        }
    }

    // ------------------------------------------------------------------
    // Result
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public AssessmentAttemptResultDto getResult(Long attemptId, Long learnerId) {
        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, learnerId);
        if (attempt.getStatus() == AssessmentAttempt.Status.IN_PROGRESS) {
            throw new BusinessRuleException.InvalidAssessmentSubmissionException(
                    "This attempt has not been submitted yet.");
        }
        // Admin-configured per-assessment setting: whether the answer key is
        // shown to the learner at all. AI/diagram feedback is never gated by
        // this — it's guidance, not the reference answer itself.
        boolean releaseAnswers = attempt.getExam().effectiveReleaseAnswers();

        List<AssessmentAttemptQuestion> questions = attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(attemptId);
        Map<Long, AssessmentAttemptAnswer> answersByQuestion = new HashMap<>();
        for (AssessmentAttemptAnswer answer :
                attemptAnswerRepository.findByAttempt_AssessmentAttemptId(attemptId)) {
            answersByQuestion.put(answer.getAttemptQuestion().getAttemptQuestionId(), answer);
        }

        List<AttemptAnswerReviewDto> reviews = new ArrayList<>();
        int correct = 0;
        int incorrect = 0;
        int pending = 0;
        int unanswered = 0;

        // Per-lesson performance for strengths / weak-area analysis (diagnostics).
        Map<Long, BigDecimal> lessonPossible = new LinkedHashMap<>();
        Map<Long, BigDecimal> lessonEarned = new LinkedHashMap<>();
        Map<Long, Integer> lessonPending = new LinkedHashMap<>();

        for (AssessmentAttemptQuestion attemptQuestion : questions) {
            AssessmentAttemptAnswer answer =
                    answersByQuestion.get(attemptQuestion.getAttemptQuestionId());
            Question source = questionRepository
                    .findById(attemptQuestion.getSourceQuestionId()).orElse(null);

            Long lessonId = attemptQuestion.getLessonId();
            if (lessonId != null) {
                BigDecimal points = attemptQuestion.getPoints() == null
                        ? BigDecimal.ZERO : attemptQuestion.getPoints();
                lessonPossible.merge(lessonId, points, BigDecimal::add);
                BigDecimal earned = (answer != null && answer.getEarnedPoints() != null)
                        ? answer.getEarnedPoints() : BigDecimal.ZERO;
                lessonEarned.merge(lessonId, earned, BigDecimal::add);
                if (answer != null && answer.isPendingManualEvaluation()) {
                    lessonPending.merge(lessonId, 1, Integer::sum);
                }
            }

            String selectedChoiceText = null;
            String correctChoiceText = null;
            String explanation = null;
            if (source != null && isMultipleChoice(source.getQuestionType())) {
                Choice correctChoice = source.getChoices().stream()
                        .filter(Choice::isCorrect).findFirst().orElse(null);
                if (releaseAnswers && correctChoice != null) {
                    correctChoiceText = correctChoice.getChoiceText();
                    explanation = correctChoice.getExplanation();
                }
                if (answer != null && answer.getSelectedChoiceId() != null) {
                    selectedChoiceText = source.getChoices().stream()
                            .filter(c -> c.getChoiceId().equals(answer.getSelectedChoiceId()))
                            .map(Choice::getChoiceText).findFirst().orElse(null);
                }
            }

            if (answer == null) {
                unanswered++;
            } else if (answer.isPendingManualEvaluation()) {
                pending++;
            } else if (Boolean.TRUE.equals(answer.getIsCorrect())) {
                correct++;
            } else {
                incorrect++;
            }

            reviews.add(new AttemptAnswerReviewDto(
                    attemptQuestion.getAttemptQuestionId(),
                    attemptQuestion.getDisplayOrder(),
                    attemptQuestion.getQuestionType(),
                    attemptQuestion.getQuestionTextSnapshot(),
                    answer == null ? null : answer.getIsCorrect(),
                    answer != null && answer.isPendingManualEvaluation(),
                    answer == null ? null : answer.getEarnedPoints(),
                    attemptQuestion.getPoints(),
                    answer == null ? null : answer.getLearnerAnswer(),
                    answer == null ? null : answer.getSelectedChoiceId(),
                    selectedChoiceText,
                    correctChoiceText,
                    explanation,
                    answer == null ? null : answer.getSubmittedCode(),
                    answer == null ? null : answer.getProgrammingLanguage(),
                    answer != null && answer.getDiagramSubmissionData() != null,
                    answer == null ? null : answer.getFeedback(),
                    buildSubQuestionAnswerReviews(source, answer),
                    buildDiagramElementReviews(answer, releaseAnswers)
            ));
        }

        List<LessonPerformanceDto> lessonBreakdown = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> entry : lessonPossible.entrySet()) {
            Long lessonId = entry.getKey();
            BigDecimal possible = entry.getValue();
            BigDecimal earned = lessonEarned.getOrDefault(lessonId, BigDecimal.ZERO);
            BigDecimal lessonPercentage = possible.signum() > 0
                    ? earned.multiply(BigDecimal.valueOf(100)).divide(possible, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            String title = lessonRepository.findById(lessonId)
                    .map(Lesson::getName).orElse("Lesson " + lessonId);
            lessonBreakdown.add(new LessonPerformanceDto(
                    lessonId, title, possible, earned, lessonPercentage,
                    lessonPending.getOrDefault(lessonId, 0)));
        }

        Exam exam = attempt.getExam();
        return new AssessmentAttemptResultDto(
                attempt.getAssessmentAttemptId(),
                exam.getExamId(),
                exam.getTitle(),
                exam.getExamType().getExamTypeText(),
                attempt.getAttemptNumber(),
                attempt.getSubmittedAt(),
                attempt.getDurationSeconds(),
                attempt.getPercentage(),
                attempt.getPassed(),
                exam.getPassingScore(),
                attempt.getTotalPoints(),
                attempt.getEarnedPoints(),
                correct, incorrect, pending, unanswered,
                reviews,
                lessonBreakdown,
                exam.getCertification().getCertificationId()
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listAttempts(Long learnerId) {
        List<Map<String, Object>> summaries = new ArrayList<>();
        for (AssessmentAttempt attempt :
                attemptRepository.findByLearnerIdOrderByStartedAtDesc(learnerId)) {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("assessmentAttemptId", attempt.getAssessmentAttemptId());
            summary.put("assessmentId", attempt.getExam().getExamId());
            summary.put("assessmentTitle", attempt.getExam().getTitle());
            summary.put("attemptNumber", attempt.getAttemptNumber());
            summary.put("status", attempt.getStatus().name());
            summary.put("startedAt", attempt.getStartedAt());
            summary.put("submittedAt", attempt.getSubmittedAt());
            summary.put("percentage", attempt.getPercentage());
            summary.put("passed", attempt.getPassed());
            summaries.add(summary);
        }
        return summaries;
    }

    /**
     * Every attempt a learner has made on one assessment, newest first —
     * the attempt-history list. Retakes never remove or overwrite earlier
     * attempts (see startAttempt), so this always reflects the full history.
     */
    @Transactional(readOnly = true)
    public List<AttemptSummaryDto> listAttemptsForAssessment(Long examId, Long learnerId) {
        List<AttemptSummaryDto> summaries = new ArrayList<>();
        for (AssessmentAttempt attempt : attemptRepository
                .findByExam_ExamIdAndLearnerIdOrderByAttemptNumberDesc(examId, learnerId)) {
            summaries.add(new AttemptSummaryDto(
                    attempt.getAssessmentAttemptId(),
                    attempt.getExam().getExamId(),
                    attempt.getExam().getTitle(),
                    attempt.getAttemptNumber(),
                    attempt.getStatus().name(),
                    attempt.getStartedAt(),
                    attempt.getSubmittedAt(),
                    attempt.getDurationSeconds(),
                    attempt.getTotalPoints(),
                    attempt.getEarnedPoints(),
                    attempt.getPercentage(),
                    attempt.getPassed()));
        }
        return summaries;
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private AssessmentAttempt requireOwnedAttempt(Long attemptId, Long learnerId) {
        AssessmentAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new EntityNotFoundException("Attempt not found: " + attemptId));
        if (learnerId == null || !attempt.getLearnerId().equals(learnerId)) {
            throw new EntityNotFoundException("Attempt not found: " + attemptId);
        }
        return attempt;
    }

    private String resolveLockReason(Exam exam, Long learnerId) {
        Long certificationId = exam.getCertification().getCertificationId();
        Optional<LearnerCertification> enrollment = learnerCertificationRepository
                .findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        learnerId, certificationId, LearnerCertification.Status.active);
        if (enrollment.isEmpty()) {
            return "Enroll in this certification before taking its assessments.";
        }
        String type = exam.getExamType().getExamTypeText();
        // Mock exams are premium: lock them for learners without personal Pro or
        // an eligible institution-sponsored entitlement (shown as locked upfront;
        // startAttempt also hard-blocks with a structured 403).
        if (TYPE_MOCK.equals(type)
                && !learnerEntitlementService.hasLearnerEntitlement(
                        learnerId, Entitlements.MOCK_EXAM_ACCESS, certificationId)) {
            return "This mock exam requires REBYU Pro or an eligible institutional license.";
        }
        // The diagnostic is a one-time placement check, not a retakeable quiz:
        // once it has completed the enrollment's gate, block starting another.
        if (TYPE_DIAGNOSTIC.equals(type) && enrollment.get().getDiagnosticCompletedAt() != null) {
            return "You have already completed the diagnostic assessment for this certification.";
        }
        if (!TYPE_DIAGNOSTIC.equals(type)
                && enrollment.get().getDiagnosticCompletedAt() == null
                && publishedDiagnosticExists(certificationId)) {
            return "Complete the diagnostic assessment before studying lessons.";
        }
        return null;
    }

    private boolean publishedDiagnosticExists(Long certificationId) {
        return examRepository.findAll().stream()
                // Only the OFFICIAL diagnostic gates the curriculum. A group's
                // own assessment is its own content and must never gate
                // learners outside (or inside) that group.
                .filter(exam -> exam.getOwnerGroup() == null)
                .anyMatch(exam -> exam.getCertification().getCertificationId().equals(certificationId)
                        && TYPE_DIAGNOSTIC.equals(exam.getExamType().getExamTypeText())
                        && exam.effectiveStatus() == Exam.Status.PUBLISHED);
    }

    private Long findEnrollmentId(Exam exam, Long learnerId) {
        return learnerCertificationRepository
                .findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        learnerId,
                        exam.getCertification().getCertificationId(),
                        LearnerCertification.Status.active)
                .map(LearnerCertification::getLearnerCertificationId)
                .orElse(null);
    }

    private void completeDiagnosticGateIfApplicable(AssessmentAttempt attempt) {
        if (!TYPE_DIAGNOSTIC.equals(attempt.getExam().getExamType().getExamTypeText())) {
            return;
        }
        Optional<LearnerCertification> activeEnrollment = attempt.getEnrollmentId() != null
                ? learnerCertificationRepository.findById(attempt.getEnrollmentId())
                : learnerCertificationRepository
                        .findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                                attempt.getLearnerId(),
                                attempt.getExam().getCertification().getCertificationId(),
                                LearnerCertification.Status.active);

        activeEnrollment
                .ifPresent(enrollment -> {
                    if (enrollment.getDiagnosticCompletedAt() == null) {
                        enrollment.setDiagnosticCompletedAt(LocalDateTime.now());
                        enrollment.setDiagnosticAttemptId(attempt.getAssessmentAttemptId());
                        learnerCertificationRepository.save(enrollment);
                    }
                });
    }

    /** Keeps the pre-existing exam_results analytics table in sync. */
    private void recordLegacyExamResult(AssessmentAttempt attempt) {
        try {
            ExamResultId id = new ExamResultId();
            id.setLearnerId(attempt.getLearnerId());
            id.setExamId(attempt.getExam().getExamId());
            id.setAttemptNo(attempt.getAttemptNumber());
            if (examResultRepository.existsById(id)) {
                return;
            }
            com.capstone.rebyu.user.entity.Learner learnerRef =
                    new com.capstone.rebyu.user.entity.Learner();
            learnerRef.setLearnerId(attempt.getLearnerId());
            examResultRepository.save(ExamResult.builder()
                    .id(id)
                    .learner(learnerRef)
                    .exam(attempt.getExam())
                    .takenAt(attempt.getSubmittedAt())
                    .score(attempt.getPercentage())
                    .durationSeconds(attempt.getDurationSeconds() == null
                            ? 0 : attempt.getDurationSeconds())
                    .isPassed(Boolean.TRUE.equals(attempt.getPassed()))
                    .build());
        } catch (Exception e) {
            // Analytics sync must not fail the submission transaction result.
            log.warn("Could not record legacy exam result for attempt {}: {}",
                    attempt.getAssessmentAttemptId(), e.getMessage());
        }
    }

    private void upsertAnswers(AssessmentAttempt attempt, List<AttemptAnswerDraftDto> drafts) {
        if (drafts == null) {
            return;
        }
        for (AttemptAnswerDraftDto draft : drafts) {
            if (draft == null || draft.attemptQuestionId() == null) {
                continue;
            }
            AssessmentAttemptQuestion attemptQuestion = attemptQuestionRepository
                    .findById(draft.attemptQuestionId())
                    .orElseThrow(() -> new BusinessRuleException.InvalidAssessmentSubmissionException(
                            "One of the answers does not belong to this attempt."));
            if (!attemptQuestion.getAttempt().getAssessmentAttemptId()
                    .equals(attempt.getAssessmentAttemptId())) {
                throw new BusinessRuleException.InvalidAssessmentSubmissionException(
                        "One of the answers does not belong to this attempt.");
            }

            AssessmentAttemptAnswer answer = attemptAnswerRepository
                    .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(
                            attempt.getAssessmentAttemptId(), draft.attemptQuestionId())
                    .orElseGet(() -> AssessmentAttemptAnswer.builder()
                            .attempt(attempt)
                            .attemptQuestion(attemptQuestion)
                            .build());

            boolean unchanged =
                    equalsNullable(answer.getLearnerAnswer(), draft.learnerAnswer())
                            && equalsNullable(answer.getSelectedChoiceId(), draft.selectedChoiceId())
                            && equalsNullable(answer.getSubmittedCode(), draft.submittedCode())
                            && equalsNullable(answer.getProgrammingLanguage(), draft.programmingLanguage())
                            && equalsNullable(answer.getDiagramSubmissionData(), draft.diagramSubmissionData());
            if (unchanged && answer.getAttemptAnswerId() != null) {
                continue;
            }

            boolean codeChanged = !equalsNullable(answer.getSubmittedCode(), draft.submittedCode());

            answer.setLearnerAnswer(draft.learnerAnswer());
            answer.setSelectedChoiceId(draft.selectedChoiceId());
            answer.setSubmittedCode(draft.submittedCode());
            answer.setProgrammingLanguage(draft.programmingLanguage());
            answer.setDiagramSubmissionData(draft.diagramSubmissionData());

            // The code no longer matches whatever Judge0 last graded — clear
            // the stale result rather than let an old verdict silently
            // describe new code. A fresh Run/Check repopulates it.
            if (codeChanged && answer.getExecutionResult() != null) {
                answer.setExecutionResult(null);
                answer.setEarnedPoints(null);
                answer.setIsCorrect(null);
                answer.setPendingManualEvaluation(true);
            }

            LocalDateTime now = LocalDateTime.now();
            answer.setAnsweredAt(now);
            answer.setLastSavedAt(now);
            attemptAnswerRepository.save(answer);

            // A real answer clears any prior "skipped" state on that item.
            if (attemptQuestion.isSkipped() && hasAnswerContent(draft)) {
                attemptQuestion.setSkipped(false);
                attemptQuestionRepository.save(attemptQuestion);
            }
        }
    }

    private boolean hasAnswerContent(AttemptAnswerDraftDto draft) {
        return (draft.learnerAnswer() != null && !draft.learnerAnswer().isBlank())
                || draft.selectedChoiceId() != null
                || (draft.submittedCode() != null && !draft.submittedCode().isBlank())
                || (draft.diagramSubmissionData() != null && !draft.diagramSubmissionData().isBlank());
    }

    private static boolean equalsNullable(Object a, Object b) {
        return a == null ? b == null : a.equals(b);
    }

    private static boolean isMultipleChoice(String questionType) {
        return "MULTIPLE_CHOICE".equalsIgnoreCase(questionType)
                || "MCQ".equalsIgnoreCase(questionType);
    }

    private static String normalizeQuestionType(String questionType) {
        return isMultipleChoice(questionType) ? "MULTIPLE_CHOICE" : questionType;
    }

    private void scoreAnswer(
            AssessmentAttemptQuestion attemptQuestion,
            AssessmentAttemptAnswer answer,
            BigDecimal points,
            GradingBatch batch) {

        String type = attemptQuestion.getQuestionType();
        Question source = questionRepository
                .findById(attemptQuestion.getSourceQuestionId()).orElse(null);

        if (isMultipleChoice(type) && source != null) {
            boolean correct = answer.getSelectedChoiceId() != null
                    && source.getChoices().stream()
                            .anyMatch(choice -> choice.getChoiceId()
                                    .equals(answer.getSelectedChoiceId())
                                    && choice.isCorrect());
            answer.setIsCorrect(correct);
            answer.setEarnedPoints(correct ? points : BigDecimal.ZERO);
            answer.setPendingManualEvaluation(false);
            return;
        }

        if ("SHORT_ANSWER".equals(type) && source != null) {
            Optional<TextQuestionConfig> config = textQuestionConfigRepository
                    .findByQuestion_QuestionId(source.getQuestionId());
            if (config.isPresent()
                    && "EXACT_MATCH".equalsIgnoreCase(config.get().getCheckingMethod())
                    && answer.getLearnerAnswer() != null) {
                boolean correct = matchesTextAnswer(answer.getLearnerAnswer(), config.get());
                answer.setIsCorrect(correct);
                answer.setEarnedPoints(correct ? points : BigDecimal.ZERO);
                answer.setPendingManualEvaluation(false);
                return;
            }

            // AI_SEMANTIC short answers were falling straight through to
            // pending. The grader they need already exists and
            // `rubricGuidanceFor` is already written to return the reference
            // answer for exactly this checking method -- only the branch
            // routing them into it was missing, so a question authored to be
            // marked by meaning rather than by string equality could never be
            // marked at all. Graded against the same rubric path descriptive
            // answers use.
            if (config.isPresent()
                    && "AI_SEMANTIC".equalsIgnoreCase(config.get().getCheckingMethod())
                    && gradeDescriptiveAnswer(attemptQuestion, source, answer, points, batch)) {
                return;
            }
        }

        // AI grading (no admin review): descriptive answers scored against
        // their authored rubric, immediately finalized.
        if ("DESCRIPTIVE".equals(type) && source != null
                && gradeDescriptiveAnswer(attemptQuestion, source, answer, points, batch)) {
            return;
        }

        // AI grading: critical-thinking questions whose parent has neither a
        // programming nor a diagram config are plain analytical sub-question
        // sets — grade every sub-question in one holistic call.
        if ("CRITICAL_THINKING".equals(type) && source != null) {
            String criticalThinkingType = resolveCriticalThinkingType(source.getQuestionId());

            if (criticalThinkingType == null
                    && gradeCriticalThinkingAnswer(attemptQuestion, source, answer, points, batch)) {
                return;
            }

            // Programming is graded deterministically via Judge0. A learner
            // who ran Check already has that verdict and it is never
            // re-executed or overwritten here. One who never ran Check used to
            // be left pending forever, which meant submitting a finished
            // solution without pressing a button scored nothing and waited on
            // a manual review that nothing schedules -- so submit now grades
            // it against the full test set.
            if ("PROGRAMMING".equals(criticalThinkingType)) {
                if (hasDefinitiveVerdict(answer)) {
                    return;
                }
                gradeProgrammingOnSubmit(attemptQuestion, source, answer, points, batch);
                // Judge0 unreachable, or no test cases authored. Falls through
                // to the closing branch below so the item is still marked
                // rather than left pending.
                if (hasDefinitiveVerdict(answer)) {
                    return;
                }
            }

            // Deterministic structural grading against the admin's reference
            // diagram, immediately finalized — no AI, no admin review.
            if ("DIAGRAM".equals(criticalThinkingType)
                    && gradeDiagramAnswer(attemptQuestion, source, answer, points)) {
                return;
            }
        }

        // An item with nothing submitted needs no evaluator of any kind. This
        // used to fall into the pending branch below, so leaving a written item
        // blank produced "awaiting manual review" rather than the zero it
        // plainly is -- and held up the whole result waiting on a review of an
        // empty box.
        if (!hasSubmittedContent(answer)) {
            answer.setIsCorrect(false);
            answer.setEarnedPoints(BigDecimal.ZERO);
            answer.setPendingManualEvaluation(false);
            return;
        }

        /* Last resort: mark it rather than park it.
         *
         * Everything reaching this line has already been through every grader
         * that applies to it, including a retry of the AI call and a
         * rubric-free AI pass -- so this is a diagram with no reference
         * authored, or a grading service that failed twice.
         *
         * The result is closed out at zero instead of pending. That is a
         * product decision, made explicitly: a result that is complete the
         * moment it is submitted is worth more here than one that is
         * withheld for a manual review queue nothing drains. The cost is real
         * and worth naming -- an item whose reference material was never
         * authored now scores the learner zero rather than waiting for
         * someone to author it.
         *
         * The feedback says so plainly, so the zero is never silent and a
         * learner can raise it. `isCorrect=false` (not null) is what keeps it
         * out of the pending count and inside the graded totals.
         */
        log.warn("No automatic grader produced a verdict for attemptQuestion {} (type {}); "
                        + "closing it out at zero",
                attemptQuestion.getAttemptQuestionId(), type);
        answer.setIsCorrect(false);
        answer.setEarnedPoints(BigDecimal.ZERO);
        answer.setPendingManualEvaluation(false);
        if (answer.getFeedback() == null || answer.getFeedback().isBlank()) {
            answer.setFeedback("This answer could not be marked automatically and was scored "
                    + "zero. If you believe it deserves credit, raise it with your instructor.");
        }
    }

    /**
     * Pre-computed results for one submission's expensive graders.
     *
     * Both maps are keyed by {@code attemptQuestionId}. An absent entry means
     * nothing was pre-computed for that item, and the grader falls back to
     * calling out directly -- so this is an optimisation that the correctness
     * of grading never depends on.
     */
    private record GradingBatch(
            Map<Long, AnswerGradingResultDto> aiResults,
            Map<Long, CodeExecutionResultDto> codeResults) {
    }

    /** How many grading calls of one family may be in flight at once. */
    private static final int GRADING_BATCH_CONCURRENCY = 4;

    /**
     * Runs one family of blocking grading calls concurrently.
     *
     * Only the network call runs off-thread. Nothing here touches an entity, a
     * repository, or the EntityManager -- none of which are thread-safe, and
     * the whole submission runs in one transaction bound to the calling thread,
     * so every mutation stays on it. The suppliers are pure: request in, result
     * out.
     *
     * A task that throws contributes no entry rather than failing the batch,
     * which leaves its item to the ordinary sequential path and, in turn, to
     * the retry and the closing fallback below it.
     */
    private <T> Map<Long, T> runGradingBatch(Map<Long, Supplier<Optional<T>>> tasks) {
        if (tasks.isEmpty()) {
            return Map.of();
        }

        // One item is not a batch -- a thread pool would cost more than it saves.
        if (tasks.size() == 1) {
            Map.Entry<Long, Supplier<Optional<T>>> only = tasks.entrySet().iterator().next();
            try {
                Optional<T> value = only.getValue().get();
                Map<Long, T> single = new LinkedHashMap<>();
                value.ifPresent(v -> single.put(only.getKey(), v));
                return single;
            } catch (RuntimeException ex) {
                log.warn("Grading call failed for attemptQuestion {}: {}",
                        only.getKey(), ex.toString());
                return Map.of();
            }
        }

        ExecutorService pool = Executors.newFixedThreadPool(
                Math.min(tasks.size(), GRADING_BATCH_CONCURRENCY));
        try {
            Map<Long, CompletableFuture<Optional<T>>> futures = new LinkedHashMap<>();
            for (Map.Entry<Long, Supplier<Optional<T>>> entry : tasks.entrySet()) {
                Supplier<Optional<T>> task = entry.getValue();
                Long key = entry.getKey();
                futures.put(key, CompletableFuture.supplyAsync(() -> {
                    try {
                        return task.get();
                    } catch (RuntimeException ex) {
                        log.warn("Grading call failed for attemptQuestion {}: {}",
                                key, ex.toString());
                        return Optional.<T>empty();
                    }
                }, pool));
            }

            Map<Long, T> results = new LinkedHashMap<>();
            for (Map.Entry<Long, CompletableFuture<Optional<T>>> entry : futures.entrySet()) {
                try {
                    entry.getValue().join()
                            .ifPresent(value -> results.put(entry.getKey(), value));
                } catch (RuntimeException ex) {
                    log.warn("Grading call failed for attemptQuestion {}: {}",
                            entry.getKey(), ex.toString());
                }
            }
            return results;
        } finally {
            pool.shutdown();
        }
    }

    /**
     * Groups a submission's answers by what actually grades them, and runs the
     * two network-bound families concurrently before any scoring begins.
     *
     * Deterministic items -- multiple choice, exact-match short answers,
     * structural diagram comparison -- are deliberately absent: they are
     * in-process and finish faster than a request could be dispatched, so they
     * are simply graded in the sequential pass that follows.
     *
     * The two families left each make one blocking call per item, and used to
     * make them strictly one after another: a ten-question paper of written
     * answers paid ten AI round trips end to end. They now overlap within their
     * family, so a submission costs roughly the slowest call in each group
     * rather than the sum of every call.
     */
    private GradingBatch prepareGradingBatch(
            List<AssessmentAttemptQuestion> questions,
            Map<Long, AssessmentAttemptAnswer> answersByQuestion) {

        Map<Long, Supplier<Optional<AnswerGradingResultDto>>> aiTasks = new LinkedHashMap<>();
        Map<Long, Supplier<Optional<CodeExecutionResultDto>>> codeTasks = new LinkedHashMap<>();

        for (AssessmentAttemptQuestion attemptQuestion : questions) {
            AssessmentAttemptAnswer answer =
                    answersByQuestion.get(attemptQuestion.getAttemptQuestionId());
            if (answer == null || !hasSubmittedContent(answer)) {
                continue;
            }

            Long key = attemptQuestion.getAttemptQuestionId();
            String type = attemptQuestion.getQuestionType();
            Question source = questionRepository
                    .findById(attemptQuestion.getSourceQuestionId()).orElse(null);
            if (source == null) {
                continue;
            }
            BigDecimal points = attemptQuestion.getPoints() == null
                    ? BigDecimal.ONE : attemptQuestion.getPoints();

            if ("DESCRIPTIVE".equals(type) || isAiSemanticShortAnswer(type, source)) {
                AnswerGradingRequestDto request = descriptiveGradingRequest(
                        attemptQuestion, source, answer, points);
                aiTasks.put(key, () -> gradeWithRetry(request));
                continue;
            }

            if ("CRITICAL_THINKING".equals(type)) {
                String criticalThinkingType = resolveCriticalThinkingType(source.getQuestionId());

                if (criticalThinkingType == null) {
                    AnswerGradingRequestDto request =
                            criticalThinkingGradingRequest(attemptQuestion, source, answer, points);
                    if (request != null) {
                        aiTasks.put(key, () -> gradeWithRetry(request));
                    }
                    continue;
                }

                if ("PROGRAMMING".equals(criticalThinkingType) && !hasDefinitiveVerdict(answer)) {
                    List<TestCaseInputDto> inputs = programmingInputsFor(source);
                    String code = answer.getSubmittedCode();
                    String language = answer.getProgrammingLanguage();
                    if (!inputs.isEmpty() && code != null && !code.isBlank()) {
                        codeTasks.put(key, () -> Optional.ofNullable(
                                codeExecutionService.execute(
                                        new CodeExecutionRequestDto(language, code, inputs))));
                    }
                }
            }
        }

        return new GradingBatch(runGradingBatch(aiTasks), runGradingBatch(codeTasks));
    }

    private boolean isAiSemanticShortAnswer(String type, Question source) {
        return "SHORT_ANSWER".equals(type)
                && textQuestionConfigRepository.findByQuestion_QuestionId(source.getQuestionId())
                        .map(config -> "AI_SEMANTIC".equalsIgnoreCase(config.getCheckingMethod()))
                        .orElse(false);
    }

    private List<TestCaseInputDto> programmingInputsFor(Question source) {
        return loadIndexedProgrammingTestCases(source).stream()
                .map(it -> new TestCaseInputDto(
                        it.index(), it.testCase().isSample(),
                        it.testCase().getInputData(), it.testCase().getExpectedOutput()))
                .toList();
    }

    /** Whether the learner put anything at all into this item. */
    private static boolean hasSubmittedContent(AssessmentAttemptAnswer answer) {
        return (answer.getLearnerAnswer() != null && !answer.getLearnerAnswer().isBlank())
                || answer.getSelectedChoiceId() != null
                || (answer.getSubmittedCode() != null && !answer.getSubmittedCode().isBlank())
                || (answer.getDiagramSubmissionData() != null
                        && !answer.getDiagramSubmissionData().isBlank());
    }

    /** A Check already produced a real verdict for this answer. */
    private static boolean hasDefinitiveVerdict(AssessmentAttemptAnswer answer) {
        return !answer.isPendingManualEvaluation() && answer.getIsCorrect() != null;
    }

    /**
     * Grades a programming item at submit time for a learner who never ran
     * Check, using the same deterministic Judge0 path and the same
     * passed/total scoring that Check applies.
     *
     * Separate from {@link #executeProgramming} rather than reusing it: that
     * method is the interactive entry point and begins with
     * {@code requireEditable(attempt)} plus an {@code upsertAnswers} write,
     * both of which are wrong here -- at submit the attempt is already closed
     * and the code is already persisted.
     *
     * Two cases still do not produce a score, and both leave the answer exactly
     * as it was rather than inventing one:
     *   - no code submitted, which is an unanswered item and is scored zero;
     *   - no test cases authored, or Judge0 returning a non-definitive status
     *     (UNAVAILABLE, UNSUPPORTED_LANGUAGE), where there is nothing to grade
     *     against and a fabricated verdict would be worse than an honest
     *     pending.
     */
    private void gradeProgrammingOnSubmit(
            AssessmentAttemptQuestion attemptQuestion,
            Question source,
            AssessmentAttemptAnswer answer,
            BigDecimal points,
            GradingBatch batch) {

        String code = answer.getSubmittedCode();
        if (code == null || code.isBlank()) {
            // Nothing was written. That is a zero, not something to review.
            answer.setIsCorrect(false);
            answer.setEarnedPoints(BigDecimal.ZERO);
            answer.setPendingManualEvaluation(false);
            return;
        }

        List<IndexedTestCase> testCases = loadIndexedProgrammingTestCases(source);
        if (testCases.isEmpty()) {
            return;
        }

        List<TestCaseInputDto> inputs = testCases.stream()
                .map(it -> new TestCaseInputDto(
                        it.index(), it.testCase().isSample(),
                        it.testCase().getInputData(), it.testCase().getExpectedOutput()))
                .toList();

        // Normally already run by the batch, alongside every other code item.
        CodeExecutionResultDto result =
                batch.codeResults().get(attemptQuestion.getAttemptQuestionId());
        if (result == null) {
            try {
                result = codeExecutionService.execute(new CodeExecutionRequestDto(
                        answer.getProgrammingLanguage(), code, inputs));
            } catch (RuntimeException ex) {
                log.warn("Submit-time programming grading failed for attemptQuestion {}: {}",
                        attemptQuestion.getAttemptQuestionId(), ex.toString());
                return;
            }
        }

        boolean definitive = "COMPLETED".equals(result.status())
                || "COMPILE_ERROR".equals(result.status());
        if (!definitive) {
            return;
        }

        answer.setExecutionResult(serializeExecutionResult(
                attemptQuestion.getAttemptQuestionId(),
                AssessmentAttemptExecution.Mode.CHECK, result, hashCode(code)));

        int total = result.totalTests() == null ? 0 : result.totalTests();
        int passed = result.passedTests() == null ? 0 : result.passedTests();
        if (total > 0) {
            BigDecimal ratio = BigDecimal.valueOf(passed)
                    .divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP);
            answer.setEarnedPoints(points.multiply(ratio).setScale(2, RoundingMode.HALF_UP));
            answer.setIsCorrect(passed == total);
        } else {
            answer.setEarnedPoints(BigDecimal.ZERO);
            answer.setIsCorrect(false);
        }
        answer.setPendingManualEvaluation(false);
    }

    /**
     * Structural (non-AI) diagram grading: compares the learner's submitted
     * draw.io XML against the admin's reference XML as node/edge graphs
     * (label similarity, direction, cardinality — see DiagramGradingService)
     * and awards weighted partial credit. Never fabricates a score when the
     * reference itself has no gradeable content.
     */
    private boolean gradeDiagramAnswer(
            AssessmentAttemptQuestion attemptQuestion,
            Question source,
            AssessmentAttemptAnswer answer,
            BigDecimal points) {
        Optional<DiagramQuestionConfig> config = diagramQuestionConfigRepository
                .findByQuestion_QuestionId(source.getQuestionId());
        if (config.isEmpty() || config.get().getReferenceDiagramXml() == null
                || config.get().getReferenceDiagramXml().isBlank()) {
            return false;
        }

        DiagramGradingResultDto result = diagramGradingService.grade(new DiagramGradingRequestDto(
                config.get().getReferenceDiagramXml(), answer.getDiagramSubmissionData(), points));

        if ("INVALID_REFERENCE".equals(result.status())) {
            // The admin's own reference diagram isn't gradeable — an
            // authoring gap, never the learner's fault.
            return false;
        }

        answer.setEarnedPoints(result.earnedPoints());
        answer.setFeedback(result.feedback());
        answer.setIsCorrect(isPassingShare(result.earnedPoints(), points));
        answer.setPendingManualEvaluation(false);
        answer.setDiagramGradingResult(serializeDiagramGradingResult(result));
        return true;
    }

    private String serializeDiagramGradingResult(DiagramGradingResultDto result) {
        try {
            return objectMapper.writeValueAsString(result.elementResults());
        } catch (Exception e) {
            log.warn("Could not serialize diagram grading result");
            return null;
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    /**
     * Exact-match short-answer scoring: the learner answer is correct when it
     * matches the configured correct answer or any accepted variation (one per
     * line), e.g. "SQL" and "Structured Query Language".
     */
    private static boolean matchesTextAnswer(String learnerAnswer, TextQuestionConfig config) {
        String normalized = normalize(learnerAnswer);
        if (normalized.isEmpty()) {
            return false;
        }
        if (normalized.equals(normalize(config.getCorrectAnswer()))) {
            return true;
        }
        String variations = config.getAcceptedVariations();
        if (variations != null && !variations.isBlank()) {
            for (String variation : variations.split("\\n")) {
                if (normalized.equals(normalize(variation))) {
                    return true;
                }
            }
        }
        return false;
    }

    /** PROGRAMMING or DIAGRAM when the parent carries that sub-config, else null (analytical). */
    private String resolveCriticalThinkingType(Long parentQuestionId) {
        if (programmingQuestionConfigRepository.findByQuestion_QuestionId(parentQuestionId).isPresent()) {
            return "PROGRAMMING";
        }
        if (diagramQuestionConfigRepository.findByQuestion_QuestionId(parentQuestionId).isPresent()) {
            return "DIAGRAM";
        }
        return null;
    }

    /** True on a successful (or intentionally rubric-less) resolution; the caller returns either way. */
    /**
     * One retry around the AI grader.
     *
     * The call is a network round trip to the Python service and its failures
     * are mostly transient. A single retry converts most of them into a real
     * mark, which matters more now that a failure no longer parks the item for
     * a human — it falls through to the zero-with-explanation branch instead.
     */
    private Optional<AnswerGradingResultDto> gradeWithRetry(AnswerGradingRequestDto request) {
        Optional<AnswerGradingResultDto> graded = aiAnswerGradingService.grade(request);
        if (graded.isPresent()) {
            return graded;
        }
        log.warn("AI grading returned nothing; retrying once");
        return aiAnswerGradingService.grade(request);
    }

    /** The grading request for a descriptive or AI-semantic short answer. */
    private AnswerGradingRequestDto descriptiveGradingRequest(
            AssessmentAttemptQuestion attemptQuestion,
            Question source,
            AssessmentAttemptAnswer answer,
            BigDecimal points) {
        String learnerText = answer.getLearnerAnswer() == null ? "" : answer.getLearnerAnswer();
        return new AnswerGradingRequestDto(
                attemptQuestion.getQuestionTextSnapshot(), points,
                rubricGuidanceFor(source.getQuestionId()),
                rubricCriteriaFor(source.getQuestionId()), learnerText, null);
    }

    private boolean gradeDescriptiveAnswer(
            AssessmentAttemptQuestion attemptQuestion,
            Question source,
            AssessmentAttemptAnswer answer,
            BigDecimal points,
            GradingBatch batch) {

        // No rubric authored is no longer a reason to stop. The question text
        // is itself a standard to mark against, and an AI judgement of whether
        // the answer actually answers the question beats parking the item for a
        // review queue that nothing drains. A rubric, where one exists, still
        // takes precedence -- this only changes what happens when there is none.
        //
        // The batch will normally have graded this already, concurrently with
        // every other written answer on the paper; the direct call is the
        // fallback for anything the batch did not cover.
        Optional<AnswerGradingResultDto> graded = Optional.ofNullable(
                batch.aiResults().get(attemptQuestion.getAttemptQuestionId()));
        if (graded.isEmpty()) {
            graded = gradeWithRetry(
                    descriptiveGradingRequest(attemptQuestion, source, answer, points));
        }
        if (graded.isEmpty()) {
            return false;
        }
        AnswerGradingResultDto result = graded.get();
        answer.setEarnedPoints(result.earnedPoints());
        answer.setFeedback(result.feedback());
        answer.setIsCorrect(isPassingShare(result.earnedPoints(), points));
        answer.setPendingManualEvaluation(false);
        return true;
    }

    /**
     * The grading request for an analytical critical-thinking item, or null
     * when it has no sub-questions and therefore nothing to grade.
     */
    private AnswerGradingRequestDto criticalThinkingGradingRequest(
            AssessmentAttemptQuestion attemptQuestion,
            Question source,
            AssessmentAttemptAnswer answer,
            BigDecimal points) {
        List<Question> subQuestions = questionRepository
                .findByParentQuestion_QuestionIdOrderByQuestionIdAsc(source.getQuestionId());
        if (subQuestions.isEmpty()) {
            return null;
        }
        Map<Long, BigDecimal> pointSplit = splitPointsAcrossSubQuestions(subQuestions, points);
        Map<Long, String> subAnswerText = parseSubAnswerText(answer.getLearnerAnswer());

        List<SubQuestionGradingRequestDto> subRequests = new ArrayList<>();
        for (Question sub : subQuestions) {
            subRequests.add(new SubQuestionGradingRequestDto(
                    sub.getQuestionId(), sub.getQuestionText(),
                    pointSplit.get(sub.getQuestionId()),
                    rubricGuidanceFor(sub.getQuestionId()),
                    rubricCriteriaFor(sub.getQuestionId()),
                    subAnswerText.getOrDefault(sub.getQuestionId(), "")));
        }
        return new AnswerGradingRequestDto(
                attemptQuestion.getQuestionTextSnapshot(), points,
                rubricGuidanceFor(source.getQuestionId()),
                rubricCriteriaFor(source.getQuestionId()), null, subRequests);
    }

    private boolean gradeCriticalThinkingAnswer(
            AssessmentAttemptQuestion attemptQuestion,
            Question source,
            AssessmentAttemptAnswer answer,
            BigDecimal points,
            GradingBatch batch) {
        List<Question> subQuestions = questionRepository
                .findByParentQuestion_QuestionIdOrderByQuestionIdAsc(source.getQuestionId());
        if (subQuestions.isEmpty()) {
            return false;
        }

        Map<Long, BigDecimal> pointSplit = splitPointsAcrossSubQuestions(subQuestions, points);
        Map<Long, String> subAnswerText = parseSubAnswerText(answer.getLearnerAnswer());

        List<SubQuestionGradingRequestDto> subRequests = new ArrayList<>();
        for (Question sub : subQuestions) {
            subRequests.add(new SubQuestionGradingRequestDto(
                    sub.getQuestionId(),
                    sub.getQuestionText(),
                    pointSplit.get(sub.getQuestionId()),
                    rubricGuidanceFor(sub.getQuestionId()),
                    rubricCriteriaFor(sub.getQuestionId()),
                    subAnswerText.getOrDefault(sub.getQuestionId(), "")));
        }

        Optional<AnswerGradingResultDto> graded = Optional.ofNullable(
                batch.aiResults().get(attemptQuestion.getAttemptQuestionId()));
        if (graded.isEmpty()) {
            graded = gradeWithRetry(new AnswerGradingRequestDto(
                    attemptQuestion.getQuestionTextSnapshot(), points,
                    rubricGuidanceFor(source.getQuestionId()),
                    rubricCriteriaFor(source.getQuestionId()), null, subRequests));
        }
        if (graded.isEmpty()) {
            return false;
        }
        AnswerGradingResultDto result = graded.get();
        answer.setEarnedPoints(result.earnedPoints());
        answer.setFeedback(result.feedback());
        answer.setIsCorrect(isPassingShare(result.earnedPoints(), points));
        answer.setPendingManualEvaluation(false);
        answer.setSubAnswerScores(
                serializeSubAnswerScores(subQuestions, pointSplit, subAnswerText, result));
        return true;
    }

    private String rubricGuidanceFor(Long questionId) {
        return textQuestionConfigRepository.findByQuestion_QuestionId(questionId)
                .filter(config -> "AI_SEMANTIC".equalsIgnoreCase(config.getCheckingMethod()))
                .map(TextQuestionConfig::getCorrectAnswer)
                .orElse(null);
    }

    private List<AnswerGradingRequestDto.RubricCriterionDto> rubricCriteriaFor(Long questionId) {
        List<AnswerGradingRequestDto.RubricCriterionDto> criteria = new ArrayList<>();
        for (QuestionRubricCriterion criterion :
                rubricCriterionRepository.findByQuestion_QuestionIdOrderByDisplayOrderAsc(questionId)) {
            criteria.add(new AnswerGradingRequestDto.RubricCriterionDto(
                    criterion.getName(), criterion.getMaxPoints()));
        }
        return criteria;
    }

    /**
     * Splits an assessment's configured points for a critical-thinking item
     * across its sub-questions, weighted by each sub-question's own
     * {@code totalPoints} (equal weight when unset). The last sub-question
     * absorbs the rounding remainder so shares always sum to exactly points.
     */
    private Map<Long, BigDecimal> splitPointsAcrossSubQuestions(
            List<Question> subQuestions, BigDecimal totalPoints) {
        Map<Long, BigDecimal> allocation = new LinkedHashMap<>();
        if (subQuestions.isEmpty() || totalPoints == null || totalPoints.signum() <= 0) {
            return allocation;
        }

        Map<Long, BigDecimal> weights = new LinkedHashMap<>();
        BigDecimal weightSum = BigDecimal.ZERO;
        for (Question sub : subQuestions) {
            BigDecimal weight = sub.getTotalPoints() == null || sub.getTotalPoints().signum() <= 0
                    ? BigDecimal.ONE : sub.getTotalPoints();
            weights.put(sub.getQuestionId(), weight);
            weightSum = weightSum.add(weight);
        }

        BigDecimal running = BigDecimal.ZERO;
        for (int i = 0; i < subQuestions.size(); i++) {
            Long id = subQuestions.get(i).getQuestionId();
            BigDecimal share;
            if (i == subQuestions.size() - 1) {
                share = totalPoints.subtract(running).setScale(2, RoundingMode.HALF_UP);
            } else {
                share = totalPoints.multiply(weights.get(id))
                        .divide(weightSum, 2, RoundingMode.HALF_UP);
                running = running.add(share);
            }
            allocation.put(id, share);
        }
        return allocation;
    }

    /** Parses a critical-thinking learner_answer JSON blob ({subQuestionId: text}) safely. */
    private Map<Long, String> parseSubAnswerText(String learnerAnswer) {
        Map<Long, String> result = new LinkedHashMap<>();
        if (learnerAnswer == null || learnerAnswer.isBlank()) {
            return result;
        }
        try {
            JsonNode node = objectMapper.readTree(learnerAnswer);
            if (!node.isObject()) {
                return result;
            }
            node.fields().forEachRemaining(entry -> {
                try {
                    result.put(Long.valueOf(entry.getKey()), entry.getValue().asText(""));
                } catch (NumberFormatException ignored) {
                    // skip malformed keys
                }
            });
        } catch (Exception e) {
            log.warn("Could not parse critical-thinking sub-answer JSON");
        }
        return result;
    }

    private String serializeSubAnswerScores(
            List<Question> subQuestions,
            Map<Long, BigDecimal> pointSplit,
            Map<Long, String> subAnswerText,
            AnswerGradingResultDto result) {
        Map<Long, SubAnswerGradeDto> scoreById = new LinkedHashMap<>();
        for (SubAnswerGradeDto score : result.subScores()) {
            scoreById.put(score.subQuestionId(), score);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Question sub : subQuestions) {
            SubAnswerGradeDto scored = scoreById.get(sub.getQuestionId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("subQuestionId", sub.getQuestionId());
            row.put("questionText", sub.getQuestionText());
            row.put("learnerAnswer", subAnswerText.get(sub.getQuestionId()));
            row.put("earnedPoints", scored == null ? null : scored.earnedPoints());
            row.put("maxPoints", pointSplit.get(sub.getQuestionId()));
            row.put("feedback", scored == null ? null : scored.feedback());
            rows.add(row);
        }
        try {
            return objectMapper.writeValueAsString(rows);
        } catch (Exception e) {
            log.warn("Could not serialize sub-answer scores");
            return null;
        }
    }

    private Boolean isPassingShare(BigDecimal earned, BigDecimal max) {
        if (earned == null || max == null || max.signum() <= 0) {
            return null;
        }
        return earned.compareTo(max.multiply(new BigDecimal("0.5"))) >= 0;
    }

    /**
     * Sub-questions render as a normal ordered list in review/results (tabs
     * are attempt-answering UI only). Merges the sub-question text from the
     * question tree with the persisted AI score/feedback so review is a pure
     * read — grading never re-runs here.
     */
    private List<SubQuestionAnswerReviewDto> buildSubQuestionAnswerReviews(
            Question source, AssessmentAttemptAnswer answer) {
        if (source == null || !"CRITICAL_THINKING".equals(source.getQuestionType())) {
            return List.of();
        }
        List<Question> subQuestions = questionRepository
                .findByParentQuestion_QuestionIdOrderByQuestionIdAsc(source.getQuestionId());
        if (subQuestions.isEmpty()) {
            return List.of();
        }

        Map<Long, String> rawAnswers = parseSubAnswerText(answer == null ? null : answer.getLearnerAnswer());
        Map<Long, JsonNode> scored = parseSubAnswerScores(answer == null ? null : answer.getSubAnswerScores());

        List<SubQuestionAnswerReviewDto> reviews = new ArrayList<>();
        for (Question sub : subQuestions) {
            JsonNode scoreNode = scored.get(sub.getQuestionId());
            reviews.add(new SubQuestionAnswerReviewDto(
                    sub.getQuestionId(),
                    sub.getQuestionText(),
                    rawAnswers.get(sub.getQuestionId()),
                    scoreNode != null && scoreNode.hasNonNull("earnedPoints")
                            ? scoreNode.get("earnedPoints").decimalValue() : null,
                    scoreNode != null && scoreNode.hasNonNull("maxPoints")
                            ? scoreNode.get("maxPoints").decimalValue() : null,
                    scoreNode != null && scoreNode.hasNonNull("feedback")
                            ? scoreNode.get("feedback").asText() : null
            ));
        }
        return reviews;
    }

    /**
     * Reads the persisted node/edge comparison from a diagram Check/submit
     * (see gradeDiagramAnswer) so a learner can see exactly which required
     * elements were found vs. missing — not just a final score. Gated by
     * the exam's release-answers setting, same as the MCQ answer key,
     * since the "expected" side of the comparison is reference-diagram
     * content.
     */
    private List<DiagramElementReviewDto> buildDiagramElementReviews(
            AssessmentAttemptAnswer answer, boolean releaseAnswers) {
        if (!releaseAnswers || answer == null || answer.getDiagramGradingResult() == null) {
            return List.of();
        }
        try {
            JsonNode array = objectMapper.readTree(answer.getDiagramGradingResult());
            if (!array.isArray()) {
                return List.of();
            }
            List<DiagramElementReviewDto> reviews = new ArrayList<>();
            for (JsonNode node : array) {
                reviews.add(new DiagramElementReviewDto(
                        node.path("kind").asText(null),
                        node.path("expectedDescription").asText(null),
                        node.path("matched").asBoolean(false),
                        node.path("matchQuality").asText(null),
                        node.hasNonNull("learnerDescription") ? node.get("learnerDescription").asText() : null,
                        node.hasNonNull("earnedPoints") ? node.get("earnedPoints").decimalValue() : null,
                        node.hasNonNull("maxPoints") ? node.get("maxPoints").decimalValue() : null
                ));
            }
            return reviews;
        } catch (Exception e) {
            log.warn("Could not parse persisted diagram grading result");
            return List.of();
        }
    }

    private Map<Long, JsonNode> parseSubAnswerScores(String subAnswerScoresJson) {
        Map<Long, JsonNode> result = new LinkedHashMap<>();
        if (subAnswerScoresJson == null || subAnswerScoresJson.isBlank()) {
            return result;
        }
        try {
            JsonNode array = objectMapper.readTree(subAnswerScoresJson);
            if (!array.isArray()) {
                return result;
            }
            for (JsonNode node : array) {
                if (node.hasNonNull("subQuestionId")) {
                    result.put(node.get("subQuestionId").asLong(), node);
                }
            }
        } catch (Exception e) {
            log.warn("Could not parse persisted sub-answer scores");
        }
        return result;
    }

    private AssessmentAttemptStartResponseDto buildStartResponse(
            AssessmentAttempt attempt, boolean resumed) {

        List<AssessmentAttemptQuestion> questions = attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(
                        attempt.getAssessmentAttemptId());

        List<LearnerAttemptQuestionDto> questionDtos = new ArrayList<>();
        List<Long> flaggedIds = new ArrayList<>();
        List<Long> skippedIds = new ArrayList<>();
        for (AssessmentAttemptQuestion attemptQuestion : questions) {
            questionDtos.add(toLearnerQuestion(attemptQuestion));
            if (attemptQuestion.isFlagged()) {
                flaggedIds.add(attemptQuestion.getAttemptQuestionId());
            }
            if (attemptQuestion.isSkipped()) {
                skippedIds.add(attemptQuestion.getAttemptQuestionId());
            }
        }

        Map<Long, AttemptAnswerDraftDto> savedAnswers = new LinkedHashMap<>();
        for (AssessmentAttemptAnswer answer :
                attemptAnswerRepository.findByAttempt_AssessmentAttemptId(
                        attempt.getAssessmentAttemptId())) {
            savedAnswers.put(
                    answer.getAttemptQuestion().getAttemptQuestionId(),
                    new AttemptAnswerDraftDto(
                            answer.getAttemptQuestion().getAttemptQuestionId(),
                            answer.getLearnerAnswer(),
                            answer.getSelectedChoiceId(),
                            answer.getSubmittedCode(),
                            answer.getProgrammingLanguage(),
                            answer.getDiagramSubmissionData()));
        }

        Exam exam = attempt.getExam();
        return new AssessmentAttemptStartResponseDto(
                attempt.getAssessmentAttemptId(),
                exam.getExamId(),
                exam.getTitle(),
                exam.getExamType().getExamTypeText(),
                attempt.getAttemptNumber(),
                attempt.getStartedAt(),
                attempt.getExpiresAt(),
                resumed,
                questionDtos,
                savedAnswers,
                attempt.getCurrentQuestionId(),
                flaggedIds,
                skippedIds
        );
    }

    /**
     * Builds the learner-safe snapshot JSON for one question: choices without
     * correct flags/explanations, starter code, diagram type + instructions,
     * and sub-question prompts. Answer keys never enter the snapshot.
     */
    private String buildLearnerSafeSnapshot(Question question) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("questionImageKey", question.getImageKey());

        if (isMultipleChoice(question.getQuestionType())) {
            List<Map<String, Object>> choices = new ArrayList<>();
            for (Choice choice : question.getChoices()) {
                Map<String, Object> safe = new LinkedHashMap<>();
                safe.put("choiceId", choice.getChoiceId());
                safe.put("choiceText", choice.getChoiceText());
                safe.put("imageKey", choice.getImageKey());
                choices.add(safe);
            }
            data.put("choices", choices);
        }

        if ("CRITICAL_THINKING".equals(question.getQuestionType())) {
            programmingQuestionConfigRepository
                    .findByQuestion_QuestionId(question.getQuestionId())
                    .ifPresent(config -> {
                        data.put("criticalThinkingType", "PROGRAMMING");
                        data.put("starterCode", config.getStarterCode());
                        // Learner-safe test metadata: sample inputs may show;
                        // hidden cases are label-only, never expected output.
                        List<Map<String, Object>> tests = new ArrayList<>();
                        int index = 1;
                        int sampleNo = 1;
                        int hiddenNo = 1;
                        for (ProgrammingTestCase testCase : config.getTestCases()) {
                            Map<String, Object> safe = new LinkedHashMap<>();
                            boolean sample = testCase.isSample();
                            safe.put("index", index++);
                            safe.put("sample", sample);
                            safe.put("label", sample ? "Sample " + (sampleNo++) : "Hidden " + (hiddenNo++));
                            safe.put("input", sample ? testCase.getInputData() : null);
                            tests.add(safe);
                        }
                        data.put("testCases", tests);
                    });
            diagramQuestionConfigRepository
                    .findByQuestion_QuestionId(question.getQuestionId())
                    .ifPresent(config -> {
                        data.put("criticalThinkingType", "DIAGRAM");
                        data.put("diagramType", config.getDiagramType());
                        data.put("instructions", config.getInstructions());
                        // reference diagram XML/JSON is the answer key — excluded
                    });

            List<Map<String, Object>> subQuestions = new ArrayList<>();
            for (Question sub : questionRepository
                    .findByParentQuestion_QuestionIdOrderByQuestionIdAsc(question.getQuestionId())) {
                Map<String, Object> safe = new LinkedHashMap<>();
                safe.put("subQuestionId", sub.getQuestionId());
                safe.put("questionText", sub.getQuestionText());
                subQuestions.add(safe);
            }
            data.put("subQuestions", subQuestions);
        }

        // Backend-driven rubric (diagram/descriptive): learner-safe name + max
        // points only. Awarded points are never snapshotted.
        List<QuestionRubricCriterion> criteria = rubricCriterionRepository
                .findByQuestion_QuestionIdOrderByDisplayOrderAsc(question.getQuestionId());
        if (!criteria.isEmpty()) {
            List<Map<String, Object>> rubric = new ArrayList<>();
            for (QuestionRubricCriterion criterion : criteria) {
                Map<String, Object> safe = new LinkedHashMap<>();
                safe.put("name", criterion.getName());
                safe.put("maxPoints", criterion.getMaxPoints());
                rubric.add(safe);
            }
            data.put("rubric", rubric);
        }

        try {
            return objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            log.warn("Could not serialize snapshot for question {}", question.getQuestionId());
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private LearnerAttemptQuestionDto toLearnerQuestion(AssessmentAttemptQuestion attemptQuestion) {
        Map<String, Object> data = Map.of();
        try {
            if (attemptQuestion.getQuestionDataSnapshot() != null) {
                data = objectMapper.readValue(
                        attemptQuestion.getQuestionDataSnapshot(),
                        new TypeReference<Map<String, Object>>() {});
            }
        } catch (Exception e) {
            log.warn("Could not parse snapshot for attempt question {}",
                    attemptQuestion.getAttemptQuestionId());
        }

        List<LearnerChoiceDto> choices = new ArrayList<>();
        Object rawChoices = data.get("choices");
        if (rawChoices instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    choices.add(new LearnerChoiceDto(
                            map.get("choiceId") == null
                                    ? null : Long.valueOf(map.get("choiceId").toString()),
                            (String) map.get("choiceText"),
                            (String) map.get("imageKey")));
                }
            }
        }

        // Repair learner-safe output for attempts created before MCQ was
        // normalized to MULTIPLE_CHOICE. Only choice text/media is copied;
        // correct flags and explanations remain server-side.
        if (choices.isEmpty() && isMultipleChoice(attemptQuestion.getQuestionType())) {
            questionRepository.findById(attemptQuestion.getSourceQuestionId())
                    .ifPresent(source -> source.getChoices().forEach(choice ->
                            choices.add(new LearnerChoiceDto(
                                    choice.getChoiceId(),
                                    choice.getChoiceText(),
                                    choice.getImageKey()))));
        }

        List<LearnerSubQuestionDto> subQuestions = new ArrayList<>();
        Object rawSubs = data.get("subQuestions");
        if (rawSubs instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    subQuestions.add(new LearnerSubQuestionDto(
                            map.get("subQuestionId") == null
                                    ? null : Long.valueOf(map.get("subQuestionId").toString()),
                            (String) map.get("questionText")));
                }
            }
        }

        return new LearnerAttemptQuestionDto(
                attemptQuestion.getAttemptQuestionId(),
                attemptQuestion.getDisplayOrder(),
                normalizeQuestionType(attemptQuestion.getQuestionType()),
                (String) data.get("criticalThinkingType"),
                attemptQuestion.getQuestionTextSnapshot(),
                (String) data.get("questionImageKey"),
                choices,
                (String) data.get("starterCode"),
                (String) data.get("diagramType"),
                (String) data.get("instructions"),
                subQuestions,
                attemptQuestion.getPoints(),
                parseLearnerTestCases(data),
                parseRubric(data)
        );
    }

    // ------------------------------------------------------------------
    // Diagram Check — saves the current diagram and previews the rubric.
    // The actual structural grade (DiagramGradingService, see scoreAnswer /
    // gradeDiagramAnswer) is computed once, definitively, at submit time —
    // Check never scores, so re-checking a diagram is always safe.
    // ------------------------------------------------------------------

    @Transactional
    public DiagramCheckResultDto checkDiagram(
            Long attemptId, Long attemptQuestionId, DiagramCheckRequestDto request) {

        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, request.learnerId());
        requireEditable(attempt);
        AssessmentAttemptQuestion question = requireAttemptQuestion(attempt, attemptQuestionId);
        if (!"CRITICAL_THINKING".equals(question.getQuestionType())) {
            throw new BusinessRuleException.InvalidAssessmentSubmissionException(
                    "This item is not a diagram question.");
        }

        // Persist the latest diagram before "checking" (spec requirement).
        upsertAnswers(attempt, List.of(new AttemptAnswerDraftDto(
                attemptQuestionId, null, null, null, null, request.diagramData())));

        // No diagram auto-grader yet — return the rubric as PENDING and never
        // expose the reference diagram or private evaluation logic.
        return new DiagramCheckResultDto(
                "PENDING",
                "Your diagram has been saved. It will be evaluated against the rubric "
                        + "after you submit the assessment.",
                readSnapshotRubric(question));
    }

    private List<RubricCriterionDto> readSnapshotRubric(AssessmentAttemptQuestion attemptQuestion) {
        try {
            if (attemptQuestion.getQuestionDataSnapshot() == null) {
                return List.of();
            }
            Map<String, Object> data = objectMapper.readValue(
                    attemptQuestion.getQuestionDataSnapshot(),
                    new TypeReference<Map<String, Object>>() {});
            return parseRubric(data);
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<RubricCriterionDto> parseRubric(Map<String, Object> data) {
        List<RubricCriterionDto> rubric = new ArrayList<>();
        Object raw = data.get("rubric");
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    Object maxPoints = map.get("maxPoints");
                    rubric.add(new RubricCriterionDto(
                            (String) map.get("name"),
                            maxPoints == null ? null : new java.math.BigDecimal(maxPoints.toString()),
                            null,
                            null,
                            "PENDING"));
                }
            }
        }
        return rubric;
    }

    // ------------------------------------------------------------------
    // Programming Run / Check — deterministic Judge0 execution, no AI.
    // Run grades against sample tests only (quick feedback); Check grades
    // against every configured test case and finalizes the answer's score.
    // ------------------------------------------------------------------

    @Transactional
    public ExecutionResultDto runProgramming(
            Long attemptId, Long attemptQuestionId, ProgrammingRunRequestDto request) {
        return executeProgramming(
                attemptId, attemptQuestionId, request, AssessmentAttemptExecution.Mode.RUN);
    }

    @Transactional
    public ExecutionResultDto checkProgramming(
            Long attemptId, Long attemptQuestionId, ProgrammingRunRequestDto request) {
        return executeProgramming(
                attemptId, attemptQuestionId, request, AssessmentAttemptExecution.Mode.CHECK);
    }

    private ExecutionResultDto executeProgramming(
            Long attemptId, Long attemptQuestionId,
            ProgrammingRunRequestDto request, AssessmentAttemptExecution.Mode mode) {

        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, request.learnerId());
        requireEditable(attempt);
        AssessmentAttemptQuestion attemptQuestion = requireAttemptQuestion(attempt, attemptQuestionId);
        if (!"CRITICAL_THINKING".equals(attemptQuestion.getQuestionType())) {
            throw new BusinessRuleException.InvalidAssessmentSubmissionException(
                    "This item is not a programming question.");
        }

        // Run/Check always saves the current code first (spec requirement);
        // if the code changed since the last run, this also clears the prior
        // stale execution result (see upsertAnswers).
        upsertAnswers(attempt, List.of(new AttemptAnswerDraftDto(
                attemptQuestionId, null, null, request.code(), request.language(), null)));

        List<LearnerTestCaseDto> learnerTests = readSnapshotTestCases(attemptQuestion);
        Question source = questionRepository
                .findById(attemptQuestion.getSourceQuestionId()).orElse(null);
        List<IndexedTestCase> allTestCases = source == null
                ? List.of() : loadIndexedProgrammingTestCases(source);
        List<IndexedTestCase> scopedTestCases = mode == AssessmentAttemptExecution.Mode.RUN
                ? allTestCases.stream().filter(it -> it.testCase().isSample()).toList()
                : allTestCases;

        LocalDateTime now = LocalDateTime.now();
        if (scopedTestCases.isEmpty()) {
            // Nothing configured to run against (or no sample cases for Run) —
            // never fabricate a result.
            String message = allTestCases.isEmpty()
                    ? "No test cases are configured for this item yet."
                    : "No sample test cases are available for Run — use Check to grade against all tests.";
            AssessmentAttemptExecution execution = executionRepository.save(
                    AssessmentAttemptExecution.builder()
                            .attempt(attempt).attemptQuestion(attemptQuestion).mode(mode)
                            .language(request.language()).submittedCode(request.code())
                            .status(AssessmentAttemptExecution.Status.UNAVAILABLE)
                            .totalTests(learnerTests.isEmpty() ? null : learnerTests.size())
                            .output(message)
                            .createdAt(now)
                            .build());
            return new ExecutionResultDto(
                    execution.getExecutionId(), mode.name(), execution.getStatus().name(),
                    message, request.language(), null, execution.getTotalTests(), now, learnerTests);
        }

        List<TestCaseInputDto> inputs = scopedTestCases.stream()
                .map(it -> new TestCaseInputDto(
                        it.index(), it.testCase().isSample(),
                        it.testCase().getInputData(), it.testCase().getExpectedOutput()))
                .toList();

        CodeExecutionResultDto result = codeExecutionService.execute(
                new CodeExecutionRequestDto(request.language(), request.code(), inputs));

        applyExecutionResultToAnswer(attemptQuestion, mode, result, hashCode(request.code()));

        AssessmentAttemptExecution execution = executionRepository.save(
                AssessmentAttemptExecution.builder()
                        .attempt(attempt)
                        .attemptQuestion(attemptQuestion)
                        .mode(mode)
                        .language(request.language())
                        .submittedCode(request.code())
                        .status(toExecutionEntityStatus(result.status()))
                        .passedTests(result.passedTests())
                        .totalTests(result.totalTests())
                        .output(executionOutputSummary(result))
                        .createdAt(now)
                        .build());

        return new ExecutionResultDto(
                execution.getExecutionId(),
                mode.name(),
                execution.getStatus().name(),
                executionOutputSummary(result),
                request.language(),
                result.passedTests(),
                result.totalTests(),
                now,
                mergeTestStatuses(learnerTests, result));
    }

    private record IndexedTestCase(int index, ProgrammingTestCase testCase) {}

    /** Loads a source question's programming test cases with a stable 1-based index matching the snapshot. */
    private List<IndexedTestCase> loadIndexedProgrammingTestCases(Question source) {
        return programmingQuestionConfigRepository.findByQuestion_QuestionId(source.getQuestionId())
                .map(config -> {
                    List<IndexedTestCase> indexed = new ArrayList<>();
                    int index = 1;
                    for (ProgrammingTestCase testCase : config.getTestCases()) {
                        indexed.add(new IndexedTestCase(index++, testCase));
                    }
                    return indexed;
                })
                .orElse(List.of());
    }

    /**
     * Persists the Judge0 result onto the answer's execution payload (code
     * hash, output, status, per-test results, time/memory) and — only for
     * Check, and only on a definitive outcome — finalizes earned points.
     * Run never scores; an infra-level UNAVAILABLE/UNSUPPORTED_LANGUAGE
     * result never scores either (never fabricate on a Judge0 failure).
     */
    private void applyExecutionResultToAnswer(
            AssessmentAttemptQuestion attemptQuestion,
            AssessmentAttemptExecution.Mode mode,
            CodeExecutionResultDto result,
            String codeHash) {
        AssessmentAttemptAnswer answer = attemptAnswerRepository
                .findByAttempt_AssessmentAttemptIdAndAttemptQuestion_AttemptQuestionId(
                        attemptQuestion.getAttempt().getAssessmentAttemptId(),
                        attemptQuestion.getAttemptQuestionId())
                .orElse(null);
        if (answer == null) {
            return;
        }

        answer.setExecutionResult(serializeExecutionResult(
                attemptQuestion.getAttemptQuestionId(), mode, result, codeHash));

        boolean definitive = "COMPLETED".equals(result.status()) || "COMPILE_ERROR".equals(result.status());
        if (mode == AssessmentAttemptExecution.Mode.CHECK && definitive) {
            BigDecimal points = attemptQuestion.getPoints() == null
                    ? BigDecimal.ZERO : attemptQuestion.getPoints();
            int total = result.totalTests() == null ? 0 : result.totalTests();
            int passed = result.passedTests() == null ? 0 : result.passedTests();
            if (total > 0) {
                BigDecimal ratio = BigDecimal.valueOf(passed)
                        .divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP);
                answer.setEarnedPoints(points.multiply(ratio).setScale(2, RoundingMode.HALF_UP));
                answer.setIsCorrect(passed == total);
            } else {
                answer.setEarnedPoints(BigDecimal.ZERO);
                answer.setIsCorrect(false);
            }
            answer.setPendingManualEvaluation(false);
        }
        attemptAnswerRepository.save(answer);
    }

    private String serializeExecutionResult(
            Long attemptQuestionId, AssessmentAttemptExecution.Mode mode,
            CodeExecutionResultDto result, String codeHash) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("codeHash", codeHash);
        payload.put("mode", mode.name());
        payload.put("status", result.status());
        payload.put("output", result.output());
        payload.put("error", result.error());
        payload.put("executionTimeMs", result.executionTimeMs());
        payload.put("memoryKb", result.memoryKb());
        payload.put("passedTests", result.passedTests());
        payload.put("totalTests", result.totalTests());
        List<Map<String, Object>> tests = new ArrayList<>();
        for (TestCaseResultDto testResult : result.testResults()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("index", testResult.index());
            row.put("sample", testResult.sample());
            row.put("passed", testResult.passed());
            row.put("status", testResult.status());
            tests.add(row);
        }
        payload.put("testResults", tests);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("Could not serialize execution result for attempt question {}", attemptQuestionId);
            return null;
        }
    }

    private AssessmentAttemptExecution.Status toExecutionEntityStatus(String status) {
        return switch (status) {
            case "COMPLETED" -> AssessmentAttemptExecution.Status.COMPLETED;
            case "COMPILE_ERROR" -> AssessmentAttemptExecution.Status.ERROR;
            default -> AssessmentAttemptExecution.Status.UNAVAILABLE;
        };
    }

    private String executionOutputSummary(CodeExecutionResultDto result) {
        if ("COMPILE_ERROR".equals(result.status())) {
            return "Compilation failed:\n" + (result.error() == null ? "" : result.error());
        }
        if ("UNAVAILABLE".equals(result.status()) || "UNSUPPORTED_LANGUAGE".equals(result.status())) {
            return result.error();
        }
        if (result.error() != null && !result.error().isBlank()) {
            return result.error();
        }
        if (result.totalTests() != null) {
            return result.passedTests() + " / " + result.totalTests() + " test case(s) passed.";
        }
        return result.output();
    }

    /** Overlays real PASSED/FAILED/etc. statuses onto the learner-safe test list; never adds actual output for hidden tests (the DTO has no such field). */
    private List<LearnerTestCaseDto> mergeTestStatuses(
            List<LearnerTestCaseDto> learnerTests, CodeExecutionResultDto result) {
        Map<Integer, TestCaseResultDto> byIndex = new LinkedHashMap<>();
        for (TestCaseResultDto testResult : result.testResults()) {
            byIndex.put(testResult.index(), testResult);
        }
        List<LearnerTestCaseDto> merged = new ArrayList<>();
        for (LearnerTestCaseDto test : learnerTests) {
            TestCaseResultDto matched = byIndex.get(test.index());
            merged.add(new LearnerTestCaseDto(
                    test.index(), test.label(), test.sample(), test.input(),
                    matched != null ? matched.status() : test.status()));
        }
        return merged;
    }

    private String hashCode(String code) {
        if (code == null) {
            return null;
        }
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(code.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public List<ExecutionHistoryItemDto> listExecutions(
            Long attemptId, Long attemptQuestionId, Long learnerId) {
        AssessmentAttempt attempt = requireOwnedAttempt(attemptId, learnerId);
        requireAttemptQuestion(attempt, attemptQuestionId);
        return executionRepository
                .findByAttemptQuestion_AttemptQuestionIdOrderByCreatedAtDesc(
                        attemptQuestionId, PageRequest.of(0, MAX_EXECUTION_HISTORY))
                .stream()
                .map(execution -> new ExecutionHistoryItemDto(
                        execution.getExecutionId(),
                        execution.getMode().name(),
                        execution.getLanguage(),
                        execution.getStatus().name(),
                        execution.getPassedTests(),
                        execution.getTotalTests(),
                        execution.getCreatedAt()))
                .toList();
    }

    /** Reads the learner-safe test metadata already stored in the snapshot. */
    @SuppressWarnings("unchecked")
    private List<LearnerTestCaseDto> readSnapshotTestCases(AssessmentAttemptQuestion attemptQuestion) {
        try {
            if (attemptQuestion.getQuestionDataSnapshot() == null) {
                return List.of();
            }
            Map<String, Object> data = objectMapper.readValue(
                    attemptQuestion.getQuestionDataSnapshot(),
                    new TypeReference<Map<String, Object>>() {});
            return parseLearnerTestCases(data);
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<LearnerTestCaseDto> parseLearnerTestCases(Map<String, Object> data) {
        List<LearnerTestCaseDto> tests = new ArrayList<>();
        Object raw = data.get("testCases");
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    Object indexValue = map.get("index");
                    tests.add(new LearnerTestCaseDto(
                            indexValue == null ? tests.size() + 1
                                    : Integer.parseInt(indexValue.toString()),
                            (String) map.get("label"),
                            Boolean.TRUE.equals(map.get("sample")),
                            (String) map.get("input"),
                            "NOT_RUN"));
                }
            }
        }
        return tests;
    }
}
