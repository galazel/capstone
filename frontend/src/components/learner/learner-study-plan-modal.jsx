import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { STUDY_PLAN_QUERY_KEY, getMyStudyPlans } from "@/services/studyPlanService.js"

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

/**
 * Which certification a session belongs to.
 *
 * The event's own certification where it has one, and only then the plan's
 * name. An overall plan is called "All certifications", so labelling its events
 * by the plan put that same phrase under every session on the calendar -- true,
 * and useless, since the one thing the label is there to answer is which
 * certification this particular session is for.
 */
function labelFor(event) {
  return event?.certification ?? event?.planLabel ?? "Study plan"
}

function formatDayLabel(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/**
 * The study calendar: every plan the learner is following, laid out by month.
 *
 * Read-only. Generating a plan moved to the certification's curriculum page --
 * the moment the learner opens the course they are about to study, with the
 * diagnostic's priority order behind them -- because reaching it here meant
 * knowing the feature existed and navigating to a calendar to find it.
 *
 * <p>Every active plan, not one. This used to ask for "the active plan" without
 * naming a certification, which the backend answers with whichever plan was
 * created most recently -- so a learner following a plan per certification saw
 * one of them and no sign the others existed, and an overall plan disappeared
 * the moment any certification's plan was built after it. A calendar that hides
 * most of your schedule is worse than no calendar, because it reads as a
 * complete one.
 */
export default function LearnerStudyPlanCalendarPage() {
  const [viewDate, setViewDate] = useState(new Date())
  const [movedToPlan, setMovedToPlan] = useState(false)

  const planQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, "mine"],
    queryFn: getMyStudyPlans,
    staleTime: 30_000,
  })

  /* Only the plans being followed. Regenerating retires the old one as
     ABANDONED rather than deleting it, so the full list carries every plan the
     learner has ever built -- drawing those onto the calendar would replay
     schedules they deliberately replaced. */
  const activePlans = useMemo(
    () => (planQuery.data ?? []).filter((row) => row?.status === "ACTIVE" && row?.schedule),
    [planQuery.data]
  )

  /* Events from every plan on one grid, each tagged with the plan it came from.
     The tag is what keeps a merged calendar readable: without it, two plans
     scheduling a session on the same day are indistinguishable. */
  const events = useMemo(
    () =>
      activePlans.flatMap((row) =>
        (row.schedule?.events ?? []).map((event) => ({
          ...event,
          planId: row.planId,
          planLabel: row.schedule?.certification ?? row.goal ?? "Study plan",
        }))
      ),
    [activePlans]
  )

  /* The span every plan covers between them, read off the saved schedules
     rather than off the events, so it states what was asked for even where
     generation produced nothing. */
  const planRange = useMemo(() => {
    const starts = activePlans.map((row) => row.schedule?.calendarStart).filter(Boolean)
    const ends = activePlans.map((row) => row.schedule?.targetExamDate).filter(Boolean)
    if (starts.length === 0 || ends.length === 0) return null

    // Zero-padded YYYY-MM-DD, so plain string ordering is chronological.
    const from = starts.reduce((earliest, value) => (value < earliest ? value : earliest))
    const to = ends.reduce((latest, value) => (value > latest ? value : latest))

    return `${formatDayLabel(from)} → ${formatDayLabel(to)}`
  }, [activePlans])

  /* What this calendar is showing. Named individually while that stays
     readable, and counted once it does not -- a header is not the place for a
     list of six certification titles. */
  const planSummary = useMemo(() => {
    if (activePlans.length === 0) return "Personal study calendar"
    if (activePlans.length > 3) return `${activePlans.length} study plans`
    return activePlans
      .map((row) => row.schedule?.certification ?? row.goal ?? "Study plan")
      .join(" · ")
  }, [activePlans])

  const days = useMemo(() => buildMonth(viewDate), [viewDate])
  const today = dateKey(new Date())
  const eventsByDate = useMemo(() => events.reduce((result, event) => {
    const key = event.dateKey ?? event.key
    if (key) (result[key] ??= []).push(event)
    return result
  }, {}), [events])

  // Opens on the month the earliest plan starts, once, rather than on today --
  // a plan that begins next month would otherwise load onto an empty grid. Only
  // the first time, so paging away from it sticks.
  const earliestStart = useMemo(() => {
    const starts = activePlans.map((row) => row.schedule?.calendarStart).filter(Boolean)
    return starts.length ? starts.reduce((a, b) => (b < a ? b : a)) : null
  }, [activePlans])

  useEffect(() => {
    if (movedToPlan || !earliestStart) return
    setViewDate(new Date(`${earliestStart}T00:00:00`))
    setMovedToPlan(true)
  }, [earliestStart, movedToPlan])

  function changeMonth(amount) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  /* The height left between the top of the calendar and the bottom of the
     window, measured rather than assumed.
   *
   * A `calc(100dvh - 8.5rem)` would mean hardcoding the height of the portal
   * header and the page padding above this point -- a number that is wrong the
   * moment either changes, and wrong differently at every breakpoint, in the
   * direction that puts the last week back under the fold. Measuring the
   * element's own offset costs one layout pass and is right by construction.
   *
   * `useLayoutEffect` so the height is applied before paint: with a plain
   * effect the grid renders full-height for a frame and visibly collapses. */
  const frameRef = useRef(null)
  const [frameHeight, setFrameHeight] = useState(null)

  useLayoutEffect(() => {
    function measure() {
      const top = frameRef.current?.getBoundingClientRect().top
      if (top == null) return
      // A floor, so a short window scrolls rather than crushing the grid into
      // an unreadable band of slivers.
      setFrameHeight(Math.max(420, Math.round(window.innerHeight - top - 16)))
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  return (
    /* Sized to the viewport rather than to its content, so the whole month is
       on screen at once. A calendar you have to scroll defeats the one thing a
       month grid is for -- seeing the shape of the month -- and the six-row
       grid divides whatever height is left rather than setting its own. */
    <div
      ref={frameRef}
      className="flex min-w-0 flex-col"
      style={{ height: frameHeight ?? undefined }}
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 pb-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground sm:text-2xl">
              {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h2>

            {/* Which plans this is showing, and the span they cover between
                them. Without the range printed, a plan running to a later exam
                date looks like the calendar inventing sessions past the date
                you chose. */}
            <p className="truncate text-xs text-muted-foreground">
              {planSummary}
              {planRange ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>{planRange}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex w-fit items-center border border-border bg-card p-0.5">
              <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></Button>
              <Button variant="ghost" size="sm" className="min-w-14" onClick={() => setViewDate(new Date())}>Today</Button>
              <Button variant="ghost" size="icon-sm" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></Button>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              {/* Both go to the analytics board: it is the one place a plan is
                  built, so "update" is the same journey as "create". */}
              <Link to="/learner/analytics?plan=1">
                <Sparkles className="size-4" />
                {activePlans.length ? "Update plan" : "Create a plan"}
              </Link>
            </Button>
          </div>
        </div>

        {/* `min-w` low enough that a desktop never scrolls sideways. The old
            900px floor forced a horizontal scrollbar on top of the vertical
            one. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto border-y border-border bg-card [scrollbar-width:thin]">
          <div className="flex min-h-0 min-w-[44rem] flex-1 flex-col">
            <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted">
              {DAY_NAMES.map((day, index) => (
                <div key={day} className={`px-3 py-1.5 text-[11px] font-semibold ${index === 0 || index === 6 ? "text-primary" : "text-muted-foreground"}`}>{day}</div>
              ))}
            </div>

            {/* Six fixed rows sharing the leftover height: `minmax(0,1fr)` is
                what lets a row shrink below its content instead of pushing the
                grid past the fold. */}
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[repeat(6,minmax(0,1fr))]">
              {days.map((day, dayIndex) => {
                // Named apart from the merged `events` above rather than
                // shadowing it -- one is this day's, the other is every day's.
                const dayEvents = eventsByDate[day.key] ?? []
                const isToday = day.key === today
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6
                return (
                  <div key={day.key} className={`flex min-h-0 flex-col overflow-hidden border-b border-r border-border/70 px-1.5 py-1 [&:nth-child(7n)]:border-r-0 ${dayIndex >= 35 ? "border-b-0" : ""} ${day.currentMonth ? (isWeekend ? "bg-muted/40" : "bg-card") : "bg-muted/20 text-muted-foreground"} ${isToday ? "shadow-[inset_0_3px_0_var(--primary)]" : ""}`}>
                    <div className="flex shrink-0 items-center justify-between">
                      <span className={`inline-flex size-5 items-center justify-center text-[11px] font-medium ${isToday ? "rounded-full bg-primary font-semibold text-primary-foreground" : ""}`}>{day.date.getDate()}</span>
                      {dayEvents.length ? <span className="text-[10px] font-medium text-muted-foreground">{dayEvents.length}</span> : null}
                    </div>

                    {/* Scrolls within its own day rather than stretching the
                        row: a single busy day would otherwise set the height of
                        every week on the grid. */}
                    <div className="mt-0.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {dayEvents.map((event, index) => (
                        <div
                          key={`${event.planId ?? ""}-${event.id ?? event.title}-${index}`}
                          className="border-l-2 border-primary bg-primary/[0.06] px-1.5 py-0.5 text-[10px] font-medium leading-tight text-foreground"
                          title={`${event.title} · ${labelFor(event)}`}
                        >
                          <p className="truncate">{event.title}</p>

                          {/* Which certification this session belongs to,
                              written out rather than left to a colour -- but
                              only when the calendar carries more than one plan,
                              since otherwise it repeats the header on every
                              single event. */}
                          {activePlans.length > 1 ? (
                            <p className="truncate text-[9px] font-normal text-muted-foreground">
                              {labelFor(event)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {activePlans.length === 0 && !planQuery.isLoading ? (
          <div className="flex shrink-0 items-center gap-3 px-1 py-3">
            <span className="flex size-9 items-center justify-center bg-accent text-primary"><CalendarDays className="size-4" /></span>
            <div>
              <p className="text-sm font-medium">No scheduled study tasks</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Create a study plan from Analytics — it needs your diagnostic result
                to decide what to schedule first.
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
