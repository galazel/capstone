import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AnswerTile,
  ArenaHeader,
  ArenaShell,
  CountdownRing,
  useQuestionClock,
} from "@/components/practice/kahoot-arena.jsx"

/**
 * A generated quiz, played rather than sat.
 *
 * <p>The attempt runner behind this is the one every REBYU assessment uses --
 * item navigator, flags, skips, autosave, a server-issued clock for the whole
 * paper. That is right for a mock exam and far too much furniture for the
 * ten-question quiz the tutor generates from a lesson: an exam hall for a
 * warm-up.
 *
 * <p>This is the same attempt with the same endpoints -- answers still autosave
 * through the page's own `setAnswer`, and finishing still submits the same
 * payload for the same server-side grading. What changes is the framing: one
 * question filling the window, four coloured tiles, and a clock per question.
 *
 * <h3>Why there is no "Correct!" between questions</h3>
 * A graded attempt is marked on submission, by the server, all at once. Nothing
 * here knows whether a tile was right, so nothing here says. The practice-set
 * arena does show it, because that runner grades each answer as it is given --
 * a different endpoint answering a different question. Inventing the verdict
 * locally would mean marking the paper in the browser, which is exactly what an
 * assessment must not do.
 */

/** Per question. Enough to read four options, not enough to deliberate. */
const QUESTION_SECONDS = 20

function isMultipleChoice(question) {
  return (
    question?.questionType === "MULTIPLE_CHOICE" ||
    question?.questionType === "TRUE_FALSE" ||
    (question?.choices?.length ?? 0) > 0
  )
}

export function GeneratedQuizArena({
  attempt,
  questions,
  answers,
  onAnswer,
  currentIndex,
  onIndexChange,
  onFinish,
  onLeave,
  isSubmitting,
  remainingSeconds,
}) {
  /* Locked per question, not per answer: a tile can be changed until the clock
     stops or the learner moves on, and after that the question is done. This is
     the arena's own state -- the attempt still holds the answer itself. */
  const [lockedIds, setLockedIds] = useState(() => new Set())

  const question = questions[currentIndex]
  const answer = question ? answers[question.attemptQuestionId] : null
  const locked = question ? lockedIds.has(question.attemptQuestionId) : false
  const isLast = currentIndex === questions.length - 1

  const lock = useCallback(() => {
    if (!question) return
    setLockedIds((current) => new Set(current).add(question.attemptQuestionId))
  }, [question])

  /* Time up locks whatever is selected, blank included -- an unanswered
     question is submitted unanswered and marked wrong, the same as it would be
     on the standard runner when the paper's clock runs out. */
  const remaining = useQuestionClock({
    seconds: QUESTION_SECONDS,
    index: currentIndex,
    running: Boolean(question) && !locked && !isSubmitting,
    onExpire: lock,
  })

  if (!question) return null

  const answeredCount = questions.filter(
    (item) =>
      answers[item.attemptQuestionId]?.selectedChoiceId != null ||
      String(answers[item.attemptQuestionId]?.learnerAnswer ?? "").trim()
  ).length

  return (
    <ArenaShell
      header={
        <ArenaHeader
          title={attempt.assessmentTitle}
          subtitle={`Generated quiz · attempt ${attempt.attemptNumber}`}
          position={currentIndex + 1}
          total={questions.length}
          onLeave={onLeave}
          right={
            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="font-rb-display text-xl font-extrabold tabular-nums">
                  {answeredCount}/{questions.length}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Answered
                </p>
              </div>

              <CountdownRing
                remaining={remaining}
                total={QUESTION_SECONDS}
                paused={locked}
              />
            </div>
          }
        />
      }
    >
      <h1 className="py-6 text-center font-rb-display text-2xl leading-tight font-extrabold text-white sm:py-10 sm:text-4xl">
        {question.question}
      </h1>

      {isMultipleChoice(question) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(question.choices ?? []).map((choice, choiceIndex) => (
            <AnswerTile
              key={choice.choiceId ?? choiceIndex}
              index={choiceIndex}
              label={choice.choiceText}
              selected={answer?.selectedChoiceId === choice.choiceId}
              disabled={locked || isSubmitting}
              state={
                locked && answer?.selectedChoiceId !== choice.choiceId
                  ? "dimmed"
                  : "idle"
              }
              onSelect={() => {
                onAnswer(question.attemptQuestionId, {
                  selectedChoiceId: choice.choiceId,
                })
                lock()
              }}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white/10 p-6 backdrop-blur">
          <p className="font-rb-display text-sm font-extrabold text-white/80">
            Type your answer
          </p>

          <Input
            autoFocus
            className="mt-4 h-14 border-white/30 bg-white/95 text-lg text-rb-eel"
            value={answer?.learnerAnswer ?? ""}
            disabled={locked || isSubmitting}
            onChange={(event) =>
              onAnswer(question.attemptQuestionId, {
                learnerAnswer: event.target.value,
              })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") lock()
            }}
            placeholder="Your answer"
          />

          {!locked ? (
            <Button type="button" className="mt-4 w-full" onClick={lock}>
              Lock it in
            </Button>
          ) : null}
        </div>
      )}

      {/* Said once, plainly. A learner who has just watched a tile go dim with
          no verdict deserves to know the marking is coming, not to conclude the
          quiz is broken. */}
      {locked ? (
        <p className="mt-6 text-center text-sm text-white/70">
          Locked in. Every answer is marked when you finish the quiz.
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-4 py-6">
        <p className="text-xs text-white/50">
          {remainingSeconds != null
            ? `${Math.floor(remainingSeconds / 60)}m left on the whole quiz`
            : ""}
        </p>

        <Button
          size="lg"
          disabled={!locked || isSubmitting}
          className="min-w-40 font-rb-display font-extrabold"
          onClick={() => {
            if (isLast) onFinish()
            else onIndexChange(currentIndex + 1)
          }}
        >
          {isLast ? (isSubmitting ? "Marking..." : "Finish") : "Next"}
        </Button>
      </div>
    </ArenaShell>
  )
}

export default GeneratedQuizArena
