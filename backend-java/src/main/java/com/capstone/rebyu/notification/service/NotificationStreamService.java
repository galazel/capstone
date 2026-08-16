package com.capstone.rebyu.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Server-Sent Events fan-out for in-app notifications: one live HTTP stream per
 * open tab, keyed by user, so a notification appears the moment it is created
 * instead of on the next poll.
 *
 * SSE rather than WebSocket because this feed is strictly one-way
 * (server to browser) and needs no broker, no STOMP frames, and no separate
 * handshake authentication -- the stream is an ordinary authenticated GET, so
 * the existing Cognito bearer-token filter chain secures it unchanged.
 *
 * A user may hold several emitters at once (multiple tabs/windows); every one
 * of them receives each event, and dead ones are dropped on the first failed
 * write.
 */
@Slf4j
@Service
public class NotificationStreamService {

    /**
     * Well above the heartbeat interval so an idle stream is never torn down
     * for being quiet. On timeout the browser simply reconnects.
     */
    private static final long STREAM_TIMEOUT_MS = 30 * 60 * 1000L;

    private final Map<Long, Collection<SseEmitter>> emittersByUser = new ConcurrentHashMap<>();

    /** Opens a stream for one tab. The caller returns this straight to the client. */
    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);

        Collection<SseEmitter> emitters =
                emittersByUser.computeIfAbsent(userId, key -> new CopyOnWriteArrayList<>());
        emitters.add(emitter);

        emitter.onCompletion(() -> remove(userId, emitter));
        // `completeQuietly` for the same reason as in `send`: onError in
        // particular fires *because* the async context is already broken, so
        // the plain `complete()` these used could throw straight back into the
        // container's callback.
        emitter.onTimeout(() -> {
            completeQuietly(emitter);
            remove(userId, emitter);
        });
        emitter.onError(error -> {
            completeQuietly(emitter);
            remove(userId, emitter);
        });

        // An immediate first event flushes the response headers, so the browser
        // fires onopen right away rather than sitting in a buffered proxy.
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            remove(userId, emitter);
            emitter.completeWithError(e);
            return emitter;
        }

        log.debug("Notification stream opened for userId={} ({} open)", userId, emitters.size());
        return emitter;
    }

    /** Delivers one payload to every stream this user currently has open. */
    public void push(Long userId, Object payload) {
        Collection<SseEmitter> emitters = emittersByUser.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : emitters) {
            send(userId, emitter, SseEmitter.event().name("notification").data(payload));
        }
    }

    /**
     * Keeps intermediaries from closing a quiet stream. A comment-only event is
     * ignored by the EventSource API but still counts as traffic on the wire.
     */
    @Scheduled(fixedDelay = 25_000L)
    public void heartbeat() {
        emittersByUser.forEach((userId, emitters) -> {
            for (SseEmitter emitter : emitters) {
                // Belt and braces around `send`, which already swallows a dead
                // client. This is the outer loop over *every* connected user,
                // so one escaped exception here would stop the sweep partway
                // and leave the rest of the estate unheartbeaten -- the exact
                // failure this method was the visible symptom of.
                try {
                    send(userId, emitter, SseEmitter.event().comment("keep-alive"));
                } catch (Exception e) {
                    log.debug("Heartbeat failed for userId={}; dropping that stream", userId, e);
                    remove(userId, emitter);
                }
            }
        });
    }

    private void send(Long userId, SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (Exception e) {
            // The tab closed or the connection died -- expected, not an error.
            //
            // Catches Exception rather than the IOException/IllegalStateException
            // pair it used to: this runs inside a fan-out loop, and anything that
            // escapes here stops every stream after this one from being written
            // to. What one dead client does must stay with that client.
            remove(userId, emitter);
            completeQuietly(emitter);
        }
    }

    /**
     * Ends a stream, tolerating one that has already ended.
     *
     * `complete()` is itself a throwing call once the container has torn the
     * async context down:
     *
     *   IllegalStateException: A non-container (application) thread attempted
     *   to use the AsyncContext after an error had occurred...
     *
     * which made the cleanup path the thing that failed. That exception escaped
     * `send`, then the per-user loop, then `ConcurrentHashMap.forEach`, and
     * killed the whole scheduled run -- so a single dead tab meant every stream
     * the map happened to visit after it silently stopped receiving heartbeats,
     * and was eventually dropped by an intermediary for being idle. The stack
     * trace named the heartbeat, which is why it read as a scheduler problem
     * rather than as one broken connection.
     */
    private static void completeQuietly(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (Exception ignored) {
            // Already completed, already errored, or its async context is gone.
            // There is nothing left to close and nothing to report.
        }
    }

    private void remove(Long userId, SseEmitter emitter) {
        emittersByUser.computeIfPresent(userId, (key, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }
}
