import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  ClockIcon,
  HourglassIcon,
  XCircleIcon,
} from "@/components/icons"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  BackButton,
  Chip,
  RebyuCard,
  TactileButton,
} from "@/components/rebyu/rebyu-ui.jsx"
import CodeMirrorProgrammingWorkspace from "@/components/assessments/attempt/code-mirror-programming-workspace.jsx"
import PerformanceBreakdown from "@/components/assessments/attempt/performance-breakdown.jsx"
import {
  getCurrentLearner,
  getCurrentLearnerIdentity,
} from "@/services/learnerService.js"
import {
  getAssessmentTypeLabel,
  getAttemptResult,
} from "@/services/assessmentService.js"
import LearnerPremiumGuard from "@/components/learner/learner-premium-guard.jsx"
import { StudyPlanPrompt } from "@/components/learner/study-plan-prompt.jsx"
import { FEATURES } from "@/services/subscriptionService.js"

/**
 * Per-state colours for the answer review.
 *
 * These are design-system tokens now. They used to be literal emerald/amber
 * Tailwind classes, on the stated grounds that the token set had no success or
 * warning hue -- true when that comment was written, and no longer: `rb-leaf`
 * is the green accent and `rb-fox` the amber one, each with a wash tuned to
 * both themes. Spelling them as tokens is what keeps a correct answer here the
 * same green as a correct answer in the attempt runner and the curriculum.
 *
 * `card` is the tinted surface the item sits on -- the shape of a run of
 * answers is readable before any of the text is -- and `panel` is for blocks
 * sitting *on* that surface, which go back to Snow so they do not disappear
 * into it.
 */
const ANSWER_TONES = {
  correct: {
    card: "border-rb-leaf/45 bg-rb-leaf-wash",
    panel: "border-rb-leaf/45 bg-rb-leaf-wash",
    text: "text-rb-leaf",
    badge: "bg-rb-leaf text-white",
  },
  incorrect: {
    card: "border-rb-cardinal/45 bg-rb-cardinal-wash",
    panel: "border-rb-cardinal/45 bg-rb-cardinal-wash",
    text: "text-rb-cardinal-lip",
    badge: "bg-rb-cardinal text-white",
  },
  pending: {
    card: "border-rb-fox/45 bg-rb-fox-wash",
    panel: "border-rb-fox/45 bg-rb-fox-wash",
    text: "text-rb-fox-lip",
    badge: "bg-rb-fox text-white",
  },
  neutral: {
    card: "border-rb-swan bg-rb-snow",
    panel: "border-rb-swan bg-rb-polar",
    text: "text-rb-wolf",
    badge: "bg-rb-hare text-white",
  },
}

/** Which of the four states an answer is in. Order matters: an item awaiting
 *  manual marking is pending even though `isCorrect` is still null. */
function answerState(answer) {
  if (answer.pendingManualEvaluation) return "pending"
  if (answer.isCorrect == null) return "neutral"
  return answer.isCorrect ? "correct" : "incorrect"
}

const STATE_LABEL = {
  correct: "Correct",
  incorrect: "Incorrect",
  pending: "Pending review",
  neutral: "Unanswered",
}

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return "—"
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The score, as a dial.
 *
 * The number used to be a 60px figure beside a thin rail. The dial carries the
 * same two facts in one object: how much of the paper was earned, and where the
 * line was -- the threshold is a notch cut through the ring, so a score that
 * clears it still shows what it cleared. The arc grows from zero on mount;
 * `prefers-reduced-motion` stills it with every other transition in the system.
 */
