import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Ban } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWorkflowStream } from "@/hooks/useWorkflowStream"
import {
  cancelWorkflowRun,
  getPendingReview,
  getWorkflowVersions,
  listWorkflowRuns,
  submitCertificationReview,
} from "@/services/aiWorkflowService"
import { ActivityPanel } from "@/components/generation/activity-panel"
import { ArtifactViewer } from "@/components/generation/artifact-viewer"
import { ReviewPanel } from "@/components/generation/review-panel"
import { VersionHistory } from "@/components/generation/version-history"
import { WorkflowTimeline } from "@/components/generation/workflow-timeline"
import { TaskStatusIcon, stageLabel } from "@/components/generation/task-status"

/**
 * The live generation timeline, rendered inside the certification modal.
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
  const { run, events, tasks, attempts, currentTask, connected, isTerminal, isWaitingForReview } = stream

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
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        {waitedTooLong ? (
          <>
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium">Nothing has picked this up yet</p>
            <p className="max-w-md text-xs text-muted-foreground">
              The build was queued but no worker has claimed it — usually the Python
              generation service is not running, or cannot reach RabbitMQ or the
              database. Still watching.
            </p>
          </>
        ) : (
          <>
            <TaskStatusIcon status="RUNNING" className="size-5" />
            <p className="text-sm font-medium">Queuing the build…</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Waiting for a worker to pick this up. The timeline starts as soon as it does.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TaskStatusIcon status={run?.status === "RUNNING" ? "RUNNING" : run?.status ?? "PENDING"} />
          <span className="text-sm font-medium">
            {currentTask ? stageLabel(currentTask.stage) : (run?.status ?? "").replace(/_/g, " ").toLowerCase()}
          </span>
          {isTerminal ? (
            <Badge variant="secondary">Finished</Badge>
          ) : connected ? (
            <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">Live</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Reconnecting</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!isTerminal ? (
            <>
              {/* Leaving and stopping were the same button before: the only
                  control on a live run was labelled "Cancel", so closing the
                  workspace meant clicking the thing that kills the run. They
                  are now two buttons that say what they do. */}
              <Button size="sm" onClick={onClose}>Close</Button>
              <Button
                size="sm"
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                <Ban className="mr-2 size-4" />
                Stop generating
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onClose}>Done</Button>
          )}
        </div>
      </div>

      {!isTerminal ? (
        <p className="text-xs text-muted-foreground">
          Generation runs on the server — closing this leaves it running. The
          certification stays marked as generating until it finishes.
        </p>
      ) : null}

      <Tabs defaultValue="timeline" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="review">
            Review
            {isWaitingForReview ? (
              <span className="ml-1.5 size-2 rounded-full bg-amber-500" aria-label="waiting" />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="min-h-0 flex-1">
          {attempts > 1 ? (
            <p className="pb-2 text-xs text-muted-foreground">
              Attempt {attempts}. Earlier attempts are in Activity.
            </p>
          ) : null}
          <WorkflowTimeline tasks={tasks} currentTaskId={currentTask?.id} />
        </TabsContent>

        <TabsContent value="review" className="min-h-0 flex-1">
          {isWaitingForReview && review.data?.review ? (
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-3">
                <div className="rounded-md border p-3">
                  <ArtifactViewer payload={review.data.review.payload} />
                </div>
                <ReviewPanel
                  review={review.data.review}
                  submitting={submitReview.isPending}
                  onSubmit={(decision) => submitReview.mutate(decision)}
                />
              </div>
            </ScrollArea>
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
            onRestore={(version) =>
              submitReview.mutate({
                action: "edit",
                payload: version.artifact,
                restoredFrom: version.revision,
              })
            }
          />
        </TabsContent>

        <TabsContent value="activity" className="min-h-0 flex-1">
          <ActivityPanel events={events} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
