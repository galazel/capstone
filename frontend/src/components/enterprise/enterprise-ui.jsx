import { AlertCircle, Inbox, RefreshCw, UsersRoundIcon } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Files moved into the account dropdown (with Profile/Settings/Log out) --
// see enterprise-layout.jsx -- so it isn't listed here anymore.
const MEMBER_WORKSPACE_LINKS = [
  { label: "My Groups", href: "/enterprise/member", icon: UsersRoundIcon },
]

/**
 * An Enterprise Member (group leader) has no header nav for their workspace
 * -- it lives on the page instead. Drop this at the top of any member page
 * (the group picker, a group's own workspace) so they can still move
 * between them.
 */
export function EnterpriseMemberSubNav() {
  const location = useLocation()
  return (
    <nav
      aria-label="Your workspace"
      className="flex items-center gap-1 border-b border-border pb-3"
    >
      {MEMBER_WORKSPACE_LINKS.map((link) => {
        const Icon = link.icon
        const active =
          location.pathname === link.href || location.pathname.startsWith(`${link.href}/`)
        return (
          <NavLink
            key={link.href}
            to={link.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {link.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function EnterprisePageHeader({ title, subtitle, actions }) {
  void title
  void subtitle

  return actions ? (
    <div className="flex justify-end">
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  ) : null
}

export function EnterpriseStatCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="gap-3 border-0 border-l border-border bg-transparent py-2 shadow-none first:border-l-0">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 pb-0">
        <div className="min-w-0">
          <CardDescription className="truncate text-sm font-medium">
            {label}
          </CardDescription>
          <CardTitle className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </CardTitle>
        </div>
        {Icon ? (
          <span className="flex size-9 items-center justify-center rounded bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </CardHeader>
      {hint ? (
        <CardContent className="px-4 pt-0 text-xs leading-5 text-muted-foreground">
          {hint}
        </CardContent>
      ) : null}
    </Card>
  )
}

export function EnterpriseLoadingSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-md" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-11 rounded-md" />
        ))}
      </div>
    </div>
  )
}

export function EnterpriseErrorState({ title, description, onRetry }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium">{title ?? "Unable to load this data"}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {description ??
              "The organization data could not be loaded right now. It may require a signed-in organization account."}
          </p>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function EnterpriseEmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium">{title}</p>
          {description ? (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ?? null}
      </CardContent>
    </Card>
  )
}

const STATUS_BADGE_VARIANTS = {
  // invitation
  PENDING: "secondary",
  ACCEPTED: "default",
  DECLINED: "destructive",
  EXPIRED: "outline",
  REVOKED: "outline",
  // partnership
  UNDER_REVIEW: "secondary",
  MEETING_SCHEDULED: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
  // invoice / allocation (lowercase enums in backend)
  issued: "secondary",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
  draft: "outline",
  active: "default",
  expired: "outline",
}

export function EnterpriseStatusBadge({ status }) {
  if (!status) return null
  const variant = STATUS_BADGE_VARIANTS[status] ?? "secondary"
  const label = String(status).replaceAll("_", " ").toLowerCase()
  return (
    <Badge variant={variant} className="capitalize">
      {label}
    </Badge>
  )
}

export function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "—"
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  })
}
