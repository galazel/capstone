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
        emitter.onTimeout(() -> {
            emitter.complete();
            remove(userId, emitter);
        });
        emitter.onError(error -> {
            emitter.complete();
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
                send(userId, emitter, SseEmitter.event().comment("keep-alive"));
            }
        });
    }

    private void send(Long userId, SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (IOException | IllegalStateException e) {
            // The tab closed or the connection died -- expected, not an error.
            remove(userId, emitter);
            emitter.complete();
        }
    }

    private void remove(Long userId, SseEmitter emitter) {
        emittersByUser.computeIfPresent(userId, (key, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }
}
