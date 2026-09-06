package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.aigateway.client.AiServiceException;
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
import com.capstone.rebyu.common.PhaseTimer;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

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
    /** An IT Olympics arena run; see ChallengeArenaService. */
    private static final String TYPE_CHALLENGE = "CHALLENGE";

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
    private final OrganizationCertificationLearnerRepository organizationCertificationLearnerRepository;
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
    private final AttemptGradingBatchService gradingBatchService;
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

    /**
     * The pop-up knowledge check pays the same three tiers at a quarter of the
     * size, topping up to 50 rather than 200.
     *
     * <p>It has to be scaled separately because it is the only exam a learner
     * does not choose to sit. Every other type is opened deliberately and is
     * minted once; a check fires by itself, mints a NEW exam each time, and the
     * awards are keyed by exam id -- so at the full tiers, acing five questions
     * would pay 200 XP, twice what finishing an entire lesson pays, and pay it
     * again after every cooldown. That is not a reward for learning, it is a
     * reason to sit and wait for pop-ups.
     *
     * <p>50 keeps a perfect check comfortably below the 100 a lesson pays,
     * which is the ordering the economy needs: the check is a nudge to
     * remember something, not a way to progress.
     */
    private static final int CHECK_ATTEMPTED_XP = 10;
    private static final int CHECK_PASSED_TOPUP_XP = 15;
    private static final int CHECK_PERFECT_TOPUP_XP = 25;

    /**
     * Mirrors {@code LessonKnowledgeCheckService.KNOWLEDGE_CHECK_EXAM_TYPE}.
     * Duplicated as a literal rather than imported so the assessment engine
     * keeps no compile-time dependency on the knowledge-check package, which
     * depends on it.
     */
    private static final String KNOWLEDGE_CHECK_EXAM_TYPE = "KNOWLEDGE_CHECK";

    /** Percentage is stored 0-100 (scale 2), so a perfect score is 100.00. */
    private static final BigDecimal PERFECT_PERCENTAGE = new BigDecimal("100");

    private static final int MAX_EXECUTION_HISTORY = 20;

    /**
     * TEMPORARY: whether a mock exam still requires MOCK_EXAM_ACCESS.
     *
     * Off by default, so mock exams are open to every enrolled learner. The
     * gates are left in place and read this flag rather than being deleted --
     * mock exams are a paid feature in the revenue model, and the way back is
     * `rebyu.assessment.mock-exam-requires-entitlement: true` (or the
     * MOCK_EXAM_REQUIRES_ENTITLEMENT environment variable), not a re-implementation.
     *
     * Both gates read it: the lock badge the learner sees before starting, and
     * the hard 403 at start. Turning one on without the other would either
     * advertise a lock that does not bite or bite without warning.
     */
    @Value("${rebyu.assessment.mock-exam-requires-entitlement:false}")
    private boolean mockExamRequiresEntitlement;

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

        // Idempotency dedupes a double-fired start, so it only ever hands back an
        // attempt that is still open. It used to return whatever the key mapped
        // to, which sat ABOVE the lock check below and so was a way around it:
        // the client keeps this key in sessionStorage past submit, so re-entering
        // a finished assessment in the same tab reopened the submitted attempt
        // instead of being refused. That is a retake of a one-time diagnostic in
        // everything but name. A finished/abandoned attempt now falls through to
        // the normal path, where `resolveLockReason` gets its say.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<AssessmentAttempt> byKey = attemptRepository.findByIdempotencyKey(idempotencyKey);
            if (byKey.isPresent()
                    && byKey.get().getStatus() == AssessmentAttempt.Status.IN_PROGRESS) {
                return buildStartResponse(byKey.get(), true);
            }
        }

        PhaseTimer timer = PhaseTimer.start("startAttempt exam=" + examId, log);

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new EntityNotFoundException("Assessment not found: " + examId));
        if (exam.effectiveStatus() != Exam.Status.PUBLISHED) {
            throw new BusinessRuleException.AssessmentNotPublishedException();
        }

        // Mock exams are a premium feature: require personal Pro or an
        // institution-sponsored MOCK_EXAM_ACCESS entitlement for this
        // certification before an attempt can be created (structured 403).
        if (mockExamRequiresEntitlement && TYPE_MOCK.equals(exam.getExamType().getExamTypeText())) {
            learnerEntitlementService.requireLearnerEntitlement(
                    learnerId, Entitlements.MOCK_EXAM_ACCESS,
                    exam.getCertification().getCertificationId());
        }

        String lockReason = resolveLockReason(exam, learnerId);
        PhaseTimer.mark(timer, "access gate");
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

        /*
         * Adaptive retake is for exams that assess a curriculum. It rebuilds
         * the paper from the learner's weakest (lesson, difficulty) cells,
         * drawing from the whole certification's question bank -- which is
         * right for a unit exam and wrong for a challenge arena.
         *
         * An arena IS its problem set. CodeStrike is one programming problem
         * and Blueprint Arena is one diagram problem, chosen by an admin; on
         * the second attempt the selector was replacing them with whatever
         * multiple-choice questions the certification happened to have, so
         * CodeStrike stopped being CodeStrike and asked about requirements
         * elicitation instead. Nothing failed loudly -- the paper was valid,
         * just not the arena's.
         *
         * So a CHALLENGE exam always runs its configured problems, on every
         * attempt.
         */
        boolean adaptiveRetake = nextAttemptNumber > 1
                && !TYPE_CHALLENGE.equals(exam.getExamType().getExamTypeText());

        if (adaptiveRetake) {
            AdaptiveRetakeQuestionSelectionService.Selection selection =
                    adaptiveRetakeQuestionSelectionService.select(exam, learnerId, examQuestions);
            questionsToUse = selection.questions();
            retakeBasisJson = selection.retakeBasisJson();
            PhaseTimer.mark(timer, "select new questions");
        } else {
            /* Fetched in one query with choices and the type configs, rather
               than by dereferencing each ExamQuestion's lazy question. Question
               owns three EAGER inverse-side one-to-ones, so walking the proxies
               costs three round trips per question on top of the choices --
               about four times the queries needed to build one paper. */
            List<Long> baselineIds = examQuestions.stream()
                    .map(examQuestion -> examQuestion.getQuestion().getQuestionId())
                    .toList();
            Map<Long, Question> baselineById = questionRepository.findForAttemptByIdIn(baselineIds).stream()
                    .collect(Collectors.toMap(Question::getQuestionId, q -> q, (a, b) -> a));
            questionsToUse = baselineIds.stream()
                    .map(baselineById::get)
                    .filter(Objects::nonNull)
                    .toList();
            PhaseTimer.mark(timer, "load questions");
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
        PhaseTimer.mark(timer, "create attempt");

        /* Everything the per-question snapshot needs that is not already on the
           question entity, for the WHOLE paper, in two queries.

           buildLearnerSafeSnapshot used to ask the database four times per
           question -- programming config, diagram config, sub-questions,
           rubric criteria -- so a 64-item paper spent 256 round trips building
           its snapshots. Against this database (~50ms away) that alone was
           most of the time a learner waited for an assessment to open. The two
           configs are already on the entity: findForAttemptByIdIn fetches them
           in its entity graph, so reading them costs nothing. The other two
           are batched here and looked up in memory. */
        SnapshotContext snapshotContext = buildSnapshotContext(questionsToUse);

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
                    .questionDataSnapshot(buildLearnerSafeSnapshot(question, snapshotContext))
                    .displayOrder(order++)
                    .points(points)
                    .lessonId(question.getLesson().getLessonId())
                    .build());
        }

        PhaseTimer.mark(timer, "snapshot questions");

        if (nextAttemptNumber > 1) {
            // Lightweight RabbitMQ trigger (ids only) alongside the
            // synchronous adaptive-retake selection above -- Phase 6 wires
            // the consumer.
            assessmentEventProducer.publishAssessmentRetakeRequested(attempt.getAssessmentAttemptId());
        }

        log.info("Started attempt {} (#{}) of exam {} for learner {}",
                attempt.getAssessmentAttemptId(), nextAttemptNumber, examId, learnerId);
        AssessmentAttemptStartResponseDto response = buildStartResponse(attempt, false);
        PhaseTimer.mark(timer, "build response");
        PhaseTimer.finish(timer);
        return response;
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

        PhaseTimer timer = PhaseTimer.start("submitAttempt attempt=" + attemptId, log);

        List<AssessmentAttemptQuestion> questions = attemptQuestionRepository
                .findByAttempt_AssessmentAttemptIdOrderByDisplayOrderAsc(attemptId);
        Map<Long, AssessmentAttemptAnswer> answersByQuestion = new HashMap<>();
        for (AssessmentAttemptAnswer answer :
                attemptAnswerRepository.findByAttempt_AssessmentAttemptId(attemptId)) {
            answersByQuestion.put(answer.getAttemptQuestion().getAttemptQuestionId(), answer);
        }

        /* Every source question this paper grades against, in one query.

           Both passes below used to call questionRepository.findById() per
           item, and a Question drags its three config one-to-ones with it
           whether or not anyone reads them -- they are mapped without a fetch
           type, so they are EAGER. Add the lazy choices collection each MCQ
           then asks for, and one 40-question paper spent roughly two hundred
           round trips deciding what it was looking at. Against a database in
           another region at ~75ms a trip, that was most of the half-minute a
           learner waited to see their score.

           findForAttemptByIdIn is the loader startAttempt already uses for
           exactly this, entity graph and all -- see its note. Grading a paper
           is the same "a paper's worth of ids" it was written for. */
        Map<Long, Question> sourceQuestions = questionRepository
                .findForAttemptByIdIn(questions.stream()
                        .map(AssessmentAttemptQuestion::getSourceQuestionId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .toList())
                .stream()
                .collect(Collectors.toMap(Question::getQuestionId, q -> q, (a, b) -> a));

        /* The parts of every question on this paper that has parts, in one
           query. Three graders need them -- fill-in-the-blank, the analytical
           critical-thinking request, and the critical-thinking mark itself --
           and each used to ask per question, so a paper of blanks paid three
           round trips apiece to grade items it had already loaded. */
        Map<Long, List<Question>> subQuestionsByParentId = sourceQuestions.isEmpty()
                ? Map.of()
                : questionRepository.findSubQuestionsByParentIdIn(sourceQuestions.keySet()).stream()
                        .collect(Collectors.groupingBy(
                                sub -> sub.getParentQuestion().getQuestionId(),
                                LinkedHashMap::new, Collectors.toList()));

        /* Every expensive grader for this paper, run per family and
           concurrently within each, before a single answer is scored. The loop
           below then reads the results instead of making the calls itself. */
        PhaseTimer.mark(timer, "load paper");

        GradingBatch gradingBatch = prepareGradingBatch(
                questions, answersByQuestion, sourceQuestions, subQuestionsByParentId);
        PhaseTimer.mark(timer, "graders (ai/code/diagram)");

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
            scoreAnswer(attemptQuestion, answer, points, gradingBatch,
                    sourceQuestions, subQuestionsByParentId);
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
        PhaseTimer.mark(timer, "score + persist");

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

        PhaseTimer.mark(timer, "rewards + progress");

        log.info("Attempt {} submitted: {}% ({} / {} points)",
                attemptId, percentage, earnedPoints, totalPoints);
        AssessmentAttemptResultDto result = getResult(attemptId, request.learnerId());
        PhaseTimer.mark(timer, "build result");
        PhaseTimer.finish(timer);
        return result;
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

        boolean isCheck = KNOWLEDGE_CHECK_EXAM_TYPE.equals(
                attempt.getExam().getExamType().getExamTypeText());

        int attemptedXp = isCheck ? CHECK_ATTEMPTED_XP : ASSESSMENT_ATTEMPTED_XP;
        int passedXp = isCheck ? CHECK_PASSED_TOPUP_XP : ASSESSMENT_PASSED_TOPUP_XP;
        int perfectXp = isCheck ? CHECK_PERFECT_TOPUP_XP : ASSESSMENT_PERFECT_TOPUP_XP;

        // Existing key and reason, so learners already paid the previous flat
        // award are not paid again for simply finishing this exam.
        rewardService.awardXp(learnerId, attemptedXp, "ASSESSMENT_COMPLETED",
                "assessment-completed:" + examId);

        if (!Boolean.TRUE.equals(attempt.getPassed())) {
            return;
        }
        rewardService.awardXp(learnerId, passedXp, "ASSESSMENT_PASSED",
                "assessment-passed:" + examId);

        if (attempt.getPercentage() != null
                && attempt.getPercentage().compareTo(PERFECT_PERCENTAGE) >= 0) {
            rewardService.awardXp(learnerId, perfectXp, "ASSESSMENT_PERFECT",
                    "assessment-perfect:" + examId);
        }
    }

    // ------------------------------------------------------------------
    // Result
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public AssessmentAttemptResultDto getResult(Long attemptId, Long learnerId) {
        PhaseTimer timer = PhaseTimer.start("getResult attempt=" + attemptId, log);
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

        /* Every source question this review reads, in one query.

           This loop used to call questionRepository.findById() per item. A
           Question drags three EAGER inverse-side one-to-one configs behind it
           that Hibernate cannot proxy, so that is four round trips per
           question before the MCQ choices collection adds a fifth -- and the
           sub-question and text-config lookups below each added another. A
           64-item paper spent over four hundred round trips, ~50ms apiece,
           building one result page. Submit pays it too: it ends by calling
           this method.

           findForAttemptByIdIn is the loader startAttempt and submitAttempt
           already use for exactly this, entity graph and all. */
        List<Long> sourceQuestionIds = questions.stream()
                .map(AssessmentAttemptQuestion::getSourceQuestionId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Question> sourceQuestions = sourceQuestionIds.isEmpty()
                ? Map.of()
                : questionRepository.findForAttemptByIdIn(sourceQuestionIds).stream()
                        .collect(Collectors.toMap(Question::getQuestionId, q -> q, (a, b) -> a));
        // The parts of every question that has parts, in one more query.
        Map<Long, List<Question>> subQuestionsByParentId = sourceQuestionIds.isEmpty()
                ? Map.of()
                : questionRepository.findSubQuestionsByParentIdIn(sourceQuestionIds).stream()
                        .collect(Collectors.groupingBy(
                                sub -> sub.getParentQuestion().getQuestionId(),
                                LinkedHashMap::new, Collectors.toList()));

        PhaseTimer.mark(timer, "load questions + answers");

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
            Question source = sourceQuestions.get(attemptQuestion.getSourceQuestionId());

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
            } else if (source != null && "SHORT_ANSWER".equals(source.getQuestionType()) && releaseAnswers) {
                /* The reference answer for a typed question.
                 *
                 * Only multiple choice filled this in, so a learner who got a
                 * short answer wrong was shown their own wrong string and
                 * nothing else -- no answer key, no explanation, on a review
                 * screen whose entire purpose is to say what the answer was.
                 * The key is on the question's text config (it is what
                 * `matchesTextAnswer` grades against), for both checking
                 * methods: EXACT_MATCH marks against it directly and
                 * AI_SEMANTIC marks meaning against it as the reference.
                 *
                 * Accepted variations are deliberately not listed. They are
                 * spellings of the same answer, and a review that answered
                 * "what should I have written?" with six near-identical
                 * strings reads as six different answers.
                 */
                // Read off the entity rather than re-queried: findForAttemptByIdIn
                // fetches textQuestionConfig in its graph, so this is already here.
                correctChoiceText = Optional.ofNullable(source.getTextQuestionConfig())
                        .map(TextQuestionConfig::getCorrectAnswer)
                        .filter(text -> text != null && !text.isBlank())
                        .orElse(null);
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
                    buildSubQuestionAnswerReviews(source, answer, subQuestionsByParentId),
                    buildDiagramElementReviews(answer, releaseAnswers)
            ));
        }

        // Lesson names in one query. findById per lesson was cheap only because
        // the persistence context deduped repeats -- it was still one round
        // trip per distinct lesson on the paper.
        Map<Long, String> lessonNames = lessonPossible.isEmpty()
                ? Map.of()
                : lessonRepository.findAllById(lessonPossible.keySet()).stream()
                        .collect(Collectors.toMap(Lesson::getLessonId, Lesson::getName, (a, b) -> a));

        List<LessonPerformanceDto> lessonBreakdown = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> entry : lessonPossible.entrySet()) {
            Long lessonId = entry.getKey();
            BigDecimal possible = entry.getValue();
            BigDecimal earned = lessonEarned.getOrDefault(lessonId, BigDecimal.ZERO);
            BigDecimal lessonPercentage = possible.signum() > 0
                    ? earned.multiply(BigDecimal.valueOf(100)).divide(possible, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            String title = lessonNames.getOrDefault(lessonId, "Lesson " + lessonId);
            lessonBreakdown.add(new LessonPerformanceDto(
                    lessonId, title, possible, earned, lessonPercentage,
                    lessonPending.getOrDefault(lessonId, 0)));
        }

        PhaseTimer.mark(timer, "build review");
        PhaseTimer.finish(timer);

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

        /* An arena is not a certification's assessment.
         *
         * A CHALLENGE exam belongs to a certification only because an exam has
         * to -- that is where its questions were authored. The arena itself is
         * a platform-wide surface: the IT Olympics are open to whoever the
         * admin opens them to, by industry, not to whoever happens to have
         * bought the certification the problems were written against.
         *
         * Without this, configuring CodeStrike from any one certification's
         * bank locked it for every learner not enrolled in that certification
         * -- which is most of them, and none of whom did anything wrong. The
         * arena would look unlocked on the challenges page and then refuse
         * entry, which is the exact failure the lock was meant to prevent.
         */
        if (TYPE_CHALLENGE.equals(exam.getExamType().getExamTypeText())) {
            return null;
        }

        Optional<LearnerCertification> enrollment = learnerCertificationRepository
                .findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        learnerId, certificationId, LearnerCertification.Status.active);

        /* Two ways to hold a certification, and both must open its assessments.
         *
         * A learner who buys it themselves gets a `learner_certifications` row.
         * One an organization sponsors gets only an
         * `organization_certification_learners` row -- `LearnerService
         * .acceptInvitation` never writes the former, and cannot: that table's
         * `order_detail_id` is NOT NULL, so it models a *purchase* and a
         * sponsored seat has no order behind it.
         *
         * Checking only the first told every invited learner to "enroll in this
         * certification" for a certification they had just been invited to and
         * accepted -- the diagnostic, and therefore the whole curriculum behind
         * it, was unreachable for anyone an institution sponsored.
         *
         * `ProgressAnalyticsService.getProgressAnalytics` already tests both
         * routes for exactly this reason; this is the same test, applied at the
         * gate that decides whether an assessment can be opened at all.
         */
        boolean organizationSponsored = organizationCertificationLearnerRepository
                .existsByLearner_LearnerIdAndOrgCert_Certification_CertificationIdAndStatus(
                        learnerId, certificationId, OrganizationCertificationLearner.Status.active);

        if (enrollment.isEmpty() && !organizationSponsored) {
            return "Enroll in this certification before taking its assessments.";
        }
        String type = exam.getExamType().getExamTypeText();
        // Mock exams are premium: lock them for learners without personal Pro or
        // an eligible institution-sponsored entitlement (shown as locked upfront;
        // startAttempt also hard-blocks with a structured 403).
        if (mockExamRequiresEntitlement
                && TYPE_MOCK.equals(type)
                && !learnerEntitlementService.hasLearnerEntitlement(
                        learnerId, Entitlements.MOCK_EXAM_ACCESS, certificationId)) {
            return "This mock exam requires REBYU Pro or an eligible institutional license.";
        }
        boolean diagnosticSat = diagnosticSat(enrollment.orElse(null), learnerId, certificationId);

        // The diagnostic is a one-time placement check, not a retakeable quiz:
        // once it has completed the enrollment's gate, block starting another.
        if (TYPE_DIAGNOSTIC.equals(type) && diagnosticSat) {
            return "You have already completed the diagnostic assessment for this certification.";
        }
        if (!TYPE_DIAGNOSTIC.equals(type)
                && !diagnosticSat
                && publishedDiagnosticExists(certificationId)) {
            return "Complete the diagnostic assessment before studying lessons.";
        }
        return null;
    }

    /**
     * Whether this learner has actually sat this certification's diagnostic.
     *
     * `diagnostic_completed_at` on the enrollment is the fast answer, but it is
     * not the only evidence and it is not always there. The flag is stamped on
     * the enrollment row that was active when the diagnostic was submitted, so
     * anything that produces a *different* active row afterwards -- unenrolling
     * and re-enrolling, an organization re-issuing a seat, a self-enrollment
     * added alongside a sponsored one -- leaves a learner who has demonstrably
     * sat the diagnostic looking, to this gate, like they never did. Every
     * assessment on the certification then refuses to start, while the
     * curriculum page (which reads their submitted results, not this flag)
     * shows the whole thing unlocked. That divergence is what a learner
     * experiences as "start quiz does nothing but say I have not done the
     * diagnostic".
     *
     * So the submitted attempt is treated as the fact and the flag as a cache
     * of it. Read-only on purpose: this runs inside `getLearnerAssessment`,
     * which is a `readOnly` transaction, and a gate is not the place to be
     * repairing rows. `completeDiagnosticGateIfApplicable` still writes the
     * flag on submit, which keeps the common path a single field read.
     */
    private boolean diagnosticSat(LearnerCertification enrollment, Long learnerId, Long certificationId) {
        // Null for a sponsored learner: they hold the certification through an
        // organization allocation, which has no enrollment row to cache the
        // flag on. The submitted-attempt check below is the real evidence
        // anyway -- the flag is only ever a shortcut past it.
        if (enrollment != null && enrollment.getDiagnosticCompletedAt() != null) {
            return true;
        }
        // Same scope as the gate itself: only the official diagnostic counts,
        // never a group's own copy. Asked as one COUNT rather than by reading
        // every submitted attempt back and resolving each one's lazy exam to
        // look at its type -- that was a round trip per attempt, on a gate that
        // runs before every assessment page and every attempt start.
        return examRepository.existsSubmittedAttemptOfOfficialType(
                learnerId, certificationId, TYPE_DIAGNOSTIC, AssessmentAttempt.Status.SUBMITTED);
    }

    /**
     * Only the OFFICIAL diagnostic gates the curriculum. A group's own
     * assessment is its own content and must never gate learners outside (or
     * inside) that group -- which is the {@code ownerGroup IS NULL} in the
     * query this delegates to.
     */
    private boolean publishedDiagnosticExists(Long certificationId) {
        return examRepository.existsOfficialPublishedByType(
                certificationId, TYPE_DIAGNOSTIC, Exam.Status.PUBLISHED);
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
            GradingBatch batch,
            Map<Long, Question> sourceQuestions,
            Map<Long, List<Question>> subQuestionsByParentId) {

        String type = attemptQuestion.getQuestionType();
        Question source = sourceQuestions.get(attemptQuestion.getSourceQuestionId());

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

        if ("SHORT_ANSWER".equals(type) && source != null
                && gradeFillInTheBlank(source, answer, points, subQuestionsByParentId)) {
            return;
        }

        if ("SHORT_ANSWER".equals(type) && source != null) {
            // Off the entity the batch loader already fetched it with, rather
            // than a fresh query for a row that is sitting right here.
            Optional<TextQuestionConfig> config =
                    Optional.ofNullable(source.getTextQuestionConfig());
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
        if (isWorkspaceType(type) && source != null) {
            String criticalThinkingType = resolveCriticalThinkingType(source);

            if (criticalThinkingType == null
                    && gradeCriticalThinkingAnswer(
                            attemptQuestion, source, answer, points, batch, subQuestionsByParentId)) {
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
                    && gradeDiagramAnswer(attemptQuestion, source, answer, points, batch)) {
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
     * Groups a submission's answers by what actually grades them, and runs
     * every family concurrently before any scoring begins.
     *
     * Purely deterministic in-process items -- multiple choice, exact-match
     * short answers -- are deliberately absent: they are decided by a field
     * comparison that finishes faster than a task could be handed to a thread,
     * so they are simply graded in the sequential pass that follows.
     *
     * Everything else is queued here by family and dispatched by
     * {@link AttemptGradingBatchService}, which starts all three at once.
     * Diagrams join them not because a graph comparison is slow on its own, but
     * because it is the one remaining grader that ran strictly one at a time
     * inside the scoring loop -- so a paper of diagrams paid for every
     * comparison in sequence while the AI family sat finished and idle.
     *
     * This method does every repository read the tasks need, because it runs on
     * the transaction-bound thread and the tasks do not. What it hands over are
     * closures over plain values.
     */
    private GradingBatch prepareGradingBatch(
            List<AssessmentAttemptQuestion> questions,
            Map<Long, AssessmentAttemptAnswer> answersByQuestion,
            Map<Long, Question> sourceQuestions,
            Map<Long, List<Question>> subQuestionsByParentId) {

        AttemptGradingBatchService.Workload workload = new AttemptGradingBatchService.Workload();

        for (AssessmentAttemptQuestion attemptQuestion : questions) {
            AssessmentAttemptAnswer answer =
                    answersByQuestion.get(attemptQuestion.getAttemptQuestionId());
            if (answer == null || !hasSubmittedContent(answer)) {
                continue;
            }

            Long key = attemptQuestion.getAttemptQuestionId();
            String type = attemptQuestion.getQuestionType();
            Question source = sourceQuestions.get(attemptQuestion.getSourceQuestionId());
            if (source == null) {
                continue;
            }
            BigDecimal points = attemptQuestion.getPoints() == null
                    ? BigDecimal.ONE : attemptQuestion.getPoints();

            if ("DESCRIPTIVE".equals(type) || isAiSemanticShortAnswer(type, source)) {
                AnswerGradingRequestDto request = descriptiveGradingRequest(
                        attemptQuestion, source, answer, points);
                workload.ai(key, () -> gradeWithRetry(request));
                continue;
            }

            if (isWorkspaceType(type)) {
                String criticalThinkingType = resolveCriticalThinkingType(source);

                if (criticalThinkingType == null) {
                    AnswerGradingRequestDto request =
                            criticalThinkingGradingRequest(
                                    attemptQuestion, source, answer, points, subQuestionsByParentId);
                    if (request != null) {
                        workload.ai(key, () -> gradeWithRetry(request));
                    }
                    continue;
                }

                if ("PROGRAMMING".equals(criticalThinkingType) && !hasDefinitiveVerdict(answer)) {
                    List<TestCaseInputDto> inputs = programmingInputsFor(source);
                    String code = answer.getSubmittedCode();
                    String language = answer.getProgrammingLanguage();
                    if (!inputs.isEmpty() && code != null && !code.isBlank()) {
                        workload.code(key, () -> Optional.ofNullable(
                                codeExecutionService.execute(
                                        new CodeExecutionRequestDto(language, code, inputs))));
                    }
                    continue;
                }

                if ("DIAGRAM".equals(criticalThinkingType)) {
                    // Queued only when a usable reference exists. The config
                    // read has to happen here anyway -- it is a repository call,
                    // and the task itself may not make one -- and it doubles as
                    // the check that stops us dispatching work whose only
                    // possible outcome is INVALID_REFERENCE.
                    diagramGradingRequest(source, answer, points).ifPresent(request ->
                            workload.diagram(key, () -> Optional.ofNullable(
                                    diagramGradingService.grade(request))));
                }
            }
        }

        return gradingBatchService.run(workload);
    }

    /**
     * The comparison request for a diagram answer, or empty when there is
     * nothing to compare against.
     *
     * An absent or blank reference diagram is an authoring gap, never the
     * learner's fault, and it is the same condition {@link #gradeDiagramAnswer}
     * treats as "no verdict" -- so recognising it here just avoids paying for
     * the grader to reach the same conclusion.
     */
    private Optional<DiagramGradingRequestDto> diagramGradingRequest(
            Question source, AssessmentAttemptAnswer answer, BigDecimal points) {
        return diagramQuestionConfigRepository
                .findByQuestion_QuestionId(source.getQuestionId())
                .map(DiagramQuestionConfig::getReferenceDiagramXml)
                .filter(xml -> xml != null && !xml.isBlank())
                .map(xml -> new DiagramGradingRequestDto(
                        xml, answer.getDiagramSubmissionData(), points));
    }

    private boolean isAiSemanticShortAnswer(String type, Question source) {
        // Same already-loaded config the scorer reads; see resolveCriticalThinkingType.
        return "SHORT_ANSWER".equals(type)
                && Optional.ofNullable(source.getTextQuestionConfig())
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
            BigDecimal points,
            GradingBatch batch) {

        // Normally already compared by the batch, alongside every other family.
        // The direct call is the fallback for anything the batch did not cover.
        DiagramGradingResultDto result =
                batch.diagramResults().get(attemptQuestion.getAttemptQuestionId());
        if (result == null) {
            Optional<DiagramGradingRequestDto> request =
                    diagramGradingRequest(source, answer, points);
            if (request.isEmpty()) {
                return false;
            }
            result = diagramGradingService.grade(request.get());
        }

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

    /**
     * Whether an item is a workspace item -- one sat in the code editor or on
     * the diagram canvas rather than in a plain answer box.
     *
     * <p>A question can say so two ways, and both are in the database. Older
     * ones are typed {@code CRITICAL_THINKING} and carry the specialism in a
     * programming or diagram config; the question bank's editors type them
     * {@code PROGRAMMING} or {@code DIAGRAM} outright. Every check here used to
     * test only for the first, so a directly typed coding problem was served as
     * a textarea, could not be run or checked, and -- worst of the three -- was
     * never routed to Judge0 or the structural grader when submitted. It was
     * marked as prose.
     */
    private static boolean isWorkspaceType(String questionType) {
        return "CRITICAL_THINKING".equals(questionType)
                || TYPE_PROGRAMMING_ITEM.equals(questionType)
                || TYPE_DIAGRAM_ITEM.equals(questionType);
    }

    private static final String TYPE_PROGRAMMING_ITEM = "PROGRAMMING";
    private static final String TYPE_DIAGRAM_ITEM = "DIAGRAM";

    /**
     * Which workspace grader a question needs, read off the question itself.
     *
     * <p>Both configs are already on the entity -- they are EAGER one-to-ones,
     * so they were loaded whether or not this method existed, and asking their
     * repositories for them was two more round trips for rows already in hand.
     */
    private String resolveCriticalThinkingType(Question source) {
        if (source.getProgrammingQuestionConfig() != null) {
            return "PROGRAMMING";
        }
        if (source.getDiagramQuestionConfig() != null) {
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
    /** Attempts before an answer is closed out unmarked. */
    private static final int GRADING_ATTEMPTS = 3;

    /**
     * Retries the AI grader, backing off between tries.
     *
     * Three attempts with a short pause rather than one immediate retry: the
     * failures worth retrying are transient -- a rate limit, a cold model, a
     * dropped connection -- and hammering the same instant twice mostly
     * reproduces them. The learner is on a loading screen throughout, so a few
     * seconds spent getting a real mark beats returning a zero nobody earned.
     */
    private Optional<AnswerGradingResultDto> gradeWithRetry(AnswerGradingRequestDto request) {
        for (int attempt = 1; attempt <= GRADING_ATTEMPTS; attempt++) {
            Optional<AnswerGradingResultDto> graded;
            try {
                graded = aiAnswerGradingService.grade(request);
            } catch (AiServiceException permanent) {
                // The request itself is wrong -- a missing route, a bad payload,
                // a rejected key. No number of retries fixes any of those.
                log.error("AI grading cannot succeed for this request; not retrying: {}",
                        permanent.getMessage());
                return Optional.empty();
            }
            if (graded.isPresent()) {
                return graded;
            }
            if (attempt < GRADING_ATTEMPTS) {
                log.warn("AI grading returned nothing (attempt {} of {}); retrying",
                        attempt, GRADING_ATTEMPTS);
                try {
                    Thread.sleep(1000L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        log.error("AI grading failed after {} attempts -- the answer will be closed out "
                + "unmarked. Check the AI service is reachable.", GRADING_ATTEMPTS);
        return Optional.empty();
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
     * Marks a fill-in-the-blank item: several blanks in one passage, each with
     * one right term, each worth its share of the item.
     *
     * <p>Returns false when this short answer is an ordinary one -- no
     * sub-questions -- so the caller falls through to its single-answer path.
     *
     * <p>Marked here rather than by the AI grader because a blank has exactly
     * one right term and the stem's candidate list makes sure of it. Sending it
     * to a model would be a paid call, and a slower attempt, to ask whether
     * "Usability" means the same as "Usability" -- with a chance of it saying
     * no. Partial credit is the point: three blanks right out of four scores
     * three quarters, not zero.
     */
    private boolean gradeFillInTheBlank(
            Question source, AssessmentAttemptAnswer answer, BigDecimal points,
            Map<Long, List<Question>> subQuestionsByParentId) {
        List<Question> blanks = subQuestionsByParentId
                .getOrDefault(source.getQuestionId(), List.of());
        if (blanks.isEmpty()) {
            return false;
        }

        Map<Long, BigDecimal> pointSplit = splitPointsAcrossSubQuestions(blanks, points);
        Map<Long, String> submitted = parseSubAnswerText(answer.getLearnerAnswer());

        BigDecimal earned = BigDecimal.ZERO;
        int correctBlanks = 0;
        // Per-blank rows, so the results screen can show each blank with what
        // the learner typed and whether it scored. Without these the review
        // has the blanks but no marks against them.
        List<Map<String, Object>> rows = new ArrayList<>();

        for (Question blank : blanks) {
            TextQuestionConfig config = blank.getTextQuestionConfig();
            String typed = submitted.get(blank.getQuestionId());
            BigDecimal max = pointSplit.getOrDefault(blank.getQuestionId(), BigDecimal.ZERO);

            boolean correct = config != null
                    && typed != null && !typed.isBlank()
                    && matchesTextAnswer(typed, config);
            if (correct) {
                correctBlanks++;
                earned = earned.add(max);
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("subQuestionId", blank.getQuestionId());
            row.put("questionText", blank.getQuestionText());
            row.put("learnerAnswer", typed);
            row.put("earnedPoints", correct ? max : BigDecimal.ZERO);
            row.put("maxPoints", max);
            // The expected term is the answer key, and whether a learner may
            // see it is the exam's release-answers decision, made elsewhere.
            // Saying only whether this blank scored keeps that decision intact.
            row.put("feedback", correct ? "Correct" : "Not the expected term");
            rows.add(row);
        }

        answer.setEarnedPoints(earned);
        // "Correct" means every blank, so the item reads as right or wrong in
        // the attempt summary while the score still reflects partial credit.
        answer.setIsCorrect(correctBlanks == blanks.size());
        answer.setPendingManualEvaluation(false);
        try {
            answer.setSubAnswerScores(objectMapper.writeValueAsString(rows));
        } catch (Exception e) {
            // The marks are already on the answer; only the per-blank
            // breakdown is lost, and a review without it still shows the score.
            log.warn("Could not serialize fill-in-the-blank sub-answer scores");
        }
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
            BigDecimal points,
            Map<Long, List<Question>> subQuestionsByParentId) {
        List<Question> subQuestions = subQuestionsByParentId
                .getOrDefault(source.getQuestionId(), List.of());
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
            GradingBatch batch,
            Map<Long, List<Question>> subQuestionsByParentId) {
        List<Question> subQuestions = subQuestionsByParentId
                .getOrDefault(source.getQuestionId(), List.of());
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
            Question source, AssessmentAttemptAnswer answer,
            Map<Long, List<Question>> subQuestionsByParentId) {
        // Any parent with parts, not just workspace ones.
        //
        // Gated on isWorkspaceType, a fill-in-the-blank came back with an
        // empty list: the learner saw partial marks on the question and no
        // blanks at all -- not what they typed, not what was right, on the
        // screen whose whole purpose is to tell them.
        //
        // A question with no parts still returns an empty list. The parts of the
        // whole paper arrive in one query from getResult; this only reads them.
        if (source == null) {
            return List.of();
        }
        List<Question> subQuestions = subQuestionsByParentId
                .getOrDefault(source.getQuestionId(), List.of());
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
                attempt.getStartedAt() == null
                        ? null : attempt.getStartedAt().atOffset(ZoneOffset.UTC),
                attempt.getExpiresAt() == null
                        ? null : attempt.getExpiresAt().atOffset(ZoneOffset.UTC),
                resumed,
                questionDtos,
                savedAnswers,
                attempt.getCurrentQuestionId(),
                flaggedIds,
                skippedIds
        );
    }

    /**
     * The parts of a paper's snapshots that do not live on the question rows,
     * gathered for every question at once.
     *
     * <p>Two queries, whatever the paper's size. See its use in
     * {@link #startAttempt} for why the per-question form it replaces was the
     * dominant cost of opening an assessment.
     */
    private record SnapshotContext(
            Map<Long, List<Question>> subQuestionsByParentId,
            Map<Long, List<QuestionRubricCriterion>> rubricByQuestionId) {

        static SnapshotContext empty() {
            return new SnapshotContext(Map.of(), Map.of());
        }

        List<Question> subQuestionsOf(Long questionId) {
            return subQuestionsByParentId.getOrDefault(questionId, List.of());
        }

        List<QuestionRubricCriterion> rubricOf(Long questionId) {
            return rubricByQuestionId.getOrDefault(questionId, List.of());
        }
    }

    private SnapshotContext buildSnapshotContext(List<Question> questions) {
        List<Long> questionIds = questions.stream()
                .map(Question::getQuestionId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (questionIds.isEmpty()) {
            return SnapshotContext.empty();
        }
        Map<Long, List<Question>> subQuestions = questionRepository
                .findSubQuestionsByParentIdIn(questionIds).stream()
                .collect(Collectors.groupingBy(
                        sub -> sub.getParentQuestion().getQuestionId(),
                        LinkedHashMap::new, Collectors.toList()));
        Map<Long, List<QuestionRubricCriterion>> rubric = rubricCriterionRepository
                .findByQuestion_QuestionIdInOrderByQuestion_QuestionIdAscDisplayOrderAsc(questionIds)
                .stream()
                .collect(Collectors.groupingBy(
                        criterion -> criterion.getQuestion().getQuestionId(),
                        LinkedHashMap::new, Collectors.toList()));
        return new SnapshotContext(subQuestions, rubric);
    }

    /**
     * Builds the learner-safe snapshot JSON for one question: choices without
     * correct flags/explanations, starter code, diagram type + instructions,
     * and sub-question prompts. Answer keys never enter the snapshot.
     *
     * <p>Reads only what it was handed: the question entity (loaded with its
     * choices and its three type configs by
     * {@link QuestionRepository#findForAttemptByIdIn}) and the batched
     * {@link SnapshotContext}. It issues no query of its own -- see
     * {@link #buildSnapshotContext}.
     */
    private String buildLearnerSafeSnapshot(Question question, SnapshotContext context) {
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

        if (isWorkspaceType(question.getQuestionType())) {
            ProgrammingQuestionConfig programmingConfig = question.getProgrammingQuestionConfig();
            if (programmingConfig != null) {
                data.put("criticalThinkingType", "PROGRAMMING");
                data.put("starterCode", programmingConfig.getStarterCode());
                // Learner-safe test metadata: sample inputs may show;
                // hidden cases are label-only, never expected output.
                List<Map<String, Object>> tests = new ArrayList<>();
                int index = 1;
                int sampleNo = 1;
                int hiddenNo = 1;
                for (ProgrammingTestCase testCase : programmingConfig.getTestCases()) {
                    Map<String, Object> safe = new LinkedHashMap<>();
                    boolean sample = testCase.isSample();
                    safe.put("index", index++);
                    safe.put("sample", sample);
                    safe.put("label", sample ? "Sample " + (sampleNo++) : "Hidden " + (hiddenNo++));
                    safe.put("input", sample ? testCase.getInputData() : null);
                    tests.add(safe);
                }
                data.put("testCases", tests);
            }
            DiagramQuestionConfig diagramConfig = question.getDiagramQuestionConfig();
            if (diagramConfig != null) {
                data.put("criticalThinkingType", "DIAGRAM");
                data.put("diagramType", diagramConfig.getDiagramType());
                data.put("instructions", diagramConfig.getInstructions());
                // reference diagram XML/JSON is the answer key -- excluded
            }
        }

        // Snapshotted for ANY question that has parts, not just workspace ones.
        //
        // Inside the workspace branch this only ran for critical-thinking
        // items, so a fill-in-the-blank -- a SHORT_ANSWER whose parts are its
        // blanks -- reached the learner with an empty list. The page then had
        // no blanks to draw and fell back to one answer box, and since each
        // blank is marked separately every one of them was marked wrong.
        //
        // A question with no parts still gets an empty list, exactly as before.
        List<Map<String, Object>> subQuestions = new ArrayList<>();
        for (Question sub : context.subQuestionsOf(question.getQuestionId())) {
            Map<String, Object> safe = new LinkedHashMap<>();
            safe.put("subQuestionId", sub.getQuestionId());
            safe.put("questionText", sub.getQuestionText());
            subQuestions.add(safe);
        }
        data.put("subQuestions", subQuestions);

        // Backend-driven rubric (diagram/descriptive): learner-safe name + max
        // points only. Awarded points are never snapshotted.
        List<QuestionRubricCriterion> criteria = context.rubricOf(question.getQuestionId());
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
        if (!isWorkspaceType(question.getQuestionType())) {
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
        if (!isWorkspaceType(attemptQuestion.getQuestionType())) {
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
