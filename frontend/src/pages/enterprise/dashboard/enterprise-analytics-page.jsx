import { useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { BarChart3Icon } from "@/components/icons"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatCard,
} from "@/components/enterprise/enterprise-ui.jsx"
import {
  BarBreakdownChart,
  ChartPanel,
  DonutChart,
  TrendAreaChart,
} from "@/components/charts/rebyu-charts.jsx"
import {
  ENTERPRISE_ACTIVITY_TREND,
  ENTERPRISE_GROUP_PROGRESS,
} from "@/components/charts/sample-data.js"
import {
  getLearnerDisplayName,
  useEnterpriseData,
} from "@/hooks/use-enterprise-data.js"

const PROGRESS_BUCKETS = [
  { label: "0–25%", min: 0, max: 25 },
  { label: "26–50%", min: 26, max: 50 },
  { label: "51–75%", min: 51, max: 75 },
  { label: "76–100%", min: 76, max: 100 },
]

export default function EnterpriseAnalyticsPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const data = useEnterpriseData(enterprise?.enterpriseId)
  const [certFilter, setCertFilter] = useState("all")

  const scoped = useMemo(() => {
    let assignments = data.assignments
    if (certFilter !== "all") {
      const orgCertIds = data.orgCerts
        .filter((cert) => String(cert.certificationId) === certFilter)
        .map((cert) => cert.orgCertId)
      assignments = assignments.filter((assignment) =>
        orgCertIds.includes(assignment.orgCertId)
      )
    }
    const progresses = assignments.map((assignment) =>
      Number(assignment.progressPercentage ?? 0)
    )
    const average =
      progresses.length > 0
        ? progresses.reduce((sum, value) => sum + value, 0) / progresses.length
        : null
    const needingSupport = assignments.filter(
      (assignment) =>
        assignment.status === "active" &&
        Number(assignment.progressPercentage ?? 0) < 30
    )
    const completed = assignments.filter(
      (assignment) => assignment.status === "completed"
    )
    const buckets = PROGRESS_BUCKETS.map((bucket) => ({
      ...bucket,
      count: progresses.filter(
        (value) => value >= bucket.min && value <= bucket.max
      ).length,
    }))
    return { assignments, average, needingSupport, completed, buckets }
  }, [data, certFilter])

  if (enterpriseLoading || (enterprise && data.isLoading)) {
    return <EnterpriseLoadingSkeleton />
  }
  if (enterpriseError) {
    return <EnterpriseErrorState onRetry={refetchEnterprise} />
  }
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Cohort analytics appear here once your organization is registered."
      />
    )
  }
  if (data.isError) {
    return (
      <div className="space-y-6">
        <EnterprisePageHeader
          title="Analytics"
          subtitle="Cohort progress across your certification programs."
        />
        <EnterpriseErrorState onRetry={data.refetchAll} />
      </div>
    )
  }

  const certificationOptions = [
    ...new Map(
      data.orgCerts.map((orgCert) => [
        orgCert.certificationId,
        data.certificationById.get(orgCert.certificationId)?.title ??
          `Certification #${orgCert.certificationId}`,
      ])
    ).entries(),
  ]

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Analytics"
        subtitle="Cohort progress across your certification programs."
        actions={
          <Select value={certFilter} onValueChange={setCertFilter}>
            <SelectTrigger className="w-[220px]" aria-label="Certification">
              <SelectValue placeholder="Certification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All certifications</SelectItem>
              {certificationOptions.map(([id, title]) => (
                <SelectItem key={id} value={String(id)}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {scoped.assignments.length === 0 ? (
        <EnterpriseEmptyState
          icon={BarChart3Icon}
          title="No learner data yet"
          description="Analytics appear once learners are assigned to your certifications and begin studying."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <EnterpriseStatCard
              tone="macaw"
              label="Learners"
              value={scoped.assignments.length}
            />
            <EnterpriseStatCard
              tone="feather"
              label="Average progress"
              value={
                scoped.average != null
                  ? `${scoped.average.toFixed(0)}%`
                  : "—"
              }
            />
            <EnterpriseStatCard
              tone="bee"
              label="Completed"
              value={scoped.completed.length}
            />
            <EnterpriseStatCard
              tone="fox"
              label="Needing support"
              value={scoped.needingSupport.length}
              hint="Active learners below 30% progress"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Real cohort data — the buckets were already computed, they were
                just drawn as four unrelated progress bars. */}
            <ChartPanel
              title="Completion distribution"
              subtitle="How learner progress is spread across the cohort"
            >
              <DonutChart
                data={scoped.buckets.map((bucket) => ({
                  name: bucket.label,
                  value: bucket.count,
                }))}
                centerValue={scoped.assignments.length}
                centerLabel="learners"
              />
            </ChartPanel>

            <Card>
              <CardHeader>
                <CardTitle>Learners needing support</CardTitle>
                <CardDescription>
                  Active learners with the lowest recorded progress.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scoped.needingSupport.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No learners currently flagged. Great work!
                  </p>
                ) : (
                  <ul className="divide-y">
                    {scoped.needingSupport.slice(0, 8).map((assignment) => {
                      const learner = data.learnerById.get(
                        assignment.learnerId
                      )
                      return (
                        <li
                          key={assignment.orgCertLearnerId}
                          className="flex items-center justify-between gap-2 py-2.5 text-sm"
                        >
                          <span className="truncate font-medium">
                            {getLearnerDisplayName(learner)}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {Number(
                              assignment.progressPercentage ?? 0
                            ).toFixed(0)}
                            %
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trend surfaces the current endpoints cannot answer yet — shown on
              placeholder series so the layout can be judged now. */}
          <section className="space-y-4">
            <div>
              <h2 className="font-rb-display text-xl font-extrabold lowercase">
                trends over time
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Layout preview — the assignment endpoint returns a snapshot, so these
                plots run on placeholder numbers until history is exposed.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Weekly activity" subtitle="Completed items per week" sample>
                <TrendAreaChart
                  data={ENTERPRISE_ACTIVITY_TREND}
                  xKey="week"
                  series={[
                    { key: "lessons", name: "Lessons" },
                    { key: "practice", name: "Practice" },
                    { key: "assessments", name: "Assessments" },
                  ]}
                  legendNote="Latest week"
                />
              </ChartPanel>

              <ChartPanel title="Completion by group" subtitle="Share of assigned work done" sample>
                <BarBreakdownChart
                  data={ENTERPRISE_GROUP_PROGRESS}
                  categoryKey="group"
                  valueKey="completion"
                  unit="%"
                  target={60}
                />
              </ChartPanel>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
