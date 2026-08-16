import { useQuery } from "@tanstack/react-query"
import {
  BrainCircuitIcon,
  Loader2Icon,
  RefreshCwIcon,
  SparklesIcon,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import PriorityBadge from "@/components/analytics/priority-badge.jsx"
import {
  comparePriority,
  flattenPriorityAreas,
  getCertificationConfidence,
  getCertificationPriorities,
} from "@/services/learnerAnalyticsService.js"

const URGENT_TAGS = new Set(["CRITICAL_PRIORITY", "HIGH_PRIORITY"])

function isUnavailable(data) {
  return !data || data.status === "TEMPORARILY_UNAVAILABLE"
}

function MasteryBar({ value }) {
  const pct = Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
    </div>
  )
}

/* The four mastery bands, in the order they read as a scale. Colour is a second
   channel only -- every band is labelled with its name and count underneath. */
const MASTERY_BANDS = [
  { key: "masteredCount", label: "Mastered", bar: "bg-rb-feather", dot: "bg-rb-feather" },
  { key: "goodCount", label: "Good", bar: "bg-rb-macaw", dot: "bg-rb-macaw" },
  { key: "developingCount", label: "Developing", bar: "bg-rb-fox", dot: "bg-rb-fox" },
  { key: "weakCount", label: "Weak", bar: "bg-rb-cardinal", dot: "bg-rb-cardinal" },
]

