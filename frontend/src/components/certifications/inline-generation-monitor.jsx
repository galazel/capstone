import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Ban, ChevronDown, Loader2 } from "lucide-react"
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
export function InlineGenerationMonitor({ certificationId, onClose }) {
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
  const { run, events, tasks, attempts, currentTask, connected, isTerminal, isWaitingForReview } =
    stream

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
      toast.success("Cancellation requested. The run will stop at the next safe point."),
    onError: () => toast.error("Could not cancel this run."),
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
          {/* Leaving and stopping were the same button before: the only control
              on a live run was labelled "Cancel", so closing the workspace meant
              clicking the thing that kills the run. They are now two buttons
              that say what they do. */}
          {!isTerminal ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                <Ban className="mr-2 size-4" />
                Stop generating
              </Button>
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </span>
      </header>

      {!isTerminal ? (
        <p className="border-b border-border bg-muted/30 px-4 py-2 text-xs leading-relaxed text-muted-foreground sm:px-6">
          Generation runs on the server — closing this leaves it running. The certification stays
          marked as generating until it finishes.
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

      <RawEventLog events={events} />

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
        className="px-4 sm:px-6"
      />
    </div>
  )
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
