import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PomodoroSession } from "@/components/learner/pomodoro-session.jsx"
import { RecallSession } from "@/components/learner/recall-session.jsx"
import { SpacedRepetitionSession } from "@/components/learner/spaced-repetition-session.jsx"
import { formatWhen, isDue } from "@/lib/study-schedule.js"
import {
  STUDY_PLAN_QUERY_KEY,
  STUDY_PLAN_TASKS_QUERY_KEY,
  getMyStudyPlans,
  getStudyPlanTaskStatuses,
  setStudyPlanTaskStatus,
} from "@/services/studyPlanService.js"

/**
 * Runs the learner's scheduled study activities when their time comes.
 *
 * <p>Mounted once, beside the router's pages rather than inside one, so a
 * session fires whatever the learner happens to be reading. A page cannot own
 * this: the whole point is that the learner did not navigate anywhere to make
 * it happen.
 *
 * <h3>What "automatic" can actually mean</h3>
 * A browser tab cannot wake itself. If REBYU is not open at 7:00 PM, nothing
 * fires at 7:00 PM — no amount of client code changes that, and only a push
 * notification or a native app would. So a session is due from its scheduled
 * time onwards rather than exactly at it, and an open tab picks up anything
 * that came due while it was closed. A missed session surfaces the moment the
 * learner comes back instead of being silently skipped, which is the honest
 * reading of "the learner should not have to click anything".
 *
 * <h3>Why status is server-side</h3>
 * Firing is decided from the plan plus recorded task status. Kept only in the
 * browser, a reload would re-fire a session the learner just finished, and a
 * second tab would fire it again alongside the first.
 */

/** How often the clock is checked. A minute's granularity, checked twice. */
const TICK_MS = 30_000

const ACTIVITY_TITLES = {
  "pomodoro": "Pomodoro session",
  "active-recall": "Active recall",
  "spaced-repetition": "Spaced repetition review",
}

export function StudyActivityHost() {
  const queryClient = useQueryClient()

  const plansQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, "mine"],
    queryFn: getMyStudyPlans,
    staleTime: 5 * 60_000,
  })

  const statusesQuery = useQuery({
    queryKey: [STUDY_PLAN_TASKS_QUERY_KEY],
    queryFn: getStudyPlanTaskStatuses,
    staleTime: 60_000,
  })

  /* The task on screen right now, or null. Held here rather than derived from
     the clock so that dismissing one keeps it dismissed until its status is
     written -- otherwise the next tick would re-open what was just closed. */
  const [activeTask, setActiveTask] = useState(null)

  /* Tasks this tab has already opened. Belt and braces alongside the server's
     status: the status write is a round trip, and two ticks can pass before it
     lands. Without this, a slow network re-opens the same session. */
  const firedRef = useRef(new Set())

  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const statusMutation = useMutation({
    mutationFn: setStudyPlanTaskStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STUDY_PLAN_TASKS_QUERY_KEY] }),
    onError: (error) => {
      // Never swallowed: if status cannot be written, the same session will
      // offer itself again on the next load, and the learner deserves to know
      // why rather than thinking the app is stuck in a loop.
      console.warn("Could not record study task status.", error)
    },
  })

  /** Recorded status per "planId:eventId", for the settled-task test below. */
  const statusByTask = useMemo(() => {
    const map = new Map()
    for (const row of statusesQuery.data ?? []) {
      map.set(`${row.planId}:${row.eventId}`, row.status)
    }
    return map
  }, [statusesQuery.data])

  /**
   * The session that should be running, if any.
   *
   * The earliest due one, so a learner returning after a gap works forward
   * through what they missed rather than being handed the most recent first.
   */
  const dueTask = useMemo(() => {
    const candidates = []

    for (const plan of plansQuery.data ?? []) {
      if (plan?.status !== "ACTIVE") continue

      for (const event of plan.schedule?.events ?? []) {
        if (!isDue(event, now)) continue

        const key = `${plan.planId}:${event.id}`
        const status = statusByTask.get(key)

        // Anything already settled is done with -- only a genuinely untouched
        // task, or one this tab has not yet opened, is a candidate.
        if (status && status !== "PENDING") continue
        if (firedRef.current.has(key)) continue

        candidates.push({
          key,
          planId: plan.planId,
          event,
          certification: event.certification ?? plan.schedule?.certification ?? null,
          /* An overall plan stamps the certification on each event, since it
             spans several; a single-certification plan carries it on the row
             itself. Recall needs it either way -- questions are assembled per
             certification, and enrolment is checked against it. */
          certificationId: event.certificationId ?? plan.certificationId ?? null,
        })
      }
    }

    candidates.sort((a, b) => String(a.event.at).localeCompare(String(b.event.at)))
    return candidates[0] ?? null
  }, [plansQuery.data, statusByTask, now])

  useEffect(() => {
    if (activeTask || !dueTask) return

    firedRef.current.add(dueTask.key)
    setActiveTask(dueTask)
    statusMutation.mutate({
      planId: dueTask.planId,
      eventId: dueTask.event.id,
      status: "IN_PROGRESS",
    })
    // `statusMutation` deliberately absent: it is recreated every render, and
    // depending on it would re-run this the instant a task opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask, dueTask])

  const finishTask = useCallback(
    (status) => {
      const task = activeTask
      setActiveTask(null)
      if (!task) return

      // IN_PROGRESS is left as it is on a dismissal: the session was started
      // and not finished, which is exactly what the record should say.
      if (status) {
        statusMutation.mutate({ planId: task.planId, eventId: task.event.id, status })
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [activeTask]
  )

  if (!activeTask) return null

  const technique = activeTask.event.technique
  const title = ACTIVITY_TITLES[technique] ?? "Scheduled study session"

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) finishTask(null)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>

          {/* Says what this is and why it appeared. A modal that opens by
              itself owes the learner that much -- without it, an exam
              appearing unbidden reads as a bug. */}
          <DialogDescription>
            {formatWhen(activeTask.event, now)}
            {activeTask.certification ? ` · ${activeTask.certification}` : ""}
          </DialogDescription>
        </DialogHeader>

        {technique === "pomodoro" ? (
          <PomodoroSession
            task={activeTask.event}
            onComplete={() => finishTask("COMPLETED")}
            onDismiss={() => finishTask(null)}
          />
        ) : technique === "active-recall" ? (
          <RecallSession
            task={activeTask.event}
            certificationId={activeTask.certificationId}
            /* Completed on starting, not on submitting: the learner leaves this
               modal for the attempt runner, and the exam's own result is the
               record of how it went. Leaving the task in progress would have it
               re-offered on the next page they land on -- mid-exam. */
            onStarted={() => finishTask("COMPLETED")}
            onDismiss={() => finishTask(null)}
          />
        ) : technique === "spaced-repetition" ? (
          <SpacedRepetitionSession
            task={activeTask.event}
            certificationId={activeTask.certificationId}
            onComplete={() => finishTask("COMPLETED")}
            onDismiss={() => finishTask(null)}
          />
        ) : (
          /* Active recall and spaced repetition are not built yet. Saying so
             beats firing an empty modal, and beats pretending the session
             happened by marking it complete. */
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-foreground">
              {activeTask.event.title}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              This session is scheduled as {title.toLowerCase()}, which isn&apos;t ready
              yet. Nothing has been marked complete — it will be offered again.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default StudyActivityHost
