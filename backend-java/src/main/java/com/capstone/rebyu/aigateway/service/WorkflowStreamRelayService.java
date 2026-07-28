package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.client.WorkflowClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;

import java.io.IOException;

/**
 * Relays Python's workflow event stream to a browser.
 *
 * <p>Why a relay rather than letting the browser connect to Python directly:
 * Python's endpoints are authenticated with a shared service key. Handing that
 * to the browser would let any signed-in user drive any workflow, so Java stays
 * the only client-facing entry point and holds the key server-side.
 *
 * <p>The stream is one-way (server to client) -- review actions are ordinary
 * REST calls -- so SSE is sufficient, and its {@code Last-Event-ID} header is
 * exactly the replay cursor Python's event log already exposes. That makes
 * reconnect-and-resume a property of the protocol rather than something each
 * client reimplements.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowStreamRelayService {

    /**
     * Well above the stream's 10s heartbeat, so an idle-but-healthy generation
     * is never torn down; a paused review can legitimately sit for a long time.
     * The browser reconnects with Last-Event-ID if this does fire.
     */
    private static final long STREAM_TIMEOUT_MS = 30 * 60 * 1000L;

    private final WorkflowClient workflowClient;

    public SseEmitter relay(String runId, String lastEventId) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);

        Disposable subscription = workflowClient.streamTimeline(runId, lastEventId)
                .subscribe(
                        event -> forward(emitter, runId, event),
                        error -> {
                            log.warn("Workflow stream {} failed: {}", runId, error.toString());
                            emitter.completeWithError(error);
                        },
                        emitter::complete
                );

        // Without this, closing a browser tab leaves the upstream Python stream
        // open indefinitely -- one leaked connection and subscriber queue per
        // abandoned tab. All three callbacks are registered because a client can
        // vanish (completion), stall (timeout), or break (error).
        emitter.onCompletion(subscription::dispose);
        emitter.onTimeout(() -> {
            subscription.dispose();
            emitter.complete();
        });
        emitter.onError(e -> subscription.dispose());

        return emitter;
    }

    private void forward(SseEmitter emitter, String runId, org.springframework.http.codec.ServerSentEvent<String> event) {
        try {
            SseEmitter.SseEventBuilder out = SseEmitter.event();
            if (event.event() != null) {
                out.name(event.event());
            }
            // Forwarding the id verbatim is what lets the browser resume: it
            // echoes the last one it saw back as Last-Event-ID, which we pass
            // through to Python, which replays from that seq.
            if (event.id() != null) {
                out.id(event.id());
            }
            if (event.data() != null) {
                out.data(event.data());
            }
            emitter.send(out);
        } catch (IOException e) {
            // The client went away mid-send. Expected, not an error worth a
            // stack trace; completing here triggers onCompletion, which
            // disposes the upstream subscription.
            log.debug("Client disconnected from workflow stream {}: {}", runId, e.toString());
            emitter.complete();
        } catch (IllegalStateException e) {
            // NOT a disconnect: the emitter was already completed or not yet
            // initialised. Lumping it in with IOException above meant an
            // internal fault closed the stream as quietly as a closed tab, so
            // a browser stuck reconnecting left no trace of why.
            log.warn("Workflow stream {} could not be written: {}", runId, e.toString());
            emitter.complete();
        }
    }
}
