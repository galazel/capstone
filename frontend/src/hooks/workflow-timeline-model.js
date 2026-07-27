/**
 * Pure reduction of a workflow event log into the timeline the workspace draws.
 *
 * Kept free of React and of any service import so it can be reasoned about — and
 * exercised — on its own. The subtleties here (a stage running more than once, a
 * completion with no matching start after a reconnect) are the kind that are
 * invisible in a rendered UI and obvious in isolation.
 */

export const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"])

export function maxSeq(events) {
  return (events ?? []).reduce((max, event) => Math.max(max, event.seq ?? 0), 0)
}

/** Union by seq, oldest first. Later copies of a seq win. */
export function mergeEvents(existing, incoming) {
  if (!incoming?.length) return existing
  const bySeq = new Map((existing ?? []).map((event) => [event.seq, event]))
  incoming.forEach((event) => bySeq.set(event.seq, event))
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

/**
 * A terminal message reports the event type that ended the run
 * ("workflow.cancelled"), or a run status when the run had already finished
 * before we connected. Normalise both to a status.
 */
export function terminalStatus(status, fallback) {
  if (TERMINAL_STATUSES.has(status)) return status
  if (status === "workflow.completed") return "COMPLETED"
  if (status === "workflow.failed") return "FAILED"
  if (status === "workflow.cancelled") return "CANCELLED"
  return fallback
}

/**
 * Keeps the run summary current from events, so status and stage update the
 * moment they change rather than on the next fetch.
 */
export function applyEventToRun(run, event) {
  if (!run) return run
  const next = { ...run, last_seq: event.seq }
  if (event.stage) next.current_stage = event.stage
  switch (event.event_type) {
    case "review.waiting":
      return { ...next, status: "WAITING_FOR_REVIEW" }
    case "workflow.restarted":
      // A new attempt from the first step: the error and stage on the run
      // describe the attempt that just ended, not this one.
      return { ...next, status: "RUNNING", current_stage: null, error_message: null }
    case "workflow.retried":
    case "workflow.resumed":
    case "review.submitted":
      return { ...next, status: "RUNNING", error_message: null }
    case "workflow.completed":
      return { ...next, status: "COMPLETED" }
    case "workflow.failed":
      return { ...next, status: "FAILED", error_message: event.payload?.error ?? next.error_message }
    case "workflow.cancelled":
      return { ...next, status: "CANCELLED" }
    default:
      return next
  }
}

/**
 * Events that begin a fresh attempt at the whole run, from its first step.
 *
 * `workflow.retried` is deliberately absent: a retry re-runs the one step that
 * failed and carries on, so everything before it is still work this attempt
 * did and belongs on the same timeline.
 */
export const ATTEMPT_BOUNDARY_EVENTS = new Set(["workflow.started", "workflow.restarted"])

export function attemptCount(events) {
  return (events ?? []).filter((event) => ATTEMPT_BOUNDARY_EVENTS.has(event.event_type)).length
}

/**
 * Events belonging to the attempt now running.
 *
 * A run's event log is cumulative across attempts: the registry keys runs by
 * thread id, so a redelivered queue message or an admin restart continues the
 * same run rather than forking a new one. Drawing the whole log meant opening a
 * generation and seeing a dozen tasks from attempts hours earlier, with the one
 * live task buried at the bottom.
 *
 * Nothing is lost — the full log is still what the Activity tab renders.
 */
export function currentAttemptEvents(events) {
  const list = events ?? []
  let start = 0
  list.forEach((event, index) => {
    if (ATTEMPT_BOUNDARY_EVENTS.has(event.event_type)) start = index
  })
  return start === 0 ? list : list.slice(start)
}

/**
 * Collapses the event log into the task list.
 *
 * A task is one *execution* of one stage. A stage can run more than once — a
 * regenerate re-enters it — so a completed task is closed out and no longer
 * matchable. Keying by stage alone would let a regenerated lesson overwrite the
 * record of its first attempt, and the timeline would claim it ran once.
 */
export function buildTasks(events) {
  const tasks = []
  const openByStage = new Map()

  ;(events ?? []).forEach((event) => {
    const { stage, event_type: type } = event
    if (!stage) return

    if (type === "node.started") {
      const task = {
        id: `${stage}#${tasks.length}`,
        stage,
        status: "RUNNING",
        startedAt: event.created_at,
        durationMs: null,
        retryCount: event.retry_count ?? 0,
        itemNumber: event.payload?.item_number ?? null,
        error: null,
        seq: event.seq,
      }
      tasks.push(task)
      openByStage.set(stage, task)
      return
    }

    if (type === "node.completed") {
      // A reconnect can deliver a completion whose start we never saw (it was
      // before the client's replay cursor). Synthesising the task keeps the
      // timeline honest instead of dropping the work silently.
      let target = openByStage.get(stage)
      if (!target) {
        target = {
          id: `${stage}#${tasks.length}`,
          stage,
          startedAt: null,
          retryCount: event.retry_count ?? 0,
          itemNumber: null,
          seq: event.seq,
        }
        tasks.push(target)
      }
      target.status = event.task_status === "FAILED" ? "FAILED" : "COMPLETED"
      target.durationMs = event.duration_ms ?? null
      target.error = event.payload?.error ?? null
      if (event.payload?.item_number) target.itemNumber = event.payload.item_number
      openByStage.delete(stage)
      return
    }

    if (type === "review.waiting") {
      tasks.push({
        id: `review:${stage}#${event.seq}`,
        stage,
        status: "WAITING_FOR_REVIEW",
        startedAt: event.created_at,
        durationMs: null,
        retryCount: 0,
        isReview: true,
        seq: event.seq,
      })
      return
    }

    if (type === "review.submitted") {
      const pending = [...tasks]
        .reverse()
        .find((task) => task.isReview && task.stage === stage && task.status === "WAITING_FOR_REVIEW")
      if (pending) {
        const action = event.payload?.action
        // Skip and reject are the same decision under two names; both mean the
        // item was deliberately left out, which is not a failure.
        pending.status = action === "skip" || action === "reject" ? "SKIPPED" : "COMPLETED"
        pending.action = action
      }
    }
  })

  return tasks
}

/** The task a reviewer should be looking at: the newest one still open. */
export function findCurrentTask(tasks) {
  return (
    [...tasks]
      .reverse()
      .find((task) => task.status === "RUNNING" || task.status === "WAITING_FOR_REVIEW") ?? null
  )
}
