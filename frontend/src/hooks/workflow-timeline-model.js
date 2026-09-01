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
        itemTotal: event.payload?.item_total ?? null,
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
          itemTotal: null,
          seq: event.seq,
        }
        tasks.push(target)
      }
      target.status = event.task_status === "FAILED" ? "FAILED" : "COMPLETED"
      target.durationMs = event.duration_ms ?? null
      target.error = event.payload?.error ?? null
      if (event.payload?.item_number) target.itemNumber = event.payload.item_number
      if (event.payload?.item_total) target.itemTotal = event.payload.item_total
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

/**
 * Which unit of work a stage belongs to.
 *
 * Three graph nodes run for every lesson — write it, quiz it, check it — and a
 * fourth pauses for review. Listed flat, a twenty-lesson certification is eighty
 * rows of near-identical text and the reviewer has to count to work out which
 * lesson is being built. Grouped, it is one row per lesson with its steps
 * nested underneath, which is the level the reviewer actually thinks at.
 */
const STAGE_FAMILIES = {
  validate_documents: "documents",
  // Runs BETWEEN validating and ingesting (see the graph's edges). Grouping is
  // by consecutive family, so leaving this stage unmapped gave it a family of
  // its own and split the document phase into two "Source documents" groups
  // with an unrelated row wedged between them -- one showing the validate step,
  // one showing the ingest step, as though documents were read twice.
  capture_document_visuals: "documents",
  ingest_documents: "documents",
  plan_curriculum: "curriculum",
  CURRICULUM: "curriculum",
  major_generate: "major",
  major_validate: "major",
  MAJOR: "major",
  middle_generate: "middle",
  middle_validate: "middle",
  MIDDLE: "middle",
  lesson_content: "lesson",
  lesson_quiz_generate: "lesson",
  lesson_validate: "lesson",
  LESSON: "lesson",
  generate_diagnostic_exam: "diagnostic_exam",
  DIAGNOSTIC_EXAM: "diagnostic_exam",
  generate_mock_exam: "mock_exam",
  MOCK_EXAM: "mock_exam",
  generate_question_bank: "question_bank",
  QUESTION_BANK: "question_bank",
  resolve_scope: "scope",
  generate_batch: "question_batch",
  validate_batch: "question_batch",
  QUESTION_BATCH: "question_batch",
}

const FAMILY_LABELS = {
  documents: "Source documents",
  curriculum: "Curriculum",
  major: "Major category",
  middle: "Middle category",
  lesson: "Lesson",
  diagnostic_exam: "Diagnostic exam",
  mock_exam: "Mock exam",
  question_bank: "Question bank",
  scope: "Scope",
  question_batch: "Question batch",
}

/**
 * Status of a group, from the statuses of its steps.
 *
 * Ordered by what the reviewer needs to see first: a group holding a failure or
 * a review pause is reported as such even if later steps completed, because
 * those are the two states that need a person. "All steps skipped" stays
 * SKIPPED — reporting it COMPLETED would claim work that was deliberately left
 * out actually happened.
 */
function groupStatus(steps) {
  const has = (status) => steps.some((step) => step.status === status)
  if (has("WAITING_FOR_REVIEW")) return "WAITING_FOR_REVIEW"
  if (has("FAILED")) return "FAILED"
  if (has("RETRYING")) return "RETRYING"
  if (has("RUNNING")) return "RUNNING"
  if (has("CANCELLED")) return "CANCELLED"
  if (steps.every((step) => step.status === "SKIPPED")) return "SKIPPED"
  if (has("COMPLETED")) return "COMPLETED"
  return "PENDING"
}

/**
 * Collapses the task list into the grouped feed the transcript draws.
 *
 * Consecutive tasks sharing a family and an item number are one group, so order
 * is preserved and a stage revisited later (a regenerated lesson 7 after lesson
 * 8 started) opens a second group rather than reordering the feed to rejoin the
 * first. Reading the transcript top to bottom still tells you what happened
 * when, which is the property a merged-by-key grouping would lose.
 */
export function buildTranscript(tasks) {
  const groups = []

  ;(tasks ?? []).forEach((task) => {
    const family = STAGE_FAMILIES[task.stage] ?? `stage:${task.stage}`
    const key = `${family}#${task.itemNumber ?? ""}`
    const last = groups[groups.length - 1]

    if (last?.key === key) {
      last.steps.push(task)
      return
    }

    // A review pause carries no item number: `review.waiting` reports the stage
    // and the validation report, and the item lives in the LangGraph interrupt
    // the event log never sees. But the graph always wires generate → validate →
    // review for one item, so the pause belongs to the group just before it —
    // without this it opened a second, apparently empty "Lesson" group directly
    // under the lesson it was reviewing.
    if (task.isReview && task.itemNumber == null && last?.family === family) {
      last.steps.push(task)
      return
    }

    groups.push({
      id: `${key}@${task.seq}`,
      key,
      family,
      label: FAMILY_LABELS[family] ?? stageTitle(task.stage),
      itemNumber: task.itemNumber ?? null,
      itemTotal: task.itemTotal ?? null,
      steps: [task],
    })
  })

  return groups.map((group) => {
    const durations = group.steps.map((step) => step.durationMs).filter((ms) => ms != null)

    return {
      ...group,
      status: groupStatus(group.steps),
      // Summed rather than wall-clock: the graph runs one node at a time, and
      // there is no group-level start/end event to subtract.
      durationMs: durations.length ? durations.reduce((total, ms) => total + ms, 0) : null,
      error: group.steps.find((step) => step.error)?.error ?? null,
    }
  })
}

