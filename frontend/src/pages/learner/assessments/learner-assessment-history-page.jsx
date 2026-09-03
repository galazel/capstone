import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  ClockIcon,
  StarIcon,
  XCircleIcon,
} from "@/components/icons"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  BackButton,
  Chip,
  RebyuCard,
  TactileButton,
} from "@/components/rebyu/rebyu-ui.jsx"
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

/**
 * The run of attempts, as a shape.
 *
 * A list of percentages one card apart is not comparable at a glance, and
 * comparing attempts is the entire reason this page exists. Bars are in the
 * order they were sat -- oldest at the left -- so improvement reads left to
 * right, and each is coloured by whether that attempt passed rather than by
 * height, because the pass mark is the only threshold that matters here and the
 * summary payload does not carry its value.
 */
function AttemptTrend({ attempts }) {
  if (attempts.length < 2) return null

  return (
    <RebyuCard className="p-5">
      <p className="rb-eyebrow">score by attempt</p>
      <div className="mt-4 flex items-end gap-2 sm:gap-3">
        {attempts.map((attempt) => {
          const percentage = Math.min(100, Math.max(0, Number(attempt.percentage ?? 0)))
          return (
            <div
              key={attempt.assessmentAttemptId}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span className="rb-numeric text-xs text-rb-wolf">
                {percentage.toFixed(0)}%
              </span>
              {/* Fixed-height well so every bar is measured against the same
                  100%, not against the tallest score in the run. */}
              <div className="flex h-24 w-full items-end rounded-rb-tile bg-rb-polar p-1">
                <div
                  className={cn(
                    "w-full rounded-[6px]",
                    attempt.passed ? "bg-rb-leaf" : "bg-rb-cardinal"
                  )}
                  /* A floor of 4px so a zero-scoring attempt is still a mark on
                     the page rather than a gap in the run. */
                  style={{ height: `max(4px, ${percentage}%)` }}
                />
              </div>
              <span className="text-xs font-bold text-rb-wolf">
                #{attempt.attemptNumber}
              </span>
            </div>
          )
        })}
      </div>
    </RebyuCard>
  )
}

