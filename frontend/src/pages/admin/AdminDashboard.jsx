import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  AwardIcon,
  Building2Icon,
  ClipboardListIcon,
  HandshakeIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatCard,
  EnterpriseStatusBadge,
  formatDateTime,
} from "@/components/enterprise/enterprise-ui.jsx"
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EnterpriseStatCard
          icon={UsersIcon}
          label="Total learners"
          value={learnersQuery.isError ? "—" : stats.learners}
        />
        <EnterpriseStatCard
          icon={Building2Icon}
          label="Organizations"
          value={enterprisesQuery.isError ? "—" : stats.enterprises}
        />
        <EnterpriseStatCard
          icon={AwardIcon}
          label="Certifications"
          value={certificationsQuery.isError ? "—" : stats.certifications}
        />
        <EnterpriseStatCard
          icon={HandshakeIcon}
          label="Pending partnerships"
          value={partnershipsQuery.isError ? "—" : stats.pendingPartnerships}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EnterpriseStatCard
          label="Active enrollments"
          value={enrollmentsQuery.isError ? "—" : stats.enrollments}
          hint="Learner certification enrollments with active status"
        />
        <EnterpriseStatCard
          icon={ClipboardListIcon}
          label="Assessment attempts"
          value={resultsQuery.isError ? "—" : stats.attempts}
          hint="Total recorded exam results"
        />
        <EnterpriseStatCard
          label="Average score"
          value={
            resultsQuery.isError || stats.avgScore == null
              ? "—"
              : `${stats.avgScore}%`
          }
          hint="Average score across recorded assessment results"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent partnership requests</CardTitle>
            <CardDescription>
              Latest requests from organizations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentPartnerships.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No partnership requests yet.
              </p>
            ) : (
              <ul className="divide-y">
                {stats.recentPartnerships.map((request) => (
                  <li
                    key={request.requestId}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        Request #{request.requestId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(request.submittedAt)}
                      </p>
                    </div>
                    <EnterpriseStatusBadge status={request.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent assessment activity</CardTitle>
            <CardDescription>Latest recorded exam results.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No assessment attempts recorded yet.
              </p>
            ) : (
              <ul className="divide-y">
                {stats.recentResults.map((result) => (
                  <li
                    key={`${result.learnerId}-${result.examId}-${result.attemptNo}`}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        Learner #{result.learnerId} · Exam #{result.examId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Attempt {result.attemptNo} ·{" "}
                        {formatDateTime(result.takenAt)}
                      </p>
                    </div>
                    <span
                      className={
                        result.isPassed
                          ? "font-medium tabular-nums text-primary"
                          : "font-medium tabular-nums text-destructive"
                      }
                    >
                      {Number(result.score ?? 0).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">Manage certifications</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/question-bank">Question bank</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/learners">Learners</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/organizations">Organizations</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
