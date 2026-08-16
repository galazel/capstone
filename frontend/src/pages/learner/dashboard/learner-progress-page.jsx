import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowRight,
  Brain,
  BookOpen,
  Check,
  GripHorizontal,
  Loader2,
  Target,
  Trophy,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  LearnerEmptyState,
  LearnerErrorState,
} from "@/components/learner/learner-ui.jsx"
import LearnerPremiumGuard from "@/components/learner/learner-premium-guard.jsx"
import { ExamCountdownTile } from "@/components/learner/exam-countdown-tile.jsx"
import { StudyNotesTile } from "@/components/learner/study-notes-tile.jsx"
import { TodaysPlanTile } from "@/components/learner/todays-plan-tile.jsx"
import { PrioritySeal } from "@/components/learner/priority-tag.jsx"
import { BentoGrid, BentoHeading, BentoTile } from "@/components/commons/bento.jsx"
import { DashboardBoard } from "@/components/commons/dashboard-board.jsx"
import {
  RadialGauge,
  TrendLineChart,
  masteryBand,
  masteryColor,
  masteryInk,
  seriesColor,
  useChartTheme,
} from "@/components/charts/rebyu-charts.jsx"
import { FEATURES } from "@/services/subscriptionService.js"
import {
  PRIORITY_META,
  getProgressAnalytics,
} from "@/services/learnerAnalyticsService.js"
import {
  DASHBOARD_LAYOUT_KEY,
  getDashboardLayout,
  saveDashboardLayout,
} from "@/services/studyDeskService.js"

/* The page draws every chart from the shared portal kit rather than its own
   chart.js instance. That kit reads the active theme, so the grid lines and
   tick ink follow dark mode instead of staying pinned to a light-mode grey,
   and the categorical order (azure → teal → orange → violet) is the same one
   the enterprise panels use — the two portals read as one product. */

// Anything the page paints outside a chart still needs the series hues.
const SERIES_INK = ["#1B6EF3", "#00B8D4", "#FF9600", "#CE82FF"]

// For values the backend already reports on a 0-100 scale. Never re-scales --
// a real value of 0.5 (half a percent) must stay 0.5, not become 50.
function clampPercent(value) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)))
}

function getTopicScore(topic) {
  return (
    clampPercent(
      topic.mastery ??
      topic.masteryPercentage ??
      topic.score ??
      topic.percentage ??
      topic.correctRate ??
      topic.value
    ) ?? 0
  )
}

function getTopicTitle(topic, fallback = "Untitled Topic") {
  return (
    topic.title ??
    topic.name ??
    topic.lessonName ??
    topic.topicName ??
    fallback
  )
}

/* ------------------------------------------------------------------ pieces */

/**
 * How well the learner is holding a topic, as a tier.
 *
 * Read off the mastery percentage, on the same boundaries the bar is coloured
 * with -- so a red bar always reads "low", orange "medium", green "high", and
 * the two can never contradict each other on the same row.
 *
 * This used to grade the *evidence count* instead (25+ answers = high), which
 * is a different question: how sure the estimate is, rather than how good it
 * is. That reading never worked on a REBYU-sized curriculum, where a topic can
 * hold only a handful of questions and so was pinned at "low" permanently,
 * however well it was answered. The answer count is still printed beside the
 * tier, which is where "how much is this based on?" is now answered.
 *
 * Returns null when nothing has been answered: a topic with no evidence at all
 * gets no tier rather than a flattering one.
 */
const MASTERY_TIERS = {
  weak: { label: "low", bars: 1 },
  developing: { label: "medium", bars: 2 },
  strong: { label: "high", bars: 3 },
}

function masteryConfidence(value, evidenceCount) {
  const count = Number(evidenceCount)
  if (!Number.isFinite(count) || count <= 0) return null
  const band = masteryBand(value)
  return band ? MASTERY_TIERS[band] : null
}

/**
 * Three ascending bars. Decorative on its own — the tier is always written out
 * beside it, so the meaning never depends on counting bars or reading a colour.
 */
function ConfidenceMeter({ bars }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={`w-1 rounded-sm ${step <= bars ? "bg-foreground" : "bg-muted-foreground/30"}`}
          style={{ height: `${4 + step * 3}px` }}
        />
      ))}
    </span>
  )
}

/**
 * One measured thing with a bar under it. Full title on its own line rather
 * than sharing a row with the number, because lesson titles here run long
 * enough that a shared row truncates every one of them to nothing.
 *
 * `evidenceCount` is optional: rows that have it gain a confidence line under
 * the bar, rows that do not are unchanged.
 */
