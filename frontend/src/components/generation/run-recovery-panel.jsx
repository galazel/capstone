import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Loader2, RefreshCw, RotateCcw } from "@/components/icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  getWorkflowRun,
  restartWorkflowRun,
  retryWorkflowRun,
} from "@/services/aiWorkflowService"
import { stageLabel } from "./task-status"

/**
 * What a failed run offers a human next.
 *
 * Both recovery paths existed in Python from the start but were unreachable
 * from the browser — no gateway route, no button — so a failed generation was a
 * dead end in the UI however recoverable it was underneath. A run that died on
 * the last lesson after twenty minutes of work had to be started from scratch.
 *
 * Retry re-runs only the step that failed, because LangGraph checkpoints after
 * every superstep: the thread is still parked with the failed node pending, so
 * the ingestion and every approved item before it are kept. Restart discards
 * the checkpoints and begins again, re-reading the certification's documents —
 * the answer when the run's state is itself the problem.
 *
 * `recovery` is fetched here rather than taken from the event stream: the
 * stream carries the run summary, and whether a run is recoverable depends on
 * the checkpoint, not on anything an event records.
 *
 * That fetch is also the authority on whether to render at all. Keying only off
 * the streamed status showed this panel over a run that had already recovered
 * and moved on — "this run stopped" sitting above a transcript visibly still
 * working, with buttons that could only ever answer 409.
 */
export function RunRecoveryPanel({ runId, lastSeq, errorMessage }) {
  const queryClient = useQueryClient()

  const details = useQuery({
    // Re-read as the run advances: every event the stream delivers moves
    // last_seq, so a run that recovers refetches instead of going stale.
    queryKey: ["workflow-recovery", runId, lastSeq],
    queryFn: () => getWorkflowRun(runId),
    enabled: Boolean(runId),
  })

  const recovery = details.data?.recovery
  const status = details.data?.status

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["workflow-recovery", runId] })
    queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
  }

  /**
   * A refused recovery is almost always "the run already moved on" — the
   * server explains it, so show that sentence rather than a generic failure,
   * and re-read the run so the panel corrects itself instead of leaving a
   * button that will refuse again on the next click.
   *
   * Java answers with `message`; Python's own `detail` is read too, so this
   * still says something useful if the gateway is ever bypassed.
   */
  const refused = (error, fallback) => {
    const body = error?.response?.data
    toast.error(body?.detail || body?.message || fallback)
    invalidate()
  }

  const retry = useMutation({
    mutationFn: () => retryWorkflowRun(runId),
    onSuccess: (data) => {
      toast.success(
        data?.retrying_stage
          ? `Re-running ${stageLabel(data.retrying_stage)}.`
          : "Re-running the failed step.",
      )
      invalidate()
    },
    onError: (error) => refused(error, "Could not retry this run."),
  })

  const restart = useMutation({
    mutationFn: () => restartWorkflowRun(runId),
    onSuccess: () => {
      toast.success("Starting this run again from the beginning.")
      invalidate()
    },
    onError: (error) => refused(error, "Could not restart this run."),
  })

  const busy = retry.isPending || restart.isPending

  // A run abandoned by a service restart is RUNNING, not FAILED — the process
  // that would have recorded the failure is the one that died. The server
  // decides when silence has gone on long enough to call that stalled, and
  // reports it here; the panel must not re-derive it from the status alone or
  // it hides itself over exactly the runs that most need these two buttons.
  const stalled = Boolean(recovery?.stalled)

  // Declared after the hooks, not before them: an early return above would
  // make the two mutations conditional.
  if (details.isSuccess && status !== "FAILED" && !stalled) return null

  return (
    <div className="mx-2.5 my-2 rounded-lg border border-amber-300/70 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-950/20">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {stalled ? "This run went quiet" : "This run stopped"}
          </p>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
            {stalled
              ? `Nothing has been recorded for ${Math.round((recovery.idle_seconds ?? 0) / 60)} minutes. ` +
                "The generation service most likely restarted while it was executing. It is " +
                "resumed automatically from its last checkpoint; these are here in case it isn't."
              : errorMessage || "It failed partway through and is no longer running."}
          </p>

          {recovery?.failed_stage ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Failed at <span className="font-medium">{stageLabel(recovery.failed_stage)}</span>
              {recovery.attempt > 1 ? ` · attempt ${recovery.attempt}` : null}
            </p>
          ) : null}

          {details.isLoading ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Checking what can be recovered…
            </p>
          ) : recovery?.can_retry ? (
            <>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => retry.mutate()}>
                  {retry.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" />
                  )}
                  {recovery.failed_stage
                    ? `Retry ${stageLabel(recovery.failed_stage)}`
                    : "Retry the failed step"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !recovery.can_restart}
                  onClick={() => restart.mutate()}
                >
                  {restart.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 size-4" />
                  )}
                  Start over
                </Button>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Retrying keeps everything generated so far. Starting over discards it and
                re-reads the source documents.
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              This run can&rsquo;t be recovered automatically — generate the certification again.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
