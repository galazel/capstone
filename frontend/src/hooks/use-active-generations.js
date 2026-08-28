import { useEffect, useMemo, useRef } from "react"
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

const POLL_MS = 10_000

function useRunsWithStatus(status, enabled) {
  return useQuery({
    queryKey: ["workflow-runs", "active", status],
    queryFn: () => listWorkflowRuns({ status, limit: 200 }),
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
    staleTime: POLL_MS / 2,
  })
}

export function useActiveGenerations({ enabled = true } = {}) {
  const queryClient = useQueryClient()

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
  const failed = useRunsWithStatus("FAILED", enabled)

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
    // Last, so a live run always wins over a failure the admin has already
    // retried past. `add` keeps the first entry for a certification.
    ;(failed.data?.runs ?? []).forEach(add)
    return map
  }, [running.data, awaitingReview.data, failed.data])

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
