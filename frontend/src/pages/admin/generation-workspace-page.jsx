import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Ban, Cpu, Loader2, Radio, RefreshCw, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { ArtifactViewer } from "@/components/generation/artifact-viewer"
import { ReviewPanel } from "@/components/generation/review-panel"
import { VersionHistory } from "@/components/generation/version-history"
import { WorkflowTimeline } from "@/components/generation/workflow-timeline"
import { TaskStatusIcon, stageLabel } from "@/components/generation/task-status"

/**
 * The AI Generation Workspace.
 *
 * A generation run is a long conversation with a model that a human steers, not
 * a request that either succeeds or fails. So this shows the work as it happens
 * — every task, its duration, what it produced — and puts the review controls
 * next to the artifact being judged. There is deliberately no full-page loading
 * state after the first connect: the timeline *is* the progress indicator.
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
  const { run, events, tasks, currentTask, connected, isTerminal, isWaitingForReview } = stream

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
      // lie the timeline immediately contradicts.
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
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Cpu className="size-6 text-primary" />
            Generation workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Watch AI generation as it runs, and review what it produces.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[16rem_1fr_20rem]">
        <RunList runs={runList} activeRunId={runId} onSelect={(id) => navigate(`/admin/generation/${id}`)} />

        <Card className="flex min-h-0 flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {run ? (
                <>
                  <TaskStatusIcon status={mapRunStatus(run.status)} />
                  {run.kind === "QUESTION_BANK" ? "Question bank" : "Certification"}
                  <span className="text-sm font-normal text-muted-foreground">
                    {currentTask ? stageLabel(currentTask.stage) : run.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                </>
              ) : (
                "Select a run"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            {!runId ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                {awaitingCertificationId && waitedTooLong ? (
                  <>
                    <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-medium">Nothing has picked this up yet</p>
                    <p className="max-w-md text-xs text-muted-foreground">
                      The build was queued but no worker has claimed it. Usually that
                      means the Python generation service is not running, or it cannot
                      reach RabbitMQ or the database. Still watching — it will appear
                      here the moment a worker starts.
                    </p>
                  </>
                ) : awaitingCertificationId ? (
                  <>
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <p className="text-sm font-medium">Queuing the build…</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      Waiting for a worker to pick this up. The timeline starts as soon
                      as it does — you can leave this page and come back to it.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {runs.isLoading ? "Loading runs…" : "No generation runs yet."}
                  </p>
                )}
              </div>
            ) : (
              <Tabs defaultValue="timeline" className="flex h-full min-h-0 flex-col">
                <TabsList>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="review">
                    Review
                    {isWaitingForReview ? (
                      <span className="ml-1.5 size-2 rounded-full bg-amber-500" aria-label="waiting" />
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="versions">Versions</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="min-h-0 flex-1">
                  <WorkflowTimeline tasks={tasks} currentTaskId={currentTask?.id} />
                </TabsContent>

                <TabsContent value="review" className="min-h-0 flex-1">
                  {isWaitingForReview && review.data?.review ? (
                    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-2">
                      <div className="min-h-0 overflow-hidden rounded-md border p-3">
                        <ArtifactViewer payload={review.data.review.payload} />
                      </div>
                      <ScrollArea className="min-h-0">
                        <div className="pr-3">
                          <ReviewPanel
                            review={review.data.review}
                            submitting={submitReview.isPending}
                            onSubmit={(decision) => submitReview.mutate(decision)}
                          />
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {isTerminal
                        ? "This run has finished — nothing left to review."
                        : "Nothing waiting for review right now."}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="versions" className="min-h-0 flex-1">
                  <VersionHistory
                    versions={versions.data?.versions}
                    restoring={submitReview.isPending}
                    disabled={!isWaitingForReview}
                    onRestore={restore}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <CardContent className="min-h-0 flex-1 p-4">
            <ActivityPanel events={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RunList({ runs, activeRunId, onSelect }) {
  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Runs</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-2">
        <ScrollArea className="h-full">
          <ul className="space-y-1 pr-2">
            {runs.map((run) => (
              <li key={run.run_id}>
                <button
                  type="button"
                  onClick={() => onSelect(run.run_id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                    run.run_id === activeRunId && "bg-muted font-medium",
                  )}
                >
                  <span className="mt-0.5">
                    <TaskStatusIcon status={mapRunStatus(run.status)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {run.kind === "QUESTION_BANK" ? "Question bank" : "Certification"}
                      {run.certification_id ? ` #${run.certification_id}` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {run.current_stage ? stageLabel(run.current_stage) : run.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!runs.length ? (
              <li className="py-6 text-center text-xs text-muted-foreground">No runs.</li>
            ) : null}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function ConnectionBadge({ connected, terminal, hasRun }) {
  // With no run selected there is no stream to be connected to, so "Reconnecting"
  // would be reporting a failure that isn't happening.
  if (!hasRun) return null
  if (terminal) return <Badge variant="secondary">Finished</Badge>
  return connected ? (
    <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400">
      <Radio className="size-3" />
      Live
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
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
