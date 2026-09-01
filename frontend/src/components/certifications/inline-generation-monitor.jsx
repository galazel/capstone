import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Ban, ChevronDown, FastForward, Loader2 } from "@/components/icons"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWorkflowStream } from "@/hooks/useWorkflowStream"
import {
  cancelWorkflowRun,
  getPendingReview,
  getWorkflowVersions,
  listWorkflowRuns,
  setCertificationReviewMode,
  submitCertificationReview,
} from "@/services/aiWorkflowService"
import { ActivityPanel } from "@/components/generation/activity-panel"
import {
  GenerationStatusBar,
  GenerationTranscript,
} from "@/components/generation/generation-transcript"
import { ReviewCheckpoint } from "@/components/generation/review-checkpoint"
import { RunRecoveryPanel } from "@/components/generation/run-recovery-panel"
import { TaskStatusIcon, stageLabel } from "@/components/generation/task-status"

/**
 * The live generation transcript, rendered inside the certification modal.
 *
 * Same data and same components as the standalone workspace — this is a second
 * mount of them, not a second implementation, so the two cannot drift. Keeping
 * generation in the modal means the admin never loses the thread of what they
 * were doing: they created a certification, and the thing they created is right
 * there building itself.
 *
 * The run does not exist when this mounts. Generation is queued over RabbitMQ
 * and the Python consumer creates the run when it claims the message, so there
 * is a short window with nothing to attach to — polled for here, then streamed.
 */
