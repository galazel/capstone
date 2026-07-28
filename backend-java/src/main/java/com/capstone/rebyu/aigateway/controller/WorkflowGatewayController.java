package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.client.WorkflowClient;
import com.capstone.rebyu.aigateway.service.WorkflowStreamRelayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

/**
 * The browser's single entry point to AI generation workflows: what is running,
 * what it has done, what is waiting for a human, and the reviewer's decisions.
 *
 * <p>Every method is admin-gated here rather than in Python. Python authenticates
 * with a shared service key that identifies the *caller service*, not a user, so
 * it has no way to tell an admin from a learner. Keeping Cognito role checks on
 * this side means there is exactly one place where "who may drive a generation
 * run" is decided.
 */
@RestController
@RequestMapping("/api/ai/workflows")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class WorkflowGatewayController {

    private final WorkflowClient workflowClient;
    private final WorkflowStreamRelayService relayService;

    @GetMapping
    public Map<String, Object> listRuns(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long certificationId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return workflowClient.listRuns(status, certificationId, limit, offset);
    }

    /** The queue the workspace opens on: runs paused at a HITL checkpoint. */
    @GetMapping("/awaiting-review")
    public Map<String, Object> awaitingReview(@RequestParam(defaultValue = "50") int limit) {
        return workflowClient.listAwaitingReview(limit);
    }

    @GetMapping("/{runId}")
    public Map<String, Object> getRun(
            @PathVariable String runId,
            @RequestParam(defaultValue = "0") long afterSeq) {
        return workflowClient.getRun(runId, afterSeq);
    }

    /**
     * Artifact version history for a run, optionally for a single artifact
     * ({@code key=LESSON:3}). Includes the artifacts themselves, which is what
     * the workspace diffs and restores from.
     */
    @GetMapping("/{runId}/versions")
    public Map<String, Object> getVersions(
            @PathVariable String runId,
            @RequestParam(required = false) String key) {
        return workflowClient.getVersions(runId, key);
    }

    /**
     * Live timeline for one run.
     *
     * <p>{@code Last-Event-ID} is sent automatically by the browser on
     * reconnect and forwarded to Python, so a dropped connection resumes at the
     * exact event it stopped at instead of replaying the whole run.
     */
    @GetMapping(value = "/{runId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(
            @PathVariable String runId,
            @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId) {
        return relayService.relay(runId, lastEventId);
    }

    /**
     * What a paused run is waiting on: the generated artifact, its validation
     * report, the actions available, and the version refs for this item.
     */
    @GetMapping("/{runId}/review")
    public Map<String, Object> pendingReview(@PathVariable String runId) {
        return workflowClient.getPendingReview(runId);
    }

    @PostMapping("/{runId}/cancel")
    public Map<String, Object> cancel(@PathVariable String runId) {
        return workflowClient.cancelRun(runId);
    }

    /**
     * Recovery for a failed run. Retry re-runs only the step it died on,
     * keeping the minutes of ingestion and generation that preceded it;
     * restart throws the checkpoints away and begins again.
     *
     * <p>Python has had both since the workspace was built, but neither was
     * reachable from the browser -- so a failed run was a dead end in the UI
     * however recoverable it was underneath.
     */
    @PostMapping("/{runId}/retry")
    public Map<String, Object> retry(@PathVariable String runId) {
        return workflowClient.retryRun(runId);
    }

    @PostMapping("/{runId}/restart")
    public Map<String, Object> restart(@PathVariable String runId) {
        return workflowClient.restartRun(runId);
    }

    /**
     * Submits a reviewer's decision for a certification run.
     *
     * <p>Body: {@code action} (approve | edit | improve | regenerate | skip |
     * approve_remaining), plus {@code instructions} for improve, {@code payload}
     * for edit, and {@code restored_from} when the payload is an earlier version
     * being rolled back to.
     */
    @PostMapping("/certification/{threadId}/review")
    public Map<String, Object> reviewCertification(
            @PathVariable String threadId,
            @RequestBody Map<String, Object> decision) {
        return workflowClient.resumeCertification(threadId, decision);
    }

    /** The question-bank equivalent, which reviews a batch at a time. */
    @PostMapping("/question-bank/{threadId}/review")
    public Map<String, Object> reviewQuestionBatch(
            @PathVariable String threadId,
            @RequestBody Map<String, Object> decision) {
        return workflowClient.reviewQuestionBatch(threadId, decision);
    }
}
