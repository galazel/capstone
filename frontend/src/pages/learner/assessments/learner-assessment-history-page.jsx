import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClockIcon,
  StarIcon,
  XCircleIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  getCurrentLearner,
  getCurrentLearnerIdentity,
} from "@/services/learnerService.js"
import { getAssessmentAttempts } from "@/services/assessmentService.js"

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return "—"
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Every retake is stored separately and never overwritten — this page lists
// the full history so a learner can compare attempts before opening one for
// full review. Highlights the highest-scoring and most recent attempts,
// since progress/analytics elsewhere may use either depending on config.
export default function LearnerAssessmentHistoryPage() {
  const { examId } = useParams()

  const identity = getCurrentLearnerIdentity()
  const currentLearnerQuery = useQuery({
    queryKey: ["current-learner"],
    queryFn: getCurrentLearner,
    retry: 1,
    enabled: identity.learnerId == null,
  })
  const learnerId =
    identity.learnerId ?? currentLearnerQuery.data?.learnerId ?? null

  const attemptsQuery = useQuery({
    queryKey: ["assessment-attempts", examId, learnerId],
    queryFn: () => getAssessmentAttempts(examId, learnerId),
    enabled: examId != null && learnerId != null,
    retry: 1,
  })

  if (attemptsQuery.isLoading || (learnerId == null && currentLearnerQuery.isLoading)) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const attempts = Array.isArray(attemptsQuery.data) ? attemptsQuery.data : []
  const submitted = attempts.filter((attempt) => attempt.submittedAt != null)
  const assessmentTitle = attempts[0]?.assessmentTitle ?? "Assessment"

  const highestAttemptId = submitted.length
    ? submitted.reduce((best, attempt) =>
        Number(attempt.percentage ?? 0) > Number(best.percentage ?? 0) ? attempt : best
      ).assessmentAttemptId
    : null
  const latestAttemptId = submitted.length ? submitted[0].assessmentAttemptId : null

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/learner/progress">
              <ArrowLeftIcon aria-hidden="true" />
              Back to Progress
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{assessmentTitle}</CardTitle>
            <CardDescription>
              {submitted.length} submitted attempt{submitted.length === 1 ? "" : "s"}
              {attempts.length > submitted.length
                ? ` · ${attempts.length - submitted.length} in progress`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={`/learner/assessments/${examId}`}>
                {submitted.length > 0 ? "Retake Assessment" : "Start Assessment"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Attempt history</h2>

          {attempts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-medium">No attempts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start the assessment to begin your attempt history.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {attempts.map((attempt) => {
                const percentage = Number(attempt.percentage ?? 0)
                const inProgress = attempt.submittedAt == null
                const isHighest =
                  attempt.assessmentAttemptId === highestAttemptId && submitted.length > 1
                const isLatest =
                  attempt.assessmentAttemptId === latestAttemptId && submitted.length > 1

                return (
                  <li key={attempt.assessmentAttemptId}>
                    <Card>
                      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">
                              Attempt {attempt.attemptNumber}
                            </span>
                            {inProgress ? (
                              <Badge variant="secondary">In progress</Badge>
                            ) : attempt.passed ? (
                              <Badge className="gap-1">
                                <CheckCircle2Icon className="size-3" aria-hidden="true" />
                                Passed
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircleIcon className="size-3" aria-hidden="true" />
                                Not passed
                              </Badge>
                            )}
                            {isHighest ? (
                              <Badge variant="outline" className="gap-1 text-amber-600">
                                <StarIcon className="size-3" aria-hidden="true" />
                                Highest score
                              </Badge>
                            ) : null}
                            {isLatest ? (
                              <Badge variant="outline">Most recent</Badge>
                            ) : null}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {formatDate(attempt.startedAt)}
                            {!inProgress ? (
                              <>
                                {" "}
                                · Duration: {formatDuration(attempt.durationSeconds)}
                              </>
                            ) : null}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-4">
                          {!inProgress ? (
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-2xl font-bold tabular-nums",
                                  attempt.passed ? "text-primary" : "text-destructive"
                                )}
                              >
                                {percentage.toFixed(0)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {attempt.earnedPoints != null && attempt.totalPoints != null
                                  ? `${Number(attempt.earnedPoints)} / ${Number(attempt.totalPoints)} pts`
                                  : null}
                              </p>
                            </div>
                          ) : (
                            <ClockIcon
                              className="size-5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}

                          {!inProgress ? (
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/learner/results/${attempt.assessmentAttemptId}`}>
                                View Details
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}
