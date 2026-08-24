import { useMemo } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  BadgeCheckIcon,
  BarChart3Icon,
  BookOpenCheckIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  MailPlusIcon,
  TargetIcon,
  TicketIcon,
  UserCheck,
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
import { BentoHeading, BentoStat, BentoTile } from "@/components/commons/bento.jsx"
import { DashboardBoard } from "@/components/commons/dashboard-board.jsx"
import { DashboardRearrangeControls } from "@/components/commons/dashboard-rearrange-controls.jsx"
import { useDashboardLayout } from "@/hooks/use-dashboard-layout.js"
import { useEnterpriseData } from "@/hooks/use-enterprise-data.js"
import {
  getEnterpriseGroupStats,
  getEnterpriseLearningStats,
} from "@/services/enterpriseLearningStatsService.js"
import {
  BarBreakdownChart,
  DonutChart,
  RadialGauge,
  readinessColor,
  readinessInk,
  useChartTheme,
} from "@/components/charts/rebyu-charts.jsx"

const PROGRESS_BUCKETS = [
  { label: "0-25%", min: 0, max: 25 },
  { label: "26-50%", min: 26, max: 50 },
  { label: "51-75%", min: 51, max: 75 },
  { label: "76-100%", min: 76, max: 100 },
]

/** Not-yet-measured reads as a dash. A zero would claim a fact we do not have. */
function count(value) {
  return value == null ? "—" : Number(value).toLocaleString()
}

function percent(value, digits = 0) {
  return value == null ? "—" : `${Number(value).toFixed(digits)}%`
}

/** Relative-ish, but plain: a roster is scanned, not read. */
function lastActive(value) {
  if (!value) return "No activity yet"
  return `Last active ${formatDateTime(value)}`
}

/**
 * One supporting figure on the "At a glance" strip.
 *
 * Deliberately smaller than a `BentoStat`: these are the numbers you read after
 * the three gauges, not instead of them, and giving each one a card of its own
 * was what turned the top of this board into a wall of boxes. No border, no
 * fill -- the strip's own tile is the container, and the icon is muted so a row
 * of five does not read as five buttons.
 */
