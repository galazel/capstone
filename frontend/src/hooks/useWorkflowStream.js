import { useEffect, useMemo, useReducer } from "react"
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

  return {
    ...state,
    tasks,
    currentTask,
    attempts,
    isTerminal: TERMINAL_STATUSES.has(state.run?.status),
    isWaitingForReview: state.run?.status === "WAITING_FOR_REVIEW",
  }
}
