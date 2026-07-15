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
} from "lucide-react"

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
      <SheetContent side="left" className="w-80 p-0" showCloseButton={false}>
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
    <div className="flex min-h-64 flex-col items-center justify-center border-y border-border/60 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function LearnerErrorState({ title = "Could not load data", error, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <p className="font-semibold text-red-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-red-700">
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
      <Skeleton key={item} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

export function LearnerStatCard({ icon: Icon = Award, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950">
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {helper && <p className="mt-3 text-xs leading-5 text-zinc-500">{helper}</p>}
    </div>
  )
}

export function ProgressBar({ value = 0 }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full bg-zinc-950 transition-all"
        style={{ width: `${width}%` }}
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

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
            {certification.industry || "Certification"}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950">
            {certification.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
            {certification.description || "No description available."}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {percent}%
        </span>
      </div>
      <div className="mt-5 space-y-2">
        <ProgressBar value={percent} />
        <p className="text-xs text-zinc-500">
          {completed} of {related.length} lessons completed
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onContinue}>Continue Learning</Button>
        <Button variant="outline" onClick={onProgress}>
          View Progress
        </Button>
      </div>
    </article>
  )
}

export function LessonRow({ lesson, onOpen }) {
  const statusClass =
    lesson.status === "Completed"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-zinc-100 text-zinc-600"

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-zinc-950">{lesson.name}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
            {lesson.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {lesson.middleCategoryTitle || lesson.majorCategoryTitle || "Module"}
        </p>
      </div>
      <Button onClick={onOpen} variant={lesson.completed ? "outline" : "default"}>
        {lesson.completed ? "Review" : "Start"}
      </Button>
    </div>
  )
}

export function WeakTopicCard({ topic }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-950">{topic.title}</p>
          <p className="mt-1 text-xs text-zinc-500">{topic.category}</p>
        </div>
        <span className="text-sm font-semibold text-zinc-900">{topic.percent}%</span>
      </div>
      <div className="mt-3">
        <ProgressBar value={topic.percent} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{topic.recommendation}</p>
    </div>
  )
}

export function LineChartCard({ title, data }) {
  const points = data.filter((item) => Number.isFinite(Number(item.score)))
  const width = 640
  const height = 220
  const padding = 28
  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2)
    const y = height - padding - (Number(point.score) / 100) * (height - padding * 2)
    return { ...point, x, y }
  })
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-950">{title}</h2>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-zinc-950" />
            Quiz / Exam
          </span>
        </div>
      </div>
      {coords.length === 0 ? (
        <LearnerEmptyState
          icon={BarChart3}
          title="No assessment results yet"
          description="Quiz and exam scores will appear here after you complete assessments."
        />
      ) : (
        <div className="mt-5 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px]">
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = height - padding - (tick / 100) * (height - padding * 2)
              return (
                <g key={tick}>
                  <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e4e4e7" />
                  <text x={0} y={y + 4} className="fill-zinc-400 text-[10px]">
                    {tick}
                  </text>
                </g>
              )
            })}
            <path d={path} fill="none" stroke="#18181b" strokeWidth="3" strokeLinecap="round" />
            {coords.map((point) => (
              <g key={point.id}>
                <circle cx={point.x} cy={point.y} r="4" fill="#18181b" />
                <text x={point.x} y={height - 6} textAnchor="middle" className="fill-zinc-500 text-[10px]">
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  )
}

export function BarChartCard({ title, data }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-zinc-950">{title}</h2>
      {data.length === 0 ? (
        <LearnerEmptyState
          icon={Target}
          title="No weak areas recorded"
          description="Weak area analytics will appear after lesson or assessment activity is available."
        />
      ) : (
        <div className="mt-5 space-y-4">
          {data.slice(0, 6).map((item) => (
            <div key={item.lessonId}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-zinc-800">{item.title}</span>
                <span className="text-zinc-500">{item.percent}%</span>
              </div>
              <ProgressBar value={item.percent} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DonutCard({ title, result }) {
  const score = Number(result?.score)
  const value = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null
  const radius = 46
  const circumference = 2 * Math.PI * radius

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-zinc-950">{title}</h2>
      {value === null ? (
        <LearnerEmptyState
          icon={Award}
          title="No mock exam result"
          description="Your most recent mock exam breakdown will appear here once an exam result exists."
        />
      ) : (
        <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row">
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r={radius} fill="none" stroke="#f4f4f5" strokeWidth="16" />
            <circle
              cx="66"
              cy="66"
              r={radius}
              fill="none"
              stroke="#18181b"
              strokeWidth="16"
              strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 66 66)"
            />
            <text x="66" y="71" textAnchor="middle" className="fill-zinc-950 text-xl font-bold">
              {Math.round(value)}%
            </text>
          </svg>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-zinc-950">{result.title}</p>
            <p className="text-zinc-500">Attempt {result.id?.split("-").at(-1) ?? ""}</p>
            <p className="text-zinc-500">Passed: {result.score >= 70 ? "Likely" : "Needs review"}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export const learnerIcons = {
  BookOpen,
  FileText,
  CheckCircle2,
  Target,
  Trophy,
}