/** Fallback label for a stage with no family, matching stageLabel's shape. */
function stageTitle(stage) {
  if (!stage) return "Workflow"
  return stage.replace(/_/g, " ").replace(/^\w/, (character) => character.toUpperCase())
}

/**
 * How many instrumented steps each unit of work runs, read off the graph's
 * wiring in `app/graphs/certification/workflow.py`.
 *
 * Documents is validate → capture visuals → ingest; a lesson is content →
 * quiz → check; a category is generate → check. Review pauses are not counted:
 * they are not instrumented nodes, and a run left waiting is not a run making
 * progress.
 *
 * Steps are counted, not timed. Weighting them by an estimated duration would
 * put a number on the bar that looks more precise than it is — the actual cost
 * of a step swings with the model, the document set, and how much of the
 * curriculum a retry re-did.
 */
export const PLANNED_STEPS = {
  documents: 3,
  curriculum: 1,
  lesson: 3,
  middle: 2,
  major: 2,
  mock_exam: 1,
  diagnostic_exam: 1,
  question_bank: 1,
}

/** Everything the run always does, whatever the curriculum turns out to be. */
const FIXED_STEPS =
  PLANNED_STEPS.documents +
  PLANNED_STEPS.curriculum +
  PLANNED_STEPS.mock_exam +
  PLANNED_STEPS.diagnostic_exam +
  PLANNED_STEPS.question_bank

const FINISHED_STEP_STATUSES = new Set(["COMPLETED", "SKIPPED"])

/**
 * The run's plan — how many majors, middles and lessons the curriculum implies.
 *
 * The server puts it on every node event once the curriculum exists rather than
 * announcing it once, so a client that attaches halfway through still gets a
 * denominator. Read from the newest event backwards because a regenerated
 * curriculum changes the plan mid-run.
 */
export function findRunPlan(events) {
  for (let i = (events?.length ?? 0) - 1; i >= 0; i -= 1) {
    const plan = events[i]?.payload?.plan
    if (plan?.lessons) return plan
  }
  return null
}

/** Total instrumented steps a run against `plan` will execute. */
export function plannedStepCount(plan) {
  if (!plan?.lessons) return null
  return (
    FIXED_STEPS +
    PLANNED_STEPS.lesson * (plan.lessons ?? 0) +
    PLANNED_STEPS.middle * (plan.middles ?? 0) +
    PLANNED_STEPS.major * (plan.majors ?? 0)
  )
}

/**
 * Steps finished, counted per unit of work rather than per task.
 *
 * Only the latest group for a key counts, and each group is capped at the steps
 * its family plans: regenerating lesson 7 re-runs its three nodes, and counting
 * those as three more finished steps would let a heavily-reviewed run report
 * more work done than it ever had to do.
 */
function finishedStepCount(groups) {
  const latest = new Map()
  ;(groups ?? []).forEach((group) => latest.set(group.key, group))

  let done = 0
  latest.forEach((group) => {
    const finished = group.steps.filter(
      (step) => !step.isReview && FINISHED_STEP_STATUSES.has(step.status),
    ).length
    done += Math.min(finished, PLANNED_STEPS[group.family] ?? group.steps.length)
  })
  return done
}

/**
 * How far through the run is, as a fraction of its planned steps.
 *
 * `percent` is null until the curriculum has been planned — before that there is
 * genuinely no denominator, and a bar guessing at one would be a fiction the
 * reviewer has no way to check. Draw an indeterminate bar for that stretch.
 *
 * Held below 100 while the run is still going, so the bar never sits full while
 * the transcript is still moving; only a COMPLETED run reads 100%.
 */
export function runProgress(tasks, events, status) {
  const plan = findRunPlan(events)
  const total = plannedStepCount(plan)
  const done = finishedStepCount(buildTranscript(tasks))

  if (status === "COMPLETED") return { percent: 100, done: total ?? done, total, plan }
  if (!total) return { percent: null, done, total: null, plan: null }

  return { percent: Math.min(99, Math.round((done / total) * 100)), done, total, plan }
}
