import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js"
import { Bar, Doughnut, Line } from "react-chartjs-2"
import { Brain, BookOpen, Flame, Gauge, Loader2, Target, TrendingUp } from "@/components/icons"

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
import { FEATURES } from "@/services/subscriptionService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler
)

/* Same fixed categorical order the shared chart kit uses (azure → teal →
   orange → violet), so this chart.js page and the recharts panels elsewhere
   read as one system. The order is assigned by position, never cycled by rank;
   past the fourth slot a category takes neutral ink rather than a new hue. */
const BAR_COLORS = ["#1B6EF3", "#00B8D4", "#FF9600", "#CE82FF", "#AFAFAF", "#AFAFAF"]

function toPercent(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  const normalizedValue =
      numericValue >= 0 && numericValue <= 1
          ? numericValue * 100
          : numericValue

  return Math.max(0, Math.min(100, Math.round(normalizedValue)))
}

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

// For values the backend already reports on a 0-100 scale. Unlike toPercent,
// this never re-scales -- a real value of 0.5 (half a percent) must stay 0.5,
// not become 50, which toPercent's 0-1-means-a-fraction heuristic would do.
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

function TopicReviewRow({ topic, index }) {
  const title = getTopicTitle(topic, `Topic ${index + 1}`)
  const mastery = getTopicScore(topic)

  return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">
            {title}
          </p>

          <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {mastery}%
        </span>
        </div>

        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
          <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${mastery}%`,
              }}
          />
        </div>
      </div>
  )
}

function ChartLegend() {
  return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: BAR_COLORS[0] }} />
          <span className="text-xs font-semibold text-muted-foreground">Quiz</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: BAR_COLORS[1] }} />
          <span className="text-xs font-semibold text-muted-foreground">Exam</span>
        </div>
      </div>
  )
}

function StrongestTopicRow({ topic }) {
  const mastery = clampPercent(topic.masteryPercentage) ?? 0

  return (
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-foreground">
          {topic.lessonTitle ?? "Untitled Topic"}
        </p>

        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {mastery}%
        </span>
      </div>
  )
}

function RecommendationCard({ recommendation }) {
  return (
      <div className="flex items-start gap-3 rounded-lg border border-border/60 px-3.5 py-3">
        <PrioritySeal tag={recommendation.priorityTag} size={48} />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {recommendation.lessonTitle ?? "Untitled Topic"}
          </p>

          {recommendation.reason && (
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {recommendation.reason}
              </p>
          )}
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
          <p className={`truncate ${depth === 0 ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"}`}>
            {category.title ?? "Untitled Category"}
          </p>

          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {mastery === null ? "Unassessed" : `${mastery}%`}
            {" · "}
            {category.completedLessonCount}/{category.totalLessonCount} lessons
          </span>
        </div>

        {(category.children ?? []).map((child) => (
            <CategoryMasteryNode key={`${child.categoryLevel}-${child.categoryId}`} category={child} depth={depth + 1} />
        ))}
      </div>
  )
}

function RecentActivityRow({ activity }) {
  const occurredAt = activity.occurredAt ? new Date(activity.occurredAt) : null

  return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {activity.title ?? (activity.activityType === "CHALLENGE" ? "Challenge" : "Assessment")}
          </p>

          <p className="text-xs text-muted-foreground">
            {activity.activityType === "CHALLENGE" ? "Challenge" : "Assessment"}
            {occurredAt ? ` · ${occurredAt.toLocaleDateString()}` : ""}
          </p>
        </div>

        {activity.scorePercentage != null && (
            <span className="shrink-0 text-xs font-semibold text-foreground">
              {clampPercent(activity.scorePercentage)}%
            </span>
        )}
      </div>
  )
}

