import { useEffect, useMemo, useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import {
  Award,
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  ChevronDown,
  CircleHelp,
  Command,
  FileQuestion,
  Files,
  Handshake,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Search,
  Settings,
  Swords,
  Users,
  UsersRound,
  X,
} from "lucide-react"

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
  { label: "Certifications", href: "/learner/certifications", icon: Award },
  { label: "My Learning", href: "/learner/learning", match: ["/learner/learning", "/learner/lessons"], icon: BookOpenCheck },
  { label: "Challenges", href: "/learner/challenges", icon: Swords },
  { label: "Community", href: "/learner/community", icon: UsersRound },
]

const adminGroups = [
  {
    label: "Overview",
    items: [
      { label: "Platform overview", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "Certifications", href: "/admin", icon: Award },
      { label: "Question Bank", href: "/admin/question-bank", icon: FileQuestion },
      { label: "Challenges", href: "/admin/challenges", icon: Swords },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Institutions", href: "/admin/organizations", icon: Building2 },
      { label: "Partnership requests", href: "/admin/partnership-requests", icon: Handshake },
      { label: "Learners", href: "/admin/learners", icon: Users },
    ],
  },
]

const enterpriseGroups = [
  {
    label: "Overview",
    items: [
      { label: "Organization overview", href: "/enterprise/dashboard", icon: LayoutDashboard },
      { label: "Analytics", href: "/enterprise/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "Certifications", href: "/enterprise/certifications", icon: Award },
      { label: "Learners", href: "/enterprise/learners", icon: Users },
      { label: "Groups", href: "/enterprise/groups", icon: UsersRound },
      { label: "Invitations", href: "/enterprise/invitations", icon: Bell },
      { label: "Files", href: "/enterprise/files", icon: Files },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Partnership", href: "/enterprise/partnership", icon: Handshake },
      { label: "License", href: "/enterprise/license", icon: Award },
      { label: "Billing", href: "/enterprise/billing", icon: ReceiptText },
      { label: "Profile", href: "/enterprise/organization", icon: Building2 },
      { label: "Settings", href: "/enterprise/settings", icon: Settings },
    ],
  },
]

function pathMatches(pathname, item) {
  const candidates = item.match ?? [item.href]
  return candidates.some((path) => pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`)))
}

function Brand({ role }) {
  return (
    <NavLink to={role === "LEARNER" ? "/learner/analytics" : role === "ENTERPRISE" ? "/enterprise/dashboard" : "/admin/dashboard"} className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={role === "LEARNER" ? "REBYU home and analytics" : "REBYU home"}>
      <BrandLogo className="size-8" />
      <span className="hidden leading-none sm:block">
        <span className="block font-heading text-[15px] font-bold tracking-tight">REBYU</span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {role === "LEARNER" ? "Learn" : role === "ENTERPRISE" ? "Institution" : "Admin"}
        </span>
      </span>
    </NavLink>
  )
}

function GroupDropdown({ group, pathname }) {
  const active = group.items.some((item) => pathMatches(pathname, item))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("relative inline-flex h-10 items-center gap-1 px-3 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "text-primary after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-primary" : "text-muted-foreground") }>
          {group.label}<ChevronDown className="size-3.5" aria-hidden="true" />
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

export function PortalTopNavigation({ role, actions, organizationName }) {
  const location = useLocation()
  const [commandOpen, setCommandOpen] = useState(false)
  const groups = role === "ADMIN" ? adminGroups : enterpriseGroups
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
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Brand role={role} />
          <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex" aria-label={`${role.toLowerCase()} navigation`}>
            {role === "LEARNER" ? learnerNavigation.slice(0, 6).map((item) => <NavLink key={`${item.label}-${item.href}`} to={item.href} className={cn("relative px-2.5 py-2 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", pathMatches(location.pathname, item) ? "text-primary after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-0.5 after:bg-primary" : "text-muted-foreground")}>{item.label}</NavLink>) : groups.map((group) => <GroupDropdown key={group.label} group={group} pathname={location.pathname} />)}
          </nav>
          {organizationName ? <span className="hidden max-w-48 truncate text-xs text-muted-foreground xl:block">{organizationName}</span> : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" className="hidden h-9 min-w-44 justify-start gap-2 text-muted-foreground md:flex" onClick={() => setCommandOpen(true)}><Search className="size-4" /><span className="flex-1 text-left">Search REBYU</span><kbd className="text-[10px]">Ctrl K</kbd></Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setCommandOpen(true)} aria-label="Search REBYU"><Search /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                {(role === "LEARNER" ? [{ label: "Navigation", items: learnerNavigation }] : groups).map((group, index) => <div key={group.label}><DropdownMenuLabel>{group.label}</DropdownMenuLabel>{group.items.map((item) => <NavigationMenuItem key={item.href} item={item} />)}{index < (role === "LEARNER" ? 0 : groups.length - 1) ? <DropdownMenuSeparator /> : null}</div>)}
              </DropdownMenuContent>
            </DropdownMenu>
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
