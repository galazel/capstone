import { useQuery } from "@tanstack/react-query"

import { CalendarDays } from "@/components/icons"
import { BentoHeading, BentoSkeleton, BentoTile } from "@/components/commons/bento.jsx"
import { STUDY_PLAN_QUERY_KEY, getActiveStudyPlan } from "@/services/studyPlanService.js"

function parseDay(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function daysUntil(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Whole days, so "1 day to go" means tomorrow rather than some number of
  // hours the learner has to interpret.
  return Math.round((date - today) / 86_400_000)
}

function formatExamDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Days until the exam the learner is preparing for.
 *
 * Read-only: the date comes from the target exam date on their study plan,
 * which is where they set it and what the whole schedule is built backwards
 * from. A second place to edit it would let the countdown and the plan disagree
 * about when the exam is.
 *
 * Once the date passes the tile does not keep counting into negatives or
 * silently vanish -- it says the exam has been and gone, which is the honest
 * thing to show and points at the plan that needs updating.
 */
export function ExamCountdownTile({ certificationId }) {
  const planQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, String(certificationId ?? "")],
    queryFn: () => getActiveStudyPlan(certificationId),
    enabled: Boolean(certificationId),
    staleTime: 60_000,
  })

  const examDate = parseDay(planQuery.data?.schedule?.targetExamDate)
  const days = examDate ? daysUntil(examDate) : null
  const past = days !== null && days < 0
  const today = days === 0

  return (
    // Half the band, beside the notes tile.
    <BentoTile col={3} row={2}>
      <BentoHeading title="exam countdown" />

      {planQuery.isLoading ? (
        <BentoSkeleton rows={1} />
      ) : !examDate ? (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-sm font-medium text-foreground">No exam date yet</p>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Build a study plan for this certification in My Learning and the countdown
            starts from its target exam date.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex items-baseline gap-2">
            <span className="font-rb-display text-5xl font-black leading-none tabular-nums text-foreground">
              {today ? "today" : Math.abs(days)}
            </span>

            {today ? null : (
              <span className="text-sm font-bold text-muted-foreground">
                {Math.abs(days) === 1
                  ? past ? "day ago" : "day to go"
                  : past ? "days ago" : "days to go"}
              </span>
            )}
          </div>

          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            {formatExamDate(examDate)}
          </p>
        </div>
      )}
    </BentoTile>
  )
}
