package com.capstone.rebyu.aigateway.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriBuilder;
import reactor.core.publisher.Flux;

import java.util.Map;

/**
 * Client for the Python AI backend's workflow-run registry: which generation
 * runs exist, what each has done, which are paused for a human, and the live
 * event stream behind the Generation Workspace.
 *
 * <p>Payloads are passed through as {@code Map}/{@code String} rather than
 * mirrored into DTOs. This is a proxy: Java does not interpret a validation
 * report or a generated lesson, it forwards them. Mirroring Python's artifact
 * shapes here would recreate exactly the ~70 tool-mirror DTOs Phase 1 deleted,
 * and every prompt change in Python would become a Java compile error for no
 * added safety.
 */
@Slf4j
@Component
public class WorkflowClient {

    private final WebClient webClient;

    public WorkflowClient(WebClient aiWebClient) {
        this.webClient = aiWebClient;
    }

    public Map<String, Object> listRuns(String status, Long certificationId, int limit, int offset) {
        return get(uri -> {
            uri.path("/workflows").queryParam("limit", limit).queryParam("offset", offset);
            if (StringUtils.hasText(status)) {
                uri.queryParam("status", status);
            }
            if (certificationId != null) {
                uri.queryParam("certification_id", certificationId);
            }
            return uri.build();
        }, "List workflow runs");
    }

    public Map<String, Object> listAwaitingReview(int limit) {
        return get(uri -> uri.path("/workflows/awaiting-review")
                .queryParam("limit", limit)
                .build(), "List runs awaiting review");
    }

    public Map<String, Object> getRun(String runId, long afterSeq) {
        return get(uri -> uri.path("/workflows/{runId}")
                .queryParam("after_seq", afterSeq)
                .build(runId), "Fetch workflow run " + runId);
    }

    public Map<String, Object> getVersions(String runId, String key) {
        return get(uri -> {
            uri.path("/workflows/{runId}/versions");
            if (StringUtils.hasText(key)) {
                uri.queryParam("key", key);
            }
            return uri.build(runId);
        }, "Fetch versions for run " + runId);
    }

    /**
     * The artifact a paused run is asking a human to judge, with its validation
     * report and version refs. Lives in the LangGraph interrupt rather than the
     * event log, so it needs its own fetch.
     */
    public Map<String, Object> getPendingReview(String runId) {
        return get(uri -> uri.path("/workflows/{runId}/review").build(runId),
                "Fetch pending review for run " + runId);
    }

    public Map<String, Object> cancelRun(String runId) {
        try {
            return webClient.post()
                    .uri(uri -> uri.path("/workflows/{runId}/cancel").build(runId))
                    .retrieve()
                    .bodyToMono(MAP)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException("Cancel workflow run " + runId + " failed", e);
        }
    }

    /**
     * Submits a reviewer's decision for a certification run paused at a HITL
     * checkpoint. {@code decision} carries action plus any instructions, edited
     * payload, or restored-from revision.
     */
    public Map<String, Object> resumeCertification(String threadId, Map<String, Object> decision) {
        return post("/certification/{threadId}/resume", threadId, decision);
    }

    /** The question-bank equivalent, which reviews a whole batch at a time. */
    public Map<String, Object> reviewQuestionBatch(String threadId, Map<String, Object> decision) {
        return post("/question-bank/{threadId}/review", threadId, decision);
    }

    /**
     * Opens Python's SSE timeline for one run.
     *
     * <p>Returned as a {@link Flux} rather than blocked on, because the caller
     * relays it to a browser as it arrives. {@code lastEventId} is forwarded so
     * a reconnecting browser's replay cursor reaches Python intact -- without
     * it, a reconnect would re-send the whole history and the timeline would
     * render duplicates.
     */
    public Flux<ServerSentEvent<String>> streamTimeline(String runId, String lastEventId) {
        WebClient.RequestHeadersSpec<?> request = webClient.get()
                .uri(uri -> uri.path("/workflows/{runId}/stream").build(runId))
                .accept(MediaType.TEXT_EVENT_STREAM);

        if (StringUtils.hasText(lastEventId)) {
            request = request.header("Last-Event-ID", lastEventId);
        }
        return request.retrieve().bodyToFlux(SSE);
    }

    // --- plumbing ---------------------------------------------------------

    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    private static final ParameterizedTypeReference<ServerSentEvent<String>> SSE =
            new ParameterizedTypeReference<>() {};

    private interface UriFn {
        java.net.URI apply(UriBuilder builder);
    }

    private Map<String, Object> get(UriFn uriFn, String what) {
        try {
            return webClient.get()
                    .uri(uriFn::apply)
                    .retrieve()
                    .bodyToMono(MAP)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException(what + " failed", e);
        }
    }

    private Map<String, Object> post(String path, String threadId, Map<String, Object> body) {
        try {
            return webClient.post()
                    .uri(uri -> uri.path(path).build(threadId))
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(MAP)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException("Review submission for " + threadId + " failed", e);
        }
    }
}
