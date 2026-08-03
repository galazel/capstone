import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AwardIcon,
  Building2Icon,
  ClipboardListIcon,
  HandshakeIcon,
  UsersIcon,
} from "@/components/icons"

import {
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
  formatDateTime,
} from "@/components/enterprise/enterprise-ui.jsx"
import { BentoGrid, BentoHeading, BentoStat, BentoTile } from "@/components/commons/bento.jsx"
import {
  BarBreakdownChart,
  DonutChart,
  SampleChip,
  TrendAreaChart,
  TrendLineChart,
} from "@/components/charts/rebyu-charts.jsx"
import {
  ADMIN_ATTEMPT_VOLUME,
  ADMIN_ENROLLMENT_MIX,
  ADMIN_GROWTH_TREND,
  ADMIN_PASS_RATE_BY_CERT,
} from "@/components/charts/sample-data.js"
import { base } from "@/services/base"

function useList(key, endpoint) {
  return useQuery({
    queryKey: [key],
    queryFn: () => base(endpoint),
    retry: 1,
  })
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export default function AdminDashboard() {
  const learnersQuery = useList("learners", "learners")
  const enterprisesQuery = useList("enterprises", "enterprises")
  const certificationsQuery = useList("certifications", "certifications")
  const partnershipsQuery = useList(
    "partnership-requests",
    "partnership-requests"
  )
  const enrollmentsQuery = useList(
    "learner-certifications",
    "learner-certifications"
  )
  const resultsQuery = useList("exam-results", "exam-results")

  const queries = [
    learnersQuery,
    enterprisesQuery,
    certificationsQuery,
    partnershipsQuery,
    enrollmentsQuery,
    resultsQuery,
  ]
  const isLoading = queries.some((query) => query.isLoading)
  const allFailed = queries.every((query) => query.isError)

  const stats = useMemo(() => {
    const partnerships = asArray(partnershipsQuery.data)
    const results = asArray(resultsQuery.data)
    const scored = results.filter((row) =>
      Number.isFinite(Number(row.score ?? row.percentage))
    )
    const avgScore = scored.length
      ? Math.round(
          scored.reduce((sum, row) => sum + Number(row.score ?? row.percentage), 0) /
            scored.length
        )
      : null
    return {
      learners: asArray(learnersQuery.data).length,
      enterprises: asArray(enterprisesQuery.data).length,
      certifications: asArray(certificationsQuery.data).length,
      pendingPartnerships: partnerships.filter(
        (request) =>
          request.status === "PENDING" || request.status === "UNDER_REVIEW"
      ).length,
      enrollments: asArray(enrollmentsQuery.data).filter(
        (enrollment) => enrollment.status === "active"
      ).length,
      attempts: results.length,
      avgScore,
      recentPartnerships: [...partnerships]
        .sort(
          (a, b) => new Date(b.submittedAt ?? 0) - new Date(a.submittedAt ?? 0)
        )
        .slice(0, 5),
      recentResults: [...results]
        .sort((a, b) => new Date(b.takenAt ?? 0) - new Date(a.takenAt ?? 0))
        .slice(0, 6),
    }
  }, [
    learnersQuery.data,
    enterprisesQuery.data,
    certificationsQuery.data,
    partnershipsQuery.data,
    enrollmentsQuery.data,
    resultsQuery.data,
  ])

  if (isLoading) return <EnterpriseLoadingSkeleton />

  if (allFailed) {
    return (
      <div className="space-y-6">
        <EnterprisePageHeader
          title="Dashboard"
          subtitle="Platform overview across learners, organizations, and certifications."
        />
        <EnterpriseErrorState
          title="Unable to load platform data"
          description="The dashboard could not reach the REBYU backend. Check that the API is running."
          onRetry={() => queries.forEach((query) => query.refetch())}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Dashboard"
        subtitle="Platform overview across learners, organizations, and certifications."
      />

      {/* Bento: tile size carries importance, and the counters are colour-blocked
          so the eye lands on them first. Composed in bands of six columns —
          2+4, then 4+[1+1]+2, then 2+4, then 2+2+2, then a full-width 6 — so no
          band leaves a hole and the widths alternate down the page. Chart panels
          are fed from components/charts/sample-data.js and chipped "sample
          data" — swap each for its named endpoint. */}
      <BentoGrid>
        {/* Band 1 — 2 + 4 */}
        <BentoStat
          tone="macaw"
          col={2}
          row={2}
          icon={UsersIcon}
          label="Total learners"
          value={learnersQuery.isError ? "—" : stats.learners.toLocaleString()}
          hint={`${stats.enrollments.toLocaleString()} active enrollments`}
        />

        <BentoTile col={4} row={2}>
          <BentoHeading
            title="Platform growth"
            hint="Registered learners per month"
            chip={<SampleChip />}
          />
          <TrendLineChart
            data={ADMIN_GROWTH_TREND}
            xKey="month"
            series={[{ key: "learners", name: "Learners" }]}
            domain={[0, 2000]}
            height={168}
            legendNote="Latest month"
          />
        </BentoTile>

        {/* Band 2 — a wide chart beside a stack of counters: 4 + [1 + 1] + 2 */}
        <BentoTile col={4} row={2}>
          <BentoHeading
            title="Attempt volume"
            hint="Practice runs and assessments per month"
            chip={<SampleChip />}
          />
          <TrendAreaChart
            data={ADMIN_ATTEMPT_VOLUME}
            xKey="month"
            series={[
              { key: "practice", name: "Practice" },
              { key: "assessments", name: "Assessments" },
            ]}
            height={160}
            legendNote="Latest month"
          />
        </BentoTile>

        <BentoStat
          tone="bee"
          col={1}
          row={1}
          icon={Building2Icon}
          label="Orgs"
          value={enterprisesQuery.isError ? "—" : stats.enterprises}
        />
        <BentoStat
          tone="feather"
          col={1}
          row={1}
          icon={AwardIcon}
          label="Certs"
          value={certificationsQuery.isError ? "—" : stats.certifications}
        />
        <BentoStat
          tone="fox"
          col={2}
          row={1}
          icon={HandshakeIcon}
          label="Pending partnerships"
          value={partnershipsQuery.isError ? "—" : stats.pendingPartnerships}
          hint="Awaiting review or a meeting"
        />

        {/* Band 3 — 2 + 4, mirrored against band 1 */}
        <BentoTile col={2} row={2}>
          <BentoHeading
            title="Enrollment mix"
            hint="Active enrollments by track"
            chip={<SampleChip />}
          />
          <DonutChart
            data={ADMIN_ENROLLMENT_MIX}
            height={168}
            centerValue="1,516"
            centerLabel="enrollments"
          />
        </BentoTile>

        <BentoTile col={4} row={2}>
          <BentoHeading
            title="Pass rate by certification"
            hint="Share of attempts that cleared the cut score"
            chip={<SampleChip />}
          />
          <BarBreakdownChart
            data={ADMIN_PASS_RATE_BY_CERT}
            categoryKey="certification"
            valueKey="passRate"
            unit="%"
            target={60}
            height={180}
            categoryWidth={110}
          />
        </BentoTile>

        {/* Band 4 — three equal thirds: a feed, a chart, and a counter */}
        <BentoTile col={2} row={2} className="!p-0">
          <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
            <BentoHeading
              title="Recent partnership requests"
              hint="Latest requests from organizations."
            />

            {stats.recentPartnerships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No partnership requests yet.</p>
            ) : (
              <ul className="-mr-2 min-h-0 flex-1 divide-y-2 divide-border overflow-y-auto pr-2">
                {stats.recentPartnerships.map((request) => (
                  <li
                    key={request.requestId}
                    className="flex items-center justify-between gap-2 py-3 text-sm first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">Request #{request.requestId}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(request.submittedAt)}
                      </p>
                    </div>
                    <EnterpriseStatusBadge status={request.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </BentoTile>

        <BentoTile col={2} row={2}>
          <BentoHeading
            title="Organizations onboarded"
            hint="Partner institutions per month"
            chip={<SampleChip />}
          />
          <TrendLineChart
            data={ADMIN_GROWTH_TREND}
            xKey="month"
            series={[{ key: "enterprises", name: "Organizations" }]}
            domain={[0, 30]}
            height={150}
            legendNote="Latest month"
          />
        </BentoTile>

        <BentoStat
          tone="beetle"
          col={2}
          row={2}
          icon={ClipboardListIcon}
          label="Assessment attempts"
          value={resultsQuery.isError ? "—" : stats.attempts.toLocaleString()}
          hint={
            resultsQuery.isError || stats.avgScore == null
              ? "No scores recorded"
              : `Average score ${stats.avgScore}%`
          }
        />

        {/* Band 5 — full width closes the page */}
        <BentoTile col={6} row={2} className="!p-0">
          <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
            <BentoHeading
              title="Recent assessment activity"
              hint="Latest recorded exam results."
            />

            {stats.recentResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assessment attempts recorded yet.
              </p>
            ) : (
              /* Full width would strand a single column of rows in white space,
                 so the feed splits into two tracks once there is room. */
              <ul className="-mr-2 grid min-h-0 flex-1 grid-cols-1 content-start gap-x-6 overflow-y-auto pr-2 lg:grid-cols-2">
                {stats.recentResults.map((result) => (
                  <li
                    key={`${result.learnerId}-${result.examId}-${result.attemptNo}`}
                    className="flex items-center justify-between gap-2 border-b-2 border-border py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        Learner #{result.learnerId} · Exam #{result.examId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Attempt {result.attemptNo} · {formatDateTime(result.takenAt)}
                      </p>
                    </div>
                    <span
                      className={
                        result.isPassed
                          ? "font-bold tabular-nums text-primary"
                          : "font-bold tabular-nums text-destructive"
                      }
                    >
                      {Number(result.score ?? 0).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </BentoTile>
      </BentoGrid>
    </div>
  )
}
