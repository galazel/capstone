import { useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HandshakeIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
  formatDateTime,
} from "@/components/enterprise/enterprise-ui.jsx"
import { useEnterpriseData } from "@/hooks/use-enterprise-data.js"
import {
  getPartnershipRequestTransactions,
  submitPartnershipRequestTransaction,
} from "@/services/enterpriseService.js"

function toLocalDate(date) {
  return date.toISOString().slice(0, 10)
}

function RequestPartnershipDialog({ open, onOpenChange, enterprise, data }) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState([
    { certificationId: "", slots: 10, months: 12 },
  ])
  const [error, setError] = useState("")

  // One idempotency key per open dialog: a double-click cannot create two
  // requests, and the whole request+items submission is atomic on the server.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const submitMutation = useMutation({
    mutationFn: () => {
      const start = new Date()
      return submitPartnershipRequestTransaction({
        idempotencyKey,
        items: items.map((item) => {
          const end = new Date(start)
          end.setMonth(end.getMonth() + Number(item.months))
          return {
            certificationId: Number(item.certificationId),
            slots: Number(item.slots),
            requestedAccessStartDate: toLocalDate(start),
            requestedAccessEndDate: toLocalDate(end),
          }
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partnership-request-transactions"],
      })
      toast.success("Partnership request submitted.")
      setItems([{ certificationId: "", slots: 10, months: 12 }])
      setError("")
      onOpenChange(false)
    },
    onError: (mutationError) => {
      toast.error(
        mutationError?.response?.data?.message ??
          "Unable to submit the partnership request. Please try again."
      )
    },
  })

  const updateItem = (index, patch) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (items.some((item) => !item.certificationId)) {
      setError("Select a certification for every line item.")
      return
    }
    if (items.some((item) => Number(item.slots) < 1)) {
      setError("Each line item needs at least 1 learner slot.")
      return
    }
    setError("")
    submitMutation.mutate()
  }

  const certifications = [...data.certificationById.values()]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request partnership</DialogTitle>
          <DialogDescription>
            Request certification access and learner slots for your
            organization. The REBYU team will review your request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_84px_84px_auto] items-end gap-2 rounded-lg border p-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`pr-cert-${index}`}>Certification</Label>
                  <Select
                    value={item.certificationId}
                    onValueChange={(value) =>
                      updateItem(index, { certificationId: value })
                    }
                  >
                    <SelectTrigger id={`pr-cert-${index}`} className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {certifications.map((certification) => (
                        <SelectItem
                          key={certification.certificationId}
                          value={String(certification.certificationId)}
                        >
                          {certification.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pr-slots-${index}`}>Slots</Label>
                  <Input
                    id={`pr-slots-${index}`}
                    type="number"
                    min={1}
                    value={item.slots}
                    onChange={(event) =>
                      updateItem(index, { slots: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`pr-months-${index}`}>Months</Label>
                  <Input
                    id={`pr-months-${index}`}
                    type="number"
                    min={1}
                    value={item.months}
                    onChange={(event) =>
                      updateItem(index, { months: event.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line item"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, i) => i !== index)
                    )
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((current) => [
                ...current,
                { certificationId: "", slots: 10, months: 12 },
              ])
            }
          >
            <PlusIcon aria-hidden="true" />
            Add certification
          </Button>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending
                ? "Submitting..."
                : "Submit Partnership Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function EnterprisePartnershipPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const data = useEnterpriseData(enterprise?.enterpriseId)
  const [requestOpen, setRequestOpen] = useState(false)

  // Enterprise-scoped endpoint (enterpriseId derived server-side from the JWT) --
  // NOT the unfiltered generic CRUD list, which would leak every tenant's requests.
  const requestsQuery = useQuery({
    queryKey: ["partnership-request-transactions"],
    queryFn: getPartnershipRequestTransactions,
    enabled: enterprise != null,
    retry: 1,
  })

  const requests = useMemo(() => {
    const list = Array.isArray(requestsQuery.data) ? requestsQuery.data : []
    return [...list].sort(
      (a, b) => new Date(b.submittedAt ?? 0) - new Date(a.submittedAt ?? 0)
    )
  }, [requestsQuery.data])

  if (enterpriseLoading) return <EnterpriseLoadingSkeleton />
  if (enterpriseError) {
    return <EnterpriseErrorState onRetry={refetchEnterprise} />
  }
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Partnership requests appear here once your organization is registered."
      />
    )
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Partnership"
        subtitle="Request certification access for your organization and track approval status."
        actions={
          <Button onClick={() => setRequestOpen(true)}>
            <HandshakeIcon aria-hidden="true" />
            Request Partnership
          </Button>
        }
      />

      {requestsQuery.isLoading ? (
        <EnterpriseLoadingSkeleton rows={3} />
      ) : requestsQuery.isError ? (
        <EnterpriseErrorState onRetry={requestsQuery.refetch} />
      ) : requests.length === 0 ? (
        <EnterpriseEmptyState
          icon={HandshakeIcon}
          title="No partnership requests yet"
          description="Submit a request to allocate certifications and learner slots for your organization."
          action={
            <Button size="sm" onClick={() => setRequestOpen(true)}>
              Request Partnership
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const items = Array.isArray(request.items) ? request.items : []
            return (
              <Card key={request.requestId}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      Request #{request.requestId}
                    </CardTitle>
                    <EnterpriseStatusBadge status={request.status} />
                  </div>
                  <CardDescription>
                    Submitted {formatDateTime(request.submittedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No line items recorded for this request.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {items.map((item) => {
                        const certification = data.certificationById.get(
                          item.certificationId
                        )
                        return (
                          <li
                            key={item.partnershipRequestItemId}
                            className="flex items-center justify-between gap-2 py-2 text-sm"
                          >
                            <span className="truncate">
                              {certification?.title ??
                                `Certification #${item.certificationId}`}
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {item.slots} slot(s) ·{" "}
                              {item.requestedAccessStartDate} →{" "}
                              {item.requestedAccessEndDate}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <RequestPartnershipDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        enterprise={enterprise}
        data={data}
      />
    </div>
  )
}
