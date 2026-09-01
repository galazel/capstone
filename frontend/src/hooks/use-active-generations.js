import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { listWorkflowRuns } from "@/services/aiWorkflowService"

/**
 * Which certifications are being generated right now, keyed by certification id.
 *
 * A generation outlives the workspace that started it — it runs in the Python
 * consumer, not the browser — so the certifications list needs its own way to
 * ask "is this one still building?". Without it a half-generated certification
 * looked identical to a finished one the moment the modal was closed, and
 * opening it showed a shell with no categories.
 *
 * Two queries rather than one unfiltered fetch: the registry filters by a single
 * status, and asking for the two live ones is cheaper and more honest than
 * pulling every run the system has ever recorded and filtering here.
 */

/* How often the two LIVE statuses are re-read. This is what keeps a running
   card's stage fresh, so it stays quick. */
const POLL_MS = 10_000

/* The two SETTLED statuses change only when a run ends -- which the live poll
   above notices within ten seconds anyway, because the run disappears from
   RUNNING. Re-reading them at the live rate was four database queries every ten
   seconds (~24/minute) to answer a question whose answer almost never changes,
   and every one of them is read traffic against a Neon allowance that is
   already exhausted. A minute is still well inside the time it takes anyone to
   notice a card. */
const SETTLED_POLL_MS = 60_000

/**
 * Certifications whose generation has been requested but has no run yet.
 *
 * There is a real gap between "Generate" being accepted and the run existing:
 * Java queues a message, the Python consumer has to pick it up and register the
 * run, and this hook only polls every ten seconds. For that whole window the
 * registry knows nothing, so the card fell back to a plain idle Draft -- which
 * is indistinguishable from a certification whose generation never started, and
 * is exactly what led an admin to delete a certification that was in fact about
 * to build.
 *
 * Module scope, because the drawer that starts the run and the list that draws
 * the card are different components: state local to either would not reach the
 * other. Cleared as soon as a real run appears, and expired on a timer so a
 * request that never became a run cannot spin a card forever.
 */
const PENDING_TTL_MS = 3 * 60_000

const pending = new Map()
const pendingListeners = new Set()

/* Bumped on every change so `useSyncExternalStore` has a cheap, stable value to
   compare -- returning the Map itself would be a new reference each render. */
let pendingVersion = 0

function notifyPending() {
  pendingVersion += 1
  pendingListeners.forEach((listener) => listener())
}

/** Drops entries whose run never materialised. Returns whether anything went. */
function prunePending() {
  const now = Date.now()
  let changed = false
  for (const [id, startedAt] of pending) {
    if (now - startedAt > PENDING_TTL_MS) {
      pending.delete(id)
      changed = true
    }
  }
  return changed
}

/** Marks a certification as generating before its run exists. */
export function markGenerationQueued(certificationId) {
  if (certificationId == null) return
  pending.set(String(certificationId), Date.now())
  notifyPending()
}

/** Forgets a certification, e.g. once its real run has appeared. */
function clearPending(certificationId) {
  if (pending.delete(String(certificationId))) notifyPending()
}

function subscribePending(listener) {
  pendingListeners.add(listener)
  return () => pendingListeners.delete(listener)
}

function pendingSnapshot() {
  return pendingVersion
}

function useRunsWithStatus(status, enabled, pollMs = POLL_MS) {
  return useQuery({
    queryKey: ["workflow-runs", "active", status],
    queryFn: () => listWorkflowRuns({ status, limit: 200 }),
    enabled,
    refetchInterval: enabled ? pollMs : false,
    staleTime: pollMs / 2,
    /* Nothing generates while the tab is in the background, and a card nobody
       is looking at does not need refreshing. */
    refetchIntervalInBackground: false,
  })
}

