import { AlertCircle, Inbox, RefreshCw, UsersRoundIcon } from "@/components/icons"
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

/** Matches LearnerStatCard so a tile reads the same in either portal. */
const STAT_TONES = {
  macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
  feather: "bg-rb-feather-wash text-rb-feather-lip",
  fox: "bg-rb-fox-wash text-rb-fox-lip",
  beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
  bee: "bg-rb-bee-wash text-rb-bee-lip",
}

export function EnterpriseStatCard({ icon: Icon, label, value, hint, tone = "macaw" }) {
  return (
    <div className="rounded-rb-card border-2 border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="mt-3 font-rb-display text-4xl font-extrabold leading-none tabular-nums tracking-tight text-foreground sm:text-5xl">
            {value}
          </p>
        </div>
        {Icon ? (
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
              STAT_TONES[tone] ?? STAT_TONES.macaw
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function EnterpriseLoadingSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-rb-card" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-11 rounded-rb-tile" />
        ))}
      </div>
    </div>
  )
}

export function EnterpriseErrorState({ title, description, onRetry }) {
  return (
    <div className="rounded-rb-card border-2 border-rb-cardinal/40 bg-rb-cardinal-wash p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rb-snow text-rb-cardinal-lip">
        <AlertCircle className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 font-rb-display font-extrabold lowercase text-rb-cardinal-lip">
        {title ?? "Unable to load this data"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-rb-eel">
        {description ??
          "The organization data could not be loaded right now. It may require a signed-in organization account."}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function EnterpriseEmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-rb-card border-2 border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-rb-macaw-wash text-rb-macaw-lip">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 font-rb-display text-base font-extrabold lowercase text-foreground">
        {title}
      </p>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
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
  pending: "secondary",
  suspended: "destructive",
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