function MasteryRow({ title, caption, value, color = SERIES_INK[0], leading, evidenceCount }) {
  const confidence = masteryConfidence(value, evidenceCount)

  return (
    <div className="flex items-start gap-3">
      {leading ?? null}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold leading-5 text-foreground">{title}</p>

          <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
            {value}%
          </span>
        </div>

        {caption ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{caption}</p>
        ) : null}

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${value}%`, background: color }}
          />
        </div>

        {/* Only drawn when there is evidence to report. A row that says
            "0 answers seen" invites the reading that the topic was assessed and
            scored zero, which is the opposite of what an absent count means. */}
        {confidence ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ConfidenceMeter bars={confidence.bars} />
            {confidence.label} confidence
            <span aria-hidden="true">·</span>
            {evidenceCount} {evidenceCount === 1 ? "answer" : "answers"} seen
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The one card that asks for an action rather than reporting a number, which
 * is why it leads the page instead of closing it. The bar shows *certification*
 * completion: the per-lesson progress it used to show was read off fields the
 * lesson payload does not carry, so it sat at 0% no matter how much was done.
 */
function NextUpTile({
  nextLesson,
  certification,
  completedLessons,
  totalLessons,
  passedAssessments,
  totalAssessments,
  onResume,
  onOpenAssessments,
}) {
  /* "Finished" needs the assessments too.
     This used to be the lesson counters alone, so reading the last lesson
     flipped the tile to "all caught up" while every quiz and mock exam on the
     certification was still unsat -- the tile declaring victory next to a
     readiness gauge reading 29%.
     A certification with no published assessments is judged on lessons alone,
     rather than being made permanently unfinishable. */
  const lessonsDone = totalLessons > 0 && completedLessons >= totalLessons
  const assessmentsDone = totalAssessments === 0 || passedAssessments >= totalAssessments
  const done = lessonsDone && assessmentsDone
  // Lessons finished but assessments outstanding: the tile has no next lesson
  // to offer, and the honest next action is to go and sit them.
  const awaitingAssessments = lessonsDone && !assessmentsDone
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return (
    <BentoTile tone="macaw" col={4} row={2}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-rb-macaw-lip">
          {done ? "all caught up" : awaitingAssessments ? "assessments left" : "study next"}
        </p>

        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/60 text-rb-eel dark:bg-white/10 dark:text-rb-snow">
          {done ? (
            <Trophy className="size-4" aria-hidden="true" />
          ) : (
            <BookOpen className="size-4" aria-hidden="true" />
          )}
        </span>
      </div>

      <div className="mt-4 min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-rb-macaw-lip">
          {certification?.title ?? "Certification"}
        </p>

        <p className="mt-1 font-rb-display text-xl font-extrabold leading-tight sm:text-2xl">
          {done
            ? "Certification complete."
            : awaitingAssessments
              ? `${totalAssessments - passedAssessments} assessment${
                  totalAssessments - passedAssessments === 1 ? "" : "s"
                } to pass`
              : (nextLesson?.name ?? nextLesson?.title ?? "Untitled Lesson")}
        </p>

        <p className="mt-1.5 text-sm text-rb-macaw-lip">
          {done
            ? "Every lesson read and every assessment passed."
            : awaitingAssessments
              ? "Every lesson is read. Sit the remaining assessments to finish the certification."
              : (nextLesson?.middleCategoryTitle ?? "Continue studying to raise your mastery.")}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-rb-macaw-lip">
          <span>
            {completedLessons} of {totalLessons} lessons
            {totalAssessments > 0
              ? ` · ${passedAssessments} of ${totalAssessments} assessments`
              : ""}
          </span>
          <span className="tabular-nums">{percent}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/60 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-rb-macaw transition-[width] duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* The action follows the state. With lessons finished and assessments
            outstanding there is no next lesson to resume, so the button points
            at the curriculum, where the unit assessments live -- otherwise the
            tile names work to do and offers no way to start it. */}
        {!done && nextLesson ? (
          <Button className="mt-4 w-full sm:w-fit" onClick={onResume}>
            study now
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : awaitingAssessments ? (
          <Button className="mt-4 w-full sm:w-fit" onClick={onOpenAssessments}>
            go to assessments
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </BentoTile>
  )
}

/**
 * Readiness, with the coverage it rests on.
 *
 * Readiness is a weighted blend of average mastery with the diagnostic, quiz,
 * middle-exam and mock-exam averages, renormalised over whichever of those
 * exist -- "could I pass?".
 *
 * The certification-level confidence figure that used to sit under this gauge
 * is gone. Despite the name it was not a measure of certainty: the service
 * computes it as the evidence-weighted mean of the same lesson mastery the
 * Topic Mastery figure averages, so it was that number again under a different
 * label, and it collided with the per-topic "confidence" in the mastery list --
 * which does mean certainty, and is derived from evidence count.
 *
 * The coverage line stays, because it is the part that actually qualified the
 * gauge: readiness only sees lessons that have been assessed, so a high score
 * over three of forty lessons is a statement about a small corner of the
 * certification.
 */
function ReadinessTile({ readiness, assessedLessons, totalLessons }) {
  return (
    <BentoTile col={2} row={2}>
      <BentoHeading title="exam readiness" />

      {readiness === null ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Target className="size-6 text-muted-foreground/50" aria-hidden="true" />

          <p className="mt-3 text-sm font-medium text-foreground">Not scored yet</p>

          <p className="mt-1 text-xs text-muted-foreground">
            Sit a quiz or assessment to get an estimate.
          </p>
        </div>
      ) : (
        <>
          <RadialGauge value={readiness} label="ready for the exam" height={150} />

          <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
            {totalLessons > 0
              ? `Based on ${assessedLessons} of ${totalLessons} lessons assessed`
              : "Based on the lessons assessed so far"}
          </p>
        </>
      )}
    </BentoTile>
  )
}

/**
 * Mirrors the real grid's band shape (4+2, 2+2+2, 4+2, 3+3, 3+3, 3+3, 3+3) so
 * the page doesn't jump around once real content swaps in.
 */
function AnalyticsLoadingSkeleton() {
  return (
    <BentoGrid>
      <BentoTile col={4} row={2} className="gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-auto h-2 w-full" />
        <Skeleton className="h-10 w-36" />
      </BentoTile>
      <BentoTile col={2} row={2} className="gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mx-auto h-[130px] w-[130px] rounded-full" />
      </BentoTile>

      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>
      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>
      <BentoTile col={2} row={1} className="justify-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
      </BentoTile>

      <BentoTile col={4} row={2} className="gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[200px] w-full" />
      </BentoTile>
      <BentoTile col={2} row={2} className="gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </BentoTile>

      {[0, 1, 2, 3, 4, 5].map((index) => (
        <BentoTile key={index} col={3} row={2} className="gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </BentoTile>
      ))}
    </BentoGrid>
  )
}

/* -------------------------------------------------------------------- page */

export default function LearnerProgressPage() {
  const navigate = useNavigate()
  const outletContext = useOutletContext()
  const data = outletContext?.data ?? {}

  // Analytics is enrollment-scoped: the backend 404s for a certification the
  // learner has no active enrollment in. Offering the whole published catalog
  // here made the page open on a certification it could never load.
  const publishedCertifications = data.enrolledCertifications ?? []
  const allLessons = data.lessons ?? []

  const [selectedCertificationId, setSelectedCertificationId] = useState(
    publishedCertifications[0]?.certificationId
      ? String(publishedCertifications[0].certificationId)
      : ""
  )

  useEffect(() => {
    if (publishedCertifications.length === 0) {
      if (selectedCertificationId) {
        setSelectedCertificationId("")
      }

      return
    }

    const selectedStillExists = publishedCertifications.some(
      (certification) => String(certification.certificationId) === selectedCertificationId
    )

    if (!selectedStillExists) {
      setSelectedCertificationId(String(publishedCertifications[0].certificationId))
    }
  }, [publishedCertifications, selectedCertificationId])

  const selectedCertification = useMemo(() => {
    return publishedCertifications.find(
      (certification) => String(certification.certificationId) === selectedCertificationId
    )
  }, [publishedCertifications, selectedCertificationId])

  const analyticsQuery = useQuery({
    queryKey: ["learner-progress-analytics", selectedCertificationId],
    queryFn: () => getProgressAnalytics(selectedCertificationId),
    enabled: Boolean(selectedCertificationId),
    staleTime: 30_000,
    // Mastery numbers land asynchronously after a diagnostic or assessment --
    // poll while the BKT service hasn't caught up yet so the banner below
    // clears itself the moment it does, instead of needing a manual refresh.
    refetchInterval: (query) => (query.state.data?.bktAvailable === false ? 4000 : false),
  })
  const analytics = analyticsQuery.data

  const lessons = useMemo(() => {
    if (!selectedCertificationId) {
      return allLessons
    }

    return allLessons.filter(
      (lesson) => String(lesson.certificationId) === selectedCertificationId
    )
  }, [allLessons, selectedCertificationId])

  const totalLessons = analytics?.totalLessonCount ?? 0
  const completedLessons = analytics?.completedLessonCount ?? 0

  const nextLesson = useMemo(() => {
    return lessons.find((lesson) => !lesson.completed) ?? null
  }, [lessons])

  /**
   * Open a lesson in the reading experience.
   *
   * The topic page, which is where the curriculum sends a learner and where the
   * AI tutor lives. `/learner/lessons/:lessonId` is the older standalone page —
   * still routed and still reachable from an assessment breakdown, but not
   * where a lesson is read today, so linking there from here would put this
   * page on a different screen than every other route into a lesson.
   *
   * `?lesson=` names the lesson explicitly. The topic page otherwise opens the
   * first unfinished lesson in the topic, which is only coincidentally the one
   * that was asked for.
   *
   * The middle category is the unit a lesson is read inside; without it there
   * is nowhere more specific to land than the certification, which still beats
   * a click that goes nowhere.
   */
  const goToLesson = (lesson) => {
    if (lesson?.certificationId && lesson?.middleCategoryId) {
      const query = lesson.lessonId == null ? "" : `?lesson=${lesson.lessonId}`
      navigate(
        `/learner/learning/${lesson.certificationId}/topics/${lesson.middleCategoryId}${query}`,
      )
      return
    }

    if (selectedCertificationId) {
      navigate(`/learner/learning/${selectedCertificationId}`)
    }
  }

  const resumeNextLesson = () => {
    if (!nextLesson) return
    goToLesson(nextLesson)
  }

  /**
   * Score across retakes, one line per assessment.
   *
   * Plotted against attempt number rather than the calendar, because the
   * question this answers is "is my second go at this better than my first" --
   * and on a date axis the retakes of one assessment are scattered among every
   * other assessment's attempts, so an improvement reads as noise. Each
   * assessment gets its own line, so a rising line is that assessment getting
   * better.
   */
  const retakeTrend = useMemo(() => {
    const points = (analytics?.scoreTrend ?? []).filter(
      (point) => clampPercent(point.percentage) !== null
    )

    const byAssessment = new Map()
    for (const point of points) {
      // examId when the backend has it; the title is the fallback so older
      // payloads still group instead of drawing a line per attempt.
      const key = String(point.examId ?? point.assessmentTitle ?? "unknown")
      if (!byAssessment.has(key)) {
        byAssessment.set(key, {
          key: `assessment-${byAssessment.size}`,
          name: point.assessmentTitle ?? "Assessment",
          attempts: [],
        })
      }
      byAssessment.get(key).attempts.push(point)
    }

    const assessments = [...byAssessment.values()]
      .map((assessment) => ({
        ...assessment,
        attempts: [...assessment.attempts].sort(
          (a, b) =>
            (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0) ||
            new Date(a.submittedAt ?? 0) - new Date(b.submittedAt ?? 0)
        ),
      }))
      // Most-attempted first: retakes are the subject, so the assessment a
      // learner has ground away at is the one they came here to look at.
      .sort((a, b) => b.attempts.length - a.attempts.length)

    // Capped to the chart kit's four categorical hues, and said out loud in
    // the tile rather than silently truncated. A fifth series is not given a
    // new colour by the kit -- it folds into neutral grey, so two assessments
    // would arrive the same shade and stop being distinguishable at all.
    const MAX_SERIES = 4
    const shown = assessments.slice(0, MAX_SERIES)

    const longestRun = shown.reduce((max, item) => Math.max(max, item.attempts.length), 0)
    const rows = Array.from({ length: longestRun }, (_, index) => {
      const row = { label: `Attempt ${index + 1}` }
      for (const assessment of shown) {
        // Null, not zero, past the end of a run: recharts breaks the line
        // rather than drawing it down to the floor for an attempt never sat.
        row[assessment.key] = clampPercent(assessment.attempts[index]?.percentage) ?? null
      }
      return row
    })

    const summaries = shown.map((assessment) => {
      const scores = assessment.attempts.map((attempt) => clampPercent(attempt.percentage) ?? 0)
      const first = scores[0]
      const latest = scores[scores.length - 1]
      return {
        key: assessment.key,
        name: assessment.name,
        attempts: scores.length,
        first,
        latest,
        best: Math.max(...scores),
        delta: latest - first,
      }
    })

    return {
      rows,
      series: shown.map((assessment) => ({ key: assessment.key, name: assessment.name })),
      summaries,
      hiddenCount: assessments.length - shown.length,
    }
  }, [analytics])

  /**
   * Every assessed lesson, ranked weakest first.
   *
   * `lessonPriorities` rather than `weakestTopics`: the curated lists are a
   * top-N of each extreme, so between "4 weakest" and "4 strongest" the middle
   * of the certification never appears anywhere on this page. This is the
   * uncapped set the DTO exists to carry — the curriculum pages already read
   * it for their per-lesson tags.
   *
   * Unassessed lessons are dropped rather than sorted to the front. They would
   * otherwise lead the list at 0%, which reads as "you scored nothing here"
   * when it means "nothing has been asked yet" — and they are already counted
   * separately as `unassessedTopicCount`.
   */
  const rankedMastery = useMemo(() => {
    const rows = (analytics?.lessonPriorities ?? []).filter(
      (topic) => Number(topic.evidenceCount) > 0 && topic.masteryPercentage != null
    )

    return [...rows].sort((a, b) => {
      const byMastery = getTopicScore(a) - getTopicScore(b)
      if (byMastery !== 0) return byMastery
      // Same mastery: the better-evidenced one first, because it is the one
      // the estimate is actually sure about and therefore the safer thing to
      // spend an hour on.
      return Number(b.evidenceCount ?? 0) - Number(a.evidenceCount ?? 0)
    })
  }, [analytics])

  /**
   * One row per assessment, carrying its most recent attempt.
   *
   * Built from `scoreTrend`, which is already every submitted attempt with its
   * `examId` and `attemptNumber` — the same source the retake chart groups. No
   * new endpoint is needed to answer "what have I sat, and how did it go".
   *
   * The point of the tile is the link out. Attempt history was previously only
   * reachable by going to the certification, opening the assessment, and then
   * its history; this puts the same destination one click from the page a
   * learner is already on when they wonder about it.
   */
  const assessmentHistory = useMemo(() => {
    const byExam = new Map()

    for (const point of analytics?.scoreTrend ?? []) {
      // Without an examId there is no history route to send anyone to, so the
      // row would be a dead end. Those attempts still count in the retake
      // chart, which groups by title as a fallback; here they are skipped.
      if (point.examId == null) continue

      const key = String(point.examId)
      const existing = byExam.get(key)
      const attemptNo = point.attemptNumber ?? 0
      const submitted = new Date(point.submittedAt ?? 0).getTime()

      if (!existing) {
        byExam.set(key, { latest: point, attempts: 1 })
        continue
      }

      existing.attempts += 1

      const currentNo = existing.latest.attemptNumber ?? 0
      const currentSubmitted = new Date(existing.latest.submittedAt ?? 0).getTime()
      // Attempt number first, timestamp only to break a tie: two attempts can
      // share a submission minute, but their numbering is always ordered.
      if (attemptNo > currentNo || (attemptNo === currentNo && submitted > currentSubmitted)) {
        existing.latest = point
      }
    }

    return [...byExam.entries()]
      .map(([examId, entry]) => ({
        examId,
        title: entry.latest.assessmentTitle ?? "Assessment",
        assessmentType: entry.latest.assessmentType,
        score: clampPercent(entry.latest.percentage),
        passed: entry.latest.passed,
        submittedAt: entry.latest.submittedAt,
        attempts: entry.attempts,
        resultId: entry.latest.assessmentAttemptId,
      }))
      // Most recently sat first — the thing you just did is the thing you are
      // most likely to have come here to look at.
      .sort((a, b) => new Date(b.submittedAt ?? 0) - new Date(a.submittedAt ?? 0))
  }, [analytics])

  /**
   * The one topic to work on next.
   *
   * Replaces the average this tile used to show. That figure divided only by
   * the topics already assessed, so a certification with one measured topic
   * answered correctly read 100% while the learner had barely started -- true
   * arithmetic, and a useless thing to put in the largest text on the tile.
   *
   * Priority first, lowest mastery as the tie-break. The two usually agree;
   * where they do not, the priority tag is the better answer because it already
   * weighs how much the exam leans on that topic, which a bare mastery
   * percentage cannot see. An unknown or absent tag ranks below every known one
   * rather than above, so a missing tag never promotes a topic.
   */
  /* The tile is filled by how the topic is going, on the same bands that
     colour every mastery bar -- so the wash, the figure printed on it, and the
     row for the same topic further down the board all agree.

     This used to key off the priority tag instead (red for critical/high, an
     ordinary surface otherwise). Urgency has not lost its signal: the
     `PrioritySeal` in the tile's corner still names it in words, which was
     always the part doing the accessible work. */
  const MASTERY_TONES = { weak: "cardinal", developing: "fox", strong: "leaf" }

  const focusTopic = useMemo(() => {
    if (rankedMastery.length === 0) return null

    return [...rankedMastery].sort((a, b) => {
      const rankA = PRIORITY_META[a.priorityTag]?.rank ?? -1
      const rankB = PRIORITY_META[b.priorityTag]?.rank ?? -1
      if (rankA !== rankB) return rankB - rankA
      return getTopicScore(a) - getTopicScore(b)
    })[0]
  }, [rankedMastery])

  const focusScore = focusTopic ? getTopicScore(focusTopic) : null
  const focusBand = masteryBand(focusScore)
  /* Violet is the "nothing scored yet" surface, not a band -- the tile shows
     copy rather than a figure there, so it must not borrow a band's colour. */
  const focusTone = MASTERY_TONES[focusBand] ?? "beetle"
  const readinessLevel = clampPercent(analytics?.readinessPercentage)
  /* What the readiness figure is actually based on. The response carries the
     unassessed count rather than a coverage percentage, so the assessed count
     is the total less that. Floored at zero: the two numbers come from
     different queries and a transient disagreement should not print "-1". */
  const assessedLessonCount = Math.max(0, totalLessons - (analytics?.unassessedTopicCount ?? 0))
  const bktUnavailable = analytics != null && analytics.bktAvailable === false

  // The same palette the chart draws its lines with, so a swatch beside an
  // assessment is the colour of that assessment's line -- in either theme.
  const chartTheme = useChartTheme()

  /**
   * Every tile on this page, in its default order, with the room it needs.
   *
   * Sizes stay here rather than being draggable: a trend line needs width
   * and a counter does not, and a dashboard where those can be squeezed is
   * one where the charts stop being readable. The learner arranges the
   * order; the tiles keep their proportions.
   *
   * The ids are the contract with the saved layout, so renaming one drops a
   * learner's position for that tile (it falls back to the default spot)
   * rather than breaking the page.
   */
  const dashboardTiles = [
    {
      id: "next-up",
      col: 4,
      row: 2,
      element: (
        <NextUpTile
        nextLesson={nextLesson}
        certification={selectedCertification}
        completedLessons={completedLessons}
        totalLessons={totalLessons}
        passedAssessments={analytics?.passedAssessmentCount ?? 0}
        totalAssessments={analytics?.totalAssessmentCount ?? 0}
        onResume={resumeNextLesson}
        onOpenAssessments={() =>
        selectedCertificationId
        ? navigate(`/learner/learning/${selectedCertificationId}`)
        : undefined
        }
        />
      ),
    },
    {
      // Id unchanged so a saved board keeps this tile in place -- same slot,
      // same question, a number that can actually be explained.
      id: "exam-readiness",
      col: 2,
      row: 2,
      element: (
        <ReadinessTile
        readiness={readinessLevel}
        assessedLessons={assessedLessonCount}
        totalLessons={totalLessons}
        />
      ),
    },
    {
      // Id kept so a saved board keeps this tile where the learner put it --
      // it occupies the same slot and answers a better version of the same
      // question, so moving it would be the surprise, not the change.
      id: "topic-mastery",
      col: 2,
      row: 1,
      element: (
        <BentoTile tone={focusTone} col={2} row={1}>
          <div className="flex items-start justify-between gap-3">
            {/* Band ink rather than the tone's own `-lip`: the `-lip` shades
                are tuned for button shadows, not for AA text on a wash, and
                this label is small type. Falls back to violet on the
                nothing-scored surface, which has no band. */}
            <p
              className={`text-sm font-bold ${focusBand ? "" : "text-rb-beetle-lip"}`}
              style={focusBand ? { color: masteryInk(chartTheme, focusScore) } : undefined}
            >
              {focusTopic ? "Work on this next" : "Topic Mastery"}
            </p>
            {focusTopic?.priorityTag ? (
              <PrioritySeal tag={focusTopic.priorityTag} size={36} />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/60 text-rb-eel dark:bg-white/10 dark:text-rb-snow">
                <Brain className="size-4" aria-hidden="true" />
              </span>
            )}
          </div>

          {focusTopic ? (
            <div className="mt-auto min-w-0">
              {/* The percentage carries the tile's display size, matching the
                  stat tiles beside it so the row still scans as one band of
                  figures. It is this topic's mastery, not an average -- which
                  is the point of the change: the number now belongs to
                  something you can name and open.

                  Tinted by the same bands as the bars below it, but through
                  `masteryInk` rather than `masteryColor`: this is type on a
                  tinted wash, and the bar's orange reads at 1.9:1 there --
                  under half the 3:1 large-text floor. */}
              <p
                className="font-rb-display text-4xl font-extrabold leading-[0.9] tracking-tight tabular-nums sm:text-5xl"
                style={{ color: masteryInk(chartTheme, focusScore) }}
              >
                {focusScore}%
              </p>

              {/* Clamped to one line: the row is a fixed 176px and the tile
                  clips, so a second line would be cut silently rather than
                  shown. An ellipsis at least says there was more. */}
              <p className="mt-1.5 truncate text-sm font-bold text-rb-eel">
                {focusTopic.lessonTitle ?? getTopicTitle(focusTopic)}
              </p>

              {focusTopic.categoryTitle ? (
                <p
                  className="truncate text-xs font-semibold"
                  style={{ color: masteryInk(chartTheme, focusScore) }}
                >
                  {focusTopic.categoryTitle}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-auto">
              <p className="font-rb-display text-2xl font-extrabold leading-tight text-rb-eel">
                Nothing scored yet
              </p>
              <p className="mt-1 text-xs font-semibold text-rb-beetle-lip">
                {analytics?.unassessedTopicCount
                  ? `${analytics.unassessedTopicCount} topics not yet assessed`
                  : "Sit an assessment to rank your topics"}
              </p>
            </div>
          )}
        </BentoTile>
      ),
    },
    {
      id: "todays-plan",
      col: 3,
      row: 2,
      element: (
        <TodaysPlanTile certificationId={selectedCertificationId} />
      ),
    },
    {
      id: "exam-countdown",
      col: 3,
      row: 2,
      element: (
        <ExamCountdownTile certificationId={selectedCertificationId} />
      ),
    },
    {
      id: "study-notes",
      // Half the band. The countdown beside it takes the other half, so the
      // row still ends level rather than leaving a column-wide hole that
      // nothing on this page is narrow enough to fill.
      col: 3,
      row: 2,
      element: (
        <StudyNotesTile certificationId={selectedCertificationId} />
      ),
    },
    {
      id: "score-over-time",
      // Taller by default than the other charts: it carries the per-assessment
      // verdicts under the lines, and squeezed into two rows the chart wins and
      // they get cut off.
      col: 4,
      row: 3,
      element: (
        <BentoTile col={4} row={3}>
          <BentoHeading
            title="score across retakes"
            hint="Each assessment's attempts in order — a rising line is a score you moved."
            chip={
              retakeTrend.hiddenCount > 0 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  showing {retakeTrend.summaries.length} of{" "}
                  {retakeTrend.summaries.length + retakeTrend.hiddenCount} · most retaken
                </span>
              ) : null
            }
          />

          {retakeTrend.rows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Target className="size-7 text-muted-foreground/50" aria-hidden="true" />

              <p className="mt-3 text-sm font-medium text-foreground">No graded attempts yet</p>

              <p className="mt-1 text-xs text-muted-foreground">
                Sit a quiz or an assessment, then retake it — this chart is about the
                difference between the two.
              </p>
            </div>
          ) : (
            <>
              {/* `shrink-0` off, and a smaller height: the chart is what gives
                  way when the tile is short. The verdicts below are the point
                  of the tile and can scroll; a fixed-height chart cannot, and
                  it was pushing them out of a tile the learner had made two
                  rows tall. */}
              <div className="min-h-0 shrink">
                <TrendLineChart
                  data={retakeTrend.rows}
                  xKey="label"
                  series={retakeTrend.series}
                  height={150}
                  unit="%"
                  ticks={[0, 25, 50, 75, 100]}
                  // The verdict list underneath already names every assessment
                  // and carries its numbers; the chart's own two legends were
                  // the same information a third and fourth time, printed over
                  // the top of it.
                  showLegend={false}
                />
              </div>

              {/* The chart shows the shape; this says what it means. A learner
                  asking "am I getting better at this one" gets the answer in
                  words rather than having to read it off a line. */}
              <div className="-mr-2 mt-2 min-h-16 flex-1 space-y-1 overflow-y-auto pr-2">
                {retakeTrend.summaries.map((summary, index) => (
                  <div key={summary.key} className="flex items-center gap-2.5 text-xs">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: seriesColor(chartTheme, index) }}
                      aria-hidden="true"
                    />

                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                      {summary.name}
                    </span>

                    <span className="hidden shrink-0 text-muted-foreground sm:inline">
                      {summary.attempts === 1
                        ? "1 attempt"
                        : `${summary.attempts} attempts · best ${summary.best}%`}
                    </span>

                    {summary.attempts === 1 ? (
                      <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">
                        {summary.latest}%
                      </span>
                    ) : (
                      <span
                        className={`w-20 shrink-0 text-right font-bold tabular-nums ${
                          summary.delta > 0
                            ? "text-rb-feather-ink"
                            : summary.delta < 0
                              ? "text-rb-cardinal-lip"
                              : "text-muted-foreground"
                        }`}
                        title={`First attempt ${summary.first}%, latest ${summary.latest}%`}
                      >
                        {summary.delta > 0 ? "+" : ""}
                        {summary.delta === 0 ? "no change" : `${summary.delta} pts`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </BentoTile>
      ),
    },
    {
      id: "mastery-by-topic",
      // Four wide and four tall: it is a list rather than a chart, and the
      // whole point of it is that it does not stop after the first few rows.
      col: 4,
      row: 4,
      element: (
        <BentoTile col={4} row={4} className="!p-0">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
              <BentoHeading
                title="mastery by topic"
                hint="Weakest first — every topic with enough answers behind it to score."
              />

              {analytics?.unassessedTopicCount ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                      {analytics.unassessedTopicCount} not yet assessed
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    These topics have no answers behind them yet, so they carry no
                    mastery estimate and are left out of this list.
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>

            {rankedMastery.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <Brain className="size-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Nothing scored yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sit a diagnostic or an assessment and every topic it touches gets a
                  mastery level here.
                </p>
              </div>
            ) : (
              /* Scrolls inside the tile rather than growing it. The tile's
                 height is part of the board layout the learner arranged, so a
                 certification with ninety lessons must not be the one that
                 pushes every tile below it off the screen. */
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                {rankedMastery.map((topic, index) => (
                  <li
                    key={topic.lessonId ?? `${getTopicTitle(topic)}-${index}`}
                    className="px-5 py-3.5 sm:px-6"
                  >
                    <MasteryRow
                      title={topic.lessonTitle ?? getTopicTitle(topic)}
                      caption={topic.categoryTitle}
                      value={getTopicScore(topic)}
                      /* Red under 25, orange under 50, green above — the shared
                         mastery scale, so the row tints the same way in either
                         theme and the bands live in one place. */
                      color={masteryColor(chartTheme, getTopicScore(topic))}
                      evidenceCount={topic.evidenceCount}
                      leading={
                        topic.priorityTag ? (
                          <PrioritySeal tag={topic.priorityTag} size={36} />
                        ) : null
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </BentoTile>
      ),
    },
    {
      id: "assessment-history",
      col: 4,
      row: 3,
      element: (
        <BentoTile col={4} row={3} className="!p-0">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border p-5 sm:p-6">
              <BentoHeading
                title="assessment history"
                hint="Your latest attempt on each assessment — open the full run from here."
              />
            </div>

            {assessmentHistory.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <BookOpen className="size-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  No assessments sat yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Once you submit one, every attempt shows up here.
                </p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                {assessmentHistory.map((row) => (
                  <li
                    key={row.examId}
                    className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {row.title}
                      </p>

                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-bold tabular-nums text-foreground">
                          {row.score === null ? "—" : `${row.score}%`}
                        </span>

                        {/* Pass/fail is written, never colour alone. */}
                        {row.passed == null ? null : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              row.passed
                                ? "bg-rb-feather-wash text-rb-feather-ink"
                                : "bg-rb-cardinal-wash text-rb-cardinal-lip"
                            }`}
                          >
                            {row.passed ? "passed" : "not passed"}
                          </span>
                        )}

                        <span aria-hidden="true">·</span>
                        <span>
                          {row.attempts} {row.attempts === 1 ? "attempt" : "attempts"}
                        </span>

                        {row.submittedAt ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {new Date(row.submittedAt).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    {/* The label names the destination rather than saying
                        "view", because two different destinations exist for a
                        row like this — the graded paper for one attempt, and
                        the list of every attempt. This is the list. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => navigate(`/learner/assessments/${row.examId}/history`)}
                    >
                      view attempts
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </BentoTile>
      ),
    },
  ]

  // ------------------------------------------------------------ tile layout
  // The learner's own arrangement of the tiles above, saved per learner rather
  // than per certification: it is a preference about how they read the page,
  // and having it change when they switch certification would read as the page
  // rearranging itself.
  const layoutQuery = useQuery({
    queryKey: [DASHBOARD_LAYOUT_KEY],
    queryFn: getDashboardLayout,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const queryClient = useQueryClient()
  const [rearranging, setRearranging] = useState(false)
  // Held locally as well as saved, so a tile lands where it was dropped or
  // dragged to size immediately rather than after the round trip.
  const [localLayout, setLocalLayout] = useState(null)
  /* Null while the saved board is still in flight -- deliberately distinct
     from `[]`, which is a real arrangement meaning "the defaults". Only
     `tileLayout` below flattens the two, because rendering has to draw
     something either way; anything that could *write* the layout back has to
     be able to tell "no arrangement yet" from "the default arrangement". */
  const savedLayout = localLayout ?? layoutQuery.data?.tiles ?? null
  const tileLayout = savedLayout ?? []

  const saveLayoutMutation = useMutation({
    mutationFn: saveDashboardLayout,

    /* Write the saved board straight back into the query cache.
     *
     * Without this the arrangement looked like it never saved. `localLayout`
     * only lives as long as this component: navigate away and back and it is
     * null again, so the board falls through to `layoutQuery.data` -- which
     * still held the pre-drag value, because nothing invalidated it and the
     * query's five-minute `staleTime` means react-query serves the cache
     * instead of refetching. The write did reach the database; the page just
     * kept reading a stale copy of what the board used to be.
     *
     * `setQueryData` rather than `invalidateQueries` because the PUT already
     * returns the persisted board in the GET's own shape ({tiles: [...]}), so
     * a refetch would be a round trip to learn what the response just said.
     *
     * Clearing `localLayout` afterwards hands authority back to the cache. It
     * cannot flicker: the value just written is the one being cleared in
     * favour of. */
    onSuccess: (saved) => {
      queryClient.setQueryData([DASHBOARD_LAYOUT_KEY], saved)
      setLocalLayout(null)
    },

    onError: (error) => {
      /* Drop the local override so the board falls back to the server's copy,
         which is what is actually stored. Leaving the failed arrangement on
         screen would show a layout that does not match the database, and the
         learner would only discover it on some later reload. */
      setLocalLayout(null)

      // Named loudly, because the failure is otherwise invisible until the next
      // reload puts every tile back and the arrangement looks like it was never
      // made. A 404 here means the endpoint is not deployed yet.
      console.warn("Saving the dashboard layout failed.", error)
      toast.error("Could not save your layout", {
        description:
          error?.response?.status === 404
            ? "The layout service isn't available, so arrangements cannot be saved yet."
            : "Your tiles have been put back where they were.",
      })
    },
  })

  const handleLayoutChange = (nextLayout) => {
    setLocalLayout(nextLayout)
    saveLayoutMutation.mutate(nextLayout)
  }

  const resetLayout = () => {
    setLocalLayout([])
    saveLayoutMutation.mutate([])
  }

  /* The board as it stood when this editing session opened.
   *
   * Cancel needs it because every drag saves as it happens -- by the time the
   * learner decides they preferred the old arrangement, the new one is already
   * in the database. So "cancel" cannot be a matter of dropping local state
   * the way it usually is; it has to put the snapshot back the same way any
   * other change goes in. */
  const [layoutBeforeEdit, setLayoutBeforeEdit] = useState(null)

  const startRearranging = () => {
    /* `savedLayout`, not `tileLayout`: entering the mode before the query has
       answered would otherwise snapshot the `[]` that stands in for "still
       loading", and cancelling would then write that back as though the
       learner had asked for the default board -- discarding the arrangement
       they actually had. A null snapshot means cancel restores nothing, which
       is the honest behaviour when we do not yet know what to restore. */
    setLayoutBeforeEdit(savedLayout)
    setRearranging(true)
  }

  const finishRearranging = () => {
    setLayoutBeforeEdit(null)
    setRearranging(false)
  }

  const cancelRearranging = () => {
    const previous = layoutBeforeEdit
    finishRearranging()
    // Nothing actually moved, so there is nothing to write. Worth the compare:
    // otherwise opening the mode and thinking better of it costs a PUT and a
    // toast on every failure path, to store what was already stored.
    if (previous != null && JSON.stringify(previous) !== JSON.stringify(tileLayout)) {
      setLocalLayout(previous)
      saveLayoutMutation.mutate(previous)
    }
  }

  return (
    <LearnerPremiumGuard
      feature={FEATURES.PROGRESS_ANALYTICS}
      title="Advanced progress analytics"
      description="Unlock mastery, weakness analysis, performance trends, confidence, and recommended next actions with Pro or institution access."
    >
      <div className="space-y-6">
        {/* No page title. The route is already named "Analytics" in the top
            navigation, and the strapline under it described the tiles rather
            than telling a learner anything they could not read off them. The
            controls keep the row to themselves and the board starts higher up
            the page. `ml-auto` on the picker holds them to the right now that
            nothing occupies the left of the row. */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedCertificationId}
            onValueChange={setSelectedCertificationId}
            disabled={publishedCertifications.length === 0}
          >
            <SelectTrigger className="ml-auto w-auto min-w-[210px] bg-background text-sm font-medium">
              <SelectValue placeholder="Select certification" />
            </SelectTrigger>

            <SelectContent align="start">
              {publishedCertifications.map((certification) => (
                <SelectItem
                  key={certification.certificationId}
                  value={String(certification.certificationId)}
                  className="text-sm"
                >
                  {certification.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Read left to right, the two ways out of this mode sit before the
              one way to keep it: put everything back, abandon this session's
              changes, accept them. The confirm is last because it is where the
              hand ends up, and because a destructive-ish control should never
              be the one under the finger that just finished dragging. */}
          {rearranging ? (
            <>
              <Button variant="ghost" onClick={resetLayout}>
                Reset layout
              </Button>

              <Button variant="outline" onClick={cancelRearranging}>
                Cancel
              </Button>
            </>
          ) : null}

          {/* Icon only, and a mode rather than a permanent affordance: drag
              handles on every tile all the time are clutter on the many visits
              where the learner only wants to read the page. The label is on
              the button for screen readers and as a tooltip for everyone
              else -- an unlabelled icon is a guess otherwise. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rearranging ? "default" : "outline"}
                // `icon` is size-11, which is the height of the select trigger
                // beside it -- `icon-sm` sat three pixels short of the row.
                size="icon"
                aria-pressed={rearranging}
                aria-label={rearranging ? "Keep this arrangement" : "Rearrange tiles"}
                onClick={rearranging ? finishRearranging : startRearranging}
              >
                {rearranging ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <GripHorizontal className="size-4" aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>

            <TooltipContent side="bottom">
              {rearranging ? "Keep this arrangement" : "Rearrange tiles"}
            </TooltipContent>
          </Tooltip>
        </div>

        {publishedCertifications.length === 0 ? (
          <LearnerEmptyState
            icon={BookOpen}
            title="No enrolled certifications yet"
            description="Enroll in a certification -- or accept an organization invitation -- and your mastery, performance trends, and recommended next steps will appear here."
            action={
              <Button onClick={() => navigate("/learner/certifications")}>
                Browse certifications
              </Button>
            }
          />
        ) : analyticsQuery.isLoading ? (
          <AnalyticsLoadingSkeleton />
        ) : analyticsQuery.isError ? (
          <LearnerErrorState
            title="Couldn't load your analytics"
            error={analyticsQuery.error}
            onRetry={analyticsQuery.refetch}
          />
        ) : (
          <>
            {bktUnavailable && (
              <div className="flex items-center gap-3 rounded-rb-tile border-2 border-rb-bee/40 bg-rb-bee-wash px-4 py-3 text-sm font-semibold text-rb-bee-lip">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                <span>
                  Processing your mastery — this updates itself once it's ready. Your assessment
                  scores below are still up to date.
                </span>
              </div>
            )}

            <DashboardBoard
              tiles={dashboardTiles}
              layout={tileLayout}
              editing={rearranging}
              onLayoutChange={handleLayoutChange}
            />
          </>
        )}
      </div>
    </LearnerPremiumGuard>
  )
}
