package com.capstone.rebyu.common;

import org.slf4j.Logger;

import java.util.ArrayList;
import java.util.List;

/**
 * A stopwatch that reports where a single request's time actually went.
 *
 * <p>Written for the assessment engine, whose slow operations are slow for
 * reasons that are invisible from the outside: "submit took nine seconds" does
 * not say whether the nine seconds were the AI grader, the database, or the
 * scoring loop, and guessing at that is how a fast path gets optimised while
 * the real cost sits untouched next to it. Each phase is marked as it
 * finishes and the whole breakdown is logged on one line at the end:
 *
 * <pre>
 * Retake prepare 550ms [create attempt 120ms, previous questions 80ms,
 *                       select questions 150ms, snapshot 130ms, response 70ms]
 * </pre>
 *
 * <p>Logged at DEBUG, so it costs a few longs and nothing else in production
 * and turns on per environment with {@code APP_LOG_LEVEL=DEBUG}. Not
 * thread-safe: one timer belongs to one request thread, which is the only
 * place its numbers mean anything.
 */
public final class PhaseTimer {

    private record Phase(String name, long millis) {}

    private final String operation;
    private final Logger log;
    private final long startedAt = System.nanoTime();
    private final List<Phase> phases = new ArrayList<>();
    private long lastMark = startedAt;

    private PhaseTimer(String operation, Logger log) {
        this.operation = operation;
        this.log = log;
    }

    /**
     * A timer that records nothing when the logger is not at DEBUG, so a caller
     * never pays for measurement no one is reading.
     */
    public static PhaseTimer start(String operation, Logger log) {
        return log.isDebugEnabled() ? new PhaseTimer(operation, log) : null;
    }

    /** Closes the phase that ended here and opens the next one. */
    public static void mark(PhaseTimer timer, String phase) {
        if (timer == null) {
            return;
        }
        long now = System.nanoTime();
        timer.phases.add(new Phase(phase, (now - timer.lastMark) / 1_000_000));
        timer.lastMark = now;
    }

    /** Logs the breakdown. Safe to call on a null timer (DEBUG is off). */
    public static void finish(PhaseTimer timer) {
        if (timer == null) {
            return;
        }
        long total = (System.nanoTime() - timer.startedAt) / 1_000_000;
        StringBuilder breakdown = new StringBuilder();
        for (Phase phase : timer.phases) {
            if (breakdown.length() > 0) {
                breakdown.append(", ");
            }
            breakdown.append(phase.name()).append(' ').append(phase.millis()).append("ms");
        }
        timer.log.debug("[perf] {} {}ms [{}]", timer.operation, total, breakdown);
    }
}
