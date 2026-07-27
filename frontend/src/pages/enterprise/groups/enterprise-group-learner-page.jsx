import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookOpen,
  GaugeIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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

/** A labelled bar. Used for every 0-100 figure on this page so they read alike. */
function MeterRow({ label, value, hint }) {
  const percent = toPercent(value)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {percent == null ? "—" : `${Math.round(percent)}%`}
        </span>
      </div>
      <Progress value={percent == null ? 0 : Math.min(100, Math.max(0, percent))} className="mt-2 h-2" />
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
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
  const strongestTopics = analytics?.strongestTopics ?? []
  const completedLessons = analytics?.completedLessonCount ?? 0
  const totalLessons = analytics?.totalLessonCount ?? 0

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
          icon={GaugeIcon}
          label="Readiness"
          value={formatPercent(analytics?.readinessPercentage)}
          hint="Weighted likelihood of passing"
        />
        <EnterpriseStatCard
          icon={SparklesIcon}
          label="Confidence"
          value={formatPercent(analytics?.confidencePercentage)}
          hint="Self-reported vs measured"
        />
        <EnterpriseStatCard
          icon={TrendingUpIcon}
          label="Overall mastery"
          value={formatPercent(analytics?.overallMasteryPercentage)}
          hint={`${analytics?.masteredTopicCount ?? 0} mastered · ${analytics?.weakTopicCount ?? 0} weak`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress against the curriculum</CardTitle>
          <CardDescription>
            How far through this certification the learner is, and how ready they are for it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <MeterRow
            label="Curriculum completed"
            value={analytics?.completionPercentage}
            hint={`${completedLessons} of ${totalLessons} lesson${totalLessons === 1 ? "" : "s"}`}
          />
          <MeterRow
            label="Readiness"
            value={analytics?.readinessPercentage}
          />
          <MeterRow
            label="Confidence"
            value={analytics?.confidencePercentage}
          />
          {analytics?.unassessedTopicCount ? (
            <p className="text-xs text-muted-foreground">
              {analytics.unassessedTopicCount} topic
              {analytics.unassessedTopicCount === 1 ? " has" : "s have"} not been assessed yet, so
              mastery for {analytics.unassessedTopicCount === 1 ? "it" : "them"} is unknown.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopicList
          title="Weakest topics"
          description="Where this learner needs the most help — lowest mastery first."
          icon={TrendingDownIcon}
          topics={weakestTopics}
          tone="weak"
        />
        <TopicList
          title="Strongest topics"
          description="Already mastered — safe to move past in review sessions."
          icon={TrendingUpIcon}
          topics={strongestTopics}
          tone="strong"
        />
      </div>

      {analytics?.categoryMastery?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mastery by category</CardTitle>
            <CardDescription>
              Average mastery across each major area of the curriculum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {analytics.categoryMastery.map((category, index) => (
                <li key={category.categoryId ?? index}>
                  <MeterRow
                    label={category.title ?? `Category ${index + 1}`}
                    value={category.masteryPercentage}
                    hint={
                      category.totalLessonCount
                        ? `${category.completedLessonCount ?? 0} of ${category.totalLessonCount} lesson${
                            category.totalLessonCount === 1 ? "" : "s"
                          } completed${category.masteryLevel ? ` · ${category.masteryLevel}` : ""}`
                        : category.masteryLevel ?? undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
