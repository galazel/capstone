import { Link, useOutletContext } from "react-router-dom"
import { GraduationCapIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { useEnterpriseData } from "@/hooks/use-enterprise-data.js"

export default function EnterpriseCertificationsPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const data = useEnterpriseData(enterprise?.enterpriseId)

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
        description="Certification allocations appear here once your organization is registered."
      />
    )
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Certifications"
        subtitle="Certification programs allocated to your organization."
      />

      {data.isError ? (
        <EnterpriseErrorState onRetry={data.refetchAll} />
      ) : data.orgCerts.length === 0 ? (
        <EnterpriseEmptyState
          icon={GraduationCapIcon}
          title="No certification allocations yet"
          description="Submit a partnership request to allocate certifications and learner slots for your organization."
          action={
            <Button asChild size="sm">
              <Link to="/enterprise/partnership">Go to Partnership</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.orgCerts.map((orgCert) => {
            const certification = data.certificationById.get(
              orgCert.certificationId
            )
            const used = orgCert.usedSlots ?? 0
            const total = orgCert.totalSlots ?? 0
            const assignedCount = data.assignments.filter(
              (assignment) => assignment.orgCertId === orgCert.orgCertId
            ).length
            return (
              <Card key={orgCert.orgCertId} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {certification?.title ??
                        `Certification #${orgCert.certificationId}`}
                    </CardTitle>
                    <EnterpriseStatusBadge status={orgCert.status} />
                  </div>
                  <CardDescription>
                    Access {formatDate(orgCert.accessStartDate)} –{" "}
                    {formatDate(orgCert.accessExpiryDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Slot usage</span>
                      <span className="tabular-nums">
                        {used} / {total}
                      </span>
                    </div>
                    <Progress
                      value={total > 0 ? (used / total) * 100 : 0}
                      aria-label="Slot usage"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {assignedCount} learner(s) assigned
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button asChild size="sm">
                    <Link to={`/enterprise/certifications/${orgCert.orgCertId}`}>
                      View certification
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={`/enterprise/learners?certification=${orgCert.certificationId}`}
                    >
                      View learners
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
