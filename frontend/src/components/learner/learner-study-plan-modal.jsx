import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StudyPlanGenerator } from "@/pages/learner/learning/learner-study-plan.jsx"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"
import { FEATURES } from "@/services/subscriptionService.js"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function buildMonth(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date, key: dateKey(date), currentMonth: date.getMonth() === viewDate.getMonth() }
  })
}

export default function LearnerStudyPlanCalendarPage() {
  const entitlements = useLearnerEntitlements()
  const canGeneratePlan = entitlements.hasFeature(FEATURES.PERSONALIZED_STUDY_PLAN)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())
  const [plan, setPlan] = useState(null)
  const days = useMemo(() => buildMonth(viewDate), [viewDate])
  const today = dateKey(new Date())
  const eventsByDate = useMemo(() => (plan?.events ?? []).reduce((result, event) => {
    const key = event.dateKey ?? event.key
    if (key) (result[key] ??= []).push(event)
    return result
  }, {}), [plan])

  function changeMonth(amount) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  function receivePlan(nextPlan) {
    setPlan(nextPlan)
    if (nextPlan.calendarStart) setViewDate(new Date(`${nextPlan.calendarStart}T00:00:00`))
    setGeneratorOpen(false)
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="min-w-0">
        <div className="mb-5 flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-3xl">
                {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {plan?.certification ?? "Personal study calendar"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-fit items-center border border-border bg-card p-0.5">
              <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></Button>
              <Button variant="ghost" size="sm" className="min-w-16" onClick={() => setViewDate(new Date())}>Today</Button>
              <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></Button>
            </div>
            <Button
              className="gap-2 sm:min-w-48"
              onClick={() => setGeneratorOpen(true)}
              disabled={entitlements.isLoading || !canGeneratePlan}
              aria-describedby={!canGeneratePlan ? "study-plan-pro-message" : undefined}
              title={!canGeneratePlan ? "A Pro subscription or institution license is required" : undefined}
            >
              <Sparkles className="size-4" />
              Generate study plan
            </Button>
          </div>
        </div>

        {!entitlements.isLoading && !canGeneratePlan ? (
          <p id="study-plan-pro-message" className="mb-4 text-xs text-muted-foreground">
            Pro feature · Upgrade or use institution access to generate a personalized plan.
          </p>
        ) : null}

        <div className="overflow-x-auto border-y border-border bg-card [scrollbar-width:thin]">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-7 border-b border-border bg-muted">
              {DAY_NAMES.map((day, index) => (
                <div key={day} className={`px-4 py-3 text-xs font-semibold ${index === 0 || index === 6 ? "text-primary" : "text-muted-foreground"}`}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, dayIndex) => {
                const events = eventsByDate[day.key] ?? []
                const isToday = day.key === today
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6
                return (
                  <div key={day.key} className={`min-h-36 border-b border-r border-border/70 p-3.5 [&:nth-child(7n)]:border-r-0 ${dayIndex >= 35 ? "border-b-0" : ""} ${day.currentMonth ? (isWeekend ? "bg-muted/40" : "bg-card") : "bg-muted/20 text-muted-foreground"} ${isToday ? "shadow-[inset_0_3px_0_var(--primary)]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex size-7 items-center justify-center text-xs font-medium ${isToday ? "rounded-full bg-primary font-semibold text-primary-foreground" : ""}`}>{day.date.getDate()}</span>
                      {events.length ? <span className="text-[10px] font-medium text-muted-foreground">{events.length} {events.length === 1 ? "task" : "tasks"}</span> : null}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {events.slice(0, 3).map((event, index) => (
                        <div key={`${event.id ?? event.title}-${index}`} className="truncate border-l-2 border-primary bg-primary/[0.06] px-2 py-1.5 text-[11px] font-medium text-foreground" title={event.title}>{event.title}</div>
                      ))}
                      {events.length > 3 ? <p className="px-2 text-[10px] font-medium text-primary">+{events.length - 3} more</p> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {!plan ? (
          <div className="flex items-center gap-3 border-b border-border px-1 py-5">
            <span className="flex size-9 items-center justify-center bg-accent text-primary"><CalendarDays className="size-4" /></span>
            <div><p className="text-sm font-medium">No scheduled study tasks</p><p className="mt-0.5 text-xs text-muted-foreground">Generate a study plan to add personalized activities to this calendar.</p></div>
          </div>
        ) : null}
      </section>

      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(1180px,calc(100vw-4rem))]">
          <DialogHeader className="sr-only"><DialogTitle>Generate study plan</DialogTitle><DialogDescription>Configure a personalized study plan.</DialogDescription></DialogHeader>
          <StudyPlanGenerator onPlanGenerated={receivePlan} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
