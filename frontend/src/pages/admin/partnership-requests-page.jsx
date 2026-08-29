import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Clock, XCircle } from "@/components/icons"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PlainHead,
  SortableHead,
  TableCard,
  TablePagination,
  TableToolbar,
  useTableSort,
} from "@/components/commons/data-table.jsx"
import { Textarea } from "@/components/ui/textarea"
import {
  approvePartnershipRequest,
  getAdminPartnershipRequestDetail,
  getAdminPartnershipRequests,
  rejectPartnershipRequest,
} from "@/services/partnershipService.js"

const STATUS_VARIANT = {
  PENDING: "secondary",
  UNDER_REVIEW: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
}

function formatDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default function PartnershipRequests() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [detailId, setDetailId] = useState(null)
  const [remarks, setRemarks] = useState("")
  const [confirm, setConfirm] = useState(null) // { action: "approve" | "reject", id }
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { sort, toggle, sortRows } = useTableSort()

  const listQuery = useQuery({
    queryKey: ["admin-partnership-requests", statusFilter],
    queryFn: () => getAdminPartnershipRequests(statusFilter),
  })

  const detailQuery = useQuery({
    queryKey: ["admin-partnership-request", detailId],
    queryFn: () => getAdminPartnershipRequestDetail(detailId),
    enabled: detailId != null,
  })

  const requests = Array.isArray(listQuery.data) ? listQuery.data : []

  const counts = useMemo(() => {
    // Summary cards always reflect the full set, so fetch counts from the rows
    // when no status filter is applied; otherwise show the filtered figure.
    const base = { PENDING: 0, APPROVED: 0, REJECTED: 0 }
    requests.forEach((r) => {
      if (r.status in base) base[r.status] += 1
    })
    return base
  }, [requests])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return requests
    return requests.filter(
      (r) =>
        r.organizationName?.toLowerCase().includes(term) ||
        r.organizationEmail?.toLowerCase().includes(term)
    )
  }, [requests, search])

  const sorted = useMemo(
    () =>
      sortRows(filtered, {
        organization: (request) => request.organizationName ?? null,
        reference: (request) => request.referenceNumber ?? null,
        certifications: (request) => Number(request.certificationCount ?? 0),
        slots: (request) => Number(request.totalRequestedSlots ?? 0),
        submitted: (request) => {
          const time = request.submittedAt
            ? new Date(request.submittedAt).getTime()
            : Number.NaN
          return Number.isNaN(time) ? null : time
        },
        status: (request) => request.status ?? null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sort]
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, pageSize])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const paged = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, sorted]
  )

  const rangeStart = sorted.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, sorted.length)

  const reviewMutation = useMutation({
    mutationFn: ({ action, id }) =>
      action === "approve"
        ? approvePartnershipRequest(id, remarks)
        : rejectPartnershipRequest(id, remarks),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-partnership-requests"] })
      queryClient.invalidateQueries({ queryKey: ["admin-partnership-request"] })
      if (variables.action === "approve") {
        toast.success("Partnership approved.", {
          description:
            data?.institutionAccountNote ??
            "The organization now has certification access.",
        })
      } else {
        toast.success("Partnership rejected.")
      }
      setConfirm(null)
      setDetailId(null)
      setRemarks("")
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ?? "Unable to update the request. Please try again."
      )
    },
  })

  const detail = detailQuery.data
  const canReview =
    detail && (detail.status === "PENDING" || detail.status === "UNDER_REVIEW")

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {/* Three counts on one line rather than three cards on a grid: each held
          a single number, and a card's job is to separate things that would
          otherwise run together -- which spacing already does here. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-10 gap-y-3 border-b border-border pb-4">
        <SummaryCard icon={Clock} label="Pending" value={counts.PENDING} />
        <SummaryCard icon={CheckCircle2} label="Approved" value={counts.APPROVED} />
        <SummaryCard icon={XCircle} label="Rejected" value={counts.REJECTED} />
      </div>

      {/* One table, scrolled sideways on a narrow screen. The duplicate card
          list this page used to render below md is gone: it was a second copy
          of every row to keep in step, and a request is read by comparing
          slots and dates down a column, which cards cannot do. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TableCard className="flex min-h-0 flex-1 flex-col">
        <TableToolbar
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization or email"
        >
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </TableToolbar>

        {/* The rows scroll, the pager does not: with a short list the page still
            ends where the window does rather than leaving the pager stranded
            halfway up a blank page. */}
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead
                  column="organization"
                  label="Organization"
                  sort={sort}
                  onSort={toggle}
                  className="min-w-56"
                />
                <SortableHead
                  column="reference"
                  label="Reference"
                  sort={sort}
                  onSort={toggle}
                />
                <SortableHead
                  column="certifications"
                  label="Certifications"
                  sort={sort}
                  onSort={toggle}
                  align="right"
                />
                <SortableHead
                  column="slots"
                  label="Slots"
                  sort={sort}
                  onSort={toggle}
                  align="right"
                />
                <SortableHead
                  column="submitted"
                  label="Submitted"
                  sort={sort}
                  onSort={toggle}
                />
                <SortableHead column="status" label="Status" sort={sort} onSort={toggle} />
                <PlainHead label="Actions" align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`loading-${index}`}>
                    <TableCell colSpan={7} className="h-16">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-48 text-center text-sm text-muted-foreground"
                  >
                    No partnership requests match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r) => (
                  <TableRow key={r.requestId}>
                    <TableCell>
                      <div className="font-bold">{r.organizationName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.organizationEmail}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.referenceNumber}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.certificationCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.totalRequestedSlots}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.submittedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                        {r.status.replaceAll("_", " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          setRemarks("")
                          setDetailId(r.requestId)
                        }}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          total={sorted.length}
          unit="requests"
        />
      </TableCard>
      </div>

      {/* Detail dialog */}
      <Dialog
        open={detailId != null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null)
            setRemarks("")
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Partnership request</DialogTitle>
            <DialogDescription>
              {detail?.referenceNumber} · submitted {formatDate(detail?.submittedAt)}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading || !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <section className="space-y-1.5 text-sm">
                <h3 className="font-semibold">Organization</h3>
                <Row label="Name" value={detail.organizationName} />
                <Row label="Email" value={detail.organizationEmail} />
                <Row label="Contact" value={detail.contactPersonName} />
                <Row label="Phone" value={detail.contactNumber} />
                <Row label="Address" value={detail.organizationAddress} />
                <div>
                  <p className="text-muted-foreground">Description</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{detail.businessDescription}</p>
                </div>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold">Requested certifications</h3>
                <ul className="divide-y rounded-lg border">
                  {(detail.items ?? []).map((item) => (
                    <li
                      key={item.partnershipRequestItemId}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{item.certificationTitle}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {item.requestedSlots} slot(s)
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {canReview ? (
                <section className="space-y-2">
                  <Label htmlFor="admin-remarks">Remarks (optional)</Label>
                  <Textarea
                    id="admin-remarks"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Notes shared with the organization."
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => setConfirm({ action: "approve", id: detail.requestId })}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setConfirm({ action: "reject", id: detail.requestId })}
                    >
                      Reject
                    </Button>
                  </div>
                </section>
              ) : (
                <section className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p>
                    This request was{" "}
                    <span className="font-medium">{detail.status.toLowerCase()}</span>
                    {detail.reviewedBy ? ` by ${detail.reviewedBy}` : ""}.
                  </p>
                  {detail.adminRemarks ? (
                    <p className="mt-1 text-muted-foreground">“{detail.adminRemarks}”</p>
                  ) : null}
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve / reject confirmation */}
      <AlertDialog open={confirm != null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "approve"
                ? "Approve this partnership?"
                : "Reject this partnership?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "approve"
                ? "The organization will receive certification access and learner slots."
                : "The organization will be notified that the request was rejected. No access is granted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                reviewMutation.mutate(confirm)
              }}
              disabled={reviewMutation.isPending}
              className={
                confirm?.action === "reject"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : undefined
              }
            >
              {reviewMutation.isPending
                ? confirm?.action === "approve"
                  ? "Approving partnership..."
                  : "Rejecting partnership..."
                : confirm?.action === "approve"
                  ? "Approve Partnership"
                  : "Reject Partnership"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-baseline gap-2">
      <Icon className="size-4 self-center text-muted-foreground" aria-hidden="true" />
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  )
}
