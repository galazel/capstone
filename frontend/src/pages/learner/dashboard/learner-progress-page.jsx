import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
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
import { BookOpen, Target } from "@/components/icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LearnerEmptyState,
  LearnerErrorState,
  LearnerLoadingSkeleton,
} from "@/components/learner/learner-ui.jsx"
import LearnerPremiumGuard from "@/components/learner/learner-premium-guard.jsx"
import { FEATURES } from "@/services/subscriptionService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"
import { convertCoinsToAiCredits, getMyRewardBalance, getMyRewardLedger } from "@/services/gamificationService.js"

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

function ProgressStatCard({
                            label,
                            value,
                            trend,
                          }) {
  return (
      <article className="min-w-0 py-2 sm:px-5 sm:first:pl-0 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-border/70">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {label}
          </p>

          {trend && (
              <span className="text-xs font-medium text-zinc-500">
            {trend}
          </span>
          )}
        </div>

        <p className="mt-3 font-heading text-3xl font-semibold leading-none tracking-tight text-foreground">
          {value}
        </p>
      </article>
  )
}

function DashboardPanel({ title, children, className = "" }) {
  return (
      <section
          className={`border-t border-border/70 pt-5 ${className}`}
      >
        <h2 className="text-lg font-semibold text-foreground">
          {title}
        </h2>

        {children}
      </section>
  )
}

