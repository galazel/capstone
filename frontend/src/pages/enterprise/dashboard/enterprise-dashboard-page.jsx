import { Link, useOutletContext } from "react-router-dom"
import {
  BadgeCheckIcon,
  GraduationCapIcon,
  MailPlusIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  EnterpriseEmptyState,
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
  ENTERPRISE_ACTIVITY_TREND,
  ENTERPRISE_COMPLETION_MIX,
  ENTERPRISE_GROUP_PROGRESS,
  ENTERPRISE_SEAT_TREND,
} from "@/components/charts/sample-data.js"
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
        /* Bento: tile size carries importance, counters are colour-blocked, and
           the invitation feed sits in a tall right rail. Chart panels are fed
           from components/charts/sample-data.js and chipped "sample data" —
           swap each for its named endpoint. */
        <BentoGrid>
          <BentoStat
            tone="bee"
            col={2}
            row={2}
            icon={TicketIcon}
            label="Learner slots"
            value={`${usedSlots} / ${totalSlots}`}
            hint={`${remainingSlots} slot(s) remaining`}
          />

          <BentoTile col={4} row={2}>
            <BentoHeading
              title="Seat usage"
              hint="Assigned against actually active"
              chip={<SampleChip />}
            />
            <TrendLineChart
              data={ENTERPRISE_SEAT_TREND}
              xKey="month"
              series={[
                { key: "assigned", name: "Assigned" },
                { key: "active", name: "Active" },
              ]}
              domain={[0, 140]}
              height={168}
              legendNote="Latest month"
            />
          </BentoTile>

          <BentoStat
            tone="feather"
            col={1}
            row={1}
            icon={GraduationCapIcon}
            label="Certs"
            value={data.orgCerts.filter((c) => c.status === "active").length}
          />
          <BentoStat
            tone="fox"
            col={1}
            row={1}
            icon={MailPlusIcon}
            label="Pending"
            value={data.invitations.filter((inv) => inv.status === "PENDING").length}
          />
          <BentoStat
            tone="macaw"
            col={2}
            row={1}
            icon={UsersIcon}
            label="Active learners"
            value={activeLearners.length}
            hint={
              averageProgress != null
                ? `Average progress ${averageProgress.toFixed(0)}%`
                : "No learner progress recorded yet"
            }
          />
          <BentoStat
            tone="beetle"
            col={2}
            row={1}
            icon={TicketIcon}
            label="Allocations"
            value={data.orgCerts.length}
            hint="Certification allocations in total"
          />

          <BentoTile col={4} row={2}>
            <BentoHeading
              title="Weekly activity"
              hint="Completed items per week"
              chip={<SampleChip />}
            />
            <TrendAreaChart
              data={ENTERPRISE_ACTIVITY_TREND}
              xKey="week"
              series={[
                { key: "lessons", name: "Lessons" },
                { key: "practice", name: "Practice" },
                { key: "assessments", name: "Assessments" },
              ]}
              height={160}
              legendNote="Latest week"
            />
          </BentoTile>

          {/* Right of the activity chart — invitations are scanned. */}
          <BentoTile col={2} row={2} className="!p-0">
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
              <BentoHeading
                title="Recent invitations"
                hint="The latest learner invitations sent."
              />

              {recentInvitations.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No invitations sent yet.
                  <div className="mt-3">
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to="/enterprise/certifications">Invite a learner</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <ul className="-mr-2 min-h-0 flex-1 divide-y-2 divide-border overflow-y-auto pr-2">
                  {recentInvitations.map((invitation) => (
                    <li
                      key={invitation.invitationId}
                      className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Sent {formatDateTime(invitation.sentAt)}
                        </p>
                      </div>
                      <EnterpriseStatusBadge status={invitation.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </BentoTile>

          <BentoTile col={2} row={2}>
            <BentoHeading
              title="Where your learners are"
              hint="Across all allocations"
              chip={<SampleChip />}
            />
            <DonutChart
              data={ENTERPRISE_COMPLETION_MIX}
              height={168}
              centerValue="120"
              centerLabel="learners"
            />
          </BentoTile>

          <BentoTile col={2} row={2}>
            <BentoHeading
              title="Completion by group"
              hint="Share of assigned work done"
              chip={<SampleChip />}
            />
            <BarBreakdownChart
              data={ENTERPRISE_GROUP_PROGRESS}
              categoryKey="group"
              valueKey="completion"
              unit="%"
              target={60}
              height={150}
              categoryWidth={88}
            />
          </BentoTile>

          {/* Real data, not a preview: slot usage per allocation. */}
          <BentoTile col={2} row={2} className="!p-0">
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
              <BentoHeading
                title="Certification allocations"
                hint="Slot usage per certification your organization has access to."
              />

              {data.orgCerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No certification allocations yet. Submit a partnership request to get started.
                </p>
              ) : (
                <div className="-mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
                  {data.orgCerts.map((orgCert) => {
                    const certification = data.certificationById.get(orgCert.certificationId)
                    const used = orgCert.usedSlots ?? 0
                    const total = orgCert.totalSlots ?? 0
                    const pct = total > 0 ? (used / total) * 100 : 0

                    return (
                      <div key={orgCert.orgCertId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-bold">
                            {certification?.title ?? `Certification #${orgCert.certificationId}`}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {used} / {total} slots
                          </span>
                        </div>
                        <Progress value={pct} aria-label="Slot usage" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </BentoTile>
        </BentoGrid>
      )}
    </div>
  )
}
