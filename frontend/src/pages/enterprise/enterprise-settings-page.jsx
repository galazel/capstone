import { Link, useOutletContext } from "react-router-dom"
import {
  Building2Icon,
  ChevronRightIcon,
  HandshakeIcon,
  ReceiptTextIcon,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
} from "@/components/enterprise/enterprise-ui.jsx"

const settingsLinks = [
  {
    title: "Organization profile",
    description: "Update primary contact details and address.",
    to: "/enterprise/organization",
    icon: Building2Icon,
  },
  {
    title: "Partnership",
    description: "Manage certification access requests.",
    to: "/enterprise/partnership",
    icon: HandshakeIcon,
  },
  {
    title: "Billing",
    description: "Review invoices and payment status.",
    to: "/enterprise/billing",
    icon: ReceiptTextIcon,
  },
]

export default function EnterpriseSettingsPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()

  if (enterpriseLoading) return <EnterpriseLoadingSkeleton rows={2} />
  if (enterpriseError) {
    return <EnterpriseErrorState onRetry={refetchEnterprise} />
  }
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Settings appear here once your organization is registered."
      />
    )
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Settings"
        subtitle="Manage how your organization works with REBYU."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {settingsLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardHeader>
                <item.icon
                  className="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <CardTitle className="flex items-center justify-between text-base">
                  {item.title}
                  <ChevronRightIcon
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization access</CardTitle>
          <CardDescription>
            Your organization portal is connected to the active enterprise account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Manage learner access through Invitations and Groups. Billing and
          certification capacity are managed through the linked pages above.
        </CardContent>
      </Card>
    </div>
  )
}
