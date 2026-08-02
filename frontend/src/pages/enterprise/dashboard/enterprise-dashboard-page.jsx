import { Link, useOutletContext } from "react-router-dom"
import {
  BadgeCheckIcon,
  GraduationCapIcon,
  MailPlusIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatCard,
  EnterpriseStatusBadge,
  formatDateTime,
} from "@/components/enterprise/enterprise-ui.jsx"
import {
  getLearnerDisplayName,
  useEnterpriseData,
} from "@/hooks/use-enterprise-data.js"

export default function EnterpriseDashboardPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const data = useEnterpriseData(enterprise?.enterpriseId)

  if (enterpriseLoading || (enterprise && data.isLoading)) {
    return <EnterpriseLoadingSkeleton />
  }

  if (enterpriseError) {
    return (
      <EnterpriseErrorState
        title="Unable to load your organization"
        onRetry={refetchEnterprise}
      />
    )
  }

  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Once your organization is registered with REBYU, its dashboard will appear here."
      />
    )
  }

  const totalSlots = data.orgCerts.reduce(
    (sum, cert) => sum + (cert.totalSlots ?? 0),
    0
  )
  const usedSlots = data.orgCerts.reduce(
    (sum, cert) => sum + (cert.usedSlots ?? 0),
    0
  )
  const remainingSlots = Math.max(totalSlots - usedSlots, 0)

  const activeLearners = data.assignments.filter(
    (assignment) => assignment.status === "active"
  )
  const averageProgress = activeLearners.length
    ? activeLearners.reduce(
        (sum, assignment) => sum + Number(assignment.progressPercentage ?? 0),
        0
      ) / activeLearners.length
    : null

  const recentInvitations = [...data.invitations]
    .sort((a, b) => new Date(b.sentAt ?? 0) - new Date(a.sentAt ?? 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title={enterprise.enterpriseName}
        subtitle="Overview of your organization's certifications, learners, and invitations."
        actions={
          <div className="flex items-center gap-2">
            {enterprise.isVerified ? (
              <Badge variant="default" className="gap-1">
                <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary">Verification pending</Badge>
            )}
          </div>
        }
      />

      {data.isError ? (
        <EnterpriseErrorState onRetry={data.refetchAll} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <EnterpriseStatCard
              icon={GraduationCapIcon}
              label="Active certifications"
              value={data.orgCerts.filter((c) => c.status === "active").length}
              hint={`${data.orgCerts.length} allocation(s) in total`}
            />
            <EnterpriseStatCard
              icon={TicketIcon}
              label="Learner slots"
              value={`${usedSlots} / ${totalSlots}`}
              hint={`${remainingSlots} slot(s) remaining`}
            />
            <EnterpriseStatCard
              icon={UsersIcon}
              label="Active learners"
              value={activeLearners.length}
              hint={
                averageProgress != null
                  ? `Average progress ${averageProgress.toFixed(0)}%`
                  : "No learner progress recorded yet"
              }
            />
            <EnterpriseStatCard
              icon={MailPlusIcon}
              label="Pending invitations"
              value={
                data.invitations.filter((inv) => inv.status === "PENDING")
                  .length
              }
              hint={`${data.invitations.length} invitation(s) sent overall`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Certification allocations</CardTitle>
                <CardDescription>
                  Slot usage per certification your organization has access to.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.orgCerts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No certification allocations yet. Submit a partnership
                    request to get started.
                  </p>
                ) : (
                  data.orgCerts.map((orgCert) => {
                    const certification = data.certificationById.get(
                      orgCert.certificationId
                    )
                    const used = orgCert.usedSlots ?? 0
                    const total = orgCert.totalSlots ?? 0
                    const pct = total > 0 ? (used / total) * 100 : 0
                    return (
                      <div key={orgCert.orgCertId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">
                            {certification?.title ??
                              `Certification #${orgCert.certificationId}`}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {used} / {total} slots
                          </span>
                        </div>
                        <Progress value={pct} aria-label="Slot usage" />
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent invitations</CardTitle>
                <CardDescription>
                  The latest learner invitations sent by your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentInvitations.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No invitations sent yet.
                    <div className="mt-3">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/enterprise/certifications">
                          Invite a learner
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {recentInvitations.map((invitation) => (
                      <li
                        key={invitation.invitationId}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {invitation.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Sent {formatDateTime(invitation.sentAt)}
                          </p>
                        </div>
                        <EnterpriseStatusBadge status={invitation.status} />
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
                <Link to="/enterprise/certifications">Invite learners</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/enterprise/learners">View learners</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/enterprise/partnership">Partnership requests</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/enterprise/billing">Billing</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