export function InlineGenerationMonitor({ certificationId, onClose, onFinished }) {
  const queryClient = useQueryClient()
  const [runId, setRunId] = useState(null)
  const [waitedTooLong, setWaitedTooLong] = useState(false)

  const runs = useQuery({
    queryKey: ["workflow-runs", "for-cert", certificationId],
    queryFn: () => listWorkflowRuns({ certificationId, limit: 20 }),
    enabled: Boolean(certificationId) && !runId,
    refetchInterval: runId ? false : 1_500,
  })

  useEffect(() => {
    if (runId) return
    const match = (runs.data?.runs ?? []).find(
      (r) => String(r.certification_id) === String(certificationId),
    )
    if (match) setRunId(match.run_id)
  }, [runs.data, certificationId, runId])

  // A queued build normally appears within a second or two. Past that the
  // likeliest cause is that nothing is consuming the queue, so say so rather
  // than spinning indefinitely — an endless spinner reads as "working".
  useEffect(() => {
    if (runId) return undefined
    const timer = setTimeout(() => setWaitedTooLong(true), 20_000)
    return () => clearTimeout(timer)
  }, [runId])

  const stream = useWorkflowStream(runId)
  const {
    run,
    attemptEvents,
    tasks,
    attempts,
    currentTask,
    progress,
    connected,
    isTerminal,
    isWaitingForReview,
    isStalled,
    silentFor,
  } = stream

  /* Reported ONCE, when the run reaches a terminal status.
     
     Without this the dialog sat on the last stage it happened to see -- "Mock
     exam · running" -- for a run that had already finished, so the only way to
     learn generation was done was to close the dialog and notice the card had
     changed. The parent decides what to do with it; this only reports. */
  const finishedRef = useRef(false)
  useEffect(() => {
    if (!isTerminal || finishedRef.current || !run?.status) return
    finishedRef.current = true
    onFinished?.(run.status)
  }, [isTerminal, run?.status, onFinished])

  const review = useQuery({
    queryKey: ["workflow-review", runId, isWaitingForReview, run?.last_seq],
    queryFn: () => getPendingReview(runId),
    enabled: Boolean(runId) && isWaitingForReview,
  })

  const versionKey = review.data?.review
    ? `${review.data.review.stage}:${review.data.review.item_index ?? 0}`
    : null

  const versions = useQuery({
    queryKey: ["workflow-versions", runId, versionKey],
    queryFn: () => getWorkflowVersions(runId, versionKey),
    enabled: Boolean(runId && versionKey),
  })

  // Answers as soon as the decision is recorded, not when the work it unblocks
  // finishes. The server drives the graph afterwards and reports it on this
  // run's stream, so an error here is a genuine refusal — the decision was
  // rejected — rather than the old symptom, where a slow-but-healthy resume
  // outlived the gateway's timeout and reported a failure over a run that was
  // still generating.
  const submitReview = useMutation({
    mutationFn: (decision) =>
      submitCertificationReview(review.data?.thread_id ?? run?.thread_id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-review", runId] })
      queryClient.invalidateQueries({ queryKey: ["workflow-versions", runId] })
    },
    onError: (error) =>
      toast.error(error?.response?.data?.detail || "Could not submit that decision."),
  })

  const cancel = useMutation({
    mutationFn: () => cancelWorkflowRun(runId),
    onSuccess: () =>
      toast.success("Cancellation requested. The run will stop at the next safe point.", {
        description: "Everything it has generated so far is saved as drafts.",
      }),
    onError: () => toast.error("Could not cancel this run."),
  })

  /* Whether this run still intends to stop and ask. Held locally because the
     flag lives on the graph's checkpoint, which this component does not read
     — and the only thing it changes here is whether the button is still worth
     offering. */
  const [unattended, setUnattended] = useState(false)

  const finishWithoutReview = useMutation({
    mutationFn: () => setCertificationReviewMode(run?.thread_id, "auto"),
    onSuccess: () => {
      setUnattended(true)
      toast.success("It will finish on its own", {
        description:
          "No more review stops. Everything it generates is saved as drafts for you to edit.",
      })
      queryClient.invalidateQueries({ queryKey: ["workflow-review", runId] })
    },
    onError: (error) =>
      toast.error(error?.response?.data?.detail || "Could not switch this run to unattended."),
  })

  if (!runId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        {waitedTooLong ? (
          <>
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium text-foreground">Nothing has picked this up yet</p>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              The build was queued but no worker has claimed it — usually the Python generation
              service is not running, or cannot reach RabbitMQ or the database. Still watching.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Queuing the build…</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Waiting for a worker to pick this up. The transcript starts as soon as it does.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border px-4 py-2.5 sm:px-6">
        <TaskStatusIcon status={run?.status === "RUNNING" ? "RUNNING" : (run?.status ?? "PENDING")} />

        <span className="text-sm font-medium text-foreground">
          {currentTask
            ? stageLabel(currentTask.stage)
            : (run?.status ?? "").replace(/_/g, " ").toLowerCase()}
        </span>

        {isTerminal ? (
          <Badge variant="secondary">Finished</Badge>
        ) : connected ? (
          <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">
            Live
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Reconnecting
          </Badge>
        )}

        {attempts > 1 ? <Badge variant="outline">Attempt {attempts}</Badge> : null}

        <span className="ml-auto flex items-center gap-2">
          {/* Only one control here, and it is the one that does something
              irreversible. Closing is the dialog's own X: a second "Close"
              button beside "Stop generating" was two ways out sitting next to
              each other, with the harmless one styled as the primary action --
              which is a good way to get the destructive one clicked by
              mistake. Leaving and stopping stay distinct; leaving just is not
              this component's job. */}
          {/* The way out of a run that keeps stopping to ask. Reviewing every
              lesson is a real choice, and so is deciding halfway through that
              you would rather have the whole thing and edit it afterwards --
              without that, the only alternative to sitting through the
              checkpoints was stopping the run. */}
          {!isTerminal && !unattended ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={finishWithoutReview.isPending || !run?.thread_id}
              onClick={() => finishWithoutReview.mutate()}
            >
              <FastForward className="mr-2 size-4" />
              Finish without review
            </Button>
          ) : null}

          {!isTerminal ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              <Ban className="mr-2 size-4" />
              Stop generating
            </Button>
          ) : (
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </span>
      </header>

      {/* Stalled takes precedence over the reassurance below: "closing this
          leaves it running" is exactly the wrong thing to say about a run
          nothing is executing. */}
      {isStalled ? (
        <p className="flex items-start gap-2 border-b border-border bg-amber-50 px-4 py-2 text-xs leading-relaxed text-amber-900 sm:px-6 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Nothing has happened for {minutesSince(silentFor)} minutes. The generation service
            most likely restarted while this was building. It is picked back up automatically
            from its last checkpoint — nothing generated so far is lost.
          </span>
        </p>
      ) : !isTerminal ? (
        <p className="border-b border-border bg-muted/30 px-4 py-2 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Generation runs on the server — closing this, signing out, or closing the browser all
          leave it running. The certification stays marked as generating until it finishes.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 px-2 sm:px-4">
        <GenerationTranscript tasks={tasks} currentTaskId={currentTask?.id}>
          {isWaitingForReview ? (
            review.data?.review ? (
              <ReviewCheckpoint
                review={review.data.review}
                versions={versions.data?.versions}
                submitting={submitReview.isPending}
                onSubmit={(decision) => submitReview.mutate(decision)}
                onRestore={(version) =>
                  submitReview.mutate({
                    action: "edit",
                    payload: version.artifact,
                    restoredFrom: version.revision,
                  })
                }
              />
            ) : (
              <p className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading the item waiting for review…
              </p>
            )
          ) : null}

          {run?.status === "FAILED" ? (
            <RunRecoveryPanel
              runId={runId}
              lastSeq={run?.last_seq}
              errorMessage={run?.error_message}
            />
          ) : null}
        </GenerationTranscript>
      </div>

      {/* The attempt now running, not the whole cumulative log. A run's
          events accumulate across every restart of the same thread, so
          reopening this modal showed a wall of steps from earlier attempts
          with the live one buried at the bottom -- which reads as "it is
          showing the previous certification". */}
      <RawEventLog events={attemptEvents} />

      <GenerationStatusBar
        status={run?.status === "RUNNING" ? "RUNNING" : (run?.status ?? "PENDING")}
        stage={
          currentTask
            ? stageLabel(currentTask.stage)
            : (run?.status ?? "").replace(/_/g, " ").toLowerCase()
        }
        startedAt={currentTask?.startedAt}
        live={Boolean(currentTask) && !isTerminal}
        connected={connected}
        terminal={isTerminal}
        progress={progress}
        item={
          currentTask?.itemNumber
            ? { number: currentTask.itemNumber, total: currentTask.itemTotal }
            : null
        }
        className="px-4 sm:px-6"
      />
    </div>
  )
}

function minutesSince(milliseconds) {
  return Math.max(1, Math.round((milliseconds ?? 0) / 60_000))
}

/** The full event log, closed by default — a debugging aid, not the main view. */
function RawEventLog({ events }) {
  const [open, setOpen] = useState(false)
  const count = events?.length ?? 0

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-6"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
        Event log
        <span className="font-mono tabular-nums">({count})</span>
      </button>

      {open ? (
        <div className="h-48 border-t border-border px-4 py-2.5 sm:px-6">
          <ActivityPanel events={events} />
        </div>
      ) : null}
    </div>
  )
}
