import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { ArrowRight, BookOpen, CalendarDays, Check, Target, Zap } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BentoHeading, BentoSkeleton, BentoTile } from "@/components/commons/bento.jsx"
import { useCertificationStudyPlan } from "@/components/learner/use-certification-study-plan.js"
import { formatWhen, toDateKey } from "@/lib/study-schedule.js"

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
/**
 * @param onCreatePlan  opens the generator in place. Passed by the analytics
 *   board, which owns it; without it the tile falls back to linking there, so
 *   it still works anywhere else it might be mounted.
 */
export function TodaysPlanTile({ certificationId, onCreatePlan }) {
  const navigate = useNavigate()

  const { plan, isLoading, isOverall } = useCertificationStudyPlan(certificationId)

  const { todaysEvents, nextEvent, hasEvents } = useMemo(() => {
    const events = plan?.schedule?.events
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
  }, [plan])

  return (
    <BentoTile col={3} row={2} className="!p-0">
      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <BentoHeading
            title="today's plan"
            hint={
              isOverall
                ? "From your overall study plan, which covers this certification."
                : "What your study plan has scheduled for today."
            }
          />

          {/* The way to the whole schedule, kept in the same box as the way to
              create one -- this tile shows a single day, and "what about the
              rest of it" is the obvious next question. Only once there is a
              plan to look at. */}
          {plan ? (
            <button
              type="button"
              onClick={() => navigate("/learner/plan")}
              className="mt-0.5 shrink-0 text-xs font-semibold text-primary underline decoration-dotted underline-offset-4 hover:text-primary/80"
            >
              view calendar
            </button>
          ) : null}
        </div>

        {isLoading ? (
          <BentoSkeleton rows={2} />
        ) : !hasEvents ? (
          <div className="mt-4 flex flex-1 flex-col justify-center">
            <p className="text-sm font-medium text-foreground">No study plan yet</p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Create one and this shows the topics it schedules for each day.
            </p>

            {/* The one place a plan is created. */}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-fit"
              onClick={
                onCreatePlan ?? (() => navigate("/learner/analytics?plan=1"))
              }
            >
              Create study plan
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
                    {/* The exact time, from the same value the scheduler fires
                        on -- so "Today · 7:00 PM" is a promise the app keeps
                        rather than a label that drifts from the trigger. */}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-medium">{meta.label}</span>
                      {formatWhen(event) ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{formatWhen(event)}</span>
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