function bandCount(confidence, key) {
  const value = Number(confidence?.[key])
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Whether the confidence payload actually describes anything.
 *
 * The endpoint answers with a fully-formed object of zeros while the dispatcher
 * is still working through a submission, so "not null" is not the same as "has
 * data". Without this the panel printed `Confidence 0/100` and `Weak 0` beside
 * its own "still being calculated" notice -- a hard zero that reads as a
 * measurement of the learner rather than an absence of one.
 */
function hasConfidenceData(confidence) {
  if (isUnavailable(confidence)) return false

  const graded = MASTERY_BANDS.reduce(
    (total, band) => total + bandCount(confidence, band.key),
    0,
  )

  return graded > 0 || Number(confidence.totalLessons ?? 0) > 0
}

/**
 * The four bands as one bar, sized by how many lessons sit in each.
 *
 * A row of four counts says how many lessons are weak; it does not say whether
 * that is most of the certification or a corner of it. The bar is the shape of
 * the certification, which is the thing worth seeing at a glance.
 */
function MasteryDistribution({ confidence }) {
  const segments = MASTERY_BANDS.map((band) => ({
    ...band,
    count: bandCount(confidence, band.key),
  }))
  const graded = segments.reduce((total, segment) => total + segment.count, 0)

  return (
    <div>
      {graded > 0 ? (
        <div
          className="flex h-2.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={segments
            .map((segment) => `${segment.count} ${segment.label.toLowerCase()}`)
            .join(", ")}
        >
          {segments
            .filter((segment) => segment.count > 0)
            .map((segment) => (
              <div
                key={segment.key}
                className={segment.bar}
                style={{ width: `${(segment.count / graded) * 100}%` }}
              />
            ))}
        </div>
      ) : (
        <div className="h-2.5 rounded-full bg-muted" aria-hidden="true" />
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2">
            <span
              className={`size-2 shrink-0 rounded-full ${segment.dot}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="truncate text-xs text-muted-foreground">{segment.label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{segment.count}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Learner-facing BKT analytics for one certification: confidence, the highest
 * priority areas (with reasons + next action), and weak lessons. Degrades to a
 * "being calculated" state while the async dispatcher is still processing the
 * latest submission.
 */
export default function CertificationAnalyticsPanel({ learnerId, certificationId }) {
  const enabled = learnerId != null && certificationId != null

  const prioritiesQuery = useQuery({
    queryKey: ["cert-priorities", learnerId, certificationId],
    queryFn: () => getCertificationPriorities(learnerId, certificationId),
    enabled,
    retry: 1,
  })
  const confidenceQuery = useQuery({
    queryKey: ["cert-confidence", learnerId, certificationId],
    queryFn: () => getCertificationConfidence(learnerId, certificationId),
    enabled,
    retry: 1,
  })

  const refresh = () => {
    prioritiesQuery.refetch()
    confidenceQuery.refetch()
  }

  const loading = prioritiesQuery.isLoading || confidenceQuery.isLoading
  const priorities = prioritiesQuery.data
  const confidence = confidenceQuery.data

  const areas = flattenPriorityAreas(priorities)
  const hasPriorityData = areas.length > 0
  const lessonAreas = areas.filter((a) => a.categoryType === "LESSON")

  const topAreas = [...areas]
    .filter((a) => URGENT_TAGS.has(a.priorityTag))
    .sort(comparePriority)
    .slice(0, 5)
  const fallbackAreas = [...areas].sort(comparePriority).slice(0, 5)
  const focusAreas = topAreas.length > 0 ? topAreas : fallbackAreas

  const weakLessons = lessonAreas
    .filter((l) => l.masteryProbability != null && l.masteryProbability < 0.4)
    .sort((a, b) => (a.masteryProbability ?? 0) - (b.masteryProbability ?? 0))
    .slice(0, 6)

  /* Two separate absences. Priorities can be missing while confidence is
     present and vice versa, so each is asked its own question rather than one
     flag standing in for both. */
  const showConfidence = hasConfidenceData(confidence)
  const processing = !loading && !hasPriorityData && !showConfidence

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuitIcon className="size-4 text-primary" aria-hidden="true" />
              Learning analytics
            </CardTitle>
            <CardDescription>
              Mastery and review priorities updated from your assessments.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCwIcon className="size-4" aria-hidden="true" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {/* Confidence, only once there is something behind it. */}
            {showConfidence ? (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Confidence in these estimates
                    </p>
                    <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">
                      {Number(confidence.confidenceScore ?? 0).toFixed(0)}
                      <span className="text-base font-normal text-muted-foreground">
                        /100
                      </span>
                    </p>
                  </div>

                  {/* How much of the certification has actually been measured.
                      A high confidence over a tenth of the syllabus means
                      something different from the same number over all of it,
                      and the score alone cannot say which this is. */}
                  {Number(confidence.coveragePercentage ?? 0) > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {Number(confidence.coveragePercentage).toFixed(0)}% of lessons
                      assessed
                      {Number(confidence.totalLessons ?? 0) > 0
                        ? ` · ${confidence.totalLessons} total`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4">
                  <MasteryDistribution confidence={confidence} />
                </div>
              </div>
            ) : null}

            {processing ? (
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <SparklesIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Your analytics are being calculated from your latest
                  submission. This usually takes a few seconds — use Refresh to
                  check again.
                </span>
              </div>
            ) : null}

            {/* Highest-priority areas */}
            {focusAreas.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Review these first</h3>
                <ul className="divide-y rounded-lg border">
                  {focusAreas.map((area) => (
                    <li
                      key={`${area.categoryType}-${area.categoryId}`}
                      className="flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {area.title ?? `${area.categoryType} ${area.categoryId}`}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {area.categoryType}
                          </span>
                        </div>
                        {/* Not truncated. These two lines are the whole reason
                            the row is worth reading -- clipped to one line they
                            became "Mastery is at 31% -- this is one of your..."
                            and told the learner nothing. */}
                        {area.primaryReason ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {area.primaryReason}
                          </p>
                        ) : null}
                        {area.recommendedAction ? (
                          <p className="mt-1 text-xs font-medium leading-5 text-primary">
                            {area.recommendedAction}
                          </p>
                        ) : null}
                      </div>
                      <PriorityBadge
                        tag={area.priorityTag}
                        score={area.priorityScore}
                        reason={area.primaryReason}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Weak lessons */}
            {weakLessons.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Weak lessons</h3>
                <ul className="space-y-1.5">
                  {weakLessons.map((lesson) => (
                    <li
                      key={lesson.categoryId}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {lesson.title ?? `Lesson ${lesson.categoryId}`}
                      </span>
                      <MasteryBar value={lesson.masteryProbability} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!processing && focusAreas.length === 0 && isUnavailable(confidence) ? (
              <p className="text-sm text-muted-foreground">
                No analytics are available yet for this certification.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
