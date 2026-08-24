package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto;
import com.capstone.rebyu.diagram.dto.DiagramGradingResultDto;
import com.capstone.rebyu.execution.dto.CodeExecutionResultDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;

/**
 * Runs every expensive grader on one submission concurrently -- across
 * question-type families as well as within each of them.
 *
 * <p>This exists because grading used to serialise on the family boundary. The
 * AI batch was drained to completion before the first line of code was sent to
 * Judge0, and diagrams were not batched at all: they were compared one at a
 * time inside the sequential scoring loop. A paper mixing written answers, a
 * programming question and a diagram therefore cost
 * {@code slowest_written + all_code + every_diagram} end to end, even though
 * none of the three families has any dependency on the results of another.
 *
 * <p>Now all three start together. A mixed paper costs roughly the slowest
 * single family instead of their sum, and within a family the calls overlap up
 * to that family's own cap.
 *
 * <h2>Why the caps are per family</h2>
 * They are limited by completely different things, and a single shared number
 * would be wrong for all of them:
 * <ul>
 *   <li><b>AI</b> -- bounded by the provider's rate limit, not by us. Requests
 *       are long (seconds) and almost entirely idle, waiting on a socket, so
 *       this is the one worth opening up.</li>
 *   <li><b>Code</b> -- bounded by Judge0, which runs real sandboxes. Flooding
 *       it queues the submissions anyway, and a queued submission still holds
 *       one of our threads.</li>
 *   <li><b>Diagram</b> -- in-process graph matching, so bounded by CPU. More
 *       concurrency than cores buys nothing.</li>
 * </ul>
 *
 * <h2>Thread safety</h2>
 * Only the outbound call runs off-thread. Nothing here touches an entity, a
 * repository or the {@code EntityManager} -- none of which are thread-safe, and
 * the submission runs in one transaction bound to the calling thread, so every
 * mutation stays on it. Callers must therefore do all their JPA reads while
 * building the {@link Workload}, and hand over suppliers that are pure:
 * request in, result out.
 *
 * <p>Virtual threads carry the tasks: the work is blocking IO that spends its
 * life waiting on a socket, which is what they are for, and it leaves the
 * {@link Semaphore}s -- rather than a pool size -- as the only thing deciding
 * how many calls are in flight.
 *
 * <h2>Failure</h2>
 * A task that throws contributes no entry rather than failing the batch. Its
 * item falls through to the ordinary sequential path, which retries and, if
 * that also fails, closes the answer out rather than parking it.
 */
@Slf4j
@Service
public class AttemptGradingBatchService {

    private final int aiConcurrency;
    private final int codeConcurrency;
    private final int diagramConcurrency;

    public AttemptGradingBatchService(
            @Value("${rebyu.grading.concurrency.ai:8}") int aiConcurrency,
            @Value("${rebyu.grading.concurrency.code:4}") int codeConcurrency,
            @Value("${rebyu.grading.concurrency.diagram:4}") int diagramConcurrency) {
        this.aiConcurrency = Math.max(1, aiConcurrency);
        this.codeConcurrency = Math.max(1, codeConcurrency);
        this.diagramConcurrency = Math.max(1, diagramConcurrency);
    }

    /**
     * The graders one submission needs, collected per family before any of them
     * runs.
     *
     * Built entirely on the calling (transaction-bound) thread: the caller does
     * its repository reads here, turning each item into a self-contained
     * supplier that the batch can then safely run anywhere.
     *
     * Not thread-safe, and not meant to be -- one submission builds one of
     * these, on one thread, and then hands it over.
     */
    public static final class Workload {

        private final Map<Long, Supplier<Optional<AnswerGradingResultDto>>> ai =
                new LinkedHashMap<>();
        private final Map<Long, Supplier<Optional<CodeExecutionResultDto>>> code =
                new LinkedHashMap<>();
        private final Map<Long, Supplier<Optional<DiagramGradingResultDto>>> diagram =
                new LinkedHashMap<>();

        /** An AI-marked written answer, keyed by attemptQuestionId. */
        public void ai(Long attemptQuestionId, Supplier<Optional<AnswerGradingResultDto>> task) {
            ai.put(attemptQuestionId, task);
        }

        /** A programming answer to execute, keyed by attemptQuestionId. */
        public void code(Long attemptQuestionId, Supplier<Optional<CodeExecutionResultDto>> task) {
            code.put(attemptQuestionId, task);
        }

