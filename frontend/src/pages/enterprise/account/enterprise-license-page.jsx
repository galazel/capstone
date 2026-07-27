import { useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangleIcon, CheckIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
  formatDate,
} from "@/components/enterprise/enterprise-ui.jsx"
import { getEnterpriseLicense } from "@/services/subscriptionService.js"

const USAGE_LABELS = {
  SEAT_LIMIT: "Learner seats",
  GROUP_LIMIT: "Groups",
  AUTHORITY_LIMIT: "Authorities",
  CERTIFICATION_ALLOCATION_LIMIT: "Certification allocations",
}

const FEATURE_LABELS = {
  GROUP_MANAGEMENT: "Group management",
  AUTHORITY_MANAGEMENT: "Authority assignment",
  LEARNER_ASSIGNMENT: "Learner assignment",
  BASIC_MONITORING: "Basic monitoring",
  DETAILED_GROUP_ANALYTICS: "Group analytics",
  WEAKNESS_ANALYSIS: "Weakness reports",
  MASTERY_ANALYTICS: "Learner mastery",
  PERSONALIZED_STUDY_PLAN: "Study plans",
  MOCK_EXAM_ACCESS: "Mock exams",
  READINESS_ANALYSIS: "Readiness reports",
  DETAILED_PROGRESS: "Detailed progress",
  PROGRESS_ANALYTICS: "Progress analytics",
  EXPORT_REPORTS: "Report exports",
  ORG_WIDE_ANALYTICS: "Organization-wide analytics",
  AUDIT_LOGS: "Audit logs",
}

function UsageBar({ metric }) {
  const used = metric.used ?? 0
  const limit = metric.limit ?? 0
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const nearLimit = limit > 0 && used / limit >= 0.9
  const atLimit = limit > 0 && used >= limit
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{USAGE_LABELS[metric.code] ?? metric.code}</span>
        <span
          className={
            atLimit
              ? "font-semibold text-destructive tabular-nums"
              : nearLimit
                ? "font-semibold text-amber-600 tabular-nums"
                : "tabular-nums text-muted-foreground"
          }
        >
          {used} / {limit}
        </span>
      </div>
      <Progress value={pct} aria-label={`${USAGE_LABELS[metric.code] ?? metric.code} usage`} />
      {nearLimit ? (
        <p className="flex items-center gap-1 text-xs text-amber-600">
          <AlertTriangleIcon className="size-3" aria-hidden="true" />
          {atLimit ? "Limit reached" : "Approaching limit"}
        </p>
      ) : null}
    </div>
  )
}

export default function EnterpriseLicensePage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const enterpriseId = enterprise?.enterpriseId

  const licenseQuery = useQuery({
    queryKey: ["enterprise-license", enterpriseId],
    queryFn: () => getEnterpriseLicense(enterpriseId),
    enabled: enterpriseId != null,
    retry: 1,
  })

  if (enterpriseLoading) return <EnterpriseLoadingSkeleton />
  if (enterpriseError) return <EnterpriseErrorState onRetry={refetchEnterprise} />
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Your institutional license appears here once your organization is registered."
      />
    )
  }

  const license = licenseQuery.data
  const hasLicense = license && license.licenseStatus && license.licenseStatus !== "NONE"

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Institutional License"
        subtitle="Your organization's plan, entitlements, and usage against its limits."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast.info("Contact your REBYU account manager to add capacity.")}>
              Add Capacity
            </Button>
            <Button onClick={() => toast.info("Contact sales to upgrade your institutional plan.")}>
              <SparklesIcon aria-hidden="true" />
              Upgrade Plan
            </Button>
          </div>
        }
      />

      {licenseQuery.isLoading ? (
        <EnterpriseLoadingSkeleton rows={3} />
      ) : licenseQuery.isError ? (
        <EnterpriseErrorState onRetry={licenseQuery.refetch} />
      ) : !hasLicense ? (
        <EnterpriseEmptyState
          icon={SparklesIcon}
          title="No active institutional license"
          description="Once an institutional license is activated for your organization, your plan tier, entitlements, and usage will appear here."
          action={
            <Button onClick={() => toast.info("Contact sales to set up an institutional license.")}>
              Contact Sales
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{license.planName}</CardTitle>
                  <CardDescription>
                    {license.billingInterval?.toLowerCase()} billing
                    {license.contractNumber ? ` · Contract ${license.contractNumber}` : ""}
                  </CardDescription>
                </div>
                <EnterpriseStatusBadge status={license.licenseStatus} />
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Current period</dt>
                  <dd className="font-medium">
                    {formatDate(license.currentPeriodStart)} – {formatDate(license.currentPeriodEnd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {license.cancelAtPeriodEnd ? "Access until" : "Renews"}
                  </dt>
                  <dd className="font-medium">{formatDate(license.currentPeriodEnd)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Usage</CardTitle>
              <CardDescription>Live counts validated against active records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(license.usage ?? []).map((metric) => (
                <UsageBar key={metric.code} metric={metric} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Included features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {[...(license.features ?? [])]
                  .filter((code) => FEATURE_LABELS[code])
                  .map((code) => (
                    <li key={code} className="flex items-center gap-2">
                      <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {FEATURE_LABELS[code]}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