/** One figure in the summary strip. */
function SummaryTile({ label, value, caption, tone = "neutral" }) {
  const TONES = {
    leaf: "border-rb-leaf/45 bg-rb-leaf-wash text-rb-leaf",
    cardinal: "border-rb-cardinal/45 bg-rb-cardinal-wash text-rb-cardinal-lip",
    neutral: "border-rb-swan bg-rb-polar text-rb-eel",
  }

  return (
    <div className={cn("rounded-rb-tile border-2 px-3 py-2.5", TONES[tone])}>
      <p className="text-xs font-bold opacity-80">{label}</p>
      <p className="rb-numeric mt-0.5 text-xl leading-none">{value}</p>
      {caption ? <p className="mt-1 text-xs opacity-70">{caption}</p> : null}
    </div>
  )
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
      <div className="rebyu-ds min-h-dvh bg-rb-polar">
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Skeleton className="h-10 w-2/3 rounded-rb-tile" />
          <Skeleton className="h-32 w-full rounded-rb-card" />
          <Skeleton className="h-64 w-full rounded-rb-card" />
        </div>
      </div>
    )
  }

  const attempts = Array.isArray(attemptsQuery.data) ? attemptsQuery.data : []
  const submitted = attempts.filter((attempt) => attempt.submittedAt != null)
  const assessmentTitle = attempts[0]?.assessmentTitle ?? "Assessment"

  const highestAttempt = submitted.length
    ? submitted.reduce((best, attempt) =>
        Number(attempt.percentage ?? 0) > Number(best.percentage ?? 0) ? attempt : best
      )
    : null
  const highestAttemptId = highestAttempt?.assessmentAttemptId ?? null
  const latestAttempt = submitted.length ? submitted[0] : null
  const latestAttemptId = latestAttempt?.assessmentAttemptId ?? null

  const everPassed = submitted.some((attempt) => attempt.passed)
  const inProgressCount = attempts.length - submitted.length

  /* Oldest first for the trend, whatever order the list arrives in: a run that
     reads right-to-left would show improvement as decline. */
  const chronological = [...submitted].reverse()

  return (
    <div className="rebyu-ds min-h-dvh bg-rb-polar text-rb-eel">
      <header className="sticky top-0 z-40 border-b-2 border-rb-swan bg-rb-snow">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <BackButton asChild size="sm" label="Back to progress">
            <Link to="/learner/progress" />
          </BackButton>
          <div className="min-w-0">
            <p className="rb-eyebrow">attempt history</p>
            <p className="truncate text-sm font-bold text-rb-eel">{assessmentTitle}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <RebyuCard raised className="p-6 sm:p-8">
          <h1 className="rb-display rb-display-md">{assessmentTitle}</h1>
          <p className="rb-body mt-2 text-sm">
            {submitted.length} submitted attempt{submitted.length === 1 ? "" : "s"}
            {inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ""}
            {submitted.length > 0
              ? everPassed
                ? " · passed"
                : " · not passed yet"
              : ""}
          </p>

          {submitted.length > 0 ? (
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryTile
                label="Best score"
                value={`${Number(highestAttempt.percentage ?? 0).toFixed(0)}%`}
                caption={`Attempt ${highestAttempt.attemptNumber}`}
                tone={highestAttempt.passed ? "leaf" : "cardinal"}
              />
              <SummaryTile
                label="Latest score"
                value={`${Number(latestAttempt.percentage ?? 0).toFixed(0)}%`}
                caption={`Attempt ${latestAttempt.attemptNumber}`}
                tone={latestAttempt.passed ? "leaf" : "cardinal"}
              />
              <SummaryTile label="Attempts sat" value={submitted.length} />
            </dl>
          ) : null}

          <TactileButton asChild className="mt-6">
            <Link to={`/learner/assessments/${examId}`}>
              {/* Labelled for what the button will actually do. An unfinished
                  attempt is resumed in place, not started over, and calling
                  that "retake" is how a learner ends up afraid to press it. */}
              {inProgressCount > 0
                ? "resume attempt"
                : submitted.length > 0
                  ? "retake assessment"
                  : "start assessment"}
            </Link>
          </TactileButton>
        </RebyuCard>

        <AttemptTrend attempts={chronological} />

        <section className="space-y-4">
          <h2 className="rb-display rb-display-sm">Every attempt</h2>

          {attempts.length === 0 ? (
            <div className="rounded-rb-card border-2 border-dashed border-rb-swan p-10 text-center">
              <p className="rb-display rb-display-sm">No attempts yet</p>
              <p className="rb-body mt-2 text-sm">
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
                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-4 rounded-rb-card border-2 bg-rb-snow p-5",
                        /* The row you are most likely to want is the one you
                           can see first. Only the best attempt is lifted, and
                           only when there is more than one to be best of. */
                        isHighest ? "border-rb-fox" : "border-rb-swan"
                      )}
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-rb-eel">
                            Attempt {attempt.attemptNumber}
                          </span>
                          {inProgress ? (
                            <Chip tone="macaw">
                              <ClockIcon className="size-3" aria-hidden="true" />
                              In progress
                            </Chip>
                          ) : attempt.passed ? (
                            <Chip tone="leaf">
                              <CheckCircle2Icon className="size-3" aria-hidden="true" />
                              Passed
                            </Chip>
                          ) : (
                            <Chip tone="cardinal">
                              <XCircleIcon className="size-3" aria-hidden="true" />
                              Not passed
                            </Chip>
                          )}
                          {isHighest ? (
                            <Chip tone="fox">
                              <StarIcon className="size-3" aria-hidden="true" />
                              Highest score
                            </Chip>
                          ) : null}
                          {isLatest ? <Chip>Most recent</Chip> : null}
                        </div>

                        <p className="rb-caption">
                          {formatDate(attempt.startedAt)}
                          {!inProgress
                            ? ` · took ${formatDuration(attempt.durationSeconds)}`
                            : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-4">
                        {!inProgress ? (
                          <div className="text-right">
                            <p
                              className={cn(
                                "rb-numeric text-2xl leading-none",
                                attempt.passed ? "text-rb-leaf" : "text-rb-cardinal-lip"
                              )}
                            >
                              {percentage.toFixed(0)}%
                            </p>
                            {attempt.earnedPoints != null && attempt.totalPoints != null ? (
                              <p className="rb-numeric mt-1 text-xs text-rb-wolf">
                                {Number(attempt.earnedPoints)} / {Number(attempt.totalPoints)} pts
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <TactileButton asChild variant="ghost" size="sm">
                          {inProgress ? (
                            /* An unfinished attempt had no control at all --
                               only a clock glyph -- so the one row on the page
                               with something left to do was the one row you
                               could not act on. */
                            <Link to={`/learner/assessments/${examId}`}>resume</Link>
                          ) : (
                            <Link to={`/learner/results/${attempt.assessmentAttemptId}`}>
                              view details
                            </Link>
                          )}
                        </TactileButton>
                      </div>
                    </div>
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
