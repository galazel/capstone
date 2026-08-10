import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Brain,
  BookOpen,
  Flame,
  Loader2,
  Target,
  TrendingUp,
  Trophy,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LearnerEmptyState,
  LearnerErrorState,
} from "@/components/learner/learner-ui.jsx"
import LearnerPremiumGuard from "@/components/learner/learner-premium-guard.jsx"
import { PrioritySeal } from "@/components/learner/priority-tag.jsx"
import { BentoGrid, BentoHeading, BentoStat, BentoTile } from "@/components/commons/bento.jsx"
import {
  BarBreakdownChart,
  DonutChart,
  RadialGauge,
  TrendLineChart,
} from "@/components/charts/rebyu-charts.jsx"
import { FEATURES } from "@/services/subscriptionService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"

/* The page draws every chart from the shared portal kit rather than its own
   chart.js instance. That kit reads the active theme, so the grid lines and
   tick ink follow dark mode instead of staying pinned to a light-mode grey,
   and the categorical order (azure → teal → orange → violet) is the same one
   the enterprise panels use — the two portals read as one product. */

// Anything the page paints outside a chart still needs the series hues.
const SERIES_INK = ["#1B6EF3", "#00B8D4", "#FF9600", "#CE82FF"]

// The score a learner is working toward. Used as the reference line on the
// difficulty breakdown so a bar reads as "short of the bar" rather than just
// "shorter than the one beside it".
const TARGET_ACCURACY = 70

function getNumber(value, fallback = 0) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

// A bare percentage doesn't say whether 55% is good or bad without a scale to
// compare it against -- the same reason a difficulty label reads faster than
// a raw score. Bands are wide on purpose: confidence is noisy at the edges,
// and a tier that flips on every point swing would read as jittery rather
// than informative.
function confidenceTier(value) {
  if (value === null) return null
  if (value < 40) return "Low"
  if (value < 70) return "Moderate"
  if (value < 90) return "High"
  return "Very high"
}

// For values the backend already reports on a 0-100 scale. Never re-scales --
// a real value of 0.5 (half a percent) must stay 0.5, not become 50.
function clampPercent(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)))
}

function getTopicScore(topic) {
  return (
    clampPercent(
      topic.mastery ??
      topic.masteryPercentage ??
      topic.score ??
      topic.percentage ??
      topic.correctRate ??
      topic.value
    ) ?? 0
  )
}

function getTopicTitle(topic, fallback = "Untitled Topic") {
  return (
    topic.title ??
    topic.name ??
    topic.lessonName ??
    topic.topicName ??
    fallback
  )
}

function prettyBucket(key) {
  return key?.replaceAll("_", " ").toLowerCase() ?? "unknown"
}

/* ------------------------------------------------------------------ pieces */

/**
 * One measured thing with a bar under it. Full title on its own line rather
 * than sharing a row with the number, because lesson titles here run long
 * enough that a shared row truncates every one of them to nothing.
 */
