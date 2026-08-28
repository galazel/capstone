import { fetchEventSource } from "@microsoft/fetch-event-source"
import { API, base, currentAccessToken } from "./base"

/**
 * AI generation workflow runs: what is generating, what is paused for review,
 * and the reviewer's decisions.
 *
 * Everything goes through Java at /api/ai/workflows, never straight to the
 * Python service. Python authenticates with a shared service key that names the
 * calling *service*, not a user, so it cannot tell an admin from a learner —
 * putting that key in the browser would let anyone drive any run. Java holds it
 * server-side and applies the Cognito role check.
 */

export const listWorkflowRuns = ({ status, certificationId, limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams({ limit, offset })
  if (status) params.set("status", status)
  if (certificationId != null) params.set("certificationId", certificationId)
  return base(`ai/workflows?${params}`)
}

export const listAwaitingReview = (limit = 50) =>
  base(`ai/workflows/awaiting-review?limit=${limit}`)

export const getWorkflowRun = (runId, afterSeq = 0) =>
  base(`ai/workflows/${runId}?afterSeq=${afterSeq}`)

/**
 * Version history for a run, including the artifacts themselves — that is what
 * the compare view diffs and what Restore sends back.
 *
 * `key` narrows to one artifact (e.g. "LESSON:3"). Without it, a large run
 * returns every version of every item, which is a lot of payload for a view
 * that only ever shows one item at a time.
 */
export const getWorkflowVersions = (runId, key) =>
  base(`ai/workflows/${runId}/versions${key ? `?key=${encodeURIComponent(key)}` : ""}`)

/**
 * What a paused run is asking the reviewer to judge.
 *
 * Separate from the event stream because the artifact lives in the LangGraph
 * interrupt, not the event log — the log records that a review is waiting, not
 * what it is waiting on.
 */
export const getPendingReview = (runId) => base(`ai/workflows/${runId}/review`)

export const cancelWorkflowRun = (runId) =>
  base(`ai/workflows/${runId}/cancel`, { method: "POST" })

/**
 * Recovery for a failed run, offered when the run reports `recovery.can_retry`.
 *
 * Retry re-runs only the step that died, keeping everything before it — a
 * curriculum call that failed after a two-minute document ingestion does not
 * repeat the ingestion. Restart discards the checkpoints and begins again,
 * re-reading the certification's documents, which is the answer when the run's
 * state is itself the problem.
 *
 * Both return immediately; the work continues on the run's event stream.
 */
export const retryWorkflowRun = (runId) =>
  base(`ai/workflows/${runId}/retry`, { method: "POST" })

export const restartWorkflowRun = (runId) =>
  base(`ai/workflows/${runId}/restart`, { method: "POST" })

/**
 * Submits a reviewer's decision for the item a run is paused on.
 *
 * `action` is one of approve | edit | improve | regenerate | skip |
 * approve_remaining. `instructions` accompanies improve, `payload` accompanies
 * edit, and `restoredFrom` marks a payload that is an earlier version being
 * rolled back to, so the audit log records it as RESTORED rather than as
 * hand-written work.
 */
export const submitCertificationReview = (threadId, { action, instructions, payload, restoredFrom } = {}) =>
  base(`ai/workflows/certification/${threadId}/review`, {
    method: "POST",
    data: { action, instructions, payload, restored_from: restoredFrom },
  })

/**
 * Switches a certification run between supervised and unattended mid-flight.
 *
 * `mode` is "auto" (generate to the end without stopping) or "guided" (pause
 * at every checkpoint). Distinct from the `approve_all` review action: this
 * works on a run that is still generating, where there is no pending decision
 * to submit — which is the moment an admin actually decides they do not want
 * to sit through the reviews.
 */
export const setCertificationReviewMode = (threadId, mode) =>
  base(`ai/workflows/certification/${threadId}/review-mode`, {
    method: "POST",
    data: { mode },
  })

export const submitQuestionBatchReview = (threadId, { action, instructions, questions, restoredFrom } = {}) =>
  base(`ai/workflows/question-bank/${threadId}/review`, {
    method: "POST",
    data: { action, instructions, questions, restored_from: restoredFrom },
  })

/**
 * Opens the live timeline for one run.
 *
 * SSE rather than a WebSocket because the timeline is strictly server-to-client
 * — review actions are the POSTs above — and because `Last-Event-ID` is exactly
 * the replay cursor the backend event log already exposes, so a dropped
 * connection resumes at the event it stopped at instead of replaying the run.
 * fetch-event-source is used over the native EventSource for the same reason as
 * the notification feed: EventSource cannot set an Authorization header.
 *
 * Returns a function that closes the stream.
 */
export function streamWorkflow(runId, { onMessage, onOpen, onError, lastSeq = 0 } = {}) {
  const controller = new AbortController()

  const run = async () => {
    const token = await currentAccessToken()
    if (!token || controller.signal.aborted) return

    try {
      await fetchEventSource(`${API}/ai/workflows/${runId}/stream?lastSeq=${lastSeq}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        // A generation can run for many minutes with the tab in the background;
        // closing the stream then would strand the timeline mid-run.
        openWhenHidden: true,
        async onopen(response) {
          if (response.ok) {
            onOpen?.()
            return
          }
          // 401/403/404 will not fix themselves on retry.
          throw new Error(`Workflow stream failed: ${response.status}`)
        },
        onmessage(event) {
          if (!event.data) return
          try {
            onMessage?.(JSON.parse(event.data))
          } catch {
            // One malformed frame must not tear down the stream. The next
            // heartbeat or event carries on, and the reconnect logic in
            // fetch-event-source replays from the last good id if needed.
          }
        },
        onerror(error) {
          // Returning lets the library retry with backoff and resend
          // Last-Event-ID; throwing ends the stream permanently, so only give
          // up once the caller has unmounted.
          if (controller.signal.aborted) throw error
          onError?.(error)
        },
      })
    } catch {
      // Aborted on unmount, or the session ended. Nothing to recover.
    }
  }

  run()
  return () => controller.abort()
}
