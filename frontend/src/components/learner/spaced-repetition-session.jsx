import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "@/components/icons"
import {
  ArenaHeader,
  ArenaShell,
  CountdownRing,
  useQuestionClock,
} from "@/components/practice/kahoot-arena.jsx"
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
 *
 * <h3>Why it takes the window</h3>
 * This used to be a dialog: question and answer in small type inside a panel,
 * over the page the learner was reading. Recall is the one thing a review
 * session asks for, and it is the first thing a half-visible page behind a box
 * takes away. It is drawn as a round now — the whole window, one card, a clock
 * on the recall — and the clock stops the moment the answer is showing, because
 * it times the remembering, not the self-assessment that follows.
 */

/** How long to try before the card shows itself. */
const RECALL_SECONDS = 20

/** Kahoot's four, in grade order: forgot it, struggled, got it, instant. */
const GRADE_FACES = {
  AGAIN: "var(--color-rb-cardinal)",
  HARD: "var(--color-rb-fox)",
  GOOD: "var(--color-rb-feather)",
  EASY: "var(--color-rb-leaf)",
}

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

function Centered({ children }) {
  return (
    <ArenaShell>
      <section className="m-auto w-full max-w-lg rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
        {children}
      </section>
    </ArenaShell>
  )
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

  const reveal = useCallback(() => setRevealed(true), [])

  const cards = state.queue?.cards ?? []
  const card = cards[index]

  const remaining = useQuestionClock({
    seconds: RECALL_SECONDS,
    index,
    running: state.status === "ready" && Boolean(card) && !revealed,
    onExpire: reveal,
  })

  async function submitGrade(grade) {
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
      <Centered>
        <Loader2 className="mx-auto size-8 animate-spin text-white" aria-hidden="true" />
        <p className="mt-4 font-rb-display text-lg font-extrabold">Finding what is due</p>
      </Centered>
    )
  }

  if (state.status === "error") {
    return (
      <Centered>
        <p className="font-rb-display text-xl font-extrabold">Could not load your review</p>
        <p className="mt-2 text-sm leading-6 text-white/75">
          {state.error?.response?.data?.message ?? state.error?.message ?? "Please try again."}
        </p>
        <Button
          variant="outline"
          className="mt-6 border-white/40 bg-transparent text-white hover:bg-white/10"
          onClick={onDismiss}
        >
          Close
        </Button>
      </Centered>
    )
  }

  const { dueCount, seeded } = state.queue

  if (cards.length === 0) {
    return (
      <Centered>
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/15">
          <Check className="size-8" aria-hidden="true" />
        </span>
        <p className="mt-5 font-rb-display text-2xl font-extrabold">Nothing due</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/75">
          You have no material waiting for review on this certification. Sit an
          assessment and what you miss will start appearing here.
        </p>
        <Button className="mt-6" onClick={onDismiss}>Close</Button>
      </Centered>
    )
  }

  // Worked all the way through.
  if (!card) {
    return (
      <Centered>
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/15">
          <Check className="size-8" aria-hidden="true" />
        </span>
        <p className="mt-5 font-rb-display text-2xl font-extrabold">Review complete</p>
        <p className="mt-2 text-sm text-white/75">
          {cards.length} {cards.length === 1 ? "card" : "cards"} reviewed.
          {dueCount > cards.length
            ? ` ${dueCount - cards.length} more still due — they'll be waiting next time.`
            : ""}
        </p>
        <Button className="mt-6" onClick={onComplete}>Done</Button>
      </Centered>
    )
  }

  return (
    <ArenaShell
      header={
        <ArenaHeader
          title="Spaced repetition"
          subtitle={card.lessonTitle ?? "Scheduled review"}
          position={index + 1}
          total={cards.length}
          onLeave={onDismiss}
          right={
            <CountdownRing remaining={remaining} total={RECALL_SECONDS} paused={revealed} />
          }
        />
      }
    >
      {/* First seeding is worth explaining: cards the learner has never
          formally "reviewed" appearing in a review session looks wrong
          otherwise. */}
      {seeded && index === 0 ? (
        <p className="mx-auto max-w-2xl rounded-2xl bg-white/10 p-3 text-center text-xs leading-5 text-white/75">
          Some of these are entering your review schedule for the first time, drawn
          from questions you have answered before.
        </p>
      ) : null}

      <div className="flex flex-1 flex-col justify-center py-6 text-center">
        <p className="font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/60">
          Recall this
        </p>

        <h1 className="mx-auto mt-4 max-w-4xl font-rb-display text-2xl leading-tight font-extrabold text-white sm:text-4xl">
          {card.question}
        </h1>

        {revealed ? (
          <div className="mx-auto mt-10 max-h-[45vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 text-rb-eel shadow-2xl sm:p-8">
            <p className="font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-rb-feather">
              Answer
            </p>
            <p className="mt-3 text-xl leading-8 font-semibold sm:text-2xl">
              {card.answer ??
                "This question is marked from its own assessment — check the explanation there."}
            </p>
          </div>
        ) : (
          <Button
            size="lg"
            className="mx-auto mt-10 min-w-56 font-rb-display font-extrabold"
            onClick={reveal}
          >
            Show answer
          </Button>
        )}
      </div>

      <div className="py-6">
        <p className="pb-3 text-center font-rb-display text-xs font-extrabold uppercase tracking-wide text-white/60">
          {revealed ? "How well did you recall it?" : "Try to recall it before the clock runs out"}
        </p>

        {/* Four grades, each labelled in words as well as coloured. The interval
            that follows is driven entirely by this, so it must never be a
            colour to guess at. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REVIEW_GRADES.map((grade) => (
            <button
              key={grade.id}
              type="button"
              disabled={!revealed || grading}
              onClick={() => submitGrade(grade.id)}
              style={{ background: GRADE_FACES[grade.id] }}
              className="rounded-2xl px-4 py-4 text-white transition enabled:hover:-translate-y-0.5 disabled:opacity-35 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <span className="block font-rb-display text-lg font-extrabold">{grade.label}</span>
              <span className="block text-xs opacity-85">{grade.hint}</span>
            </button>
          ))}
        </div>

        {/* What the last rating bought, so the schedule is visible rather than
            something that happens to the learner. */}
        {lastOutcome && nextDueLabel(lastOutcome) ? (
          <p className="pt-3 text-center text-xs text-white/50">
            Last card returns {nextDueLabel(lastOutcome)}.
          </p>
        ) : null}
      </div>
    </ArenaShell>
  )
}

export default SpacedRepetitionSession
