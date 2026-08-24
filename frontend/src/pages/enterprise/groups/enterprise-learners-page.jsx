import { useMemo, useState } from "react"
import { Link, useOutletContext, useSearchParams } from "react-router-dom"
import { ArrowLeftIcon, Search, UsersIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  EnterpriseStatusBadge,
  formatDate,
} from "@/components/enterprise/enterprise-ui.jsx"
import {
  getLearnerDisplayName,
  useEnterpriseData,
} from "@/hooks/use-enterprise-data.js"

export default function EnterpriseLearnersPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const data = useEnterpriseData(enterprise?.enterpriseId)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  /* The certification filter lives in the URL rather than in component state.
     A learner belongs to the certification they were invited to, and that is
     how they are reached -- the Certifications page links here as
     ?certification=<id>. Held in `useState` (which is what this was) that
     parameter was accepted by the router and then silently dropped, so
     "View learners" on a specific certification always opened the unscoped
     roster of everyone in the organization. */
  const [searchParams, setSearchParams] = useSearchParams()
  const certificationFilter = searchParams.get("certification") ?? "all"
  const setCertificationFilter = (value) => {
    setSearchParams(
      (params) => {
        if (value === "all") params.delete("certification")
        else params.set("certification", value)
        return params
      },
      { replace: true }
    )
  }

  const rows = useMemo(() => {
    return data.assignments
      .map((assignment) => {
        const orgCert = data.orgCertById.get(assignment.orgCertId)
        const certification = orgCert
          ? data.certificationById.get(orgCert.certificationId)
          : null
        const learner = data.learnerById.get(assignment.learnerId)
        const group = data.groupByOrgCertLearnerId.get(assignment.orgCertLearnerId)
        return {
          assignment,
          learner,
          certification,
          group,
          name: getLearnerDisplayName(learner),
        }
      })
      .filter((row) => {
        if (
          certificationFilter !== "all" &&
          String(row.certification?.certificationId) !== certificationFilter
        ) {
          return false
        }
        if (statusFilter !== "all" && row.assignment.status !== statusFilter) {
          return false
        }
        if (search.trim()) {
          const term = search.trim().toLowerCase()
          const haystack = [
            row.name,
            row.learner?.username,
            row.certification?.title,
            row.group?.groupName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
          if (!haystack.includes(term)) return false
        }
        return true
      })
  }, [data, search, certificationFilter, statusFilter])

  const certificationOptions = useMemo(() => {
    const seen = new Map()
    data.orgCerts.forEach((orgCert) => {
      const certification = data.certificationById.get(orgCert.certificationId)
      if (certification) {
        seen.set(certification.certificationId, certification.title)
      }
    })
    return [...seen.entries()]
  }, [data])

  /* Named rather than merely filtered: arriving from one certification, the
     page has to say which one, or a short roster is indistinguishable from the
     organization having only one learner. */
  const scopedCertification =
    certificationFilter === "all"
      ? null
      : (certificationOptions.find(([id]) => String(id) === certificationFilter)?.[1] ??
        null)

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
        description="Learner rosters appear here once your organization is registered."
      />
    )
  }

  return (
    <div className="space-y-6">
      {scopedCertification ? (
        <div>
          <Link
            to="/enterprise/certifications"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Certifications
          </Link>
          <h1 className="mt-2 font-rb-display text-2xl font-extrabold tracking-tight">
            {scopedCertification} learners
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Learners invited to this certification.
          </p>
        </div>
      ) : (
        <div>
          <h1 className="font-rb-display text-2xl font-extrabold tracking-tight">
            Learners
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Learners assigned to your organization's certifications.
          </p>
        </div>
      )}

      {data.isError ? (
        <EnterpriseErrorState onRetry={data.refetchAll} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative w-full max-w-xs">
              <span className="sr-only">Search learners</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search learners"
                className="pl-9"
              />
            </label>
            <Select
              value={certificationFilter}
              onValueChange={setCertificationFilter}
            >
              <SelectTrigger className="w-[220px]" aria-label="Filter by certification">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rows.length === 0 ? (
            <EnterpriseEmptyState
              icon={UsersIcon}
              title={
                data.assignments.length === 0
                  ? "No learners assigned yet"
                  : "No learners match your filters"
              }
              description={
                data.assignments.length === 0
                  ? "Invite learners and assign them to a certification to see them here."
                  : "Try adjusting your search or filters."
              }
              action={
                data.assignments.length === 0 ? (
                  <Button asChild size="sm">
                    <Link to="/enterprise/certifications">Invite learners</Link>
                  </Button>
                ) : null
              }
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* No Progress column and no per-row drill-in. This is a
                          roster -- who is on this certification and which group
                          they are taught in -- not a performance report. */}
                      <TableHead>Learner</TableHead>
                      <TableHead>Certification</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      return (
                        <TableRow key={row.assignment.orgCertLearnerId}>
                          <TableCell>
                            <div className="font-medium">{row.name}</div>
                            {row.learner?.username ? (
                              <div className="text-xs text-muted-foreground">
                                @{row.learner.username}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {row.certification?.title ?? "—"}
                          </TableCell>
                          <TableCell>
                            {row.group ? (
                              /* Named, not linked. The group workspace is where
                                 a leader teaches -- this roster only says which
                                 group the learner belongs to. */
                              row.group.groupName
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Not in a group
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(row.assignment.assignedAt)}
                          </TableCell>
                          <TableCell>
                            <EnterpriseStatusBadge
                              status={row.assignment.status}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
