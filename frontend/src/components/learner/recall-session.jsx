import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Brain, Loader2 } from "@/components/icons"
import { createRecallSession } from "@/services/recallService.js"

/**
 * The Active Recall session: a paper built from what this learner keeps getting
 * wrong, opened without them having to go and find it.
 *
 * <p>The exam is minted on open and then handed to the ordinary attempt runner
 * at {@code /learner/assessments/:examId}. Recreating a question-answering UI
 * here would mean a second implementation of autosave, grading, timing and
 * every question type -- and the one place a learner sits an exam should be the
 * same place whatever put it in front of them.
 *
 * <p>It is minted rather than pre-built because the selection is only true at
 * the moment it is asked for: a paper assembled last week would re-test
 * mistakes the learner has since fixed and miss the ones they have since made.
 */
export function RecallSession({ task, certificationId, onStarted, onDismiss }) {
  const navigate = useNavigate()

  const [state, setState] = useState({ status: "building" })

  /* Minted once per opening. Without the guard React's development double-mount
     would create two exams for one scheduled session, and the learner would sit
     one while the other sat abandoned in their history. */
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    let cancelled = false

    createRecallSession({
      certificationId,
      // The lesson the plan scheduled, when the event names one -- its
      // questions are preferred over the rest of the certification's.
      lessonId: task?.lessonId ?? null,
    })
      .then((session) => {
        if (!cancelled) setState({ status: "ready", session })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error })
      })

    return () => {
      cancelled = true
    }
  }, [certificationId, task?.lessonId])

  if (state.status === "building") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Building your recall session</p>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          Picking the questions you have missed most, and the topics your mastery is
          weakest on.
        </p>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm font-medium text-foreground">
          Could not build a recall session
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {state.error?.response?.data?.message
            ?? state.error?.message
            ?? "Please try again."}
        </p>
        {/* Not marked complete: nothing was recalled, so the session stays
            outstanding and will be offered again. */}
        <Button variant="outline" onClick={onDismiss}>
          Close
        </Button>
      </div>
    )
  }

  const { session } = state

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Brain className="size-7" aria-hidden="true" />
      </span>

      <div>
        <p className="text-lg font-semibold text-foreground">
          {session.itemCount} {session.itemCount === 1 ? "question" : "questions"} ready
        </p>

        {/* Says which kind of paper this is. A learner with no history yet is
            not sitting a recall test, and telling them it is one would
            misdescribe both the questions and a poor score on them. */}
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
          {session.basis === "coverage"
            ? "You have no missed questions on this certification yet, so this is a spread across its topics to find your starting point."
            : "Built from the questions you have missed most and the topics your mastery is weakest on."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={() => {
            onStarted?.()
            navigate(`/learner/assessments/${session.examId}`)
          }}
        >
          Start recall
        </Button>

        <Button variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </div>
  )
}

export default RecallSession
