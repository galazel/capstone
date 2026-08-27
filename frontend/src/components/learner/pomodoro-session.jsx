import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Brain, Check, TimerReset } from "@/components/icons"

/**
 * A Pomodoro session: focus, short break, repeat, long break.
 *
 * The clock is derived from a wall-clock deadline rather than counted down by
 * decrementing a number every second. Interval timers drift, and browsers
 * throttle them hard in background tabs — a naive counter loses minutes while
 * the learner reads a lesson in another tab, which is precisely when a study
 * timer is supposed to be running. Storing the instant the phase ends and
 * re-deriving the remainder each tick makes the display correct however long
 * the tab was asleep.
 */

const DEFAULTS = { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, cycles: 4 }

function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds)
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0")
  const seconds = String(safe % 60).padStart(2, "0")
  return `${minutes}:${seconds}`
}

/** The phases one session runs through, in order. */
function buildPhases({ focusMinutes, breakMinutes, longBreakMinutes, cycles }) {
  const phases = []

  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    phases.push({ kind: "focus", label: `Focus ${cycle} of ${cycles}`, minutes: focusMinutes })

    // No trailing break: the session is over when the last focus block is, and
    // a break you are not coming back from is just a five-minute wait.
    if (cycle < cycles) {
      const isLong = cycle % 4 === 0
      phases.push({
        kind: "break",
        label: isLong ? "Long break" : "Break",
        minutes: isLong ? longBreakMinutes : breakMinutes,
      })
    }
  }

  return phases
}

export function PomodoroSession({ task, settings, onComplete, onDismiss }) {
  const phases = useMemo(
    () => buildPhases({ ...DEFAULTS, ...(settings ?? {}) }),
    [settings]
  )

  const [phaseIndex, setPhaseIndex] = useState(0)
  const [running, setRunning] = useState(true)
  const [remaining, setRemaining] = useState(() => phases[0].minutes * 60)

  /* The instant the current phase ends. Null while paused — a pause has to
     forget the deadline, or resuming would find the time already spent. */
  const deadlineRef = useRef(Date.now() + phases[0].minutes * 60_000)

  const phase = phases[phaseIndex]
  const finished = phaseIndex >= phases.length

  useEffect(() => {
    if (!running || finished) return undefined

    function tick() {
      const left = Math.round((deadlineRef.current - Date.now()) / 1000)

      if (left > 0) {
        setRemaining(left)
        return
      }

      // Straight into the next phase rather than waiting to be told: an
      // unattended timer that stops at zero is a timer that needs attending.
      setPhaseIndex((current) => {
        const next = current + 1
        if (next < phases.length) {
          deadlineRef.current = Date.now() + phases[next].minutes * 60_000
          setRemaining(phases[next].minutes * 60)
        } else {
          setRemaining(0)
        }
        return next
      })
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [running, finished, phases])

  useEffect(() => {
    if (finished) onComplete?.()
  }, [finished, onComplete])

  function togglePause() {
    setRunning((wasRunning) => {
      if (wasRunning) return false
      // Resume from what is left, not from where the old deadline was.
      deadlineRef.current = Date.now() + remaining * 1000
      return true
    })
  }

  function skipPhase() {
    setPhaseIndex((current) => {
      const next = current + 1
      if (next < phases.length) {
        deadlineRef.current = Date.now() + phases[next].minutes * 60_000
        setRemaining(phases[next].minutes * 60)
      } else {
        setRemaining(0)
      }
      return next
    })
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Check className="size-7" aria-hidden="true" />
        </span>

        <div>
          <p className="text-lg font-semibold text-foreground">Session complete</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {phases.filter((entry) => entry.kind === "focus").length} focus blocks on{" "}
            {task?.title ?? "your study plan"}.
          </p>
        </div>

        <Button onClick={onDismiss}>Done</Button>
      </div>
    )
  }

  const total = phase.minutes * 60
  const elapsedFraction = total > 0 ? Math.min(1, (total - remaining) / total) : 0

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {phase.kind === "focus" ? (
          <Brain className="size-4" aria-hidden="true" />
        ) : (
          <TimerReset className="size-4" aria-hidden="true" />
        )}
        {phase.label}
      </div>

      {/* The number is the interface. Tabular figures so the digits do not
          jiggle the layout as they change. */}
      <p className="font-rb-display text-6xl font-black tabular-nums leading-none text-foreground">
        {formatClock(remaining)}
      </p>

      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${elapsedFraction * 100}%` }}
        />
      </div>

      <p className="max-w-sm text-sm text-muted-foreground">
        {phase.kind === "focus"
          ? task?.title ?? "Study your scheduled topic."
          : "Stand up, look away from the screen, and come back."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant={running ? "outline" : "default"} onClick={togglePause}>
          {running ? "Pause" : "Resume"}
        </Button>

        <Button variant="ghost" onClick={skipPhase}>
          Skip {phase.kind === "focus" ? "focus" : "break"}
        </Button>

        {/* Leaving is not finishing: the task stays in progress so the plan
            does not claim a session that was abandoned two minutes in. */}
        <Button variant="ghost" onClick={onDismiss}>
          Close
        </Button>
      </div>
    </div>
  )
}

export default PomodoroSession
