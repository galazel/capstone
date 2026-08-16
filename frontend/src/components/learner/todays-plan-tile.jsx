import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { ArrowRight, BookOpen, CalendarDays, Check, Target, Zap } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BentoHeading, BentoSkeleton, BentoTile } from "@/components/commons/bento.jsx"
import { STUDY_PLAN_QUERY_KEY, getActiveStudyPlan } from "@/services/studyPlanService.js"

/**
 * `dateKey` as the plan generator writes it: a local YYYY-MM-DD, built from the
 * browser's own calendar fields rather than from an ISO timestamp.
 *
 * `toISOString().slice(0,10)` would be the obvious thing here and is wrong —
 * it converts to UTC first, so anywhere east of Greenwich the early hours of a
 * day report yesterday's date, and the tile would show the wrong session for
 * the first several hours of every morning. This mirrors the generator's own
 * `toDateKey` exactly, which is what the keys were written with.
 */
function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/* The event types the generator emits, and how each should read. Every entry
   carries its own words — a session that is a mock exam and one that is a
   lesson are different work, and a single generic "study" label would hide
   that. */
const EVENT_META = {
  lesson: { label: "lesson", icon: BookOpen, tone: "bg-rb-macaw-wash text-rb-macaw-lip" },
  review: { label: "review", icon: Check, tone: "bg-rb-beetle-wash text-rb-beetle-lip" },
  quiz: { label: "quiz", icon: Zap, tone: "bg-rb-fox-wash text-rb-fox-lip" },
  mock: { label: "mock exam", icon: Target, tone: "bg-rb-cardinal-wash text-rb-cardinal-lip" },
  "catch-up": { label: "catch-up", icon: CalendarDays, tone: "bg-rb-polar text-rb-wolf" },
}

function metaFor(type) {
  return EVENT_META[type] ?? EVENT_META.lesson
}

function formatDay(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })
}

/**
 * What the learner's study plan says to do today.
 *
 * The plan is generated in the browser and stored whole, so the events are read
 * back out of `schedule.events` rather than recomputed — recomputing would let
 * this tile and the study calendar disagree about the same day.
 *
 * When today has nothing scheduled the tile does not go blank or claim a rest
 * day: it shows the next session that is coming, which is the useful answer for
 * someone who has opened their analytics on an off day. A plan whose remaining
 * sessions are all in the past says so instead of showing nothing.
 */
export function TodaysPlanTile({ certificationId }) {
  const navigate = useNavigate()

  const planQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, String(certificationId ?? "")],
    queryFn: () => getActiveStudyPlan(certificationId),
    enabled: Boolean(certificationId),
    staleTime: 60_000,
  })

  const { todaysEvents, nextEvent, hasEvents } = useMemo(() => {
    const events = planQuery.data?.schedule?.events
    if (!Array.isArray(events) || events.length === 0) {
      return { todaysEvents: [], nextEvent: null, hasEvents: false }
    }

    const todayKey = toDateKey(new Date())
    const todays = events.filter((event) => event.dateKey === todayKey)

    /* String comparison rather than Date parsing: the keys are zero-padded
       YYYY-MM-DD, so lexicographic order is chronological order and there is
       no timezone to get wrong. */
    const upcoming = events
      .filter((event) => event.dateKey > todayKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))

    return { todaysEvents: todays, nextEvent: upcoming[0] ?? null, hasEvents: true }
  }, [planQuery.data])

  return (
    <BentoTile col={3} row={2} className="!p-0">
      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
        <BentoHeading
          title="today's plan"
          hint="What your study plan has scheduled for today."
        />

        {planQuery.isLoading ? (
          <BentoSkeleton rows={2} />
        ) : !hasEvents ? (
          <div className="mt-4 flex flex-1 flex-col justify-center">
            <p className="text-sm font-medium text-foreground">No study plan yet</p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Build one in My Learning and this shows the topics it schedules for
              each day.
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-fit"
              onClick={() => navigate("/learner/learning")}
            >
              Build a study plan
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : todaysEvents.length > 0 ? (
          <ul className="-mr-2 mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
            {todaysEvents.map((event) => {
              const meta = metaFor(event.type)
              const Icon = meta.icon
              return (
                <li
                  key={event.id}
                  className="flex items-start gap-3 rounded-rb-tile border border-border/60 p-3"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${meta.tone}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5 text-foreground">
                      {event.title}
                    </p>

                    {/* The type is written, never left to the icon's colour. */}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-medium">{meta.label}</span>
                      {event.time ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{event.time}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-4 flex flex-1 flex-col justify-center">
            <p className="text-sm font-medium text-foreground">
              Nothing scheduled today
            </p>

            {nextEvent ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Next up: <span className="font-semibold text-foreground">{nextEvent.title}</span>{" "}
                on {formatDay(nextEvent.dateKey)}.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Every session on this plan has passed — build a new one to keep a
                schedule.
              </p>
            )}
          </div>
        )}
      </div>
    </BentoTile>
  )
}

export default TodaysPlanTile