        /** A diagram answer to compare, keyed by attemptQuestionId. */
        public void diagram(
                Long attemptQuestionId, Supplier<Optional<DiagramGradingResultDto>> task) {
            diagram.put(attemptQuestionId, task);
        }

        public int size() {
            return ai.size() + code.size() + diagram.size();
        }

        public boolean isEmpty() {
            return size() == 0;
        }
    }

    /**
     * Runs every family in {@code workload} at once and collects what succeeded.
     *
     * Returns only once all three families have finished, because the caller's
     * scoring loop needs a complete picture before it marks anything.
     */
    public GradingBatch run(Workload workload) {
        if (workload.isEmpty()) {
            return GradingBatch.empty();
        }

        long startedAt = System.nanoTime();

        /* One executor for the whole submission rather than one per family:
           with virtual threads the executor is not the thing being rationed --
           the per-family semaphores are -- so a second executor would only add
           another object to close. */
        try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {

            // Everything is submitted before anything is joined; this is what
            // makes the families overlap instead of queueing behind each other.
            Map<Long, CompletableFuture<Optional<AnswerGradingResultDto>>> aiFutures =
                    submit("ai", workload.ai, pool, new Semaphore(aiConcurrency));
            Map<Long, CompletableFuture<Optional<CodeExecutionResultDto>>> codeFutures =
                    submit("code", workload.code, pool, new Semaphore(codeConcurrency));
            Map<Long, CompletableFuture<Optional<DiagramGradingResultDto>>> diagramFutures =
                    submit("diagram", workload.diagram, pool, new Semaphore(diagramConcurrency));

            GradingBatch batch = new GradingBatch(
                    collect("ai", aiFutures),
                    collect("code", codeFutures),
                    collect("diagram", diagramFutures));

            /* Logged at info deliberately: when a learner reports a slow
               "marking your answers" screen, this one line says whether the
               time went on the graders at all, and which family owned it. */
            log.info("Graded {} item(s) in {} ms (ai {}/{}, code {}/{}, diagram {}/{})",
                    workload.size(), (System.nanoTime() - startedAt) / 1_000_000,
                    batch.aiResults().size(), workload.ai.size(),
                    batch.codeResults().size(), workload.code.size(),
                    batch.diagramResults().size(), workload.diagram.size());
            return batch;
        }
    }

    /**
     * Hands one family's tasks to the executor, each gated by that family's
     * permit.
     *
     * The permit is acquired inside the task rather than before submitting it,
     * so submission never blocks -- a saturated AI family cannot delay the code
     * family from starting, which is the whole point of this class.
     */
    private <T> Map<Long, CompletableFuture<Optional<T>>> submit(
            String family,
            Map<Long, Supplier<Optional<T>>> tasks,
            ExecutorService pool,
            Semaphore permits) {

        Map<Long, CompletableFuture<Optional<T>>> futures = new LinkedHashMap<>();
        for (Map.Entry<Long, Supplier<Optional<T>>> entry : tasks.entrySet()) {
            Long key = entry.getKey();
            Supplier<Optional<T>> task = entry.getValue();
            futures.put(key, CompletableFuture.supplyAsync(() -> {
                try {
                    permits.acquire();
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    return Optional.<T>empty();
                }
                try {
                    return task.get();
                } catch (RuntimeException ex) {
                    log.warn("Grading call failed [{}] for attemptQuestion {}: {}",
                            family, key, ex.toString());
                    return Optional.<T>empty();
                } finally {
                    permits.release();
                }
            }, pool));
        }
        return futures;
    }

    /** Joins one family's futures, keeping only the items that produced a result. */
    private <T> Map<Long, T> collect(
            String family, Map<Long, CompletableFuture<Optional<T>>> futures) {

        Map<Long, T> results = new LinkedHashMap<>();
        for (Map.Entry<Long, CompletableFuture<Optional<T>>> entry : futures.entrySet()) {
            try {
                entry.getValue().join().ifPresent(value -> results.put(entry.getKey(), value));
            } catch (RuntimeException ex) {
                log.warn("Grading call failed [{}] for attemptQuestion {}: {}",
                        family, entry.getKey(), ex.toString());
            }
        }
        return results;
    }
}
