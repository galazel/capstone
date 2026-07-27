package com.capstone.rebyu.bkt.service;

import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptAnswer;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptQuestion;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.bkt.config.BktProperties;
import com.capstone.rebyu.bkt.dto.BktMasteryEvent;
import com.capstone.rebyu.bkt.entity.BktEventOutbox;
import com.capstone.rebyu.bkt.entity.BktOutboxStatus;
import com.capstone.rebyu.bkt.repository.BktEventOutboxRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Writes and manages BKT outbox rows. {@link #enqueueForAttempt} runs inside the
 * assessment submission transaction (transactional outbox); the claim/finalize
 * helpers back the asynchronous dispatcher.
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class BktOutboxService {

    private final BktEventOutboxRepository outboxRepository;
    private final BktEventFactory eventFactory;
    private final QuestionRepository questionRepository;
    private final BktProperties properties;
    private final ObjectMapper objectMapper;

    // ------------------------------------------------------------------
    // Producer side — inside the submission transaction
    // ------------------------------------------------------------------

    /**
     * Creates one PENDING event per final, graded, lesson-mapped answer. Idempotent
     * by deterministic event id, so a re-submit or reconciliation never duplicates
     * evidence. Must never break the submission: all failures are swallowed and
     * logged (the assessment result is already the source of truth).
     */
    public int enqueueForAttempt(
            AssessmentAttempt attempt,
            List<AssessmentAttemptQuestion> questions,
            Map<Long, AssessmentAttemptAnswer> answersByQuestionId) {

        if (!properties.isEnabled()) {
            return 0;
        }
        try {
            String rawAssessmentType = attempt.getExam().getExamType().getExamTypeText();
            Long certificationId = attempt.getExam().getCertification().getCertificationId();
            Long examId = attempt.getExam().getExamId();
            Long attemptId = attempt.getAssessmentAttemptId();
            String batchId = "attempt-" + attemptId;

            int created = 0;
            for (AssessmentAttemptQuestion question : questions) {
                AssessmentAttemptAnswer answer =
                        answersByQuestionId.get(question.getAttemptQuestionId());

                Question sourceQuestion = questionRepository
                        .findById(question.getSourceQuestionId())
                        .orElse(null);

                BktMasteryEvent event = eventFactory.buildEvent(
                        attempt, question, answer, sourceQuestion,
                        certificationId, rawAssessmentType);
                if (event == null) {
                    continue; // unanswered / pending grading / no lesson mapping
                }
                if (outboxRepository.existsByEventId(event.sourceEventId())) {
                    continue; // already enqueued (idempotent)
                }

                outboxRepository.save(BktEventOutbox.builder()
                        .eventId(event.sourceEventId())
                        .batchId(batchId)
                        .learnerId(attempt.getLearnerId())
                        .certificationId(certificationId)
                        .examId(examId)
                        .examResultId(attemptId)
                        .attemptNo(attempt.getAttemptNumber())
                        .eventType("MASTERY")
                        .payloadJson(objectMapper.writeValueAsString(event))
                        .status(BktOutboxStatus.PENDING)
                        .createdAt(LocalDateTime.now())
                        .build());
                created++;
            }
            if (created > 0) {
                log.info("Enqueued {} BKT event(s) for attempt {} ({})",
                        created, attemptId, rawAssessmentType);
            }
            return created;
        } catch (Exception e) {
            // Analytics evidence is best-effort; reconciliation will recover it.
            log.warn("Could not enqueue BKT events for attempt {}: {}",
                    attempt.getAssessmentAttemptId(), e.getMessage());
            return 0;
        }
    }

    /**
     * Enqueues one already-built event from a producer that doesn't go
     * through {@link #enqueueForAttempt} (e.g. AI-tutor/community practice
     * quizzes) -- same idempotency-by-event-id and PENDING-row shape as the
     * primary path, without duplicating the outbox-row construction.
     */
    public boolean enqueueEvent(BktMasteryEvent event, String batchId, Long certificationId, Long examResultId) {
        if (!properties.isEnabled()) {
            return false;
        }
        try {
            if (outboxRepository.existsByEventId(event.sourceEventId())) {
                return false; // already enqueued (idempotent)
            }
            outboxRepository.save(BktEventOutbox.builder()
                    .eventId(event.sourceEventId())
                    .batchId(batchId)
                    .learnerId(event.learnerId())
                    .certificationId(certificationId)
                    .examResultId(examResultId)
                    .attemptNo(1)
                    .eventType("MASTERY")
                    .payloadJson(objectMapper.writeValueAsString(event))
                    .status(BktOutboxStatus.PENDING)
                    .createdAt(LocalDateTime.now())
                    .build());
            return true;
        } catch (Exception e) {
            // Analytics evidence is best-effort; reconciliation will recover it.
            log.warn("Could not enqueue BKT event {}: {}", event.sourceEventId(), e.getMessage());
            return false;
        }
    }

    /**
     * Admin retry: force FAILED / DEAD_LETTER rows back to PENDING for immediate
     * redelivery. Idempotency on the FastAPI side keeps this safe.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int resetForRetry(List<Long> ids) {
        int reset = 0;
        for (BktEventOutbox row : outboxRepository.findAllById(ids)) {
            row.setStatus(BktOutboxStatus.PENDING);
            row.setRetryCount(0);
            row.setNextRetryAt(null);
            row.setLockedAt(null);
            row.setLockedBy(null);
            reset++;
        }
        return reset;
    }

    // ------------------------------------------------------------------
    // Consumer side — own transactions, called by the dispatcher
    // ------------------------------------------------------------------

    /**
     * Atomically claims up to {@code limit} deliverable rows using SKIP LOCKED and
     * flips them to PROCESSING. REQUIRES_NEW so the claim commits before the HTTP
     * call, releasing the row lock immediately.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public List<BktEventOutbox> claimBatch(int limit, String workerId) {
        List<BktEventOutbox> claimed =
                outboxRepository.claimPending(LocalDateTime.now(), limit);
        LocalDateTime now = LocalDateTime.now();
        for (BktEventOutbox row : claimed) {
            row.setStatus(BktOutboxStatus.PROCESSING);
            row.setLockedAt(now);
            row.setLockedBy(workerId);
        }
        outboxRepository.saveAll(claimed);
        return claimed;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markProcessed(List<Long> ids) {
        LocalDateTime now = LocalDateTime.now();
        for (BktEventOutbox row : outboxRepository.findAllById(ids)) {
            row.setStatus(BktOutboxStatus.PROCESSED);
            row.setProcessedAt(now);
            row.setLastError(null);
            row.setLockedBy(null);
            row.setLockedAt(null);
        }
    }

    /**
     * Records a delivery failure with exponential backoff. Rows past the retry
     * ceiling move to DEAD_LETTER for admin reconciliation.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markRetry(List<Long> ids, String error) {
        LocalDateTime now = LocalDateTime.now();
        for (BktEventOutbox row : outboxRepository.findAllById(ids)) {
            int attempts = row.getRetryCount() + 1;
            row.setRetryCount(attempts);
            row.setLastError(truncate(error));
            row.setLockedBy(null);
            row.setLockedAt(null);
            if (attempts >= properties.getMaxRetries()) {
                row.setStatus(BktOutboxStatus.DEAD_LETTER);
            } else {
                row.setStatus(BktOutboxStatus.PENDING);
                row.setNextRetryAt(now.plusSeconds(backoffSeconds(attempts)));
            }
        }
    }

    /**
     * Moves rows straight to DEAD_LETTER, bypassing the retry counter/backoff
     * entirely. For failures that can never succeed on their own (e.g. a
     * payload that fails to deserialize) -- retrying those with
     * {@link #markRetry} would just burn through {@code maxRetries} attempts
     * and up to the full backoff ceiling before reaching the same outcome.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDeadLetter(List<Long> ids, String error) {
        for (BktEventOutbox row : outboxRepository.findAllById(ids)) {
            row.setStatus(BktOutboxStatus.DEAD_LETTER);
            row.setLastError(truncate(error));
            row.setLockedBy(null);
            row.setLockedAt(null);
        }
    }

    /** initial * 2^(attempts-1), capped at the configured maximum. */
    long backoffSeconds(int attempts) {
        long delay = (long) properties.getRetryInitialDelaySeconds()
                * (1L << Math.min(attempts - 1, 20));
        return Math.min(delay, properties.getRetryMaxDelaySeconds());
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 1000 ? value : value.substring(0, 1000);
    }
}
