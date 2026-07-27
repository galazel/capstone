import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Clock, Search, XCircle } from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
            data?.enterpriseAccountNote ??
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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Clock} label="Pending" value={counts.PENDING} />
        <SummaryCard icon={CheckCircle2} label="Approved" value={counts.APPROVED} />
        <SummaryCard icon={XCircle} label="Rejected" value={counts.REJECTED} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search requests</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organization or email"
            className="pl-9"
          />
        </label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No partnership requests match your filters.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Certifications</TableHead>
                    <TableHead className="text-right">Slots</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.requestId}>
                      <TableCell>
                        <div className="font-medium">{r.organizationName}</div>
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
                          onClick={() => {
                            setRemarks("")
                            setDetailId(r.requestId)
                          }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => (
              <Card key={r.requestId}>
                <CardContent className="space-y-2 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.organizationName}</p>
                      <p className="text-xs text-muted-foreground">{r.organizationEmail}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                      {r.status.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.certificationCount} certification(s) · {r.totalRequestedSlots} slot(s) ·{" "}
                    {formatDate(r.submittedAt)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setRemarks("")
                      setDetailId(r.requestId)
                    }}
                  >
                    Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

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
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
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
