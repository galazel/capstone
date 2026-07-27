import { useMemo, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { Search, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
  EnterprisePageHeader,
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
  const [certificationFilter, setCertificationFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const rows = useMemo(() => {
    return data.assignments
      .map((assignment) => {
        const orgCert = data.orgCertById.get(assignment.orgCertId)
        const certification = orgCert
          ? data.certificationById.get(orgCert.certificationId)
          : null
        const learner = data.learnerById.get(assignment.learnerId)
        return {
          assignment,
          learner,
          certification,
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
      <EnterprisePageHeader
        title="Learners"
        subtitle="Learners assigned to your organization's certifications."
      />

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
                      <TableHead>Learner</TableHead>
                      <TableHead>Certification</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const progress = Number(
                        row.assignment.progressPercentage ?? 0
                      )
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
                          <TableCell className="w-[180px]">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={progress}
                                className="w-24"
                                aria-label="Learner progress"
                              />
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(row.assignment.assignedAt)}
                          </TableCell>
                          <TableCell>
                            <EnterpriseStatusBadge
                              status={row.assignment.status}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link
                                to={`/enterprise/learners/${row.assignment.learnerId}`}
                              >
                                View
                              </Link>
                            </Button>
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
