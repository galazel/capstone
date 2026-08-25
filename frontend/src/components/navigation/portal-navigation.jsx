import { useEffect, useMemo, useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import {
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  ChevronDown,
  CircleHelp,
  Command,
  FileQuestion,
  Handshake,
  LayoutDashboard,
  Menu,
  ServerCog,
  Sparkles,
  Search,
  Swords,
  Users,
  X,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const learnerNavigation = [
  { label: "Analytics", href: "/learner/analytics", icon: BarChart3 },
  { label: "Certifications", href: "/learner/certifications", icon: Award },
  { label: "My Learning", href: "/learner/learning", match: ["/learner/learning", "/learner/lessons"], icon: BookOpenCheck },
  { label: "Challenges", href: "/learner/challenges", icon: Swords },
  // No Rankings entry: the XP leaderboard is a panel on Challenges now, beside
  // the challenge-points board. Two standings on two pages meant knowing which
  // board you wanted before you could find it.
]

const adminGroups = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { label: "Platform overview", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Learning",
    icon: BookOpenCheck,
    items: [
      { label: "Certifications", href: "/admin", icon: Award },
      // No Question Bank entry: the bank is a tab inside each certification,
      // next to its curriculum and assessments, because that is the only scope
      // a question is authored in. No AI generation entry either -- a run is
      // watched in the modal that started it.
      { label: "Challenges", href: "/admin/challenges", icon: Swords },
    ],
  },
  {
    label: "Management",
    icon: ServerCog,
    items: [
      { label: "Institutions", href: "/admin/organizations", icon: Building2 },
      { label: "Partnership requests", href: "/admin/partnership-requests", icon: Handshake },
      { label: "BKT delivery", href: "/admin/bkt-delivery", icon: ServerCog },
      { label: "Gamification", href: "/admin/gamification-settings", icon: Sparkles },
      { label: "Learners", href: "/admin/learners", icon: Users },
    ],
  },
]

// Groups now live inside Certifications (you create a group from within the
// certification it belongs to), so there's no standalone "Groups" nav item.
// Items flagged ownerOnly are hidden for a group leader / other institution
// member -- only the organization owner sees them.
const institutionGroups = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      // One entry, because there is one page. "Organization overview" and
      // "Analytics" were two nav items onto what is now a single board -- the
      // same shape as the learner portal, which lists Analytics once.
      { label: "Organization overview", href: "/institution/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Learning",
    icon: BookOpenCheck,
    items: [
      // No "Learners" entry. A learner belongs to the certification they were
      // invited to, and that is the only place the roster means anything -- so
      // they are reached through it ("View learners" on a certification card),
      // not from a top-level list of everyone in the organization.
      { label: "Certifications", href: "/institution/certifications", icon: Award },
      { label: "Question Bank", href: "/institution/question-bank", icon: FileQuestion },
    ],
  },
  {
    label: "Organization",
    icon: Building2,
    ownerOnly: true,
    items: [
      // One entry, because there is one page. Profile, Partnership, License,
      // Billing and Files were five short routes behind a five-item menu; they
      // are now tabs on /institution/organization, and the old paths still open
      // their own tab. `match` keeps the header underlined on all of them.
      {
        label: "Organization",
        href: "/institution/organization",
        icon: Building2,
        match: [
          "/institution/organization",
          "/institution/partnership",
          "/institution/license",
          "/institution/billing",
          "/institution/files",
        ],
      },
    ],
  },
]

/**
 * Both institution-side roles: INSTITUTION is the organization's own (owner)
 * account, INSTITUTION_MEMBER is someone it created an account for. They share
 * the same portal and permissions -- see CognitoAuthService.isInstitutionRole.
 */
export function isInstitutionRole(role) {
  return role === "INSTITUTION" || role === "INSTITUTION_MEMBER"
}

