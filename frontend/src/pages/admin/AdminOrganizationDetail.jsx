import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, AwardIcon, Building2Icon, UsersIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatCard,
  EnterpriseStatusBadge,
  formatDate,
} from "@/components/enterprise/enterprise-ui.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import { getAllLearners } from "@/services/adminLearnerService.js"
import {
  getAllOrganizationCertificates,
  getAllOrganizationCertificationLearners,
  getEnterpriseById,
} from "@/services/enterpriseService.js"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function getLearnerDisplayName(learner) {
  if (!learner) return "Unknown learner"
  const full = [learner.firstName, learner.lastName].filter(Boolean).join(" ")
  return full || learner.username || `Learner #${learner.learnerId}`
}

export default function AdminOrganizationDetail() {
  const { id } = useParams()
  const enterpriseId = Number(id)

  const enterpriseQuery = useQuery({
    queryKey: ["admin-enterprise", enterpriseId],
    queryFn: () => getEnterpriseById(enterpriseId),
    enabled: Number.isFinite(enterpriseId),
    retry: 1,
  })

  const orgCertsQuery = useQuery({
    queryKey: ["admin-organization-certificates"],
    queryFn: getAllOrganizationCertificates,
    staleTime: 60_000,
  })

  const orgCertLearnersQuery = useQuery({
    queryKey: ["admin-organization-certification-learners"],
    queryFn: getAllOrganizationCertificationLearners,
    staleTime: 60_000,
  })

  const certificationsQuery = useQuery({
    queryKey: ["certifications-full"],
    queryFn: getAllCertifications,
    staleTime: 5 * 60 * 1000,
  })

  const learnersQuery = useQuery({
    queryKey: ["admin-learners"],
    queryFn: getAllLearners,
    staleTime: 60_000,
  })

  const isLoading =
    enterpriseQuery.isLoading ||
    orgCertsQuery.isLoading ||
    orgCertLearnersQuery.isLoading ||
    certificationsQuery.isLoading ||
    learnersQuery.isLoading

  const enterprise = enterpriseQuery.data

  const certificationById = useMemo(
    () => new Map(asArray(certificationsQuery.data).map((c) => [c.certificationId, c])),
    [certificationsQuery.data]
  )

  const learnerById = useMemo(
    () => new Map(asArray(learnersQuery.data).map((l) => [l.learnerId, l])),
    [learnersQuery.data]
  )

  const orgCerts = useMemo(
    () =>
      asArray(orgCertsQuery.data).filter(
        (orgCert) => orgCert.enterpriseId === enterpriseId
      ),
    [orgCertsQuery.data, enterpriseId]
  )

  const orgCertIds = useMemo(
    () => new Set(orgCerts.map((c) => c.orgCertId)),
    [orgCerts]
  )

  const orgCertLearners = useMemo(
    () =>
      asArray(orgCertLearnersQuery.data).filter((row) =>
        orgCertIds.has(row.orgCertId)
      ),
    [orgCertLearnersQuery.data, orgCertIds]
  )

  const orgCertById = useMemo(
    () => new Map(orgCerts.map((c) => [c.orgCertId, c])),
    [orgCerts]
  )

  const distinctLearnerCount = useMemo(
    () => new Set(orgCertLearners.map((row) => row.learnerId)).size,
    [orgCertLearners]
  )

  if (isLoading) return <EnterpriseLoadingSkeleton />

  if (enterpriseQuery.isError || !enterprise) {
    return (
      <div className="space-y-6">
        <Link
          to="/admin/organizations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to Organizations
        </Link>
        <EnterpriseErrorState onRetry={enterpriseQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back to Organizations
      </Link>

      <EnterprisePageHeader
        title={enterprise.enterpriseName}
        subtitle={`${enterprise.industry ?? "General"} · ${
          enterprise.primaryContactName ?? "No contact assigned"
        }`}
        actions={<EnterpriseStatusBadge status={enterprise.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EnterpriseStatCard
          icon={UsersIcon}
          label="Enrolled learners"
          value={distinctLearnerCount}
        />
        <EnterpriseStatCard
          icon={AwardIcon}
          label="Certification allocations"
          value={orgCerts.length}
        />
        <EnterpriseStatCard
          icon={Building2Icon}
          label="Primary contact"
          value={enterprise.primaryContactName ?? "—"}
          hint={enterprise.primaryContactEmail}
        />
        <EnterpriseStatCard label="Joined" value={formatDate(enterprise.joinedAt)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Certifications</CardTitle>
          <CardDescription>
            Slot allocations this organization has purchased access to.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orgCerts.length === 0 ? (
            <EnterpriseEmptyState
              icon={AwardIcon}
              title="No certification allocations"
              description="This organization has no active partnership allocations yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certification</TableHead>
                  <TableHead>Slot usage</TableHead>
                  <TableHead>Access period</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgCerts.map((orgCert) => {
                  const certification = certificationById.get(orgCert.certificationId)
                  const used = orgCert.usedSlots ?? 0
                  const total = orgCert.totalSlots ?? 0
                  return (
                    <TableRow key={orgCert.orgCertId}>
                      <TableCell className="font-medium">
                        {certification?.title ?? `Certification #${orgCert.certificationId}`}
                      </TableCell>
                      <TableCell className="w-56">
                        <div className="space-y-1">
                          <Progress value={total > 0 ? (used / total) * 100 : 0} />
                          <p className="text-xs text-muted-foreground">
                            {used} / {total} slots used
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(orgCert.accessStartDate)} –{" "}
                        {formatDate(orgCert.accessExpiryDate)}
                      </TableCell>
                      <TableCell>
                        <EnterpriseStatusBadge status={orgCert.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learners ({orgCertLearners.length})</CardTitle>
          <CardDescription>
            Every learner enrolled in one of this organization's certifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orgCertLearners.length === 0 ? (
            <EnterpriseEmptyState
              icon={UsersIcon}
              title="No learners yet"
              description="Learners appear here once they accept an invitation to this organization."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Certification</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgCertLearners.map((row) => {
                  const orgCert = orgCertById.get(row.orgCertId)
                  const certification = orgCert
                    ? certificationById.get(orgCert.certificationId)
                    : null
                  return (
                    <TableRow key={row.orgCertLearnerId}>
                      <TableCell className="font-medium">
                        {getLearnerDisplayName(learnerById.get(row.learnerId))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {certification?.title ?? "—"}
                      </TableCell>
                      <TableCell className="w-40">
                        <div className="space-y-1">
                          <Progress value={Number(row.progressPercentage ?? 0)} />
                          <p className="text-xs text-muted-foreground">
                            {Number(row.progressPercentage ?? 0).toFixed(0)}%
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <EnterpriseStatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
