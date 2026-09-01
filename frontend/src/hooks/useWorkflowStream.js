import { useEffect, useMemo, useReducer, useState } from "react"
import { streamWorkflow } from "@/services/aiWorkflowService"
import {
  TERMINAL_STATUSES,
  applyEventToRun,
  attemptCount,
  buildTasks,
  currentAttemptEvents,
  findCurrentTask,
  maxSeq,
  mergeEvents,
  runProgress,
  terminalStatus,
} from "./workflow-timeline-model"

/**
 * Live state for one generation run: the run summary, its event log, and the
 * derived task timeline the workspace renders.
 *
 * The stream is the single source of truth. It opens with a database-backed
 * snapshot and then pushes, so this never polls and needs no separate "load the
 * run" fetch — a fresh mount and a reconnect after an hour offline take exactly
 * the same path through the same code.
 */

const initialState = {
  run: null,
  events: [],
  lastSeq: 0,
  connected: false,
  loading: true,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case "snapshot":
      return {
        ...state,
        run: action.run,
        // Merged rather than replaced: on a reconnect the snapshot carries only
        // what we missed, so merging keeps the history already on screen.
        events: mergeEvents(state.events, action.events),
        lastSeq: Math.max(state.lastSeq, maxSeq(action.events)),
        loading: false,
        error: null,
      }
    case "event":
      // The server drops out-of-order events, but a reconnect can legitimately
      // redeliver one it is unsure we saw. Deduping by seq means an
      // at-least-once stream renders exactly once.
      if (action.event.seq <= state.lastSeq) return state
      return {
        ...state,
        events: mergeEvents(state.events, [action.event]),
        lastSeq: action.event.seq,
        run: applyEventToRun(state.run, action.event),
      }
    case "complete":
      return {
        ...state,
        connected: false,
        run: state.run
          ? { ...state.run, status: terminalStatus(action.status, state.run.status) }
          : state.run,
      }
    case "open":
      return { ...state, connected: true, error: null }
    case "error":
      return { ...state, connected: false, loading: false, error: action.error }
    case "reset":
      return initialState
    default:
      return state
  }
}

/**
 * How long a non-terminal run may record nothing before it is presented as
 * stalled rather than busy.
 *
 * A run is driven by an asyncio task inside the Python service, so a restart
 * there abandons it mid-step while its status stays RUNNING. The stream itself
 * gives no hint of that — it stays connected, waiting for events that will
 * never come, which renders identically to a run that is simply on a slow step.
 * Matches STALLED_AFTER_IDLE_SECONDS in app/services/certification_run.py, so
 * the moment this says "stalled" is the moment the server's sweep is entitled
 * to adopt it.
 */
const STALLED_AFTER_MS = 15 * 60 * 1000

/** Ticks often enough that "silent for N minutes" stays roughly honest. */
const STALL_CHECK_MS = 30_000

function lastActivityAt(state) {
  // The newest event's server timestamp, not the client's clock: attaching to
  // a run that went silent an hour ago must report an hour, not zero.
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    const at = state.events[i]?.created_at
    if (at) return Date.parse(at)
  }
  const fallback = state.run?.updated_at
  return fallback ? Date.parse(fallback) : null
}

export function useWorkflowStream(runId) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!runId) return undefined
    dispatch({ type: "reset" })

    // Always opens at 0: the server sends a snapshot of everything after that,
    // and fetch-event-source handles resumption from the last event id on its
    // own reconnects. Passing a stale seq here would only skip history.
    const close = streamWorkflow(runId, {
      lastSeq: 0,
      onOpen: () => dispatch({ type: "open" }),
      onError: (error) => dispatch({ type: "error", error }),
      onMessage: (message) => {
        switch (message.type) {
          case "snapshot":
            dispatch({ type: "snapshot", run: message.run, events: message.events ?? [] })
            break
          case "event":
            dispatch({ type: "event", event: message.event })
            break
          case "complete":
            dispatch({ type: "complete", status: message.status })
            break
          case "error":
            dispatch({ type: "error", error: new Error(message.message) })
            break
          default:
            // heartbeat — proof the connection is alive, nothing to render.
            break
        }
      },
    })

    return close
  }, [runId])

  // The timeline shows the attempt now running. A run's log is cumulative
  // across attempts -- redelivered queue messages and admin restarts continue
  // the same run -- so building tasks from the whole log stacked every attempt
  // end to end and buried the live one. `events` is untouched, so the Activity
  // tab still shows everything.
  const attempts = useMemo(() => attemptCount(state.events), [state.events])
  const attemptEvents = useMemo(() => currentAttemptEvents(state.events), [state.events])
  const tasks = useMemo(() => buildTasks(attemptEvents), [attemptEvents])
  const currentTask = useMemo(() => findCurrentTask(tasks), [tasks])

  const isTerminal = TERMINAL_STATUSES.has(state.run?.status)

  // Derived from the same attempt-scoped events as the timeline, so the bar and
  // the transcript can never disagree about how much has been done. Percent is
  // null until the curriculum gives the run a denominator.
  const progress = useMemo(
    () => runProgress(tasks, attemptEvents, state.run?.status),
    [tasks, attemptEvents, state.run?.status],
  )

  // Silence has to be re-evaluated on a timer, because nothing arrives to
  // trigger a render — being told nothing is exactly the condition.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!runId || isTerminal) return undefined
    const timer = setInterval(() => tick((n) => n + 1), STALL_CHECK_MS)
    return () => clearInterval(timer)
  }, [runId, isTerminal])

  const silentFor = (() => {
    const at = lastActivityAt(state)
    return at ? Date.now() - at : null
  })()

  return {
    ...state,
    tasks,
    currentTask,
    progress,
    attempts,
    silentFor,
    // RUNNING, connected, and yet nothing has happened for a long time:
    // whatever was executing this run is gone. The server's recovery sweep
    // resumes it from its last checkpoint, so this is a status to report, not
    // an error to act on.
    //
    // RUNNING specifically, not merely non-terminal: a run parked at a review
    // is *supposed* to sit silent for as long as it takes a human to look at
    // it, and calling that stalled would flag every pause after ten minutes.
    isStalled:
      state.run?.status === "RUNNING" && silentFor != null && silentFor > STALLED_AFTER_MS,
    // The current attempt's events, for anything showing "what is happening
    // now". `events` remains the full cumulative log for audit views.
    attemptEvents,
    isTerminal,
    isWaitingForReview: state.run?.status === "WAITING_FOR_REVIEW",
  }
}