function pathMatches(pathname, item) {
  const candidates = item.match ?? [item.href]
  return candidates.some((path) => pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`)))
}

function Brand({ role, organizationName }) {
  const isInstitution = isInstitutionRole(role)
  const home = role === "LEARNER"
    ? "/learner/analytics"
    : isInstitution
      ? "/institution/dashboard"
      : "/admin/dashboard"
  // On the institution side this shows the organization's own name rather than
  // the generic word "Institution" -- a member works inside one specific
  // organization, and naming it is what makes the header useful to them. Falls
  // back to the generic label only while the profile is still loading.
  const label = role === "LEARNER"
    ? "Learn"
    : isInstitution
      ? organizationName || "Institution"
      : "Admin"

  return (
    <NavLink to={home} className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={role === "LEARNER" ? "REBYU home and analytics" : "REBYU home"}>
      <BrandLogo className="size-8" />
      <span className="hidden leading-none sm:block">
        <span className="block font-heading text-[15px] font-bold tracking-tight">REBYU</span>
        <span
          className="mt-1 block max-w-40 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          title={isInstitution && organizationName ? organizationName : undefined}
        >
          {label}
        </span>
      </span>
    </NavLink>
  )
}

/** Shared trigger/link styling, so a single-page group and a dropdown sit on
 *  the same baseline and carry the same active underline. */
const navItemClass = (active) =>
  cn(
    "relative inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "text-primary after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-primary"
      : "text-muted-foreground",
  )

function GroupDropdown({ group, pathname }) {
  const active = group.items.some((item) => pathMatches(pathname, item))
  // A one-page group has no identity of its own, so it borrows the icon of the
  // page it opens rather than carrying a second, vaguer one.
  const Icon = group.icon ?? group.items[0]?.icon

  // A menu holding one page is a link wearing a menu's clothes: it costs a
  // click and a chevron promising choices that are not there. "Overview" was
  // exactly this -- a dropdown whose only entry went to /admin/dashboard.
  if (group.items.length === 1) {
    const only = group.items[0]
    return (
      <NavLink to={only.href} className={navItemClass(active)}>
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
        {group.label}
      </NavLink>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={navItemClass(active)}>
          {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
          {group.label}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 p-2">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">{group.label}</DropdownMenuLabel>
        {group.items.map((item) => <NavigationMenuItem key={item.href} item={item} />)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavigationMenuItem({ item }) {
  const Icon = item.icon
  return (
    <DropdownMenuItem asChild>
      <NavLink to={item.href} className="flex items-center gap-3 py-2.5">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>{item.label}</span>
      </NavLink>
    </DropdownMenuItem>
  )
}

export function CommandPalette({ open, onOpenChange, items }) {
  const [query, setQuery] = useState("")
  const navigate = useNavigate()
  const results = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value ? items.filter((item) => `${item.label} ${item.group ?? ""}`.toLowerCase().includes(value)) : items
  }, [items, query])

  useEffect(() => { if (!open) setQuery("") }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only"><DialogTitle>Command palette</DialogTitle><DialogDescription>Search and open a REBYU destination.</DialogDescription></DialogHeader>
        <label className="flex items-center gap-3 border-b px-4">
          <Search className="size-5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search destinations</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and actions…" className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </label>
        <div className="max-h-[min(440px,60vh)] overflow-y-auto p-2">
          {results.length ? results.map((item) => {
            const Icon = item.icon ?? CircleHelp
            return <button key={item.href} type="button" onClick={() => { navigate(item.href); onOpenChange(false) }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"><Icon className="size-4 text-muted-foreground" /><span className="flex-1">{item.label}</span>{item.group ? <span className="text-xs text-muted-foreground">{item.group}</span> : null}</button>
          }) : <p className="px-3 py-10 text-center text-sm text-muted-foreground">No destinations match “{query}”.</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PortalTopNavigation({ role, actions, organizationName, institutionMemberRole }) {
  const location = useLocation()
  const [commandOpen, setCommandOpen] = useState(false)
  const isInstitutionOwner = institutionMemberRole === "owner"
  // An Institution Member (group leader, non-owner) only ever acts within
  // their own assigned groups' workspace pages -- that navigation lives on
  // the page itself now (see institution-member-dashboard-page.jsx /
  // institution-group-workspace-page.jsx), not in this header, and the
  // command-K search bar is hidden for them too since there's nothing
  // institution-wide left for it to search.
  // The explicit role is authoritative; the owner check still covers accounts
  // that predate INSTITUTION_MEMBER and have not been migrated yet.
  const isInstitutionMember =
    role === "INSTITUTION_MEMBER" || (role === "INSTITUTION" && !isInstitutionOwner)
  const allGroups = role === "ADMIN" ? adminGroups : institutionGroups
  const groups = isInstitutionMember ? [] : allGroups
  const commandItems = role === "LEARNER" ? learnerNavigation.map((item) => ({ ...item, group: "Learner" })) : groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true) }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        {/* Cap and padding track `.rebyu-page` in index.css. The two are
            independent declarations of the same gutter, so they have to move
            together — widening the page alone left the brand and the nav links
            indented relative to every heading underneath them. */}
        <div className="mx-auto flex h-16 w-full max-w-[1800px] items-center gap-4 px-3 sm:px-5 lg:px-6">
          <Brand role={role} organizationName={organizationName} />
          {/* Left-aligned against the logo. Centred, the links floated in the
              middle of the bar and shifted horizontally whenever the brand or
              the action cluster changed width -- next to the wordmark they have
              a fixed edge to start from. */}
          <nav className="hidden min-w-0 flex-1 items-center justify-start gap-1 lg:flex" aria-label={`${role.toLowerCase()} navigation`}>
            {role === "LEARNER"
              ? learnerNavigation.slice(0, 6).map((item) => {
                  const Icon = item.icon
                  const active = pathMatches(location.pathname, item)
                  return (
                    <NavLink
                      key={`${item.label}-${item.href}`}
                      to={item.href}
                      className={cn(
                        "relative inline-flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "text-primary after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-0.5 after:bg-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                      {item.label}
                    </NavLink>
                  )
                })
              : groups.map((group) => (
                  <GroupDropdown key={group.label} group={group} pathname={location.pathname} />
                ))}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-1.5 lg:flex-none">
            {/* No search control in the bar. It occupied the widest slot in the
                header to search a nav tree of at most a dozen destinations that
                are already on screen. The Ctrl-K palette below still opens on
                the shortcut for anyone who reaches for it. */}
            {groups.length > 0 || role === "LEARNER" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-2">
                  {(role === "LEARNER" ? [{ label: "Navigation", items: learnerNavigation }] : groups).map((group, index) => <div key={group.label}><DropdownMenuLabel>{group.label}</DropdownMenuLabel>{group.items.map((item) => <NavigationMenuItem key={item.href} item={item} />)}{index < (role === "LEARNER" ? 0 : groups.length - 1) ? <DropdownMenuSeparator /> : null}</div>)}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {actions}
          </div>
        </div>
      </header>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} items={commandItems} />
    </>
  )
}

export function LearnerMobileNavigation() {
  const location = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Mobile learner navigation">
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${learnerNavigation.length}, minmax(0, 1fr))` }}>
        {learnerNavigation.map((item) => { const Icon = item.icon; const active = pathMatches(location.pathname, item); return <NavLink key={`${item.label}-${item.href}`} to={item.href} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", active ? "text-primary" : "text-muted-foreground")}><Icon className="size-5" /><span className="max-w-full truncate px-1">{item.label}</span></NavLink> })}
      </div>
    </nav>
  )
}