function MasteryRow({ title, caption, value, color = SERIES_INK[0], leading }) {
  return (
    <div className="flex items-start gap-3">
      {leading ?? null}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold leading-5 text-foreground">{title}</p>

          <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
            {value}%
          </span>
        </div>

        {caption ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{caption}</p>
        ) : null}

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${value}%`, background: color }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * The one card that asks for an action rather than reporting a number, which
 * is why it leads the page instead of closing it. The bar shows *certification*
 * completion: the per-lesson progress it used to show was read off fields the
 * lesson payload does not carry, so it sat at 0% no matter how much was done.
 */
function NextUpTile({ nextLesson, certification, completedLessons, totalLessons, onResume }) {
  const done = totalLessons > 0 && completedLessons >= totalLessons
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return (
    <BentoTile tone="macaw" col={4} row={2}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-rb-macaw-lip">
          {done ? "certification complete" : "pick up where you left off"}
        </p>

        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/60 text-rb-eel dark:bg-white/10 dark:text-rb-snow">
          {done ? (
            <Trophy className="size-4" aria-hidden="true" />
          ) : (
            <BookOpen className="size-4" aria-hidden="true" />
          )}
        </span>
      </div>

      <div className="mt-4 min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-rb-macaw-lip">
          {certification?.title ?? "Certification"}
        </p>

        <p className="mt-1 font-rb-display text-xl font-extrabold leading-tight sm:text-2xl">
          {done
            ? "Every lesson is done."
            : (nextLesson?.name ?? nextLesson?.title ?? "Untitled Lesson")}
        </p>

        <p className="mt-1.5 text-sm text-rb-macaw-lip">
          {done
            ? "Sit the unit assessments to convert that into mastery."
            : (nextLesson?.middleCategoryTitle ?? "Continue studying to raise your mastery.")}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-rb-macaw-lip">
          <span>
            {completedLessons} of {totalLessons} lessons
          </span>
          <span className="tabular-nums">{percent}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/60 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-rb-macaw transition-[width] duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>

        {!done && nextLesson ? (
          <Button className="mt-4 w-full sm:w-fit" onClick={onResume}>
            Resume lesson
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </BentoTile>
  )
}

/**
 * Readiness is the question the learner actually has -- "can I sit the exam
 * yet" -- so it gets the arc rather than being a footnote under confidence.
 */
function ReadinessTile({ readiness, confidence }) {
  const tier = confidenceTier(confidence)

  return (
    <BentoTile col={2} row={2}>
      <BentoHeading title="exam readiness" />

      {readiness === null ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Target className="size-6 text-muted-foreground/50" aria-hidden="true" />

          <p className="mt-3 text-sm font-medium text-foreground">Not scored yet</p>

          <p className="mt-1 text-xs text-muted-foreground">
            Sit a quiz or assessment to get a readiness estimate.
          </p>
        </div>
      ) : (
        <>
          <RadialGauge value={readiness} label="ready for the exam" height={150} />

          <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
            {tier ? `${tier} confidence · ${confidence}%` : "Confidence not scored yet"}
          </p>
        </>
      )}
    </BentoTile>
  )
}

function RecommendationCard({ recommendation }) {
  return (
    <div className="flex items-start gap-3 rounded-rb-tile border-2 border-border/60 px-3.5 py-3">
      <PrioritySeal tag={recommendation.priorityTag} size={44} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {recommendation.lessonTitle ?? "Untitled Topic"}
        </p>

        {recommendation.reason ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {recommendation.reason}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function CategoryMasteryNode({ category, depth = 0 }) {
  const mastery = clampPercent(category.masteryPercentage)

  return (
    <div>
      <div
        className="flex items-center justify-between gap-3 py-1.5"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <p
          className={`truncate ${
            depth === 0 ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"
          }`}
        >
          {category.title ?? "Untitled Category"}
        </p>

        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {mastery === null ? "Unassessed" : `${mastery}%`}
          {" · "}
          {category.completedLessonCount}/{category.totalLessonCount} lessons
        </span>
      </div>

      {(category.children ?? []).map((child) => (
        <CategoryMasteryNode
          key={`${child.categoryLevel}-${child.categoryId}`}
          category={child}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

function RecentActivityRow({ activity }) {
  const occurredAt = activity.occurredAt ? new Date(activity.occurredAt) : null
  const score = clampPercent(activity.scorePercentage)

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {activity.title ?? (activity.activityType === "CHALLENGE" ? "Challenge" : "Assessment")}
        </p>

        <p className="text-xs text-muted-foreground">
          {activity.activityType === "CHALLENGE" ? "Challenge" : "Assessment"}
          {occurredAt ? ` · ${occurredAt.toLocaleDateString()}` : ""}
        </p>
      </div>

      {score != null ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
            activity.passed === false
              ? "bg-rb-fox-wash text-rb-fox-lip"
              : "bg-rb-feather-wash text-rb-feather-lip"
          }`}
        >
          {score}%
        </span>
      ) : null}
    </div>
  )
}

