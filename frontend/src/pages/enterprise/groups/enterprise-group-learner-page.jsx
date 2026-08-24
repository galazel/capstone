import { useMemo } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookOpen,
  ClipboardListIcon,
  GaugeIcon,
  TargetIcon,
  SparklesIcon,
  TrendingDownIcon,
} from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  BarBreakdownChart,
  ChartEmpty,
  ChartPanel,
} from "@/components/charts/rebyu-charts.jsx"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterpriseStatCard,
} from "@/components/enterprise/enterprise-ui.jsx"
import {
  getGroupLearnerAnalytics,
  getGroupLearnerRoster,
} from "@/services/enterpriseService.js"

/**
 * Every figure on this page comes from ProgressAnalyticsService, which already
 * returns 0-100 percentages -- so these are used as-is. Nothing is rescaled:
 * treating a small value as a 0-1 fraction would turn a genuine 1% into 100%.
 */
function toPercent(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatPercent(value) {
  const percent = toPercent(value)
  return percent == null ? "—" : `${Math.round(percent)}%`
}

function TopicList({ title, description, icon: Icon, topics, tone }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon
            className={`size-4 ${tone === "weak" ? "text-destructive" : "text-primary"}`}
            aria-hidden="true"
          />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not enough assessment activity yet to rank topics.
          </p>
        ) : (
          <ul className="space-y-3">
            {topics.map((topic, index) => (
              <li key={topic.lessonId ?? index}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {topic.lessonTitle ?? `Topic ${index + 1}`}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatPercent(topic.masteryPercentage)}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, Math.max(0, toPercent(topic.masteryPercentage) ?? 0))}
                  className="mt-1.5 h-1.5"
                />
                {topic.categoryTitle ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {topic.categoryTitle}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * One learner's statistics, for the leader of the group they belong to. Reached
 * by clicking a row in the group's Learners tab. Read-only: this is a
 * monitoring view, so nothing here changes the learner's record.
 */
export default function EnterpriseGroupLearnerPage() {
  const { groupId, learnerId } = useParams()
  const navigate = useNavigate()
  const groupIdNumber = Number(groupId)
  const learnerIdNumber = Number(learnerId)

  // The roster already carries the learner's name, so this avoids a second
  // per-learner lookup just to title the page.
  const rosterQuery = useQuery({
    queryKey: ["group-learner-roster", groupIdNumber],
    queryFn: () => getGroupLearnerRoster(groupIdNumber),
    enabled: Number.isFinite(groupIdNumber),
  })

  const analyticsQuery = useQuery({
    queryKey: ["group-learner-analytics", groupIdNumber, learnerIdNumber],
    queryFn: () => getGroupLearnerAnalytics(groupIdNumber, learnerIdNumber),
    enabled: Number.isFinite(groupIdNumber) && Number.isFinite(learnerIdNumber),
    retry: 1,
  })

  const learner = (Array.isArray(rosterQuery.data) ? rosterQuery.data : []).find(
    (row) => row.learnerId === learnerIdNumber
  )
  const analytics = analyticsQuery.data

  const backToGroup = `/enterprise/groups/${groupId}?tab=learners`


  /* One bar per graded attempt, oldest first.
     `scoreTrend` already excludes the AI tutor's practice quizzes and
     flashcards -- the backend drops anything `tutorPracticeMarker` recognises
     before building it -- so this is the curriculum's own assessments only.
     Labelled by title and attempt number because a retake of the same exam is
     a different bar, and two bars reading "Mock Exam" would be unreadable. */
  const assessmentScores = useMemo(
    () =>
      (analytics?.scoreTrend ?? [])
        .filter((point) => point.percentage != null)
        .map((point) => ({
          label:
            point.attemptNumber && point.attemptNumber > 1
              ? `${point.examTitle ?? "Assessment"} (try ${point.attemptNumber})`
              : point.examTitle ?? "Assessment",
          score: Number(point.percentage),
        })),
    [analytics?.scoreTrend]
  )

  if (analyticsQuery.isLoading || rosterQuery.isLoading) {
    return (
      <div className="space-y-6">
        <EnterpriseLoadingSkeleton rows={4} />
      </div>
    )
  }

  if (analyticsQuery.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(backToGroup)}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to group
        </Button>
        <EnterpriseErrorState
          title="Unable to load this learner's statistics"
          description="They may no longer be assigned to this group."
          onRetry={analyticsQuery.refetch}
        />
      </div>
    )
  }

  const weakestTopics = analytics?.weakestTopics ?? []

  const completedLessons = analytics?.completedLessonCount ?? 0
  const totalLessons = analytics?.totalLessonCount ?? 0
  const passedAssessments = analytics?.passedAssessmentCount ?? 0
  const totalAssessments = analytics?.totalAssessmentCount ?? 0
  const totalAttempts = analytics?.totalAssessmentAttempts ?? 0

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(backToGroup)}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to group
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {learner?.name ?? "Learner"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {analytics?.certificationTitle ?? "Progress and performance"}
              {learner?.username ? ` · @${learner.username}` : ""}
            </p>
          </div>
          {analytics?.bktAvailable === false ? (
            <Badge variant="outline">Mastery data unavailable</Badge>
          ) : null}
        </div>
      </div>

      {!analytics?.hasAssessmentActivity && !analytics?.hasChallengeActivity ? (
        <EnterpriseEmptyState
          icon={SparklesIcon}
          title="No activity yet"
          description="This learner has not attempted an assessment or challenge yet, so there is nothing to report."
        />
      ) : null}

      {/* Four figures: curriculum progress, assessments passed, average score,
          readiness. Average score and the assessment counts are returned by
          this endpoint (`averageAssessmentScore`, `passedAssessmentCount`,
          `totalAssessmentCount`) and were being dropped on the floor -- nothing
          on the page read them.

          Confidence and overall mastery used to sit here too, alongside a
          meter card and a three-gauge row that restated readiness and
          curriculum completion a second and third time. One figure, stated
          once. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EnterpriseStatCard
          icon={BookOpen}
          label="Lessons completed"
          value={`${completedLessons}/${totalLessons}`}
          hint={
            totalLessons
              ? `${Math.round(((completedLessons / totalLessons) * 100 + Number.EPSILON) * 10) / 10}% of the curriculum`
              : "No lessons in this certification yet"
          }
        />
        <EnterpriseStatCard
          icon={ClipboardListIcon}
          label="Assessments passed"
          value={`${passedAssessments}/${totalAssessments}`}
          hint={
            totalAssessments
              ? `${totalAttempts} attempt${totalAttempts === 1 ? "" : "s"} on this certification`
              : "No published assessments yet"
          }
        />
        <EnterpriseStatCard
          icon={TargetIcon}
          label="Average score"
          /* Across graded attempts, not across assessments: an unattempted
             assessment has no score to average in, and counting it as zero
             would report a failure that has not happened. */
          value={formatPercent(analytics?.averageAssessmentScore)}
          hint={
            totalAttempts
              ? `Mean of ${totalAttempts} graded attempt${totalAttempts === 1 ? "" : "s"}`
              : "No graded attempt yet"
          }
        />
        <EnterpriseStatCard
          icon={GaugeIcon}
          label="Readiness"
          value={formatPercent(analytics?.readinessPercentage)}
          hint="Weighted likelihood of passing"
        />
      </div>

      <TopicList
        title="Weakest topics"
        description="Where this learner needs the most help — lowest mastery first."
        icon={TrendingDownIcon}
        topics={weakestTopics}
        tone="weak"
      />

      <ChartPanel
        title="score on every assessment"
        subtitle={
          analytics?.averageAssessmentScore == null
            ? "Each graded attempt on this certification, oldest first. Practice the learner generated in the AI tutor is not counted."
            : `Each graded attempt on this certification, oldest first — averaging ${formatPercent(analytics.averageAssessmentScore)}. Practice the learner generated in the AI tutor is not counted.`
        }
        footnote={
          assessmentScores.length
            ? "Bars at or above the 75% line are passes at the usual threshold."
            : undefined
        }
      >
        {assessmentScores.length === 0 ? (
          <ChartEmpty message="No assessment has been graded yet." />
        ) : (
          <BarBreakdownChart
            data={assessmentScores}
            categoryKey="label"
            valueKey="score"
            unit="%"
            target={75}
            height={Math.max(220, assessmentScores.length * 38)}
            categoryWidth={150}
          />
        )}
      </ChartPanel>

      <p className="text-xs text-muted-foreground">
        Monitoring view only.{" "}
        <Link to={backToGroup} className="font-medium text-primary hover:underline">
          Back to this group&apos;s learners
        </Link>
        .
      </p>
    </div>
  )
}
