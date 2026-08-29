import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Layers3, Trophy } from "@/components/icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArenaHeader,
  ArenaShell,
  CountdownRing,
  useQuestionClock,
} from "@/components/practice/kahoot-arena.jsx"
import {
  completePracticeAttempt,
  getStudySet,
  startPracticeAttempt,
  submitPracticeAnswer,
} from "@/services/practiceService"

/* Long enough to actually try to remember, short enough that you commit to an
   answer instead of reading the question forty times. When it runs out the card
   flips itself -- the recall attempt is over either way, and the rating that
   follows is the honest record of how it went. */
const RECALL_SECONDS = 25

/* Generated answers are not one line. A card face is a fixed box, so the type
   steps down as the text grows and the face scrolls past the point where even
   the smallest step would spill -- the alternative was an answer running out of
   the bottom of the card and over the rating buttons. */
function faceType(text) {
  const length = String(text ?? "").length
  if (length > 320) return "text-base sm:text-xl"
  if (length > 160) return "text-lg sm:text-2xl"
  if (length > 80) return "text-xl sm:text-3xl"
  return "text-2xl sm:text-4xl"
}

const RATINGS = [
  ["AGAIN", "Again", "var(--color-rb-cardinal)"],
  ["HARD", "Hard", "var(--color-rb-fox)"],
  ["GOOD", "Good", "var(--color-rb-feather)"],
  ["EASY", "Easy", "var(--color-rb-leaf)"],
]

export default function LearnerFlashcardAttemptPage() {
  const { studySetId } = useParams()
  const navigate = useNavigate()

  const [studySet, setStudySet] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [rating, setRating] = useState(null)
  const [saving, setSaving] = useState(false)
  const [completion, setCompletion] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all([getStudySet(studySetId), startPracticeAttempt(studySetId)])
      .then(([set, nextAttempt]) => {
        if (live) {
          setStudySet(set)
          setAttempt(nextAttempt)
        }
      })
      .catch(() => toast.error("This flashcard set could not be opened."))
    return () => {
      live = false
    }
  }, [studySetId])

  const reveal = useCallback(() => setFlipped(true), [])

  /* Paused once the card is face up: the clock times the recall, not the
     rating, and a countdown ticking while you decide between Hard and Good is
     pressure on the wrong decision. */
  const remaining = useQuestionClock({
    seconds: RECALL_SECONDS,
    index,
    running: Boolean(studySet) && !flipped && !completion,
    onExpire: reveal,
  })

  if (!studySet || !attempt) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  const item = studySet.items[index]
  const isLast = index === studySet.items.length - 1

  async function rateAndAdvance(value) {
    if (saving) return

    setRating(value)
    setSaving(true)

    try {
      await submitPracticeAnswer(attempt.id, {
        studyItemId: item.id,
        answer: item.correctAnswer ?? "",
        flashcardRating: value,
      })

      if (isLast) {
        setCompletion(await completePracticeAttempt(attempt.id))
      } else {
        setIndex((current) => current + 1)
        setFlipped(false)
        setRating(null)
      }
    } catch {
      toast.error("This flashcard could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  if (completion) {
    return (
      <ArenaShell>
        <section className="m-auto w-full max-w-xl rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
          <Trophy className="mx-auto size-14 text-rb-fox" />

          <p className="mt-5 font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/70">
            Flashcards complete
          </p>

          <h1 className="mt-2 font-rb-display text-5xl font-extrabold text-white">
            {Math.round(completion.percentage)}%
          </h1>

          <p className="mt-3 text-white/80">You reviewed {completion.totalItems} cards.</p>

          {completion.xpEarned > 0 || completion.coinEarned > 0 ? (
            <p className="mt-2 font-semibold text-rb-macaw">
              +{completion.xpEarned} XP
              {completion.coinEarned > 0 ? ` · +${completion.coinEarned} coins` : ""}
            </p>
          ) : null}

          <Button className="mt-8" onClick={() => navigate("/learner/library")}>
            Back to library
          </Button>
        </section>
      </ArenaShell>
    )
  }

  return (
    <ArenaShell
      header={
        <ArenaHeader
          title={studySet.title}
          subtitle="Flip-card round"
          position={index + 1}
          total={studySet.items.length}
          onLeave={() => navigate(-1)}
          right={
            <CountdownRing remaining={remaining} total={RECALL_SECONDS} paused={flipped} />
          }
        />
      }
    >
      <button
        type="button"
        className="group mt-2 block w-full flex-1 [perspective:1400px]"
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? "Show the question" : "Reveal the answer"}
      >
        <div
          className={`relative h-full min-h-[22rem] w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[2rem] bg-white p-8 text-center text-rb-eel shadow-2xl [backface-visibility:hidden]">
            <Layers3 className="size-10 text-rb-feather" />

            <p className="mt-6 font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-rb-feather">
              Question
            </p>

            <h1
              className={`mt-4 font-rb-display leading-tight font-extrabold text-rb-eel ${faceType(
                item.questionText
              )}`}
            >
              {item.questionText}
            </h1>

            <p className="mt-8 text-sm font-medium text-muted-foreground">
              Tap the card to reveal the answer
            </p>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[2rem] bg-rb-feather p-8 text-center text-white shadow-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/75">
              Answer
            </p>

            <p
              className={`mt-5 font-rb-display leading-snug font-extrabold ${faceType(
                item.correctAnswer
              )}`}
            >
              {item.correctAnswer || "Review this concept in the lesson."}
            </p>

            {item.explanation ? (
              <p className="mt-6 max-w-2xl text-sm leading-6 text-white/85">
                {item.explanation}
              </p>
            ) : null}
          </div>
        </div>
      </button>

      {/* Rating IS the next button. The old screen asked for a rating and then
          asked again for Next, and the second click carried no decision. */}
      <div className="py-6">
        <p className="pb-3 text-center font-rb-display text-xs font-extrabold uppercase tracking-wide text-white/60">
          {flipped ? "How well did you remember it?" : "Answer first, then rate your recall"}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RATINGS.map(([value, label, face]) => (
            <button
              key={value}
              type="button"
              disabled={!flipped || saving}
              onClick={() => rateAndAdvance(value)}
              style={{ background: face }}
              className={`rounded-2xl px-4 py-5 font-rb-display text-lg font-extrabold text-white transition enabled:hover:-translate-y-0.5 disabled:opacity-35 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white ${
                rating === value ? "ring-4 ring-white" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="pt-3 text-center text-xs text-white/50">
          {isLast ? "Rating the last card finishes the round." : "Rating moves you on."}
        </p>
      </div>
    </ArenaShell>
  )
}
