import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  Cpu,
  Loader2,
  Radio,
  RefreshCw,
  WifiOff,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useWorkflowStream } from "@/hooks/useWorkflowStream"
import {
  cancelWorkflowRun,
  getPendingReview,
  getWorkflowVersions,
  listWorkflowRuns,
  submitCertificationReview,
  submitQuestionBatchReview,
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
 * The AI Generation Workspace.
 *
 * A generation run is a long conversation with a model that a human steers, not
 * a request that either succeeds or fails. So this shows the work as one
 * transcript — every step, its duration, what it produced — with the review
 * decision appearing inline at the point where the run is waiting. There is
 * deliberately no full-page loading state after the first connect: the
 * transcript *is* the progress indicator.
 *
 * Everything here is driven by one SSE stream that opens with a snapshot, so
 * closing the tab and coming back an hour later replays into the same view.
 */
export default function GenerationWorkspacePage() {
  const { runId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Set when we arrive straight from "Generate": the run does not exist yet.
  // Generation is queued over RabbitMQ and the Python consumer creates the run
  // when it picks the message up, so there is a short window with nothing to
  // attach to. Poll fast until it appears rather than showing an empty
  // workspace and making the admin wonder whether the click worked.
  const awaitingCertificationId = searchParams.get("certificationId")

  const runs = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: () => listWorkflowRuns({ limit: 50 }),
    refetchInterval: awaitingCertificationId && !runId ? 1_500 : 30_000,
  })

  // A queued build normally shows up within a second or two. Past that, the
  // most likely cause is that nothing is consuming the queue — so say so rather
  // than spinning indefinitely, which reads as "working" when it is actually
  // "nobody is listening". Polling continues; only the message changes.
  const waitedTooLong = useWaitedTooLong(Boolean(awaitingCertificationId) && !runId, 20_000)

  const stream = useWorkflowStream(runId)
  const { run, events, tasks, attempts, currentTask, connected, isTerminal, isWaitingForReview } =
    stream

  // The artifact under review lives in the LangGraph interrupt, not the event
  // log, so it is fetched when the run enters (or is found in) review — keyed
  // by lastSeq so approving one item pulls the next one automatically.
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
    mutationFn: (decision) => {
      const threadId = review.data?.thread_id ?? run?.thread_id
      // Question batches take `questions`; every other artifact takes `payload`.
      // Routing on kind here keeps that difference out of the review panel.
      if (run?.kind === "QUESTION_BANK") {
        return submitQuestionBatchReview(threadId, {
          action: decision.action,
          instructions: decision.instructions,
          questions: decision.payload,
          restoredFrom: decision.restoredFrom,
        })
      }
      return submitCertificationReview(threadId, decision)
    },
    onSuccess: (_data, decision) => {
      toast.success(reviewToast(decision.action))
      queryClient.invalidateQueries({ queryKey: ["workflow-review", runId] })
      queryClient.invalidateQueries({ queryKey: ["workflow-versions", runId] })
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
    },
    onError: (error) => {
      const detail = error?.response?.data?.detail
      toast.error(detail || "Could not submit that decision.")
    },
  })

  const cancel = useMutation({
    mutationFn: () => cancelWorkflowRun(runId),
    onSuccess: () => {
      // Deliberately not phrased as "cancelled": a mid-generation run stops at
      // the next item boundary, so claiming it has already stopped would be a
      // lie the transcript immediately contradicts.
      toast.success("Cancellation requested. The run will stop at the next safe point.")
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
    },
    onError: () => toast.error("Could not cancel this run."),
  })

  const restore = (version) =>
    submitReview.mutate({
      action: "edit",
      payload: version.artifact,
      restoredFrom: version.revision,
    })

  const runList = runs.data?.runs ?? []

  // Land on something useful rather than an empty pane.
  useEffect(() => {
    if (runId || !runList.length) return

    // Arrived from "Generate": attach to *that* certification's run as soon as
    // the consumer creates it, not to whatever happens to be newest.
    if (awaitingCertificationId) {
      const match = runList.find(
        (r) => String(r.certification_id) === String(awaitingCertificationId),
      )
      if (match) navigate(`/admin/generation/${match.run_id}`, { replace: true })
      return
    }

    const waiting = runList.find((r) => r.status === "WAITING_FOR_REVIEW")
    navigate(`/admin/generation/${(waiting ?? runList[0]).run_id}`, { replace: true })
  }, [runId, runList, navigate, awaitingCertificationId])

  return (
    /* The page shell (`.rebyu-page`) supplies the outer padding and a 4rem top
       nav, so the height subtracts both rather than adding a second gutter and
       overflowing the viewport by exactly that much. */
    <div className="flex h-[calc(100dvh-7rem)] min-h-[32rem] flex-col gap-4 sm:h-[calc(100dvh-8rem)]">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
            <Cpu className="size-5 shrink-0 text-primary" />
            Generation workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Watch AI generation as it runs, and review what it produces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ConnectionBadge connected={connected} terminal={isTerminal} hasRun={Boolean(runId)} />

          <Button variant="outline" size="sm" onClick={() => runs.refetch()}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>

          {run && !isTerminal ? (
            <Button
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              <Ban className="mr-2 size-4" />
              Cancel run
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <RunList
          runs={runList}
          activeRunId={runId}
          onSelect={(id) => navigate(`/admin/generation/${id}`)}
        />

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border px-4 py-3">
            {run ? (
              <>
                <TaskStatusIcon status={mapRunStatus(run.status)} />
                <span className="text-sm font-semibold text-foreground">
                  {run.kind === "QUESTION_BANK" ? "Question bank" : "Certification"}
                  {run.certification_id ? (
                    <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">
                      #{run.certification_id}
                    </span>
                  ) : null}
                </span>
                {attempts > 1 ? (
                  <Badge variant="outline" className="ml-auto">
                    Attempt {attempts}
                  </Badge>
                ) : null}
              </>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">Select a run</span>
            )}
          </header>

          {!runId ? (
            <EmptyState
              awaiting={Boolean(awaitingCertificationId)}
              waitedTooLong={waitedTooLong}
              loading={runs.isLoading}
            />
          ) : (
            <>
              <div className="min-h-0 flex-1">
                <GenerationTranscript tasks={tasks} currentTaskId={currentTask?.id}>
                  {isWaitingForReview ? (
                    review.data?.review ? (
                      <ReviewCheckpoint
                        review={review.data.review}
                        versions={versions.data?.versions}
                        submitting={submitReview.isPending}
                        onSubmit={(decision) => submitReview.mutate(decision)}
                        onRestore={restore}
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
                status={mapRunStatus(run?.status)}
                stage={
                  currentTask
                    ? stageLabel(currentTask.stage)
                    : (run?.status ?? "").replace(/_/g, " ").toLowerCase()
                }
                startedAt={currentTask?.startedAt}
                live={Boolean(currentTask) && !isTerminal}
                connected={connected}
                terminal={isTerminal}
                actions={
                  run && !isTerminal ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate()}
                    >
                      <Ban className="mr-2 size-4" />
                      Stop
                    </Button>
                  ) : null
                }
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ awaiting, waitedTooLong, loading }) {
  if (awaiting && waitedTooLong) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-medium text-foreground">Nothing has picked this up yet</p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          The build was queued but no worker has claimed it. Usually that means the Python
          generation service is not running, or it cannot reach RabbitMQ or the database. Still
          watching — it will appear here the moment a worker starts.
        </p>
      </div>
    )
  }

  if (awaiting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Queuing the build…</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Waiting for a worker to pick this up. The transcript starts as soon as it does — you can
          leave this page and come back to it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <p className="text-sm text-muted-foreground">
        {loading ? "Loading runs…" : "No generation runs yet."}
      </p>
    </div>
  )
}

/**
 * The full event log, closed by default.
 *
 * It was a tab, which gave a debugging aid the same prominence as the work
 * itself. It is the thing you open when the transcript does not explain
 * something, so it sits below the transcript and stays shut until then.
 */
function RawEventLog({ events }) {
  const [open, setOpen] = useState(false)
  const count = events?.length ?? 0

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
        Event log
        <span className="font-mono tabular-nums">({count})</span>
      </button>

      {open ? (
        <div className="h-56 border-t border-border px-4 py-2.5">
          <ActivityPanel events={events} />
        </div>
      ) : null}
    </div>
  )
}

/** Runs that are still going, or still need a human. */
const ACTIVE_RUN_STATUSES = new Set(["RUNNING", "PENDING", "WAITING_FOR_REVIEW"])

function RunList({ runs, activeRunId, onSelect }) {
  const [showPast, setShowPast] = useState(false)

  // The list showed every run ever started, so finishing one generation left
  // its wreckage sitting above the next one — three "Certification #N" entries
  // when only one was live. Past runs are still reachable, just not by default;
  // the open run always shows regardless, since a failed run is exactly what
  // the recovery panel is for.
  const active = runs.filter(
    (run) => ACTIVE_RUN_STATUSES.has(run.status) || run.run_id === activeRunId,
  )
  const past = runs.filter((run) => !active.includes(run))
  const shown = showPast ? [...active, ...past] : active

  return (
    <div className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {showPast ? "All runs" : "Active runs"}
        </span>
        {past.length ? (
          <button
            type="button"
            onClick={() => setShowPast((open) => !open)}
            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {showPast ? "Hide past" : `Past (${past.length})`}
          </button>
        ) : null}
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-0.5 p-2">
          {shown.map((run) => (
            <li key={run.run_id}>
              <button
                type="button"
                onClick={() => onSelect(run.run_id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted",
                  run.run_id === activeRunId && "bg-muted",
                )}
              >
                <span className="mt-0.5 shrink-0">
                  <TaskStatusIcon status={mapRunStatus(run.status)} />
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[13px] leading-5",
                      run.run_id === activeRunId
                        ? "font-medium text-foreground"
                        : "text-foreground",
                    )}
                  >
                    {run.kind === "QUESTION_BANK" ? "Question bank" : "Certification"}
                    {run.certification_id ? ` #${run.certification_id}` : ""}
                  </span>

                  <span className="block truncate text-xs leading-5 text-muted-foreground">
                    {run.current_stage
                      ? stageLabel(run.current_stage)
                      : run.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                </span>
              </button>
            </li>
          ))}

          {!shown.length ? (
            <li className="py-6 text-center text-xs text-muted-foreground">
              {past.length ? "Nothing generating right now." : "No runs."}
            </li>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  )
}

function ConnectionBadge({ connected, terminal, hasRun }) {
  // With no run selected there is no stream to be connected to, so "Reconnecting"
  // would be reporting a failure that isn't happening.
  if (!hasRun) return null
  if (terminal) return <Badge variant="secondary">Finished</Badge>
  return connected ? (
    <Badge variant="outline" className="gap-1.5 text-emerald-600 dark:text-emerald-400">
      <Radio className="size-3" />
      Live
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <WifiOff className="size-3" />
      Reconnecting
    </Badge>
  )
}

/** True once `active` has been continuously true for `afterMs`. */
function useWaitedTooLong(active, afterMs) {
  const [elapsed, setElapsed] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!active) {
      setElapsed(false)
      return undefined
    }
    timer.current = setTimeout(() => setElapsed(true), afterMs)
    return () => clearTimeout(timer.current)
  }, [active, afterMs])

  return elapsed
}

function mapRunStatus(status) {
  return status === "RUNNING" ? "RUNNING" : status ?? "PENDING"
}

function reviewToast(action) {
  switch (action) {
    case "approve":
      return "Approved. Generating the next item."
    case "approve_remaining":
      return "Approving the rest of this phase without pausing."
    case "edit":
      return "Your version was saved."
    case "improve":
      return "Regenerating with your feedback."
    case "regenerate":
      return "Regenerating this item."
    case "skip":
      return "Skipped."
    default:
      return "Decision submitted."
  }
}
