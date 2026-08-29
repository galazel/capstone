import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Layers3, Trophy } from "@/components/icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AnswerTile,
  ArenaHeader,
  ArenaShell,
  CountdownRing,
  speedPoints,
  useQuestionClock,
} from "@/components/practice/kahoot-arena.jsx"
import {
  completePracticeAttempt,
  getStudySet,
  startPracticeAttempt,
  submitPracticeAnswer,
} from "@/services/practiceService"

/* How long each kind of item gets. A multiple-choice item is a recognition
   task -- twenty seconds is long enough to read four options and short enough
   that you answer rather than deliberate. Typed recall needs longer because it
   needs typing. */
const MCQ_SECONDS = 20
const RECALL_SECONDS = 30

const RATINGS = [
  ["AGAIN", "Again"],
  ["HARD", "Hard"],
  ["GOOD", "Good"],
  ["EASY", "Easy"],
]

function choicesOf(item) {
  try {
    return typeof item.choicesJson === "string"
      ? JSON.parse(item.choicesJson)
      : (item.choicesJson ?? [])
  } catch {
    return []
  }
}

export default function LearnerPracticeAttemptPage() {
  const { studySetId } = useParams()
  const navigate = useNavigate()

  const [studySet, setStudySet] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState({})
  const [flashcardRating, setFlashcardRating] = useState("GOOD")
  const [isSaving, setIsSaving] = useState(false)
  const [completion, setCompletion] = useState(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    let live = true
    Promise.all([getStudySet(studySetId), startPracticeAttempt(studySetId)])
      .then(([set, nextAttempt]) => {
        if (live) {
          setStudySet(set)
          setAttempt(nextAttempt)
        }
      })
      .catch(() => toast.error("This practice set could not be opened."))
    return () => {
      live = false
    }
  }, [studySetId])

  const item = studySet?.items?.[index]
  const isFlashcard = studySet?.type === "FLASHCARD"
  const seconds = isFlashcard ? RECALL_SECONDS : MCQ_SECONDS
  const answer = item ? (answers[item.id] ?? "") : ""
  const result = item ? results[item.id] : null
  const locked = Boolean(result)
  const isLast = studySet && index === studySet.items.length - 1
  const choices = useMemo(() => (item ? choicesOf(item) : []), [item])

  /* The clock's own reading at the moment the answer was locked in. Reading
     `remaining` when the points are awarded would score whatever the clock had
     ticked down to by the time the request came back, which turns a slow
     network into a lower score. */
  const remainingRef = useRef(seconds)

  const lockIn = useCallback(
    async (value) => {
      if (!item || !attempt || locked || isSaving) return

      const submitted = String(value ?? "")
      const earnedFrom = remainingRef.current

      setIsSaving(true)
      setAnswers((current) => ({ ...current, [item.id]: submitted }))

      try {
        const saved = await submitPracticeAnswer(attempt.id, {
          studyItemId: item.id,
          answer: submitted,
          flashcardRating: isFlashcard ? flashcardRating : null,
        })

        setResults((current) => ({ ...current, [item.id]: saved }))
        setScore(
          (current) =>
            current +
            speedPoints({ correct: saved.correct, remaining: earnedFrom, total: seconds })
        )
        setStreak((current) => (saved.correct ? current + 1 : 0))
      } catch {
        toast.error("Your answer could not be saved.")
      } finally {
        setIsSaving(false)
      }
    },
    [attempt, flashcardRating, isFlashcard, isSaving, item, locked, seconds]
  )

  /* Time up is an answer: whatever is in the box goes, blank included, and the
     server scores blank as wrong. Leaving the question open instead would make
     the clock decorative. */
  const remaining = useQuestionClock({
    seconds,
    index,
    running: Boolean(item) && !locked && !completion,
    onExpire: () => {
      void lockIn(answers[item?.id] ?? "")
    },
  })

  if (!locked) remainingRef.current = remaining

  async function advance() {
    if (!isLast) {
      setIndex((value) => value + 1)
      setFlashcardRating("GOOD")
      return
    }

    try {
      setCompletion(await completePracticeAttempt(attempt.id))
    } catch {
      toast.error("Finish every item before completing.")
    }
  }

  async function rateFlashcard(value) {
    setFlashcardRating(value)
    if (!item || !attempt || !results[item.id]) return

    try {
      const saved = await submitPracticeAnswer(attempt.id, {
        studyItemId: item.id,
        answer,
        flashcardRating: value,
      })
      setResults((current) => ({ ...current, [item.id]: saved }))
    } catch {
      toast.error("Your flashcard rating could not be saved.")
    }
  }

  if (!studySet || !attempt) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="mt-6 h-[440px] w-full" />
      </div>
    )
  }

  if (completion) {
    return (
      <ArenaShell>
        <section className="m-auto w-full max-w-xl rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-rb-fox text-white">
            <Trophy className="size-10" />
          </div>

          <p className="mt-6 font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/70">
            Practice complete
          </p>

          <h1 className="mt-2 font-rb-display text-5xl font-extrabold text-white">
            {Math.round(completion.percentage)}%
          </h1>

          <p className="mt-3 text-white/80">
            You got {completion.score} of {completion.totalItems} correct.
          </p>

          {/* Two numbers, told apart. The percentage above is the attempt as the
              server recorded it; this one is the round's own game score and is
              not saved anywhere. */}
          <p className="mt-4 font-rb-display text-lg font-extrabold text-rb-fox">
            {score.toLocaleString()} speed points
            <span className="ml-2 align-middle text-xs font-bold uppercase tracking-wide text-white/50">
              this run only
            </span>
          </p>

          {completion.xpEarned > 0 || completion.coinEarned > 0 ? (
            <p className="mt-2 font-semibold text-rb-macaw">
              +{completion.xpEarned} XP
              {completion.coinEarned > 0 ? ` · +${completion.coinEarned} coins` : ""}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
              onClick={() => navigate(`/learner/practice-review/${completion.id}`)}
            >
              Review answers
            </Button>
            <Button onClick={() => navigate("/learner/library")}>Back to library</Button>
          </div>
        </section>
      </ArenaShell>
    )
  }

  const correctText =
    item.correctAnswer ??
    choices.find((choice) => choice.isCorrect)?.text ??
    ""

  return (
    <ArenaShell
      header={
        <ArenaHeader
          title={studySet.title}
          subtitle={isFlashcard ? "Recall round" : "Quiz round"}
          position={index + 1}
          total={studySet.items.length}
          onLeave={() => navigate(-1)}
          right={
            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="font-rb-display text-xl font-extrabold tabular-nums">
                  {score.toLocaleString()}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  {streak > 1 ? `${streak} in a row` : "Points"}
                </p>
              </div>
              <CountdownRing remaining={remaining} total={seconds} paused={locked} />
            </div>
          }
        />
      }
    >
      <h1 className="py-6 text-center font-rb-display text-2xl leading-tight font-extrabold text-white sm:py-10 sm:text-4xl">
        {item.questionText}
      </h1>

      {isFlashcard ? (
        <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white/10 p-6 backdrop-blur">
          <div className="flex items-center gap-2 font-rb-display text-sm font-extrabold text-white/80">
            <Layers3 className="size-4" />
            Type what you remember
          </div>

          <Input
            autoFocus
            className="mt-4 h-14 border-white/30 bg-white/95 text-lg text-rb-eel"
            value={answer}
            disabled={locked}
            onChange={(event) =>
              setAnswers((current) => ({ ...current, [item.id]: event.target.value }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !locked) void lockIn(answer)
            }}
            placeholder="Your answer"
          />

          {!locked ? (
            <Button
              type="button"
              className="mt-4 w-full"
              disabled={isSaving}
              onClick={() => void lockIn(answer)}
            >
              Lock it in
            </Button>
          ) : (
            <div className="mt-5">
              <p className="font-rb-display text-xs font-extrabold uppercase tracking-wide text-white/60">
                How well did you remember it?
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {RATINGS.map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={flashcardRating === value ? "default" : "outline"}
                    className={
                      flashcardRating === value
                        ? ""
                        : "border-white/40 bg-transparent text-white hover:bg-white/10"
                    }
                    onClick={() => rateFlashcard(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {choices.map((choice, choiceIndex) => (
            <AnswerTile
              key={`${choice.text}-${choiceIndex}`}
              index={choiceIndex}
              label={choice.text}
              selected={answer === choice.text}
              disabled={locked || isSaving}
              state={
                !locked
                  ? "idle"
                  : choice.text === correctText
                    ? "correct"
                    : answer === choice.text
                      ? "wrong"
                      : "dimmed"
              }
              onSelect={() => void lockIn(choice.text)}
            />
          ))}
        </div>
      )}

      {/* The verdict, full width under the tiles: at this size a learner is
          looking at the middle of the screen, not at a line of small type. */}
      {locked ? (
        <div
          className={`mt-6 rounded-2xl p-5 text-center ${
            result.correct ? "bg-rb-leaf text-white" : "bg-rb-cardinal text-white"
          }`}
        >
          <p className="font-rb-display text-2xl font-extrabold">
            {result.correct ? "Correct!" : "Not quite"}
          </p>

          {!result.correct && correctText ? (
            <p className="mt-1 font-semibold">Answer: {correctText}</p>
          ) : null}

          {result.explanation ? (
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/90">
              {result.explanation}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex justify-end py-6">
        <Button
          size="lg"
          disabled={!locked}
          onClick={advance}
          className="min-w-40 font-rb-display font-extrabold"
        >
          {isLast ? "Finish" : "Next"}
        </Button>
      </div>
    </ArenaShell>
  )
}