function PerformanceBreakdownList({ buckets }) {
  const visible = (buckets ?? []).filter((bucket) => bucket.totalAnswered > 0)

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No graded answers yet.</p>
  }

  // A certification can carry more question types than fit two rows, so the
  // list scrolls inside its tile rather than pushing the band out of shape.
  return (
    <div className="-mr-2 min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-2">
      {visible.map((bucket) => {
        const accuracy = clampPercent(bucket.accuracyPercentage) ?? 0

        return (
          <MasteryRow
            key={bucket.bucketKey}
            title={<span className="capitalize">{prettyBucket(bucket.bucketKey)}</span>}
            caption={`${bucket.correctAnswers} of ${bucket.totalAnswered} correct`}
            value={accuracy}
            color={accuracy >= TARGET_ACCURACY ? SERIES_INK[0] : SERIES_INK[2]}
          />
        )
      })}
    </div>
  )
}

/**
 * Mirrors the real grid's band shape (4+2, 2+2+2, 4+2, 3+3, 3+3, 3+3, 3+3) so
 * the page doesn't jump around once real content swaps in.
 */
function AnalyticsLoadingSkeleton() {
  return (
    <BentoGrid>
      <BentoTile col={4} row={2} className="gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-auto h-2 w-full" />
        <Skeleton className="h-10 w-36" />
      </BentoTile>
      <BentoTile col={2} row={2} className="gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mx-auto h-[130px] w-[130px] rounded-full" />
      </BentoTile>

      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>
      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>
      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>

      <BentoTile col={4} row={2} className="gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[200px] w-full" />
      </BentoTile>
      <BentoTile col={2} row={2} className="gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </BentoTile>

      {[0, 1, 2, 3, 4, 5].map((index) => (
        <BentoTile key={index} col={3} row={2} className="gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </BentoTile>
      ))}
    </BentoGrid>
  )
}

/* -------------------------------------------------------------------- page */

