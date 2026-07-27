import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  formatDate,
} from "@/components/enterprise/enterprise-ui.jsx"
import { updateEnterprise } from "@/services/enterpriseService.js"

export default function EnterpriseOrganizationPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    address: "",
  })

  useEffect(() => {
    if (enterprise) {
      setForm({
        primaryContactName: enterprise.primaryContactName ?? "",
        primaryContactEmail: enterprise.primaryContactEmail ?? "",
        primaryContactPhone: enterprise.primaryContactPhone ?? "",
        address: enterprise.address ?? "",
      })
    }
  }, [enterprise])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateEnterprise(enterprise.enterpriseId, { ...enterprise, ...form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprises"] })
      toast.success("Organization details updated.")
    },
    onError: () => {
      toast.error("Unable to save changes. Please try again.")
    },
  })

  if (enterpriseLoading) return <EnterpriseLoadingSkeleton />
  if (enterpriseError) {
    return <EnterpriseErrorState onRetry={refetchEnterprise} />
  }
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Organization details appear here once your organization is registered."
      />
    )
  }

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Organization"
        subtitle="Your organization profile and primary contact details."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Managed by REBYU — contact support to change these details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{enterprise.enterpriseName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">
                {String(enterprise.organizationType ?? "—").replaceAll(
                  "_",
                  " "
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Industry</span>
              <span className="font-medium">{enterprise.industry ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Joined</span>
              <span className="font-medium">
                {formatDate(enterprise.joinedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verification</span>
              {enterprise.isVerified ? (
                <Badge>Verified</Badge>
              ) : (
                <Badge variant="secondary">Pending</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Primary contact</CardTitle>
            <CardDescription>
              Who REBYU should reach out to about partnerships and billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-contact-name">Contact name</Label>
              <Input
                id="org-contact-name"
                value={form.primaryContactName}
                onChange={setField("primaryContactName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-contact-email">Contact email</Label>
              <Input
                id="org-contact-email"
                type="email"
                value={form.primaryContactEmail}
                onChange={setField("primaryContactEmail")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-contact-phone">Contact phone</Label>
              <Input
                id="org-contact-phone"
                value={form.primaryContactPhone}
                onChange={setField("primaryContactPhone")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-address">Address</Label>
              <Textarea
                id="org-address"
                rows={3}
                value={form.address}
                onChange={setField("address")}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