function TopicReviewRow({ topic, index }) {
  const title = getTopicTitle(topic, `Topic ${index + 1}`)
  const mastery = getTopicScore(topic)

  return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-zinc-600">
            {title}
          </p>

          <span className="shrink-0 text-xs font-medium text-zinc-400">
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
        <p className="truncate text-sm font-medium text-zinc-600">
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
      <div className="rounded-lg border border-border/60 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {recommendation.lessonTitle ?? "Untitled Topic"}
          </p>

          {recommendation.priorityTag && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {recommendation.priorityTag.replaceAll("_", " ")}
              </span>
          )}
        </div>

        {recommendation.reason && (
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {recommendation.reason}
            </p>
        )}
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
          <p className="truncate text-sm font-medium text-zinc-700">
            {activity.title ?? (activity.activityType === "CHALLENGE" ? "Challenge" : "Assessment")}
          </p>

          <p className="text-xs text-zinc-400">
            {activity.activityType === "CHALLENGE" ? "Challenge" : "Assessment"}
            {occurredAt ? ` · ${occurredAt.toLocaleDateString()}` : ""}
          </p>
        </div>

        {activity.scorePercentage != null && (
            <span className="shrink-0 text-xs font-semibold text-zinc-700">
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
              <span className="truncate text-sm text-zinc-600">
                {bucket.bucketKey?.replaceAll("_", " ") ?? "Unknown"}
              </span>

              <span className="shrink-0 text-xs font-medium text-zinc-500">
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

          <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-5 text-center">
            <p className="text-sm font-medium text-zinc-700">
              No unfinished lessons available.
            </p>

            <p className="mt-1 text-xs text-zinc-500">
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

        <div className="mt-4 flex flex-col gap-4 rounded-lg bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {certification?.title ?? "Certification"}
            </p>

            <p className="mt-1 truncate text-base font-semibold text-foreground">
              {nextLesson.name ?? nextLesson.title ?? "Untitled Lesson"}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Continue studying to improve your topic mastery.
            </p>
          </div>

          <div className="w-full md:w-44">
            <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Lesson Progress
            </span>

              <span className="text-xs font-semibold text-zinc-700">
              {lessonProgress}%
            </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                  className="h-full rounded-full bg-zinc-900"
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

export default function LearnerProgressPage() {
  const navigate = useNavigate()
  const outletContext = useOutletContext()
  const data = outletContext?.data ?? {}

  const publishedCertifications = data.certifications ?? []
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
  const rewardsQuery = useQuery({ queryKey: ["my-reward-balance"], queryFn: getMyRewardBalance })
  const rewardLedgerQuery = useQuery({ queryKey: ["my-reward-ledger"], queryFn: getMyRewardLedger })
  const convertCoinsMutation = useMutation({
    mutationFn: () => convertCoinsToAiCredits(10, globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
    onSuccess: (result) => { rewardsQuery.refetch(); rewardLedgerQuery.refetch(); toast.success(result.converted ? `Converted 10 coins into ${result.aiCreditsReceived} AI credit.` : "That conversion was already processed.") },
    onError: (error) => toast.error(error?.message || "Could not convert coins."),
  })

  return (
      <LearnerPremiumGuard
          feature={FEATURES.PROGRESS_ANALYTICS}
          title="Advanced progress analytics"
          description="Unlock mastery, weakness analysis, performance trends, confidence, and recommended next actions with Pro or institution access."
      >
        <div className="space-y-8 font-sans">
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Learning rewards">
          {[
            ["XP", rewardsQuery.data?.xp ?? 0, "Permanent learning progression"],
            ["Coins", rewardsQuery.data?.coins ?? 0, "Community reward balance"],
            ["AI credits", rewardsQuery.data?.aiCredits ?? 0, "Tutor generation balance"],
          ].map(([label, value, caption]) => <div key={label} className="rounded-xl border bg-background p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{Number(value).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{caption}</p></div>)}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm"><p className="text-muted-foreground">Convert 10 Community Coins into 1 AI Credit for Tutor generation.</p><Button size="sm" variant="outline" disabled={(rewardsQuery.data?.coins ?? 0) < 10 || convertCoinsMutation.isPending} onClick={() => convertCoinsMutation.mutate()}>Convert 10 coins</Button></div>
        {(rewardLedgerQuery.data?.length ?? 0) > 0 ? <section className="rounded-xl border bg-background p-4"><h2 className="text-sm font-semibold">Recent reward activity</h2><div className="mt-3 space-y-2">{rewardLedgerQuery.data.slice(0, 5).map((entry, index) => <div key={`${entry.createdAt}-${index}`} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-muted-foreground">{entry.reason.replaceAll("_", " ")}</span><span className={entry.amount > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{entry.amount > 0 ? "+" : ""}{entry.amount} {entry.currency.replace("_", " ")}</span></div>)}</div></section> : null}
        <div className="flex justify-end">
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
                title="No published certifications yet"
                description="Published certifications will appear here with your learning analytics and assessment progress."
                action={
                  <Button onClick={() => navigate("/learner/learning")}>
                    Go to My Learning
                  </Button>
                }
            />
        ) : analyticsQuery.isLoading ? (
            <LearnerLoadingSkeleton />
        ) : analyticsQuery.isError ? (
            <LearnerErrorState
                title="Couldn't load your analytics"
                error={analyticsQuery.error}
                onRetry={analyticsQuery.refetch}
            />
        ) : (
            <>
              {bktUnavailable && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    Mastery analytics are temporarily unavailable. Your assessment scores below are still up to date.
                  </div>
              )}

              <section className="grid gap-5 sm:grid-cols-2 sm:gap-0 xl:grid-cols-4" aria-label="Analytics summary">
                <ProgressStatCard
                    label="Overall Progress"
                    value={`${overallProgress}%`}
                    backgroundClassName="bg-[#E2F5FF]"
                />

                <ProgressStatCard
                    label="Topic Mastery"
                    value={
                      topicMastery === null
                          ? "—"
                          : `${topicMastery}%`
                    }
                    backgroundClassName="bg-[#E8EFF9]"
                />

                <ProgressStatCard
                    label="Confidence Level"
                    value={
                      confidenceLevel === null
                          ? "—"
                          : `${confidenceLevel}%`
                    }
                    trend={
                      readinessLevel === null
                          ? null
                          : `Readiness ${readinessLevel}%`
                    }
                    backgroundClassName="bg-[#E2F5FF]"
                />

                <ProgressStatCard
                    label="Study Streak"
                    value={`${studyStreak} days`}
                    backgroundClassName="bg-[#E8EFF9]"
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
                <DashboardPanel title="Learning Performance">
                  <div className="mt-1 flex items-center justify-end">
                    <ChartLegend />
                  </div>

                  <div className="mt-1 h-[215px]">
                    {scoreTrend.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center">
                          <Target className="h-7 w-7 text-zinc-300" />

                          <p className="mt-3 text-sm font-medium text-zinc-600">
                            No performance data yet
                          </p>

                          <p className="mt-1 text-xs text-zinc-400">
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
                </DashboardPanel>

                <DashboardPanel title="Topics to Review">
                  {certificationWeakAreas.length === 0 ? (
                      <div className="flex min-h-[215px] flex-col items-center justify-center text-center">
                        <Target className="h-6 w-6 text-zinc-300" />

                        <p className="mt-3 text-sm font-medium text-zinc-600">
                          No review topics yet
                        </p>

                        <p className="mt-1 text-xs leading-4 text-zinc-400">
                          Complete assessments to identify weak areas.
                        </p>
                      </div>
                  ) : (
                      <div className="mt-5 space-y-4">
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
                </DashboardPanel>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(310px,0.78fr)]">
                <DashboardPanel title="Weak Areas">
                  <div className="mt-4 h-[195px]">
                    {certificationWeakAreas.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center">
                          <p className="text-sm font-medium text-zinc-600">
                            No weak-area data yet
                          </p>

                          <p className="mt-1 text-xs text-zinc-400">
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
                </DashboardPanel>

                <DashboardPanel title="Accuracy by Difficulty">
                  {mockExamSegments.length === 0 ? (
                      <div className="flex h-[195px] flex-col items-center justify-center">
                        <p className="text-sm font-medium text-zinc-600">
                          No graded answers yet
                        </p>

                        <p className="mt-1 text-xs text-zinc-400">
                          Complete an assessment to see accuracy by difficulty.
                        </p>
                      </div>
                  ) : (
                      <div className="mt-2 grid min-h-[195px] items-center gap-3 sm:grid-cols-[115px_minmax(0,1fr)]">
                        <div className="h-[120px]">
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

                                  <span className="truncate text-xs text-zinc-600">
                            {segment.label}
                          </span>
                                </div>

                                <span className="shrink-0 text-xs font-semibold text-zinc-700">
                          {segment.value}%
                        </span>
                              </div>
                          ))}
                        </div>
                      </div>
                  )}
                </DashboardPanel>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(310px,0.78fr)]">
                <DashboardPanel title="Recommended Topics">
                  {(analytics?.recommendedTopics ?? []).length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No recommendations yet -- complete an assessment to get personalized suggestions.
                      </p>
                  ) : (
                      <div className="mt-4 space-y-2.5">
                        {analytics.recommendedTopics.map((recommendation) => (
                            <RecommendationCard
                                key={recommendation.lessonId}
                                recommendation={recommendation}
                            />
                        ))}
                      </div>
                  )}
                </DashboardPanel>

                <DashboardPanel title="Strongest Topics">
                  {(analytics?.strongestTopics ?? []).length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No strong topics identified yet.
                      </p>
                  ) : (
                      <div className="mt-4 space-y-3">
                        {analytics.strongestTopics.map((topic) => (
                            <StrongestTopicRow key={topic.lessonId} topic={topic} />
                        ))}
                      </div>
                  )}
                </DashboardPanel>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(310px,0.78fr)]">
                <DashboardPanel title="Category Mastery">
                  {(analytics?.categoryMastery ?? []).length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No category mastery data yet.
                      </p>
                  ) : (
                      <div className="mt-3 divide-y divide-border/60">
                        {analytics.categoryMastery.map((category) => (
                            <CategoryMasteryNode
                                key={`${category.categoryLevel}-${category.categoryId}`}
                                category={category}
                            />
                        ))}
                      </div>
                  )}
                </DashboardPanel>

                <DashboardPanel title="Recent Activity">
                  {(analytics?.recentActivity ?? []).length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No recent assessment or challenge activity yet.
                      </p>
                  ) : (
                      <div className="mt-3 divide-y divide-border/60">
                        {analytics.recentActivity.map((activity, index) => (
                            <RecentActivityRow
                                key={`${activity.activityType}-${activity.occurredAt}-${index}`}
                                activity={activity}
                            />
                        ))}
                      </div>
                  )}
                </DashboardPanel>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <DashboardPanel title="Performance by Question Type">
                  <PerformanceBreakdownList buckets={analytics?.performanceByQuestionType} />
                </DashboardPanel>

                <DashboardPanel title="Performance by Assessment Type">
                  <PerformanceBreakdownList buckets={analytics?.performanceByAssessmentType} />
                </DashboardPanel>
              </section>

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