export default function LearnerProgressPage() {
  const navigate = useNavigate()
  const outletContext = useOutletContext()
  const data = outletContext?.data ?? {}

  // Analytics is enrollment-scoped: the backend 404s for a certification the
  // learner has no active enrollment in. Offering the whole published catalog
  // here made the page open on a certification it could never load.
  const publishedCertifications = data.enrolledCertifications ?? []
  const allLessons = data.lessons ?? []

  const [selectedCertificationId, setSelectedCertificationId] = useState(
    publishedCertifications[0]?.certificationId
      ? String(publishedCertifications[0].certificationId)
      : ""
  )

  useEffect(() => {
    if (publishedCertifications.length === 0) {
      if (selectedCertificationId) {
        setSelectedCertificationId("")
      }

      return
    }

    const selectedStillExists = publishedCertifications.some(
      (certification) => String(certification.certificationId) === selectedCertificationId
    )

    if (!selectedStillExists) {
      setSelectedCertificationId(String(publishedCertifications[0].certificationId))
    }
  }, [publishedCertifications, selectedCertificationId])

  const selectedCertification = useMemo(() => {
    return publishedCertifications.find(
      (certification) => String(certification.certificationId) === selectedCertificationId
    )
  }, [publishedCertifications, selectedCertificationId])

  const analyticsQuery = useQuery({
    queryKey: ["learner-progress-analytics", selectedCertificationId],
    queryFn: () => getProgressAnalytics(selectedCertificationId),
    enabled: Boolean(selectedCertificationId),
    staleTime: 30_000,
    // Mastery numbers land asynchronously after a diagnostic or assessment --
    // poll while the BKT service hasn't caught up yet so the banner below
    // clears itself the moment it does, instead of needing a manual refresh.
    refetchInterval: (query) => (query.state.data?.bktAvailable === false ? 4000 : false),
  })
  const analytics = analyticsQuery.data

  const lessons = useMemo(() => {
    if (!selectedCertificationId) {
      return allLessons
    }

    return allLessons.filter(
      (lesson) => String(lesson.certificationId) === selectedCertificationId
    )
  }, [allLessons, selectedCertificationId])

  const totalLessons = analytics?.totalLessonCount ?? 0
  const completedLessons = analytics?.completedLessonCount ?? 0
  const overallProgress =
    analytics?.completionPercentage != null ? Math.round(analytics.completionPercentage) : 0

  const weakestTopics = analytics?.weakestTopics ?? []
  const strongestTopics = analytics?.strongestTopics ?? []

  const nextLesson = useMemo(() => {
    return lessons.find((lesson) => !lesson.completed) ?? null
  }, [lessons])

  const resumeNextLesson = () => {
    if (!nextLesson) return

    // The middle category is the unit a lesson is read inside; without it
    // there is nowhere more specific to land than the curriculum itself.
    if (nextLesson.certificationId && nextLesson.middleCategoryId) {
      navigate(
        `/learner/learning/${nextLesson.certificationId}/topics/${nextLesson.middleCategoryId}`
      )
      return
    }

    navigate(`/learner/learning/${selectedCertificationId}`)
  }

  /* Score over time. Quiz and exam are two series on one axis -- both are
     percentages, so they belong on the same chart. A run of attempts of one
     kind leaves gaps in the other, which recharts draws as a break rather
     than inventing a straight line through data that isn't there. */
  const scoreTrendRows = useMemo(() => {
    const isQuizType = (type) => {
      const normalized = (type ?? "").toUpperCase()
      return normalized.includes("QUIZ") || normalized === "DIAGNOSTIC"
    }

    return (analytics?.scoreTrend ?? []).map((point, index) => {
      const percentage = clampPercent(point.percentage)

      return {
        label: point.submittedAt
          ? new Date(point.submittedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : point.assessmentTitle ?? `Attempt ${index + 1}`,
        quiz: isQuizType(point.assessmentType) ? percentage : null,
        exam: isQuizType(point.assessmentType) ? null : percentage,
      }
    })
  }, [analytics])

  const difficultyRows = useMemo(() => {
    return (analytics?.performanceByDifficulty ?? [])
      .filter((bucket) => bucket.totalAnswered > 0)
      .map((bucket) => ({
        difficulty: prettyBucket(bucket.bucketKey),
        accuracy: clampPercent(bucket.accuracyPercentage) ?? 0,
      }))
  }, [analytics])

  const answerSplit = useMemo(() => {
    const correct = getNumber(analytics?.totalCorrectAnswers, 0)
    const incorrect = getNumber(analytics?.totalIncorrectAnswers, 0)

    if (correct + incorrect === 0) return []

    return [
      { name: "Correct", value: correct },
      { name: "Incorrect", value: incorrect },
    ]
  }, [analytics])

  const topicMastery = clampPercent(analytics?.overallMasteryPercentage)
  const confidenceLevel = clampPercent(analytics?.confidencePercentage)
  const studyStreak = getNumber(analytics?.studyStreakDays, 0)
  const readinessLevel = clampPercent(analytics?.readinessPercentage)
  const bktUnavailable = analytics != null && analytics.bktAvailable === false

  const answerTotal =
    getNumber(analytics?.totalCorrectAnswers, 0) + getNumber(analytics?.totalIncorrectAnswers, 0)
  const answerAccuracy =
    answerTotal > 0
      ? Math.round((getNumber(analytics?.totalCorrectAnswers, 0) / answerTotal) * 100)
      : null

  return (
    <LearnerPremiumGuard
      feature={FEATURES.PROGRESS_ANALYTICS}
      title="Advanced progress analytics"
      description="Unlock mastery, weakness analysis, performance trends, confidence, and recommended next actions with Pro or institution access."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your mastery, performance trends, and recommended next steps.
            </p>
          </div>

          <Select
            value={selectedCertificationId}
            onValueChange={setSelectedCertificationId}
            disabled={publishedCertifications.length === 0}
          >
            <SelectTrigger className="w-auto min-w-[210px] bg-background text-sm font-medium">
              <SelectValue placeholder="Select certification" />
            </SelectTrigger>

            <SelectContent align="start">
              {publishedCertifications.map((certification) => (
                <SelectItem
                  key={certification.certificationId}
                  value={String(certification.certificationId)}
                  className="text-sm"
                >
                  {certification.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {publishedCertifications.length === 0 ? (
          <LearnerEmptyState
            icon={BookOpen}
            title="No enrolled certifications yet"
            description="Enroll in a certification -- or accept an organization invitation -- and your mastery, performance trends, and recommended next steps will appear here."
            action={
              <Button onClick={() => navigate("/learner/certifications")}>
                Browse certifications
              </Button>
            }
          />
        ) : analyticsQuery.isLoading ? (
          <AnalyticsLoadingSkeleton />
        ) : analyticsQuery.isError ? (
          <LearnerErrorState
            title="Couldn't load your analytics"
            error={analyticsQuery.error}
            onRetry={analyticsQuery.refetch}
          />
        ) : (
          <>
            {bktUnavailable && (
              <div className="flex items-center gap-3 rounded-rb-tile border-2 border-rb-bee/40 bg-rb-bee-wash px-4 py-3 text-sm font-semibold text-rb-bee-lip">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                <span>
                  Processing your mastery — this updates itself once it's ready. Your assessment
                  scores below are still up to date.
                </span>
              </div>
            )}

            <BentoGrid>
              {/* Band 1 — the two things a learner opens this page to decide:
                  what to study next, and whether they are ready to sit it. */}
              <NextUpTile
                nextLesson={nextLesson}
                certification={selectedCertification}
                completedLessons={completedLessons}
                totalLessons={totalLessons}
                onResume={resumeNextLesson}
              />

              <ReadinessTile readiness={readinessLevel} confidence={confidenceLevel} />

              {/* Band 2 — even thirds. Every counter carries a hint, so the
                  number never sits there without the denominator that makes
                  it mean something. */}
              <BentoStat
                tone="feather"
                col={2}
                row={1}
                icon={TrendingUp}
                label="Course Progress"
                value={`${overallProgress}%`}
                hint={`${completedLessons} of ${totalLessons} lessons done`}
              />

              <BentoStat
                tone="beetle"
                col={2}
                row={1}
                icon={Brain}
                label="Topic Mastery"
                value={topicMastery === null ? "—" : `${topicMastery}%`}
                hint={
                  analytics
                    ? `${analytics.masteredTopicCount} mastered · ${analytics.weakTopicCount} weak`
                    : undefined
                }
              />

              <BentoStat
                tone="fox"
                col={2}
                row={1}
                icon={Flame}
                label="Study Streak"
                value={`${studyStreak} ${studyStreak === 1 ? "day" : "days"}`}
                hint={`${getNumber(analytics?.totalAssessmentAttempts, 0)} assessment attempts`}
              />

              {/* Band 3 — the trend gets the width, because a line only reads
                  as a direction when it has room to run. */}
              <BentoTile col={4} row={2}>
                <BentoHeading
                  title="score over time"
                  hint="Every graded quiz and assessment attempt, oldest first."
                />

                {scoreTrendRows.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <Target className="size-7 text-muted-foreground/50" aria-hidden="true" />

                    <p className="mt-3 text-sm font-medium text-foreground">
                      No performance data yet
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Complete quizzes or assessments to see your progress.
                    </p>
                  </div>
                ) : (
                  <TrendLineChart
                    data={scoreTrendRows}
                    xKey="label"
                    series={[
                      { key: "quiz", name: "Quiz" },
                      { key: "exam", name: "Exam" },
                    ]}
                    height={190}
                    unit="%"
                    ticks={[0, 25, 50, 75, 100]}
                    legendNote="Most recent attempt of each kind"
                  />
                )}
              </BentoTile>

              <BentoTile col={2} row={2}>
                <BentoHeading title="strongest topics" />

                {strongestTopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No strong topics identified yet.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {strongestTopics.slice(0, 4).map((topic) => (
                      <MasteryRow
                        key={topic.lessonId}
                        title={topic.lessonTitle ?? "Untitled Topic"}
                        caption={topic.categoryTitle}
                        value={clampPercent(topic.masteryPercentage) ?? 0}
                        color={SERIES_INK[1]}
                      />
                    ))}
                  </div>
                )}
              </BentoTile>

              {/* Band 4 — what to do about it. Weak topics used to be drawn
                  twice, once as this list and once as a bar chart whose labels
                  were cut to seven characters; the list keeps the full title
                  and the priority seal, which is the part that's actionable. */}
              <BentoTile col={3} row={2}>
                <BentoHeading
                  title="focus areas"
                  hint="Lowest mastery first — the fastest score to move."
                />

                {weakestTopics.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <Target className="size-6 text-muted-foreground/50" aria-hidden="true" />

                    <p className="mt-3 text-sm font-medium text-foreground">No weak areas yet</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Complete assessments to identify what needs work.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {weakestTopics.slice(0, 4).map((topic, index) => (
                      <MasteryRow
                        key={topic.lessonId ?? `${getTopicTitle(topic)}-${index}`}
                        title={topic.lessonTitle ?? getTopicTitle(topic)}
                        caption={topic.categoryTitle}
                        value={getTopicScore(topic)}
                        color={SERIES_INK[2]}
                        leading={
                          topic.priorityTag ? (
                            <PrioritySeal tag={topic.priorityTag} size={36} />
                          ) : null
                        }
                      />
                    ))}
                  </div>
                )}
              </BentoTile>

              <BentoTile col={3} row={2} className="!p-0">
                <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                  <BentoHeading
                    title="recommended next"
                    hint="Ranked by what the model thinks costs you the most marks."
                  />

                  {(analytics?.recommendedTopics ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recommendations yet -- complete an assessment to get personalized
                      suggestions.
                    </p>
                  ) : (
                    <div className="-mr-2 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-2">
                      {analytics.recommendedTopics.map((recommendation) => (
                        <RecommendationCard
                          key={recommendation.lessonId}
                          recommendation={recommendation}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </BentoTile>

              {/* Band 5 — how the answers themselves are going. */}
              <BentoTile col={3} row={2}>
                <BentoHeading title="accuracy by difficulty" />

                {difficultyRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No graded answers yet — complete an assessment to see this.
                  </p>
                ) : (
                  <BarBreakdownChart
                    data={difficultyRows}
                    categoryKey="difficulty"
                    valueKey="accuracy"
                    height={170}
                    unit="%"
                    target={TARGET_ACCURACY}
                    categoryWidth={78}
                  />
                )}
              </BentoTile>

              <BentoTile col={3} row={2}>
                <BentoHeading title="answers graded" />

                {answerSplit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No graded answers yet — complete an assessment to see this.
                  </p>
                ) : (
                  <DonutChart
                    data={answerSplit}
                    height={165}
                    centerValue={answerAccuracy === null ? "—" : `${answerAccuracy}%`}
                    centerLabel="correct"
                  />
                )}
              </BentoTile>

              {/* Band 6 — the reference material: where you stand by unit, and
                  what you last did. Both scroll inside their tile. */}
              <BentoTile col={3} row={2} className="!p-0">
                <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                  <BentoHeading title="mastery by unit" />

                  {(analytics?.categoryMastery ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No category mastery data yet.
                    </p>
                  ) : (
                    <div className="-mr-2 min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto pr-2">
                      {analytics.categoryMastery.map((category) => (
                        <CategoryMasteryNode
                          key={`${category.categoryLevel}-${category.categoryId}`}
                          category={category}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </BentoTile>

              <BentoTile col={3} row={2} className="!p-0">
                <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                  <BentoHeading title="recent activity" />

                  {(analytics?.recentActivity ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recent assessment or challenge activity yet.
                    </p>
                  ) : (
                    <div className="-mr-2 min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto pr-2">
                      {analytics.recentActivity.map((activity, index) => (
                        <RecentActivityRow
                          key={`${activity.activityType}-${activity.occurredAt}-${index}`}
                          activity={activity}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </BentoTile>

              {/* Band 7 — the two breakdowns, now on the same bar treatment as
                  everything else rather than a bare right-aligned fraction. */}
              <BentoTile col={3} row={2}>
                <BentoHeading title="accuracy by question type" />
                <PerformanceBreakdownList buckets={analytics?.performanceByQuestionType} />
              </BentoTile>

              <BentoTile col={3} row={2}>
                <BentoHeading title="accuracy by assessment type" />
                <PerformanceBreakdownList buckets={analytics?.performanceByAssessmentType} />
              </BentoTile>
            </BentoGrid>
          </>
        )}
      </div>
    </LearnerPremiumGuard>
  )
}