function Figure({ icon: Icon, label, value, hint, alert = false }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {Icon ? (
        <span
          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${
            alert ? "bg-rb-fox-wash text-rb-fox-lip" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      ) : null}
      <div className="min-w-0">
        <dt className="truncate text-xs font-semibold text-muted-foreground">{label}</dt>
        <dd
          className={`mt-0.5 font-rb-display text-2xl font-extrabold leading-none tabular-nums ${
            alert ? "text-rb-fox-lip" : "text-foreground"
          }`}
        >
          {value}
        </dd>
        {hint ? (
          <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

export default function EnterpriseDashboardPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const data = useEnterpriseData(enterprise?.enterpriseId)
  const layout = useDashboardLayout("enterprise")

  /* Learning statistics come from their own tenant-scoped endpoint rather than
     being derived in the browser: progress lives on the assignment rows, but
     lessons finished, graded attempts, pass rate and average score are rollups
     over data the portal overview does not carry, and doing them per member
     client-side would mean a request per learner. */
  const statsQuery = useQuery({
    queryKey: ["enterprise-learning-stats", enterprise?.enterpriseId],
    queryFn: getEnterpriseLearningStats,
    enabled: enterprise?.enterpriseId != null,
    retry: 1,
  })

  const groupStatsQuery = useQuery({
    queryKey: ["enterprise-group-stats"],
    queryFn: getEnterpriseGroupStats,
    enabled: enterprise?.enterpriseId != null,
    retry: 1,
  })

  const summary = statsQuery.data?.summary ?? {}
  const members = useMemo(
    () => (Array.isArray(statsQuery.data?.members) ? statsQuery.data.members : []),
    [statsQuery.data]
  )

  const groupStats = useMemo(
    () => (Array.isArray(groupStatsQuery.data) ? groupStatsQuery.data : []),
    [groupStatsQuery.data]
  )

  /* The cohort shape the Analytics page used to draw, over the same roster the
     members table below uses -- so the two can never disagree, which is what
     happens when a second page recomputes the same thing from a different read. */
  const cohort = useMemo(() => {
    const buckets = PROGRESS_BUCKETS.map((bucket) => ({
      name: bucket.label,
      value: members.filter((member) => {
        const progress = Number(member.averageProgress ?? 0)
        return progress >= bucket.min && progress <= bucket.max
      }).length,
    }))

    // Below 30% and still holding an active assignment: someone who finished
    // and was archived is not "needing support", they are done.
    const needingSupport = members.filter(
      (member) =>
        member.activeCertifications > 0 && Number(member.averageProgress ?? 0) < 30
    )

    return { buckets, needingSupport }
  }, [members])

  const recentInvitations = useMemo(
    () =>
      [...data.invitations]
        .sort((a, b) => new Date(b.sentAt ?? 0) - new Date(a.sentAt ?? 0))
        .slice(0, 5),
    [data.invitations]
  )

  const pendingInvitations = useMemo(
    () => data.invitations.filter((invite) => invite.status === "PENDING").length,
    [data.invitations]
  )

  // Read once here rather than inside the tiles: `useChartTheme` is a hook and
  // the tiles are built inside a useMemo callback, which is not a component.
  const chartTheme = useChartTheme()

  const tiles = useMemo(() => {
    const failed = statsQuery.isError
    const seatsTotal = summary.seatsTotal ?? 0
    const seatsUsed = summary.seatsUsed ?? 0

    return [
      {
        id: "ent-seats",
        col: 2,
        row: 2,
        element: (
          /* A two-row tile carrying one number left most of its height empty.
             Seat utilisation is a proportion, and a proportion is the one thing
             a number alone reads worst: "3 / 20" needs arithmetic before it
             means anything, where an arc is read at a glance. The number is
             kept -- the gauge tells you how full, the number tells you how
             many, and a manager buying seats needs both. */
          <BentoStat
            tone="bee"
            col={2}
            row={2}
            icon={TicketIcon}
            label="Learner slots"
            value={failed ? "—" : `${seatsUsed} / ${seatsTotal}`}
            hint={
              failed
                ? "Could not be loaded"
                : `${Math.max(seatsTotal - seatsUsed, 0)} slot(s) remaining`
            }
          >
            {!failed && seatsTotal > 0 ? (
              <RadialGauge
                value={(seatsUsed / seatsTotal) * 100}
                label="filled"
                height={132}
              />
            ) : null}
          </BentoStat>
        ),
      },
      {
        id: "ent-members",
        col: 2,
        row: 2,
        element: (
          <BentoStat
            tone="macaw"
            col={2}
            row={2}
            icon={UsersIcon}
            label="Members"
            value={failed ? "—" : count(summary.members)}
            // "Active" here means they have actually done something -- a graded
            // attempt or a finished lesson -- not merely that a seat was assigned.
            hint={
              failed
                ? "Could not be loaded"
                : `${count(summary.activeMembers)} active · ${count(summary.membersNotStarted)} not started`
            }
          >
            {/* Started vs not started, because that split is the one a manager
                acts on: a member who has never opened anything is a chase-up,
                and a headline count of members hides them entirely. Drawn only
                when there is a roster -- an empty donut asserts a shape that
                does not exist yet. */}
            {!failed && summary.members > 0 ? (
              <DonutChart
                data={[
                  { name: "Started", value: summary.activeMembers ?? 0 },
                  { name: "Not started", value: summary.membersNotStarted ?? 0 },
                ]}
                height={132}
              />
            ) : null}
          </BentoStat>
        ),
      },
      {
        id: "ent-progress",
        col: 2,
        row: 2,
        element: (
          <BentoStat
            tone="feather"
            col={2}
            row={2}
            icon={TargetIcon}
            label="Average progress"
            value={failed ? "—" : percent(summary.averageProgress, 1)}
            hint={failed ? "Could not be loaded" : "Across every assignment"}
          >
            {/* Banded with the shared readiness scale rather than a flat accent,
                so 30% and 80% are not the same colour on a board a manager
                scans rather than reads. Null progress means nothing has been
                measured -- that is not 0%, and it must not be drawn as one. */}
            {!failed && summary.averageProgress != null ? (
              <RadialGauge
                value={Number(summary.averageProgress)}
                label="complete"
                height={132}
                color={readinessColor(chartTheme, Number(summary.averageProgress))}
                valueInk={readinessInk(chartTheme, Number(summary.averageProgress))}
              />
            ) : null}
          </BentoStat>
        ),
      },
      {
        /* Six one-row stat boxes used to sit here -- lessons, attempts, score,
           certs, pending invitations, needing support -- each with its own
           border, its own icon chip and its own 48px number. Side by side they
           read as six things of equal weight, which is exactly what they are
           not: they are the supporting figures under the three gauges above.
           One strip states them in a row, so the board has three headline
           tiles and one line of detail rather than nine competing boxes. */
        id: "ent-key-figures",
        col: 6,
        row: 1,
        element: (
          <BentoTile col={6} row={1}>
            <BentoHeading
              title="At a glance"
              hint="Learning activity across the whole organization."
            />
            <dl className="grid flex-1 grid-cols-2 items-center gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              <Figure
                icon={BookOpenCheckIcon}
                label="Lessons completed"
                value={failed ? "—" : count(summary.lessonsCompleted)}
              />
              <Figure
                icon={ClipboardListIcon}
                label="Graded attempts"
                value={failed ? "—" : count(summary.gradedAttempts)}
                hint={failed ? null : `${percent(summary.passRate)} pass rate`}
              />
              <Figure
                icon={UserCheck}
                label="Average score"
                value={failed ? "—" : percent(summary.averageScore)}
                hint={failed ? null : "Weighted by attempts"}
              />
              <Figure
                icon={GraduationCapIcon}
                label="Active certifications"
                value={data.orgCerts.filter((cert) => cert.status === "active").length}
              />
              <Figure
                icon={BarChart3Icon}
                label="Needing support"
                value={failed ? "—" : cohort.needingSupport.length}
                hint={failed ? null : "Active, below 30%"}
                /* The one figure on this strip that is a call to action rather
                   than a record of what happened, so it is the one allowed to
                   carry colour. */
                alert={!failed && cohort.needingSupport.length > 0}
              />
            </dl>
          </BentoTile>
        ),
      },
      {
        id: "ent-completion-distribution",
        col: 3,
        row: 2,
        element: (
          <BentoTile col={3} row={2}>
            <BentoHeading
              title="Completion distribution"
              hint="How member progress is spread across the roster"
            />
            <DonutChart
              data={cohort.buckets.filter((bucket) => bucket.value > 0)}
              height={168}
              centerValue={String(members.length)}
              centerLabel={members.length === 1 ? "member" : "members"}
            />
          </BentoTile>
        ),
      },
      {
        id: "ent-group-completion",
        col: 3,
        row: 2,
        element: (
          <BentoTile col={3} row={2}>
            <BentoHeading
              title="Completion by group"
              hint="Average progress across each group's active learners"
            />
            {groupStatsQuery.isError ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Group completion could not be loaded.
              </p>
            ) : (
              <BarBreakdownChart
                data={groupStats.map((group) => ({
                  group: group.groupName,
                  completion: Number(group.averageProgress ?? 0),
                }))}
                categoryKey="group"
                valueKey="completion"
                unit="%"
                target={60}
                height={168}
                categoryWidth={96}
              />
            )}
          </BentoTile>
        ),
      },
      {
        id: "ent-member-table",
        col: 6,
        row: 3,
        element: (
          <BentoTile col={6} row={3} className="!p-0">
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
              <BentoHeading
                title="Members"
                hint="Least progress first — the people most likely to need a nudge."
              />

              {statsQuery.isError ? (
                <p className="text-sm text-muted-foreground">
                  Learning statistics could not be loaded.
                </p>
              ) : members.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No learners assigned yet.
                  <div className="mt-3">
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to="/enterprise/certifications">Assign a learner</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                /* Its own horizontal scroll container: a six-column table inside
                   a tile must never be what makes the page scroll sideways. */
                <div className="-mr-2 min-h-0 flex-1 overflow-auto pr-2">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b-2 border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-bold">Member</th>
                        <th className="py-2 pr-3 font-bold">Progress</th>
                        <th className="py-2 pr-3 text-right font-bold">Lessons</th>
                        <th className="py-2 pr-3 text-right font-bold">Attempts</th>
                        <th className="py-2 pr-3 text-right font-bold">Pass rate</th>
                        <th className="py-2 text-right font-bold">Avg score</th>
                      </tr>
                    </thead>

                    <tbody>
                      {members.map((member) => (
                        <tr key={member.learnerId} className="border-b border-border">
                          <td className="py-2.5 pr-3">
                            <p className="truncate font-bold">{member.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {lastActive(member.lastActivityAt)}
                            </p>
                          </td>

                          <td className="py-2.5 pr-3">
                            <div className="flex min-w-[120px] items-center gap-2">
                              <Progress
                                value={Number(member.averageProgress ?? 0)}
                                aria-label={`${member.name} progress`}
                                className="min-w-[70px]"
                              />
                              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                                {percent(member.averageProgress)}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {count(member.lessonsCompleted)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {count(member.gradedAttempts)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {percent(member.passRate)}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {percent(member.averageScore)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </BentoTile>
        ),
      },
      {
        id: "ent-invitations",
        col: 3,
        row: 2,
        element: (
          <BentoTile col={3} row={2} className="!p-0">
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
              <BentoHeading
                title="Recent invitations"
                hint="The latest learner invitations sent."
                /* The pending count used to be a stat box of its own. It is a
                   property of this list, so it rides on this list's heading. */
                chip={
                  pendingInvitations > 0 ? (
                    <Badge variant="secondary" className="gap-1">
                      <MailPlusIcon className="size-3" aria-hidden="true" />
                      {pendingInvitations} pending
                    </Badge>
                  ) : null
                }
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
        ),
      },
      {
        id: "ent-allocations",
        col: 3,
        row: 2,
        element: (
          <BentoTile col={3} row={2} className="!p-0">
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
              <BentoHeading
                title="Certification allocations"
                hint="Slot usage per certification your organization has access to."
                chip={
                  data.orgCerts.length > 0 ? (
                    <Badge variant="secondary">{data.orgCerts.length}</Badge>
                  ) : null
                }
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
        ),
      },
    ]
  }, [
    chartTheme,
    statsQuery.isError,
    groupStatsQuery.isError,
    summary,
    members,
    cohort,
    groupStats,
    data.orgCerts,
    data.certificationById,
    recentInvitations,
    pendingInvitations,
  ])

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

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title={enterprise.enterpriseName}
        subtitle="How your members are progressing across their assigned certifications."
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
          <div className="flex flex-wrap items-center justify-end gap-3">
            <DashboardRearrangeControls
              rearranging={layout.rearranging}
              onStart={layout.startRearranging}
              onFinish={layout.finishRearranging}
              onCancel={layout.cancelRearranging}
              onReset={layout.resetLayout}
            />
          </div>

          {/* The four chart panels that used to sit here were fed from
              components/charts/sample-data.js -- invented months, invented group
              names, a donut whose centre read "120 learners" regardless of the
              roster. They are replaced by the organization's own figures rather
              than kept behind a "sample data" chip. */}
          <DashboardBoard
            tiles={tiles}
            layout={layout.tileLayout}
            editing={layout.rearranging}
            onLayoutChange={layout.handleLayoutChange}
          />
        </>
      )}
    </div>
  )
}