function PerformanceBreakdownList({ buckets }) {
  const visible = (buckets ?? []).filter((bucket) => bucket.totalAnswered > 0)

  if (visible.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">No graded answers yet.</p>
  }

  return (
      <div className="mt-3 space-y-2.5">
        {visible.map((bucket) => (
            <div key={bucket.bucketKey} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-foreground">
                {bucket.bucketKey?.replaceAll("_", " ") ?? "Unknown"}
              </span>

              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {bucket.correctAnswers}/{bucket.totalAnswered} correct
                {bucket.accuracyPercentage != null ? ` (${Math.round(bucket.accuracyPercentage)}%)` : ""}
              </span>
            </div>
        ))}
      </div>
  )
}

function ContinueLearningSection({ nextLesson, certification }) {
  if (!nextLesson) {
    return (
        <section className="rounded-rb-tile border-2 border-border bg-card px-4 py-4">
          <h2 className="text-sm font-bold text-foreground">
            Continue Learning
          </h2>

          <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
            <p className="text-sm font-medium text-foreground">
              No unfinished lessons available.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Complete an assessment or review previous lessons to continue learning.
            </p>
          </div>
        </section>
    )
  }

  const lessonProgress =
      toPercent(
          nextLesson.progress ??
          nextLesson.progressPercentage ??
          nextLesson.completionPercentage
      ) ?? 0

  return (
      <section className="rounded-rb-tile border-2 border-border bg-card px-4 py-4">
        <h2 className="text-sm font-bold text-foreground">
          Continue Learning
        </h2>

        <div className="mt-4 flex flex-col gap-4 rounded-lg bg-muted/30 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {certification?.title ?? "Certification"}
            </p>

            <p className="mt-1 truncate text-base font-semibold text-foreground">
              {nextLesson.name ?? nextLesson.title ?? "Untitled Lesson"}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Continue studying to improve your topic mastery.
            </p>
          </div>

          <div className="w-full md:w-44">
            <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Lesson Progress
            </span>

              <span className="text-xs font-semibold text-foreground">
              {lessonProgress}%
            </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${lessonProgress}%`,
                  }}
              />
            </div>
          </div>
        </div>
      </section>
  )
}

/**
 * Mirrors the real BentoGrid's band shape (2+1+2+1 stats, 4+2 charts, 4+2,
 * 3+3, 3+3, 3+3) so the page doesn't jump around once real content swaps in.
 */
function AnalyticsLoadingSkeleton() {
  return (
    <BentoGrid>
      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>
      <BentoTile col={1} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-8 w-10" />
      </BentoTile>
      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>
      <BentoTile col={1} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-12" />
      </BentoTile>

      <BentoTile col={4} row={2} className="gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[180px] w-full" />
      </BentoTile>
      <BentoTile col={2} row={2} className="gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </BentoTile>

      <BentoTile col={4} row={2} className="gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[180px] w-full" />
      </BentoTile>
      <BentoTile col={2} row={2} className="gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mx-auto h-[100px] w-[100px] rounded-full" />
      </BentoTile>

      <BentoTile col={3} row={2} className="gap-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </BentoTile>
      <BentoTile col={3} row={2} className="gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </BentoTile>

      <BentoTile col={3} row={2} className="gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </BentoTile>
      <BentoTile col={3} row={2} className="gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </BentoTile>

      <BentoTile col={3} row={1} className="gap-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-full" />
      </BentoTile>
      <BentoTile col={3} row={1} className="gap-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-full" />
      </BentoTile>
    </BentoGrid>
  )
}

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
        (certification) =>
            String(certification.certificationId) === selectedCertificationId
    )

    if (!selectedStillExists) {
      setSelectedCertificationId(
          String(publishedCertifications[0].certificationId)
      )
    }
  }, [publishedCertifications, selectedCertificationId])

  const selectedCertification = useMemo(() => {
    return publishedCertifications.find(
        (certification) =>
            String(certification.certificationId) === selectedCertificationId
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
        (lesson) =>
            String(lesson.certificationId) === selectedCertificationId
    )
  }, [allLessons, selectedCertificationId])

  const totalLessons = analytics?.totalLessonCount ?? 0
  const completedLessons = analytics?.completedLessonCount ?? 0
  const overallProgress =
      analytics?.completionPercentage != null
          ? Math.round(analytics.completionPercentage)
          : 0

  const certificationWeakAreas = useMemo(() => {
    return (analytics?.weakestTopics ?? []).map((topic) => ({
      lessonId: topic.lessonId,
      title: topic.lessonTitle,
      masteryPercentage: topic.masteryPercentage,
    }))
  }, [analytics])

  const nextLesson = useMemo(() => {
    return lessons.find((lesson) => !lesson.completed) ?? null
  }, [lessons])

  const scoreTrend = analytics?.scoreTrend ?? []

  const lineChartData = useMemo(() => {
    const labels = scoreTrend.map((point, index) =>
        point.submittedAt
            ? new Date(point.submittedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
            : point.assessmentTitle ?? `Attempt ${index + 1}`
    )

    const isQuizType = (type) => {
      const normalized = (type ?? "").toUpperCase()
      return normalized.includes("QUIZ") || normalized === "DIAGNOSTIC"
    }

    const quizScores = scoreTrend.map((point) =>
        isQuizType(point.assessmentType) ? clampPercent(point.percentage) : null
    )

    const examScores = scoreTrend.map((point) =>
        isQuizType(point.assessmentType) ? null : clampPercent(point.percentage)
    )

    return {
      labels,
      datasets: [
        {
          label: "Quiz",
          data: quizScores,
          borderColor: BAR_COLORS[0],
          backgroundColor: "rgba(27, 110, 243, 0.16)",
          borderWidth: 2,
          tension: 0.45,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: BAR_COLORS[0],
          fill: false,
        },
        {
          label: "Exam",
          data: examScores,
          borderColor: BAR_COLORS[1],
          backgroundColor: "rgba(0, 184, 212, 0.14)",
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.45,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: BAR_COLORS[1],
          fill: false,
        },
      ],
    }
  }, [scoreTrend])

  const lineChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#27272A",
          titleColor: "#FFFFFF",
          bodyColor: "#F4F4F5",
          padding: 10,
          cornerRadius: 7,
          displayColors: true,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${Math.round(
                  context.parsed.y
              )}%`
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            color: "#777777",
            font: {
              size: 11,
            },
          },
        },
        y: {
          min: 0,
          max: 100,
          border: {
            display: false,
          },
          grid: {
            color: "#E5E5E5",
            borderDash: [3, 3],
          },
          ticks: {
            color: "#777777",
            font: {
              size: 11,
            },
            stepSize: 20,
            callback(value) {
              return `${value}%`
            },
          },
        },
      },
    }
  }, [])

  const barChartData = useMemo(() => {
    const chartTopics = certificationWeakAreas.slice(0, 6)

    return {
      labels: chartTopics.map((topic, index) => {
        const title = getTopicTitle(topic, `Topic ${index + 1}`)

        return title.length > 8
            ? `${title.slice(0, 7)}…`
            : title
      }),
      datasets: [
        {
          data: chartTopics.map((topic) => getTopicScore(topic)),
          backgroundColor: chartTopics.map(
              (_, index) => BAR_COLORS[index % BAR_COLORS.length]
          ),
          borderRadius: 3,
          borderSkipped: false,
          maxBarThickness: 18,
        },
      ],
    }
  }, [certificationWeakAreas])

  const barChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#27272A",
          titleColor: "#FFFFFF",
          bodyColor: "#F4F4F5",
          padding: 10,
          cornerRadius: 7,
          callbacks: {
            label(context) {
              return `Mastery: ${Math.round(context.parsed.y)}%`
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            color: "#777777",
            font: {
              size: 10,
            },
          },
        },
        y: {
          min: 0,
          max: 100,
          border: {
            display: false,
          },
          grid: {
            color: "#E5E5E5",
            borderDash: [3, 3],
          },
          ticks: {
            color: "#777777",
            font: {
              size: 10,
            },
            stepSize: 20,
            callback(value) {
              return `${value}%`
            },
          },
        },
      },
    }
  }, [])

  const mockExamSegments = useMemo(() => {
    const buckets = analytics?.performanceByDifficulty ?? []

    return buckets
        .filter((bucket) => bucket.totalAnswered > 0)
        .map((bucket, index) => ({
          label: bucket.bucketKey,
          value: Math.round(bucket.accuracyPercentage ?? 0),
          color: BAR_COLORS[index % BAR_COLORS.length],
        }))
  }, [analytics])

  const doughnutChartData = useMemo(() => {
    return {
      labels: mockExamSegments.map((segment) => segment.label),
      datasets: [
        {
          data: mockExamSegments.map((segment) => segment.value),
          backgroundColor: mockExamSegments.map(
              (segment) => segment.color
          ),
          borderWidth: 0,
          spacing: 3,
          hoverOffset: 3,
        },
      ],
    }
  }, [mockExamSegments])

  const doughnutChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      rotation: -90,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#27272A",
          titleColor: "#FFFFFF",
          bodyColor: "#F4F4F5",
          padding: 10,
          cornerRadius: 7,
          callbacks: {
            label(context) {
              return `${context.label}: ${Math.round(context.parsed)}%`
            },
          },
        },
      },
    }
  }, [])

  const topicMastery = clampPercent(analytics?.overallMasteryPercentage)
  const confidenceLevel = clampPercent(analytics?.confidencePercentage)
  const studyStreak = getNumber(analytics?.studyStreakDays, 0)
  const readinessLevel = clampPercent(analytics?.readinessPercentage)
  const bktUnavailable = analytics != null && analytics.bktAvailable === false

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
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                    <span>
                      Processing your mastery — this updates itself once it's ready. Your assessment scores below are still up to date.
                    </span>
                  </div>
              )}

              <BentoGrid>
                {/* Band 1 — 2 + 1 + 2 + 1, mirroring the admin dashboard's counter rhythm */}
                <BentoStat
                    tone="macaw"
                    col={2}
                    row={1}
                    icon={TrendingUp}
                    label="Overall Progress"
                    value={`${overallProgress}%`}
                />

                <BentoStat
                    tone="feather"
                    col={1}
                    row={1}
                    icon={Brain}
                    label="Topic Mastery"
                    value={topicMastery === null ? "—" : `${topicMastery}%`}
                />

                <BentoStat
                    tone="bee"
                    col={2}
                    row={1}
                    icon={Gauge}
                    label="Confidence Level"
                    value={confidenceLevel === null ? "—" : confidenceTier(confidenceLevel)}
                >
                  {confidenceLevel !== null ? (
                      <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-xs font-bold text-rb-bee-lip dark:bg-white/10">
                        {confidenceLevel}% confidence
                      </p>
                  ) : null}

                  {readinessLevel !== null ? (
                      <p className="mt-2 text-xs font-semibold text-rb-bee-lip">
                        Readiness {readinessLevel}%
                      </p>
                  ) : null}
                </BentoStat>

                <BentoStat
                    tone="fox"
                    col={1}
                    row={1}
                    icon={Flame}
                    label="Study Streak"
                    value={`${studyStreak} days`}
                />

                {/* Band 2 — 4 + 2 */}
                <BentoTile col={4} row={2}>
                  <BentoHeading title="learning performance" action={<ChartLegend />} />

                  <div className="h-[215px]">
                    {scoreTrend.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center">
                          <Target className="h-7 w-7 text-muted-foreground/50" />

                          <p className="mt-3 text-sm font-medium text-foreground">
                            No performance data yet
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Complete quizzes or mock exams to see your progress.
                          </p>
                        </div>
                    ) : (
                        <Line
                            data={lineChartData}
                            options={lineChartOptions}
                        />
                    )}
                  </div>
                </BentoTile>

                <BentoTile col={2} row={2}>
                  <BentoHeading title="topics to review" />

                  {certificationWeakAreas.length === 0 ? (
                      <div className="flex min-h-[195px] flex-col items-center justify-center text-center">
                        <Target className="h-6 w-6 text-muted-foreground/50" />

                        <p className="mt-3 text-sm font-medium text-foreground">
                          No review topics yet
                        </p>

                        <p className="mt-1 text-xs leading-4 text-muted-foreground">
                          Complete assessments to identify weak areas.
                        </p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                        {certificationWeakAreas.slice(0, 6).map((topic, index) => (
                            <TopicReviewRow
                                key={
                                    topic.lessonId ??
                                    topic.topicId ??
                                    topic.id ??
                                    `${getTopicTitle(topic)}-${index}`
                                }
                                topic={topic}
                                index={index}
                            />
                        ))}
                      </div>
                  )}
                </BentoTile>

                {/* Band 3 — 4 + 2, mirrored against band 2 */}
                <BentoTile col={4} row={2}>
                  <BentoHeading title="weak areas" />

                  <div className="h-[195px]">
                    {certificationWeakAreas.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center">
                          <p className="text-sm font-medium text-foreground">
                            No weak-area data yet
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Assessment results will appear here.
                          </p>
                        </div>
                    ) : (
                        <Bar
                            data={barChartData}
                            options={barChartOptions}
                        />
                    )}
                  </div>
                </BentoTile>

                <BentoTile col={2} row={2}>
                  <BentoHeading title="accuracy by difficulty" />

                  {mockExamSegments.length === 0 ? (
                      <div className="flex h-[195px] flex-col items-center justify-center">
                        <p className="text-sm font-medium text-foreground">
                          No graded answers yet
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Complete an assessment to see accuracy by difficulty.
                        </p>
                      </div>
                  ) : (
                      <div className="grid min-h-[150px] items-center gap-3 sm:grid-cols-[100px_minmax(0,1fr)]">
                        <div className="h-[100px]">
                          <Doughnut
                              data={doughnutChartData}
                              options={doughnutChartOptions}
                          />
                        </div>

                        <div className="space-y-2.5">
                          {mockExamSegments.map((segment) => (
                              <div
                                  key={segment.label}
                                  className="flex items-center justify-between gap-3"
                              >
                                <div className="flex min-w-0 items-center gap-1.5">
                          <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: segment.color,
                              }}
                          />

                                  <span className="truncate text-xs text-muted-foreground">
                            {segment.label}
                          </span>
                                </div>

                                <span className="shrink-0 text-xs font-semibold text-foreground">
                          {segment.value}%
                        </span>
                              </div>
                          ))}
                        </div>
                      </div>
                  )}
                </BentoTile>

                {/* Band 4 — even thirds */}
                <BentoTile col={3} row={2}>
                  <BentoHeading title="recommended topics" />
                  {(analytics?.recommendedTopics ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No recommendations yet -- complete an assessment to get personalized suggestions.
                      </p>
                  ) : (
                      <div className="space-y-2.5">
                        {analytics.recommendedTopics.map((recommendation) => (
                            <RecommendationCard
                                key={recommendation.lessonId}
                                recommendation={recommendation}
                            />
                        ))}
                      </div>
                  )}
                </BentoTile>

                <BentoTile col={3} row={2}>
                  <BentoHeading title="strongest topics" />
                  {(analytics?.strongestTopics ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No strong topics identified yet.
                      </p>
                  ) : (
                      <div className="space-y-3">
                        {analytics.strongestTopics.map((topic) => (
                            <StrongestTopicRow key={topic.lessonId} topic={topic} />
                        ))}
                      </div>
                  )}
                </BentoTile>

                {/* Band 5 — even thirds */}
                <BentoTile col={3} row={2} className="!p-0">
                  <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                    <BentoHeading title="category mastery" />
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

                {/* Band 6 — even halves */}
                <BentoTile col={3} row={1}>
                  <BentoHeading title="performance by question type" />
                  <PerformanceBreakdownList buckets={analytics?.performanceByQuestionType} />
                </BentoTile>

                <BentoTile col={3} row={1}>
                  <BentoHeading title="performance by assessment type" />
                  <PerformanceBreakdownList buckets={analytics?.performanceByAssessmentType} />
                </BentoTile>
              </BentoGrid>

              <ContinueLearningSection
                  nextLesson={nextLesson}
                  certification={selectedCertification}
              />
            </>
        )}
        </div>
      </LearnerPremiumGuard>
  )
}
