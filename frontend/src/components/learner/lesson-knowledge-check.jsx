import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, Brain, Loader2 } from "@/components/icons"
import { createKnowledgeCheck } from "@/services/knowledgeCheckService.js"

/**
 * The pop-up knowledge check: five questions on lessons this learner has
 * already finished, sprung on them part-way through reading a new one.
 *
 * <p>The check is minted on confirm and then handed to the ordinary attempt
 * runner at {@code /learner/assessments/:examId}. Answering here instead would
 * mean a second implementation of every question type the bank holds -- and two
 * of those, programming and diagram, need a workspace that does not fit in a
 * modal at all. The one place a learner answers a question should be the same
 * place whatever put it in front of them.
 *
 * <h3>Why it does not close</h3>
 * The check is a gate: escape and outside-click are both suppressed, so the
 * lesson is unreadable until it is dealt with. The single exception is the
 * error path -- if the check cannot be minted there is nothing to answer, and
 * leaving the learner sealed behind a modal over a failed request would trap
 * them in the lesson with no way out.
 */
export function LessonKnowledgeCheck({ open, lessonId, itemCount, lessonNames, onDismiss }) {
  const navigate = useNavigate()

  const [state, setState] = useState({ status: "idle" })

  /* Minted at most once per opening. Without the guard a double-click, or
     React's development double-invoke, mints two checks for one interruption
     and the second sits abandoned in the learner's history. */
  const mintingRef = useRef(false)

  useEffect(() => {
    if (!open) {
      mintingRef.current = false
      setState({ status: "idle" })
    }
  }, [open])

  function start() {
    if (mintingRef.current) return
    mintingRef.current = true
    setState({ status: "minting" })

    createKnowledgeCheck(lessonId)
      .then((check) => {
        if (!check?.examId) {
          /* Eligibility is re-checked server-side, so a check can legitimately
             come back unavailable if the learner raced another tab. Nothing to
             answer means nothing to gate on. */
          onDismiss?.()
          return
        }
        navigate(`/learner/assessments/${check.examId}`)
      })
      .catch((error) => {
        mintingRef.current = false
        setState({ status: "error", error })
      })
  }

  const sources = Array.isArray(lessonNames) ? lessonNames.filter(Boolean) : []
  const count = itemCount ?? 5

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        /* Both suppressed deliberately -- see the class comment. */
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        {state.status === "error" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-amber-100 text-amber-700">
                <AlertTriangle aria-hidden="true" />
              </AlertDialogMedia>

              <AlertDialogTitle>Could not start your knowledge check</AlertDialogTitle>

              <AlertDialogDescription>
                {state.error?.response?.data?.message
                  ?? state.error?.message
                  ?? "Something went wrong building your questions."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              {/* The only exit this modal offers, and only here: there is no
                  check to sit, so gating the lesson on it would strand them. */}
              <Button variant="outline" onClick={() => onDismiss?.()}>
                Back to the lesson
              </Button>

              <Button onClick={start}>Try again</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-primary/10 text-primary">
                <Brain aria-hidden="true" />
              </AlertDialogMedia>

              <AlertDialogTitle>Quick knowledge check</AlertDialogTitle>

              <AlertDialogDescription>
                {count} {count === 1 ? "question" : "questions"} on material you have
                already finished — starting with what you have got wrong before.
                Answer them to carry on.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {sources.length > 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Drawn from
                </p>

                {/* Named rather than sprung unexplained: a learner who can see
                    the check is revisiting finished lessons reads it as recall
                    practice instead of an ambush. */}
                <p className="mt-1.5 text-sm leading-6 text-zinc-700">
                  {sources.slice(0, 3).join(" · ")}
                  {sources.length > 3 ? ` · and ${sources.length - 3} more` : ""}
                </p>
              </div>
            ) : null}

            <AlertDialogFooter>
              <Button onClick={start} disabled={state.status === "minting"} className="gap-2">
                {state.status === "minting" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Building your questions
                  </>
                ) : (
                  `Start the check`
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default LessonKnowledgeCheck
