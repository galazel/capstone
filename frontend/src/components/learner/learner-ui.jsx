import React from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  CircleUserRound,
  FileText,
  FolderOpen,
  LibraryBig,
  LogOut,
  Menu,
  Search,
  Target,
  Trophy,
  UserRound,
} from "@/components/icons"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarBreakdownChart,
  ChartPanel,
  RadialGauge,
  TrendLineChart,
} from "@/components/charts/rebyu-charts.jsx"
import { BUBBLE_TONES, BubbleCard } from "@/components/commons/bubble-card.jsx"

const mainItems = [
  { label: "Progress", href: "/learner/progress", icon: BarChart3 },
  { label: "Learning", href: "/learner/learning", icon: LibraryBig },
  { label: "Challenges", href: "/learner/challenges", icon: Trophy },
]

const pageItems = [
  { label: "Account", href: "/learner/account", icon: UserRound },
  { label: "Library", href: "/learner/files", icon: FolderOpen },
]

function getInitials(name = "", email = "") {
  const source = name || email || "Learner"
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function getLearnerDisplayName(data) {
  const learner = data?.learner
  const identity = data?.identity
  const fullName = [learner?.firstName, learner?.lastName].filter(Boolean).join(" ")
  return fullName || learner?.username || identity?.name || "Learner"
}

export function LearnerSidebar({ data, onNavigate }) {
  const displayName = getLearnerDisplayName(data)
  const email = data?.user?.email ?? data?.identity?.email ?? ""

  const renderSection = (title, items) => (
    <div className="space-y-2">
      <p className="px-3 text-[11px] font-semibold tracking-[0.18em] text-zinc-400">
        {title}
      </p>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-zinc-100 text-zinc-950 shadow-sm"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="border-b border-zinc-100 p-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarFallback className="bg-zinc-950 text-white">
              {getInitials(displayName, email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">
              {displayName}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Learner</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
        {renderSection("MAIN", mainItems)}
        {renderSection("PAGES", pageItems)}
      </div>

      <div className="border-t border-zinc-100 p-5">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
          <BrandLogo className="size-9" />
          <div>
            <p className="text-sm font-bold tracking-tight text-zinc-950">REBYU</p>
            <p className="text-xs text-zinc-500">Learner Portal</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function getPageTitle(pathname) {
  if (pathname.includes("/progress")) return "My Progress"
  if (pathname.includes("/learning")) return "My Learning"
  if (pathname.includes("/lessons")) return "Lesson"
  if (pathname.includes("/certifications")) return "My Certifications"
  if (pathname.includes("/challenges")) return "Challenges"
  if (pathname.includes("/files")) return "Library"
  if (pathname.includes("/account")) return "Account"
  return "Learner"
}

export function LearnerHeader({ data, onMenuClick, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const location = useLocation()
  const displayName = getLearnerDisplayName(data)
  const email = data?.user?.email ?? data?.identity?.email ?? ""

  const logout = () => {
    localStorage.removeItem("role")
    localStorage.removeItem("learnerId")
    localStorage.removeItem("learner_id")
    localStorage.removeItem("userId")
    localStorage.removeItem("user_id")
    localStorage.removeItem("name")
    localStorage.removeItem("email")
    navigate("/", { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur lg:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open learner menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-950">
            {getPageTitle(location.pathname)}
          </p>
          <p className="hidden text-xs text-zinc-500 sm:block">
            Learn, practice, and track your certification readiness.
          </p>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center px-6 lg:flex">
        <label className="relative w-full max-w-md">
          <span className="sr-only">Search learner portal</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search lessons, certifications, files"
            className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open notifications">
              <Bell className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-3 py-8 text-center">
              <Bell className="mx-auto h-6 w-6 text-zinc-300" />
              <p className="mt-2 text-sm font-medium text-zinc-800">
                No notifications yet
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Certification updates and reminders will appear here.
              </p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-1 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            >
              <Avatar>
                <AvatarFallback>{getInitials(displayName, email)}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Open account menu</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate">{displayName}</span>
              <span className="block truncate text-xs font-normal text-zinc-500">
                {email || "Learner"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/learner/account")}>
              <CircleUserRound className="h-4 w-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} variant="destructive">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export function LearnerMobileSidebar({ open, onOpenChange, data }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Learner navigation</SheetTitle>
        <LearnerSidebar data={data} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

export function LearnerPageHeader({ title, subtitle, children }) {
  void title
  void subtitle

  return children ? (
    <div className="flex justify-end">{children}</div>
  ) : null
}

export function LearnerEmptyState({ icon: Icon = BookOpen, title, description, action }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-rb-card border-2 border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-rb-macaw-wash text-rb-macaw-lip">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-4 font-rb-display text-base font-extrabold lowercase text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function LearnerErrorState({ title = "Could not load data", error, onRetry }) {
  return (
    <div className="rounded-rb-card border-2 border-rb-cardinal/40 bg-rb-cardinal-wash p-6">
      <p className="font-rb-display font-extrabold lowercase text-rb-cardinal-lip">{title}</p>
      <p className="mt-2 text-sm leading-6 text-rb-eel">
        {error?.response?.data?.message || error?.message || "Please try again."}
      </p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function LearnerLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-32 rounded-rb-card" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-rb-card" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-rb-card" />
        <Skeleton className="h-72 rounded-rb-card" />
      </div>
    </div>
  )
}

/** Tone keys the icon chip to the metric so a row of tiles is scannable. */
const STAT_TONES = {
  macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
  feather: "bg-rb-feather-wash text-rb-feather-lip",
  fox: "bg-rb-fox-wash text-rb-fox-lip",
  beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
  bee: "bg-rb-bee-wash text-rb-bee-lip",
}

export function LearnerStatCard({ icon: Icon = Award, label, value, helper, tone = "macaw" }) {
  return (
    <div className="rounded-rb-card border-2 border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="mt-3 font-rb-display text-4xl font-extrabold leading-none tabular-nums tracking-tight text-foreground sm:text-5xl">
            {value}
          </p>
        </div>
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
            STAT_TONES[tone] ?? STAT_TONES.macaw
          }`}
        >
          <Icon className="size-5" />
        </span>
      </div>
      {helper && <p className="mt-3 text-xs leading-5 text-muted-foreground">{helper}</p>}
    </div>
  )
}

/**
 * @param color  fill colour; defaults to the app primary. Cards pass their own
 *               tone so the bar belongs to the card it sits in rather than
 *               being the one blue thing on a violet card.
 */
export function ProgressBar({ value = 0, color }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${color ? "" : "bg-primary"}`}
        style={{ width: `${width}%`, ...(color ? { background: color } : null) }}
      />
    </div>
  )
}

export function CertificationProgressCard({ certification, lessons, onContinue, onProgress }) {
  const related = lessons.filter(
    (lesson) => String(lesson.certificationId) === String(certification.certificationId)
  )
  const completed = related.filter((lesson) => lesson.completed).length
  const percent = related.length ? Math.round((completed / related.length) * 100) : 0

  /* Same bubble card the challenge arenas use — the certification is the
     entity, so it keeps one tone wherever it appears. */
  const tone = toneForCertification(certification)
  /* The card's own colour, reused by the call to action and the bar. A blue
     button on a violet card was the one element that had not been told which
     card it belonged to. `solid` is a darkened shade of the tone, not the cap
     colour: white label text on the cap's own blue/violet/cyan sits between
     2.4:1 and 2.5:1, well under the 4.5:1 a button label needs. */
  const palette = BUBBLE_TONES[tone] ?? BUBBLE_TONES.macaw

  return (
    <BubbleCard
      tone={tone}
      cap="flat"
      body="card"
      icon={GraduationCap}
      eyebrow={certification.industry || "Certification"}
      title={certification.title}
      chips={[{ label: `${percent}%`, side: "right" }]}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full text-white hover:opacity-90"
            style={{ background: palette.solid }}
            onClick={onContinue}
          >
            Continue Learning
          </Button>
          <Button
            variant="outline"
            className="rounded-full bg-card"
            style={{ color: palette.solid, borderColor: palette.solid }}
            onClick={onProgress}
          >
            View Progress
          </Button>
        </div>
      }
    >
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {certification.description || "No description available."}
      </p>

      <div className="mt-4 space-y-2">
        <ProgressBar value={percent} color={palette.solid} />
        <p className="text-xs font-semibold text-muted-foreground">
          {completed} of {related.length} lessons completed
        </p>
      </div>
    </BubbleCard>
  )
}

/**
 * One tone for every certification: `feather`, the brand blue.
 *
 * This used to hash a certification into one of four hues so a track kept its
 * own colour across pages. It was stable, but it was not consistent — three
 * learner surfaces and the admin console each drew the same catalog in a
 * different set of colours, and the blue on the certification covers matched
 * none of them. Hue here was decorative by its own admission, so it is not
 * worth four palettes: cap, button and progress fill now all speak `feather`,
 * the same blue the covers and the admin arenas wear.
 *
 * Kept as a function rather than inlined — the callers ask "what colour is
 * this certification", which is still the right question, and the answer can
 * become per-industry later without any of them changing.
 */
export function toneForCertification() {
  return "feather"
}

export function LessonRow({ lesson, onOpen }) {
  const statusClass =
    lesson.status === "Completed"
      ? "bg-rb-feather-wash text-rb-feather-lip"
      : "bg-muted text-muted-foreground"

  return (
    <div className="flex flex-col gap-4 rounded-rb-tile border-2 border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-foreground">{lesson.name}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
            {lesson.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {lesson.middleCategoryTitle || lesson.majorCategoryTitle || "Module"}
        </p>
      </div>
      <Button
        onClick={onOpen}
        className="shrink-0 rounded-full"
        variant={lesson.completed ? "outline" : "default"}
      >
        {lesson.completed ? "Review" : "Start"}
      </Button>
    </div>
  )
}

export function WeakTopicCard({ topic }) {
  return (
    <div className="rounded-rb-tile border-2 border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-foreground">{topic.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{topic.category}</p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
          {topic.percent}%
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar value={topic.percent} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{topic.recommendation}</p>
    </div>
  )
}

/* These three used to be hand-rolled SVG on hardcoded zinc hex. They now render
   through the shared chart kit, so the portal and the landing page plot on one
   palette and one set of mark specs. The prop shapes are unchanged. */

export function LineChartCard({ title, data }) {
  const points = (data ?? [])
    .filter((item) => Number.isFinite(Number(item.score)))
    .map((item) => ({ ...item, score: Number(item.score) }))

  return (
    <ChartPanel title={title} subtitle="Quiz and exam scores, most recent last">
      {points.length === 0 ? (
        <LearnerEmptyState
          icon={BarChart3}
          title="No assessment results yet"
          description="Quiz and exam scores will appear here after you complete assessments."
        />
      ) : (
        <TrendLineChart
          data={points}
          xKey="label"
          series={[{ key: "score", name: "Score" }]}
          unit="%"
          ticks={[0, 25, 50, 75, 100]}
          legendNote="Most recent attempt"
        />
      )}
    </ChartPanel>
  )
}

export function BarChartCard({ title, data }) {
  const rows = (data ?? []).slice(0, 6).map((item) => ({
    topic: item.title,
    percent: Number(item.percent) || 0,
  }))

  return (
    <ChartPanel title={title} subtitle="Lowest scoring topics first">
      {rows.length === 0 ? (
        <LearnerEmptyState
          icon={Target}
          title="No weak areas recorded"
          description="Weak area analytics will appear after lesson or assessment activity is available."
        />
      ) : (
        <BarBreakdownChart
          data={rows}
          categoryKey="topic"
          valueKey="percent"
          unit="%"
          target={70}
        />
      )}
    </ChartPanel>
  )
}

export function DonutCard({ title, result }) {
  const score = Number(result?.score)
  const value = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null

  return (
    <ChartPanel title={title} subtitle={result?.title}>
      {value === null ? (
        <LearnerEmptyState
          icon={Award}
          title="No mock exam result"
          description="Your most recent mock exam breakdown will appear here once an exam result exists."
        />
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="w-full max-w-52">
            <RadialGauge value={value} label="score" />
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Exam</dt>
              <dd className="font-bold text-foreground">{result.title}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Attempt</dt>
              <dd className="font-semibold text-foreground">
                {result.id?.split("-").at(-1) ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Outcome</dt>
              <dd className="font-semibold text-foreground">
                {value >= 70 ? "Likely pass" : "Needs review"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </ChartPanel>
  )
}

export const learnerIcons = {
  BookOpen,
  FileText,
  CheckCircle2,
  Target,
  Trophy,
}
