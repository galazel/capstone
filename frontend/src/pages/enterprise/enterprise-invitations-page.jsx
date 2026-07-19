import { useMemo } from "react"
import { useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Ticket } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
  formatDateTime,
} from "@/components/enterprise/enterprise-ui.jsx"
import {
  getEnterpriseCertificationAccess,
  getEnterpriseInvitations,
} from "@/services/partnershipService.js"

// Read-only for the enterprise owner: invitations are sent by each group's
// leader (see the Groups page), scoped to their own group and its remaining
// slots. This page just shows what's happened across the whole organization.
export default function EnterpriseInvitationsPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const enterpriseId = enterprise?.enterpriseId

  const accessQuery = useQuery({
    queryKey: ["enterprise-cert-access", enterpriseId],
    queryFn: () => getEnterpriseCertificationAccess(enterpriseId),
    enabled: enterpriseId != null,
    retry: 1,
  })

  const invitationsQuery = useQuery({
    queryKey: ["enterprise-invitations", enterpriseId],
    queryFn: () => getEnterpriseInvitations(enterpriseId),
    enabled: enterpriseId != null,
    retry: 1,
  })

  const access = Array.isArray(accessQuery.data) ? accessQuery.data : []
  const invitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : []
  const hasAccess = access.length > 0

  const totals = useMemo(
    () =>
      access.reduce(
        (acc, a) => ({
          total: acc.total + (a.totalSlots ?? 0),
          used: acc.used + (a.usedSlots ?? 0),
          remaining: acc.remaining + (a.remainingSlots ?? 0),
        }),
        { total: 0, used: 0, remaining: 0 }
      ),
    [access]
  )

  if (enterpriseLoading) return <EnterpriseLoadingSkeleton />
  if (enterpriseError) return <EnterpriseErrorState onRetry={refetchEnterprise} />
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Learner invitations appear here once your organization is approved."
      />
    )
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Learner Invitations"
        subtitle="Group leaders invite learners into their own group from the Groups page. This is a read-only view across your whole organization."
      />

      {accessQuery.isError ? (
        <EnterpriseErrorState onRetry={accessQuery.refetch} />
      ) : !hasAccess ? (
        <EnterpriseEmptyState
          icon={Ticket}
          title="No active certification access yet"
          description="Once an approved partnership grants your organization certification slots, group leaders can invite learners here."
        />
      ) : (
        <>
          {/* Certification access cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {access.map((a) => {
              const used = a.usedSlots ?? 0
              const total = a.totalSlots ?? 0
              const pct = total > 0 ? (used / total) * 100 : 0
              return (
                <Card key={a.orgCertId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{a.certificationTitle}</CardTitle>
                      <EnterpriseStatusBadge status={a.status} />
                    </div>
                    <CardDescription>
                      {a.remainingSlots} of {total} slots available
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Progress value={pct} aria-label="Slot usage" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{used} used</span>
                      <span>{a.remainingSlots} remaining</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Invitation list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Invitations ({invitations.length})
              </CardTitle>
              <CardDescription>
                {totals.used} slot(s) reserved across {access.length} certification(s).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {invitationsQuery.isLoading ? (
                <div className="space-y-2 p-4">
                  <EnterpriseLoadingSkeleton rows={3} />
                </div>
              ) : invitations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No invitations sent yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Certification</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => (
                      <TableRow key={inv.invitationId}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {inv.certificationTitle}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-muted-foreground">
                          {inv.groupName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(inv.sentAt)}
                        </TableCell>
                        <TableCell>
                          <EnterpriseStatusBadge status={inv.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
