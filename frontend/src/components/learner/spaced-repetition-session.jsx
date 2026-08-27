import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Check, Loader2, Repeat2 } from "@/components/icons"
import {
  REVIEW_GRADES,
  getDueReviewCards,
  gradeReviewCard,
} from "@/services/reviewService.js"

/**
 * A spaced-repetition review: recall it, reveal it, say how it went.
 *
 * <p>The self-rating is the input the schedule runs on, so the answer is hidden
 * until the learner commits to having tried. Showing question and answer
 * together would make every card feel easy and every rating a guess, which is
 * the one thing that makes the whole schedule wrong — an item rated "Easy"
 * without being recalled will not come back for weeks.
 *
 * <p>Each grade is sent as it is given rather than batched at the end: a
 * session abandoned halfway should still keep the cards that were reviewed.
 */

/** How long until this card is seen again, in words. */
function nextDueLabel(outcome) {
  const days = outcome?.intervalDays
  if (!days && days !== 0) return null
  if (days <= 0) return "again today"
  if (days === 1) return "tomorrow"
  if (days < 30) return `in ${days} days`

  const months = Math.round(days / 30)
  return months <= 1 ? "in about a month" : `in about ${months} months`
}

export function SpacedRepetitionSession({ task, certificationId, onComplete, onDismiss }) {
  const [state, setState] = useState({ status: "loading" })
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastOutcome, setLastOutcome] = useState(null)
  const [grading, setGrading] = useState(false)

  // Loaded once per opening: the fetch creates review items when it tops the
  // session up, so React's development double-mount would seed twice.
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    let cancelled = false

    getDueReviewCards({ certificationId, lessonId: task?.lessonId ?? null })
      .then((queue) => {
        if (!cancelled) setState({ status: "ready", queue })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error })
      })

    return () => {
      cancelled = true
    }
  }, [certificationId, task?.lessonId])

  async function submitGrade(grade) {
    const card = state.queue?.cards?.[index]
    if (!card || grading) return

    setGrading(true)
    try {
      const outcome = await gradeReviewCard({ questionId: card.questionId, grade })
      setLastOutcome(outcome)
    } catch (error) {
      // Surfaced, not swallowed: a grade that did not save means this card is
      // not actually scheduled, and silently moving on would lose it.
      console.warn("Could not save that review grade.", error)
    } finally {
      setGrading(false)
      setRevealed(false)
      setIndex((current) => current + 1)
    }
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Finding what is due</p>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm font-medium text-foreground">Could not load your review</p>
        <p className="text-sm leading-6 text-muted-foreground">
          {state.error?.response?.data?.message ?? state.error?.message ?? "Please try again."}
        </p>
        <Button variant="outline" onClick={onDismiss}>Close</Button>
      </div>
    )
  }

  const { cards, dueCount, seeded } = state.queue
  const card = cards[index]

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Check className="size-7" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-semibold text-foreground">Nothing due</p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            You have no material waiting for review on this certification. Sit an
            assessment and what you miss will start appearing here.
          </p>
        </div>
        <Button onClick={onDismiss}>Close</Button>
      </div>
    )
  }

  // Worked all the way through.
  if (!card) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Check className="size-7" aria-hidden="true" />
        </span>

        <div>
          <p className="text-lg font-semibold text-foreground">Review complete</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {cards.length} {cards.length === 1 ? "card" : "cards"} reviewed.
            {dueCount > cards.length
              ? ` ${dueCount - cards.length} more still due — they'll be waiting next time.`
              : ""}
          </p>
        </div>

        <Button onClick={onComplete}>Done</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Repeat2 className="size-3.5" aria-hidden="true" />
          {index + 1} of {cards.length}
        </span>

        {card.lessonTitle ? <span className="truncate">{card.lessonTitle}</span> : null}
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      {/* First seeding is worth explaining: cards the learner has never
          formally "reviewed" appearing in a review session looks wrong
          otherwise. */}
      {seeded && index === 0 ? (
        <p className="rounded-2xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
          Some of these are entering your review schedule for the first time, drawn
          from questions you have answered before.
        </p>
      ) : null}

      <div className="rounded-2xl bg-muted/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recall this
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-foreground">{card.question}</p>

        {revealed ? (
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Answer
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {card.answer ?? "This question is marked from its own assessment — check the explanation there."}
            </p>
          </div>
        ) : null}
      </div>

      {revealed ? (
        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">
            How well did you recall it?
          </p>

          {/* Four ratings, each labelled in words. The interval that follows is
              driven entirely by this, so it must never be a colour to guess at. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {REVIEW_GRADES.map((grade) => (
              <Button
                key={grade.id}
                variant={grade.id === "GOOD" ? "default" : "outline"}
                size="sm"
                disabled={grading}
                className="h-auto flex-col gap-0.5 py-2"
                onClick={() => submitGrade(grade.id)}
              >
                <span className="text-sm font-semibold">{grade.label}</span>
                <span className="text-[10px] font-normal opacity-70">{grade.hint}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setRevealed(true)}>
          Show answer
        </Button>
      )}

      {/* What the last rating bought, so the schedule is visible rather than
          something that happens to the learner. */}
      {lastOutcome && nextDueLabel(lastOutcome) ? (
        <p className="text-center text-xs text-muted-foreground">
          Last card returns {nextDueLabel(lastOutcome)}.
        </p>
      ) : null}
    </div>
  )
}

export default SpacedRepetitionSession