export function useActiveGenerations({ enabled = true } = {}) {
  const queryClient = useQueryClient()
  const pendingTick = useSyncExternalStore(subscribePending, pendingSnapshot, pendingSnapshot)

  // A run in either status is still the workspace's to finish, and its
  // certification is not ready to open.
  const running = useRunsWithStatus("RUNNING", enabled)
  const awaitingReview = useRunsWithStatus("WAITING_FOR_REVIEW", enabled)
  /* Failed runs are fetched for the opposite reason: not because they are
     still the workspace's to finish, but because they are the only record of
     *why* a certification is empty. Without them a rejected generation is
     indistinguishable from one that never started, and the card can only say
     "generation did not finish" -- which is the least useful true sentence
     available when the service knows the documents did not match the topic. */
  const failed = useRunsWithStatus("FAILED", enabled, SETTLED_POLL_MS)
  /* Stopped runs, for exactly the reason failed ones are fetched: they are the
     record of why a certification is empty. A run an admin stopped keeps its
     checkpoints, so its certification is not a dead end -- it can be resumed
     from the step it stopped on. Without this the card showed a plain empty
     draft, indistinguishable from one whose generation was never started, and
     the only way to discover the half-built curriculum sitting in the
     checkpointer was to ask the database. */
  const cancelled = useRunsWithStatus("CANCELLED", enabled, SETTLED_POLL_MS)

  const byCertificationId = useMemo(() => {
    const map = new Map()
    const add = (run) => {
      if (run?.certification_id == null || run.kind !== "CERTIFICATION") return
      const key = String(run.certification_id)
      // A certification has more than one live run only transiently (a restart
      // racing the run it replaced). The registry returns newest first, and
      // RUNNING is added before WAITING_FOR_REVIEW, so the first wins.
      if (!map.has(key)) map.set(key, run)
    }
    ;(running.data?.runs ?? []).forEach(add)
    ;(awaitingReview.data?.runs ?? []).forEach(add)
    // Last, so a live run always wins over a failure or a stop the admin has
    // already retried past. `add` keeps the first entry for a certification.
    ;(failed.data?.runs ?? []).forEach(add)
    ;(cancelled.data?.runs ?? []).forEach(add)

    /* Optimistic entries last, and only where the registry has nothing: a real
       run always describes the work better than a placeholder. Anything still
       pending here has been requested but not yet registered, so it is shown as
       RUNNING with no stage -- which the card already renders as "Generating…".
       Synthetic runs carry no `run_id`, so nothing offers to open a progress
       view for a run that does not exist yet. */
    prunePending()
    pending.forEach((_startedAt, certificationId) => {
      if (map.has(certificationId)) {
        // The real run has arrived; stop shadowing it.
        clearPending(certificationId)
        return
      }
      map.set(certificationId, {
        certification_id: Number(certificationId),
        kind: "CERTIFICATION",
        status: "RUNNING",
        current_stage: null,
        run_id: null,
        thread_id: null,
        queued: true,
      })
    })

    return map
    // `pendingTick` is the subscription to the module-level pending store; it
    // is what re-runs this when a generation is queued or expires.
  }, [running.data, awaitingReview.data, failed.data, cancelled.data, pendingTick])

  // When a certification stops generating, its row in Java has just gained
  // categories and lessons. Refetching the list here is what turns the card
  // from "Generating" into the finished certification without a manual reload.
  const previousIds = useRef(new Set())
  useEffect(() => {
    // Only live runs count here. A failed run stays in the map for as long as
    // it is the newest record, so counting it would mean the list never sees
    // the transition and never refetches.
    const current = new Set(
      [...byCertificationId.entries()]
        .filter(([, run]) => run.status !== "FAILED")
        .map(([id]) => id)
    )
    const finished = [...previousIds.current].some((id) => !current.has(id))
    previousIds.current = current
    if (finished) {
      queryClient.invalidateQueries({ queryKey: ["admin-certifications"] })
    }
  }, [byCertificationId, queryClient])

  return {
    byCertificationId,
    isLoading: running.isPending || awaitingReview.isPending || failed.isPending,
  }
}

/**
 * How a card should describe a run, or null when nothing is running.
 *
 * Kept out of the card so it does not have to know that a run parked at a
 * review is, from an admin's point of view, still generating.
 */
export function generationStatusOf(run) {
  if (!run) return null
  if (run.status === "WAITING_FOR_REVIEW") return "AWAITING_REVIEW"
  if (run.status === "FAILED") return "FAILED"
  // Stopped on purpose, and resumable: the checkpoints survive a stop, so this
  // is a different state from both "building" and "failed". Falling through to
  // GENERATING (as it used to) made a stopped run spin a progress badge
  // forever for work nothing was doing.
  if (run.status === "CANCELLED") return "STOPPED"
  return "GENERATING"
}

/**
 * Why a run stopped, in the words the service used.
 *
 * The document auditor rejects a mismatch with an actual sentence -- "the
 * document is about a mathematics reviewer, which is unrelated to a
 * certification about Hiragana" -- and that sentence is the whole value of the
 * failure. It reaches the browser already; nothing was reading it.
 */
export function generationErrorOf(run) {
  if (!run || run.status !== "FAILED") return null
  return run.error_message || "Generation failed without a reported reason."
}
