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

  const processing = !loading && !hasPriorityData

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
            {/* Confidence */}
            {!isUnavailable(confidence) ? (
              <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="text-3xl font-bold tabular-nums">
                    {Number(confidence.confidenceScore ?? 0).toFixed(0)}
                    <span className="text-base font-normal text-muted-foreground">
                      /100
                    </span>
                  </p>
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Mastered</dt>
                    <dd className="font-medium tabular-nums">{confidence.masteredCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Good</dt>
                    <dd className="font-medium tabular-nums">{confidence.goodCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Developing</dt>
                    <dd className="font-medium tabular-nums">{confidence.developingCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Weak</dt>
                    <dd className="font-medium tabular-nums">{confidence.weakCount ?? 0}</dd>
                  </div>
                </dl>
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
                        {area.primaryReason ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {area.primaryReason}
                          </p>
                        ) : null}
                        {area.recommendedAction ? (
                          <p className="mt-0.5 truncate text-xs text-primary">
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