function ScoreDial({ percentage, passingScore, passed }) {
  /* The first paint must land on 0 for the transition to have anywhere to
     travel from, so the real value is set just after mount.

     A timer rather than requestAnimationFrame: rAF does not run while the tab
     is hidden, and a result opened in a background tab would then sit at a
     hard zero -- an empty dial reporting a score of nothing -- until the
     learner looked at it. A timer still fires, throttled, so the dial is always
     showing the real number by the time it is seen. */
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setGrown(true), 30)
    return () => clearTimeout(timer)
  }, [])

  const size = 168
  const stroke = 16
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, percentage))
  const arc = (grown ? clamped : 0) / 100

  const notchAngle =
    passingScore != null ? (Math.min(100, Math.max(0, passingScore)) / 100) * 360 - 90 : null

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-rb-swan)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={passed ? "var(--color-rb-leaf)" : "var(--color-rb-cardinal)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - arc)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
        {notchAngle != null ? (
          <line
            x1={size / 2 + (radius - stroke / 2 - 1) * Math.cos((notchAngle * Math.PI) / 180)}
            y1={size / 2 + (radius - stroke / 2 - 1) * Math.sin((notchAngle * Math.PI) / 180)}
            x2={size / 2 + (radius + stroke / 2 + 1) * Math.cos((notchAngle * Math.PI) / 180)}
            y2={size / 2 + (radius + stroke / 2 + 1) * Math.sin((notchAngle * Math.PI) / 180)}
            stroke="var(--color-rb-eel)"
            strokeWidth="3"
            strokeLinecap="round"
            /* Un-rotated with the group, so the notch is drawn at the angle the
               maths puts it at rather than 90 degrees off. */
            transform={`rotate(90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "rb-numeric text-4xl leading-none",
            passed ? "text-rb-leaf" : "text-rb-cardinal-lip"
          )}
        >
          {percentage.toFixed(0)}%
        </span>
        <span
          className={cn(
            "mt-1.5 flex items-center gap-1 text-xs font-bold",
            passed ? "text-rb-leaf" : "text-rb-cardinal-lip"
          )}
        >
          {passed ? (
            <>
              <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
              Passed
            </>
          ) : (
            <>
              <XCircleIcon className="size-3.5" aria-hidden="true" />
              Not passed
            </>
          )}
        </span>
      </div>
    </div>
  )
}

/* Written out rather than interpolated: Tailwind scans source text for class
   names, and `sm:grid-cols-${n}` is not a string it can find. */
const STAT_COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
}

/** One count in the result header. Zero-valued optional tiles are not rendered. */
function StatTile({ label, value, tone }) {
  const TONES = {
    leaf: "border-rb-leaf/45 bg-rb-leaf-wash text-rb-leaf",
    cardinal: "border-rb-cardinal/45 bg-rb-cardinal-wash text-rb-cardinal-lip",
    fox: "border-rb-fox/45 bg-rb-fox-wash text-rb-fox-lip",
    neutral: "border-rb-swan bg-rb-polar text-rb-wolf",
  }

  return (
    <div className={cn("rounded-rb-tile border-2 px-3 py-2.5", TONES[tone])}>
      <dt className="text-xs font-bold opacity-80">{label}</dt>
      <dd className="rb-numeric mt-0.5 text-xl leading-none">{value ?? 0}</dd>
    </div>
  )
}

export default function LearnerAssessmentResultPage() {
  // Route param carries the server attempt id.
  const { examResultId: attemptId } = useParams()
  const navigate = useNavigate()

  /* Which slice of the review is on screen. A learner who missed eleven items
     out of sixty should not have to scroll the forty-nine they got right to
     find them, and after a failed attempt "what did I get wrong" is the only
     question being asked. */
  const [reviewFilter, setReviewFilter] = useState("all")

  const identity = getCurrentLearnerIdentity()
  const currentLearnerQuery = useQuery({
    queryKey: ["current-learner"],
    queryFn: getCurrentLearner,
    retry: 1,
    enabled: identity.learnerId == null,
  })
  const learnerId =
    identity.learnerId ?? currentLearnerQuery.data?.learnerId ?? null

  const resultQuery = useQuery({
    queryKey: ["attempt-result", attemptId, learnerId],
    queryFn: () => getAttemptResult(attemptId, learnerId),
    enabled: attemptId != null && learnerId != null,
    retry: 1,
  })

  const result = resultQuery.data
  const answers = useMemo(() => result?.answers ?? [], [result])

  const counts = useMemo(() => {
    const tally = { all: answers.length, correct: 0, incorrect: 0, pending: 0, neutral: 0 }
    answers.forEach((answer) => {
      tally[answerState(answer)] += 1
    })
    return tally
  }, [answers])

  const visibleAnswers = useMemo(
    () =>
      reviewFilter === "all"
        ? answers
        : answers.filter((answer) => answerState(answer) === reviewFilter),
    [answers, reviewFilter]
  )

  if (resultQuery.isLoading || (learnerId == null && currentLearnerQuery.isLoading)) {
    return (
      <div className="rebyu-ds min-h-dvh bg-rb-polar">
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Skeleton className="h-10 w-2/3 rounded-rb-tile" />
          <Skeleton className="h-56 w-full rounded-rb-card" />
          <Skeleton className="h-64 w-full rounded-rb-card" />
        </div>
      </div>
    )
  }

  if (resultQuery.isError || !result) {
    return (
      <div className="rebyu-ds flex min-h-dvh items-center justify-center bg-rb-polar p-6">
        <RebyuCard className="max-w-md p-8 text-center">
          <p className="rb-display rb-display-sm">Unable to load this result</p>
          <p className="rb-body mt-2 text-sm">
            The result may not exist, or the backend is unavailable.
          </p>
          <TactileButton
            variant="ghost"
            className="mt-6 w-full"
            onClick={() => navigate("/learner/progress")}
          >
            back to progress
          </TactileButton>
        </RebyuCard>
      </div>
    )
  }

  const percentage = Number(result.percentage ?? 0)

  /* Null when the assessment carries no threshold, which is a real case -- the
     card falls back to "No passing score set" rather than drawing a marker at
     zero and claiming every score cleared it. */
  const rawPassingScore = Number(result.passingScore)
  const passingScore =
    result.passingScore != null && Number.isFinite(rawPassingScore) ? rawPassingScore : null

  const earnedPoints = toNumber(result.earnedPoints)
  const totalPoints = toNumber(result.totalPoints)

  const statTiles = [
    { label: "Correct", value: result.correctCount, tone: "leaf" },
    { label: "Incorrect", value: result.incorrectCount, tone: "cardinal" },
    { label: "Pending", value: result.pendingCount, tone: "fox" },
    { label: "Unanswered", value: result.unansweredCount, tone: "neutral" },
  ].filter((tile) => tile.tone === "leaf" || tile.tone === "cardinal" || tile.value > 0)

  const REVIEW_FILTERS = [
    { key: "all", label: "All", count: counts.all, tone: "neutral" },
    { key: "incorrect", label: "Incorrect", count: counts.incorrect, tone: "cardinal" },
    { key: "pending", label: "Pending", count: counts.pending, tone: "fox" },
    { key: "neutral", label: "Unanswered", count: counts.neutral, tone: "neutral" },
    { key: "correct", label: "Correct", count: counts.correct, tone: "leaf" },
  ].filter((option) => option.key === "all" || option.count > 0)

  return (
    <div className="rebyu-ds min-h-dvh bg-rb-polar text-rb-eel">
      <header className="sticky top-0 z-40 border-b-2 border-rb-swan bg-rb-snow">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <BackButton asChild size="sm" label="Back to progress">
            <Link to="/learner/progress" />
          </BackButton>
          <div className="min-w-0">
            <p className="rb-eyebrow">attempt result</p>
            <p className="truncate text-sm font-bold text-rb-eel">
              {result.assessmentTitle}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {/* --- Score ------------------------------------------------------- */}
        <RebyuCard raised className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="macaw">{getAssessmentTypeLabel(result.assessmentType)}</Chip>
            <Chip>Attempt {result.attemptNumber}</Chip>
            <Chip>
              <ClockIcon className="size-3.5" aria-hidden="true" />
              {formatDuration(result.durationSeconds)}
            </Chip>
          </div>

          <h1 className="rb-display rb-display-md mt-4">{result.assessmentTitle}</h1>

          <div className="mt-7 flex flex-col items-center gap-7 sm:flex-row sm:items-start">
            <ScoreDial
              percentage={percentage}
              passingScore={passingScore}
              passed={Boolean(result.passed)}
            />

            <div className="min-w-0 flex-1 space-y-5">
              <div>
                {/* The gap in words, since the dial already carries it as a
                    shape. Stated in percentage points and named as such: this
                    assessment also has real points, and calling both "points"
                    is how "70 points short" ends up next to "0 / 10 pts". */}
                {passingScore != null ? (
                  <>
                    <p className="rb-display rb-display-sm">
                      {result.passed
                        ? `Cleared the ${passingScore.toFixed(0)}% mark`
                        : `${(passingScore - percentage).toFixed(0)}% short of the ${passingScore.toFixed(0)}% mark`}
                    </p>
                    <p className="rb-caption mt-1">
                      {result.passed
                        ? `You scored ${percentage.toFixed(0)}%, ${(percentage - passingScore).toFixed(0)} percentage points above the passing score.`
                        : `You scored ${percentage.toFixed(0)}%. The notch on the dial marks the passing score.`}
                    </p>
                  </>
                ) : (
                  <p className="rb-caption">
                    This assessment has no passing score set.
                  </p>
                )}

                {earnedPoints != null && totalPoints != null ? (
                  <p className="mt-2 text-sm font-bold text-rb-eel">
                    <span className="rb-numeric">{earnedPoints}</span>
                    <span className="text-rb-wolf"> / {totalPoints} points</span>
                  </p>
                ) : null}
              </div>

              {/* One row, however many tiles there are. A fixed three-column
                  grid left a fourth tile stranded on a line of its own. */}
              <dl className={cn("grid grid-cols-2 gap-3", STAT_COLUMNS[statTiles.length])}>
                {statTiles.map((tile) => (
                  <StatTile
                    key={tile.label}
                    label={tile.label}
                    value={tile.value}
                    tone={tile.tone}
                  />
                ))}
              </dl>
            </div>
          </div>

          {result.pendingCount > 0 ? (
            <p className="rb-caption mt-6 flex items-start gap-2 rounded-rb-tile border-2 border-rb-fox/45 bg-rb-fox-wash p-3 text-rb-fox-lip">
              <HourglassIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {result.pendingCount} written, code, or diagram response(s) await
              manual evaluation and are not included in the automatic score yet.
            </p>
          ) : null}
        </RebyuCard>

        {/* Offered here, and nowhere along the way to the curriculum: the
            diagnostic is what a plan is built from, so this is the first moment
            there is anything to schedule. */}
        <StudyPlanPrompt
          certificationId={result.certificationId}
          enabled={result.assessmentType === "DIAGNOSTIC"}
        />

        {result.assessmentType === "DIAGNOSTIC" ? (
          <div className="flex items-start gap-2.5 rounded-rb-card border-2 border-rb-leaf/45 bg-rb-leaf-wash p-4 text-sm">
            <CheckCircle2Icon
              className="mt-0.5 size-4 shrink-0 text-rb-leaf"
              aria-hidden="true"
            />
            <p className="text-rb-eel">
              You've completed the diagnostic — your lesson content is now
              unlocked. Focus first on the recommended review topics below.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {/* Back to the certification this attempt belongs to, not the list of
              every enrolled certification. The learner arrived here from one
              course and wants to carry on with it; dropping them on the index
              made them pick it out again. Falls back to the list only when the
              attempt carries no certification id. */}
          <TactileButton asChild>
            <Link
              to={
                result.certificationId != null
                  ? `/learner/learning/${result.certificationId}`
                  : "/learner/learning"
              }
            >
              continue learning
            </Link>
          </TactileButton>
          {result.assessmentType !== "DIAGNOSTIC" ? (
            <>
              <TactileButton asChild variant="ghost">
                <Link to={`/learner/assessments/${result.assessmentId}`}>
                  retake assessment
                </Link>
              </TactileButton>
              <TactileButton asChild variant="ghost">
                <Link to={`/learner/assessments/${result.assessmentId}/history`}>
                  view all attempts
                </Link>
              </TactileButton>
            </>
          ) : null}
        </div>

        <LearnerPremiumGuard
          feature={FEATURES.READINESS_ANALYSIS}
          certificationId={result.certificationId}
          compact
          title="Advanced result insights"
          description="Unlock weakness analysis, detailed performance breakdowns, readiness insights, and deeper attempt comparisons with Pro or institution access."
        >
          <PerformanceBreakdown lessonBreakdown={result.lessonBreakdown} />
        </LearnerPremiumGuard>

        {/* --- Answer review ------------------------------------------------ */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="rb-display rb-display-sm">Answer review</h2>
            {REVIEW_FILTERS.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {REVIEW_FILTERS.map((option) => {
                  const active = reviewFilter === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setReviewFilter(option.key)}
                      /* Built from utilities rather than `rb-chip`: that class
                         sets its own background and colour in an unlayered
                         rule, which outranks any Tailwind bg/text put beside
                         it, so a selected chip could only ever change its
                         border. Geometry still matches the chip. */
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-rb-control border-2 px-3 py-1.5 text-[0.8125rem] font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw",
                        active
                          ? "border-rb-feather bg-rb-feather text-white"
                          : "border-rb-swan bg-rb-snow text-rb-wolf hover:border-rb-hare hover:text-rb-eel"
                      )}
                    >
                      {option.label}
                      <span className="rb-numeric text-xs opacity-70">
                        {option.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          {visibleAnswers.length === 0 ? (
            <RebyuCard className="py-10 text-center">
              <p className="rb-body text-sm">Nothing in this group.</p>
            </RebyuCard>
          ) : null}

          <ol className="space-y-3">
            {visibleAnswers.map((answer) => {
              const state = answerState(answer)
              const tone = ANSWER_TONES[state]
              return (
              <li key={answer.attemptQuestionId}>
                <div className={cn("rounded-rb-card border-2 p-5", tone.card)}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="flex min-w-0 gap-3 text-sm font-medium leading-6 text-rb-eel">
                        {/* The item number as a key, the same square the attempt
                            navigator uses, so a learner comparing the two screens
                            is looking at the same object. */}
                        <span className="rb-numeric grid size-7 shrink-0 place-items-center rounded-rb-tile border-2 border-rb-swan bg-rb-snow text-xs text-rb-wolf">
                          {answer.displayOrder}
                        </span>
                        <span className="min-w-0">{answer.question}</span>
                      </p>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            "rounded-rb-control px-2.5 py-1 text-xs font-bold",
                            tone.badge
                          )}
                        >
                          {STATE_LABEL[state]}
                        </span>
                        {answer.points != null && answer.earnedPoints != null ? (
                          <span className="rb-numeric text-xs text-rb-wolf">
                            {Number(answer.earnedPoints)} / {Number(answer.points)} pts
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {answer.selectedChoiceText ? (
                      <div className="space-y-2 text-sm">
                        <p className="text-rb-eel">
                          <span className="text-rb-wolf">Your answer: </span>
                          {answer.selectedChoiceText}
                        </p>
                        {answer.isCorrect === false && answer.correctChoiceText ? (
                          <p className="rounded-rb-tile border-2 border-rb-leaf/45 bg-rb-leaf-wash p-2.5 text-rb-eel">
                            <span className="font-bold text-rb-leaf">
                              Correct answer:{" "}
                            </span>
                            {answer.correctChoiceText}
                          </p>
                        ) : null}
                        {answer.explanation ? (
                          <div className="rounded-rb-tile border-2 border-rb-swan bg-rb-snow p-3">
                            <p className={cn("text-xs font-bold", tone.text)}>
                              Explanation
                            </p>
                            <p className="mt-1 text-rb-wolf">{answer.explanation}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {answer.subQuestionAnswers?.length > 0 ? (
                      // Sub-questions always render as a normal ordered list
                      // here — tabs are attempt-answering UI only.
                      <ol className="space-y-2.5 text-sm">
                        {answer.subQuestionAnswers.map((sub, index) => (
                          <li
                            key={sub.subQuestionId}
                            className="rounded-rb-tile border-2 border-rb-swan bg-rb-snow p-3"
                          >
                            <p className="font-bold text-rb-eel">
                              <span className="mr-1.5 text-rb-wolf">{index + 1}.</span>
                              {sub.questionText}
                            </p>
                            <p className="mt-1.5 whitespace-pre-wrap rounded-rb-tile bg-rb-polar p-2.5 text-rb-wolf">
                              {sub.learnerAnswer?.trim()
                                ? sub.learnerAnswer
                                : "No answer submitted."}
                            </p>
                            {sub.earnedPoints != null && sub.maxPoints != null ? (
                              <p className="rb-numeric mt-1.5 text-xs text-rb-wolf">
                                {Number(sub.earnedPoints)} / {Number(sub.maxPoints)} pts
                              </p>
                            ) : null}
                            {sub.feedback ? (
                              <p className="rb-caption mt-1">{sub.feedback}</p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : answer.learnerAnswer && !answer.selectedChoiceText ? (
                      <div className="space-y-2 text-sm">
                        <p className="text-rb-wolf">Your answer:</p>
                        <p className="whitespace-pre-wrap rounded-rb-tile border-2 border-rb-swan bg-rb-snow p-3 text-rb-eel">
                          {answer.learnerAnswer}
                        </p>

                        {/* The answer key, on typed answers too. This block
                            only existed in the multiple-choice branch above,
                            so a wrong short answer showed the learner their own
                            wrong words and stopped there. */}
                        {answer.isCorrect === false && answer.correctChoiceText ? (
                          <p className="rounded-rb-tile border-2 border-rb-leaf/45 bg-rb-leaf-wash p-2.5 text-rb-eel">
                            <span className="font-bold text-rb-leaf">
                              Correct answer:{" "}
                            </span>
                            {answer.correctChoiceText}
                          </p>
                        ) : null}

                        {answer.explanation ? (
                          <div className="rounded-rb-tile border-2 border-rb-swan bg-rb-snow p-3">
                            <p className={cn("text-xs font-bold", tone.text)}>
                              Explanation
                            </p>
                            <p className="mt-1 text-rb-wolf">{answer.explanation}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {answer.feedback ? (
                      <div className="rounded-rb-tile border-2 border-rb-swan bg-rb-snow p-3 text-sm">
                        <p className={cn("text-xs font-bold", tone.text)}>Feedback</p>
                        <p className="mt-1 text-rb-wolf">{answer.feedback}</p>
                      </div>
                    ) : null}

                    {answer.submittedCode ? (
                      <div className="text-sm">
                        <p className="mb-2 text-rb-wolf">
                          Your code ({answer.programmingLanguage ?? "code"}):
                        </p>
                        <div className="h-64 overflow-hidden rounded-rb-tile border-2 border-rb-swan">
                          <CodeMirrorProgrammingWorkspace
                            value={answer.submittedCode}
                            language={answer.programmingLanguage ?? "Java"}
                            readOnly
                          />
                        </div>
                      </div>
                    ) : null}

                    {answer.diagramSubmitted && answer.diagramElements?.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        <p className="text-rb-wolf">
                          Diagram comparison — required elements vs. what you drew:
                        </p>
                        <ul className="space-y-1.5">
                          {answer.diagramElements.map((element, index) => (
                            <li
                              key={index}
                              className={cn(
                                "flex items-start gap-2 rounded-rb-tile border-2 p-2.5",
                                element.matched
                                  ? ANSWER_TONES.correct.panel
                                  : ANSWER_TONES.incorrect.panel
                              )}
                            >
                              {element.matched ? (
                                <CheckCircle2Icon
                                  className="mt-0.5 size-4 shrink-0 text-rb-leaf"
                                  aria-hidden="true"
                                />
                              ) : (
                                <XCircleIcon
                                  className="mt-0.5 size-4 shrink-0 text-rb-cardinal"
                                  aria-hidden="true"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-1.5 font-bold text-rb-eel">
                                  <span className="rounded-rb-control border-2 border-rb-swan bg-rb-snow px-1.5 py-0.5 text-[10px] text-rb-wolf">
                                    {element.kind === "EDGE" ? "Relationship" : "Node"}
                                  </span>
                                  {element.expectedDescription}
                                </p>
                                <p className="mt-0.5 text-xs text-rb-wolf">
                                  {element.matched
                                    ? `You drew: ${element.learnerDescription}`
                                    : "Missing from your diagram"}
                                  {element.earnedPoints != null && element.maxPoints != null
                                    ? ` · ${Number(element.earnedPoints)} / ${Number(element.maxPoints)} pts`
                                    : ""}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : answer.diagramSubmitted ? (
                      <p className="text-sm text-rb-wolf">
                        A diagram answer was submitted and stored for review.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
              )
            })}
          </ol>
        </section>
      </main>
    </div>
  )
}
