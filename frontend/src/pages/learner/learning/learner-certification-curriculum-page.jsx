import { useMemo, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CircleHelp,
  Loader2,
  Lock,
  Trophy,
} from "@/components/icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BackButton, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import {
  Collapse,
  CountUp,
  Reveal,
  StaggerItem,
  StaggerList,
  fadeUp,
  motion,
  popIn,
  useAnimationControls,
} from "@/components/motion/rebyu-motion.jsx"
import { LearnerEmptyState } from "@/components/learner/learner-ui.jsx"
import { PRIORITY_CONFIG, PriorityTag } from "@/components/learner/priority-tag.jsx"
import { getExams, getExamTypes } from "@/services/assessmentService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"
import { buildCurriculum, hasSatDiagnostic } from "./curriculum-model.js"

/**
 * The curriculum a learner lands on after opening an enrolled certification.
 *
 * Card shape is the admin arena card's colour language on the landing page's
 * *band* geometry: a saturated identity panel on the left with the unit's
 * wordmark bled off it, and the body running the full width beside it. A unit
 * has a topic list, counts, and a progress bar; in a 3-up grid that content
 * wraps to six lines and the units stop being scannable. Long horizontal bands
 * give each unit one line of the page and let the stack read as the order of
 * study.
 *
 * Two levels of accordion, because that is what the curriculum is: the unit
 * opens to its middle categories, and a middle category opens to the lessons,
 * quizzes, and assessment inside it. Only the middle category is actionable —
 * lessons and quizzes are shown so the learner can see what a topic contains,
 * but they are entered through the topic surface, not from here.
 *
 * Until the diagnostic is sat, every unit carries a lock and opens the
 * diagnostic dialog instead of expanding. The lock is on the card rather than
 * on a banner above the list so it cannot be scrolled past.
 */

const TONE = {
  macaw: {
    face: "bg-rb-macaw",
    wash: "bg-rb-macaw-wash",
    chip: "bg-rb-macaw-wash text-rb-macaw-lip",
    ink: "text-rb-macaw-lip",
    btn: "macaw",
    bar: "macaw",
  },
  bee: {
    face: "bg-rb-bee",
    wash: "bg-rb-bee-wash",
    chip: "bg-rb-bee-wash text-rb-bee-ink",
    ink: "text-rb-bee-ink",
    btn: "fox",
    bar: "bee",
  },
  beetle: {
    face: "bg-rb-beetle",
    wash: "bg-rb-beetle-wash",
    chip: "bg-rb-beetle-wash text-rb-beetle-lip",
    ink: "text-rb-beetle-lip",
    btn: "beetle",
    bar: "beetle",
  },
  cardinal: {
    face: "bg-rb-cardinal",
    wash: "bg-rb-cardinal-wash",
    chip: "bg-rb-cardinal-wash text-rb-cardinal-lip",
    ink: "text-rb-cardinal-lip",
    btn: "cardinal",
    bar: "mask",
  },
  feather: {
    face: "bg-rb-feather",
    wash: "bg-rb-feather-wash",
    chip: "bg-rb-feather-wash text-rb-feather-ink",
    ink: "text-rb-feather-ink",
    btn: "feather",
    bar: "feather",
  },
  fox: {
    face: "bg-rb-fox",
    wash: "bg-rb-fox-wash",
    chip: "bg-rb-fox-wash text-rb-fox-lip",
    ink: "text-rb-fox-lip",
    btn: "fox",
    bar: "fox",
  },
}

// Worst-first: the summary reads like a triage list, not an alphabetical one.
const PRIORITY_SUMMARY_ORDER = [
  "CRITICAL_PRIORITY",
  "HIGH_PRIORITY",
  "MEDIUM_PRIORITY",
  "LOW_PRIORITY",
]

const PRIORITY_SUMMARY_LABEL = {
  CRITICAL_PRIORITY: "critical",
  HIGH_PRIORITY: "high priority",
  MEDIUM_PRIORITY: "medium priority",
  LOW_PRIORITY: "low priority",
}

/* ------------------------------------------------------------------- pieces */

/** One row inside an opened topic. Not a control — the icon and the label say
 *  what the item is, and the topic above it is what the learner acts on.
 *
 *  A div, not an li: the `<StaggerItem>` around it supplies the list item, and
 *  an li inside an li is invalid. */
function ItemRow({ icon: Icon, label, meta, done, priorityTag, historyHref }) {
  // Critical is the one tag that means "you are behind here" -- everything
  // else on this row is informational, so it is the only one that earns a
  // red highlight and a pulse instead of just its usual pill.
  const isCritical = !done && priorityTag === "CRITICAL_PRIORITY"

  return (
    <div
      className={`flex items-center gap-3 py-2 ${
        isCritical ? "-mx-2 rounded-xl bg-rb-cardinal-wash/50 px-2 ring-2 ring-rb-cardinal/30" : ""
      }`}
    >
      <span
        className={`relative grid size-8 shrink-0 place-items-center rounded-full ${
          done
            ? "bg-rb-feather text-white"
            : isCritical
              ? "bg-rb-cardinal text-white"
              : "bg-rb-swan text-rb-wolf"
        }`}
      >
        {done ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Icon className="size-4" aria-hidden="true" />
        )}

        {isCritical ? (
          <motion.span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-rb-cardinal ring-2 ring-rb-snow"
            animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
        ) : null}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-bold text-rb-eel">{label}</span>

      {/* Nothing to prioritize once it's done -- the tag is about where to
          spend study time next, not a permanent label on the lesson. */}
      {!done && priorityTag ? <PriorityTag tag={priorityTag} size="sm" /> : null}

      {meta ? <span className="shrink-0 text-xs font-bold text-rb-wolf">{meta}</span> : null}

      {/* Every non-diagnostic assessment allows unlimited retakes -- this is
          the quick way to see every past attempt without going through a
          fresh attempt's result page first. */}
      {historyHref ? (
        <Link
          to={historyHref}
          className="shrink-0 text-xs font-bold text-rb-macaw-lip underline decoration-dotted underline-offset-2 hover:text-rb-macaw"
        >
          attempts
        </Link>
      ) : null}
    </div>
  )
}

function MiddleRow({ middle, tone, index, onStudy }) {
  const [open, setOpen] = useState(false)

  const lessons = middle.lessons
  const empty = lessons.length === 0

  return (
    <li className="overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow">
      {/* The header is the accordion toggle; the key beside it is the only
          thing that leaves the page. Splitting them means opening a topic to
          look inside never costs you your place. */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-2xl font-rb-display text-base font-extrabold ${TONE[tone].chip}`}
          >
            {index}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-rb-display text-base font-extrabold text-rb-eel">
              {middle.name}
            </span>
            <span className="mt-0.5 block truncate text-xs font-medium text-rb-wolf">
              {middle.summary}
            </span>
          </span>

          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0"
          >
            <ChevronDown className="size-4 text-rb-hare" aria-hidden="true" />
          </motion.span>
        </button>

        <div className="flex shrink-0 items-center gap-3 sm:pl-2">
          <span className="hidden text-xs font-bold text-rb-wolf sm:block">
            {middle.done} of {lessons.length} lessons
          </span>

          <TactileButton
            variant={TONE[tone].btn}
            size="sm"
            onClick={() => onStudy(middle)}
            disabled={empty}
            className="shrink-0"
          >
            {empty
              ? "no lessons"
              : middle.done === 0
                ? "start"
                : middle.done === lessons.length
                  ? "review"
                  : "continue"}
            {empty ? null : <ArrowRight className="size-4" />}
          </TactileButton>
        </div>
      </div>

      <Collapse open={open}>
        <div className={`border-t-2 border-rb-swan px-4 py-3 ${TONE[tone].wash}`}>
          {empty ? (
            <p className="py-2 text-sm font-medium text-rb-wolf">
              No lessons have been published in this topic yet.
            </p>
          ) : (
            /* `amount: 0` — the panel is already on screen when it opens, so
               waiting for it to scroll into view would leave the rows blank. */
            <StaggerList as="ul" className="divide-y divide-black/5" stagger={0.04} amount={0}>
              {lessons.map((lesson) => (
                <StaggerItem as="li" key={lesson.id} variants={fadeUp}>
                  <ItemRow
                    icon={BookOpen}
                    label={lesson.name}
                    done={lesson.completed}
                    priorityTag={lesson.priorityTag}
                  />
                </StaggerItem>
              ))}

              {/* Quizzes after the lessons rather than interleaved: reading
                  "lesson, quiz, lesson, quiz" made the topic look twice as
                  long as it is. */}
              {lessons
                .filter((lesson) => lesson.quiz)
                .map((lesson) => (
                  <StaggerItem as="li" key={`quiz-${lesson.quiz.examId}`} variants={fadeUp}>
                    <ItemRow
                      icon={CircleHelp}
                        label={lesson.quiz.title}
                      meta={`${lesson.quiz.totalQuestions} questions`}
                      historyHref={`/learner/assessments/${lesson.quiz.examId}/history`}
                    />
                  </StaggerItem>
                ))}

              {middle.assessment ? (
                <StaggerItem as="li" variants={fadeUp}>
                  <ItemRow
                    icon={ClipboardCheck}
                    label={middle.assessment.title}
                    meta={`${middle.assessment.totalQuestions} questions · ${Math.round(
                      Number(middle.assessment.passingScore ?? 0),
                    )}% to pass`}
                    historyHref={`/learner/assessments/${middle.assessment.examId}/history`}
                  />
                </StaggerItem>
              ) : null}
            </StaggerList>
          )}
        </div>
      </Collapse>
    </li>
  )
}

function MajorCard({ major, locked, onLocked, onStudy }) {
  const [open, setOpen] = useState(false)
  const shake = useAnimationControls()
  const tone = TONE[major.tone]
  const Icon = major.icon

  function toggle() {
    if (locked) {
      // Imperative rather than a declarative `animate` prop: the same refusal
      // has to replay every time it is pressed, and a prop holding the same
      // keyframes twice in a row does not re-fire.
      shake.start({ x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.45 } })
      onLocked()
      return
    }
    setOpen((value) => !value)
  }

  return (
    <motion.article
      // The dialog explains the lock, but it opens elsewhere on the screen. The
      // shake answers where the finger already is.
      animate={shake}
      className="overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_5px_0_var(--color-rb-swan)]"
    >
      <div className="grid lg:grid-cols-[300px_1fr]">
        {/* Identity panel — the wordmark bleeds off it the way it does on the
            landing page's certification bands. */}
        <div className={`relative overflow-hidden p-7 ${tone.face}`}>
          <span className="pointer-events-none absolute -bottom-7 -right-3 select-none font-rb-display text-[5rem] font-black lowercase leading-none text-white/20">
            {major.wordmark}
          </span>

          <Icon className="relative size-9 text-white" aria-hidden="true" />

          <h3 className="relative mt-4 font-rb-display text-3xl font-extrabold lowercase leading-none text-white">
            {major.name}
          </h3>

          <div className="relative mt-5 flex gap-4 text-white">
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">{major.lessonCount}</span>
              lessons
            </span>
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">{major.quizCount}</span>
              quizzes
            </span>
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">
                {major.assessmentCount}
              </span>
              exams
            </span>
          </div>
        </div>

        <div className="relative flex flex-col p-7">
          {locked ? (
            <span className="absolute right-5 top-5 flex items-center gap-1.5 rounded-rb-pill bg-rb-swan px-3 py-1.5 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-rb-wolf">
              <Lock className="size-3" aria-hidden="true" />
              locked
            </span>
          ) : null}

          <p className={`rb-eyebrow ${tone.ink}`}>unit {major.index}</p>

          <p className="rb-body mt-3 max-w-3xl pr-24">
            {major.middles.length} topic{major.middles.length === 1 ? "" : "s"} in this unit
            {major.lessonCount > 0
              ? `, ${major.lessonCount} lesson${major.lessonCount === 1 ? "" : "s"} in total.`
              : "."}
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {major.middles.map((middle) => (
              <li
                key={middle.id}
                className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}
              >
                {middle.name}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-rb-wolf">
                {major.doneCount} of {major.lessonCount} lessons
              </span>
            </div>

            <TactileButton
              variant={locked ? "snow" : tone.btn}
              size="sm"
              onClick={toggle}
              aria-expanded={locked ? undefined : open}
              className="shrink-0"
            >
              {locked ? (
                <>
                  <Lock className="size-4" />
                  unlock unit
                </>
              ) : (
                <>
                  {open ? "hide topics" : "view topics"}
                  <ChevronDown
                    className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </>
              )}
            </TactileButton>
          </div>
        </div>
      </div>

      <Collapse open={open && !locked}>
        <div className="border-t-2 border-rb-swan bg-rb-polar p-5">
          <p className="rb-eyebrow">topics in this unit</p>

          <StaggerList as="ul" className="mt-4 space-y-3" stagger={0.06} amount={0}>
            {major.middles.map((middle, index) => (
              <StaggerItem as="li" key={middle.id} variants={fadeUp}>
                <MiddleRow
                  middle={middle}
                  tone={major.tone}
                  index={`${major.index}.${index + 1}`}
                  onStudy={onStudy}
                />
              </StaggerItem>
            ))}
          </StaggerList>

          {major.assessment ? (
            <div className="mt-4 flex flex-col gap-3 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-4 sm:flex-row sm:items-center">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rb-fox-wash text-rb-fox-lip">
                <ClipboardCheck className="size-5" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-rb-display text-base font-extrabold text-rb-eel">
                  {major.assessment.title}
                </p>
                <p className="mt-0.5 text-xs font-medium text-rb-wolf">
                  Unit exam · {major.assessment.totalQuestions} questions ·{" "}
                  {Math.round(Number(major.assessment.passingScore ?? 0))}% to pass
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Link
                  to={`/learner/assessments/${major.assessment.examId}/history`}
                  className="text-xs font-bold text-rb-fox-lip underline decoration-dotted underline-offset-2 hover:text-rb-fox"
                >
                  view attempts
                </Link>

                <TactileButton asChild variant="fox" size="sm">
                  <Link to={`/learner/assessments/${major.assessment.examId}`}>
                    start unit exam
                    <ArrowRight className="size-4" />
                  </Link>
                </TactileButton>
              </div>
            </div>
          ) : null}
        </div>
      </Collapse>
    </motion.article>
  )
}

function MockExamCard({ exam, locked, onLocked }) {
  const tone = TONE.fox
  const passMark = Math.round(Number(exam.passingScore ?? 0))

  return (
    <article className="overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_5px_0_var(--color-rb-swan)]">
      <div className="grid lg:grid-cols-[300px_1fr]">
        <div className={`relative overflow-hidden p-7 ${tone.face}`}>
          <span className="pointer-events-none absolute -bottom-7 -right-3 select-none font-rb-display text-[5rem] font-black lowercase leading-none text-white/20">
            final
          </span>

          <Trophy className="relative size-9 text-white" aria-hidden="true" />

          <h3 className="relative mt-4 font-rb-display text-3xl font-extrabold lowercase leading-none text-white">
            {exam.title}
          </h3>

          <div className="relative mt-5 flex gap-4 text-white">
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">{exam.totalQuestions}</span>
              questions
            </span>
            {exam.durationMinutes ? (
              <span className="text-sm font-bold">
                <span className="rb-numeric block text-xl text-white">
                  {exam.durationMinutes}
                </span>
                minutes
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative flex flex-col p-7">
          {locked ? (
            <span className="absolute right-5 top-5 flex items-center gap-1.5 rounded-rb-pill bg-rb-swan px-3 py-1.5 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-rb-wolf">
              <Lock className="size-3" aria-hidden="true" />
              locked
            </span>
          ) : null}

          <p className={`rb-eyebrow ${tone.ink}`}>final</p>

          <p className="rb-body mt-3 max-w-3xl pr-24">
            {exam.description ??
              "One full-length attempt under exam conditions, drawn from every unit above."}
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            <li className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}>
              {passMark}% to pass
            </li>
            <li className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}>
              exam conditions
            </li>
            <li className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}>
              all units
            </li>
          </ul>

          <div className="mt-auto pt-6">
            {locked ? (
              <TactileButton variant="snow" size="sm" onClick={onLocked} className="w-fit">
                <Lock className="size-4" />
                unlock mock exam
              </TactileButton>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <TactileButton asChild variant="fox" size="sm" className="w-fit">
                  <Link to={`/learner/assessments/${exam.examId}`}>
                    <Trophy className="size-4" />
                    start mock exam
                  </Link>
                </TactileButton>

                <Link
                  to={`/learner/assessments/${exam.examId}/history`}
                  className="text-xs font-bold text-rb-fox-lip underline decoration-dotted underline-offset-2 hover:text-rb-fox"
                >
                  view attempts
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/* --------------------------------------------------------------------- page */

export default function LearnerCertificationCurriculumPage() {
  const navigate = useNavigate()
  const { certificationId } = useParams()
  const { data } = useOutletContext()

  const [dialogOpen, setDialogOpen] = useState(false)

  const certification = (data?.enrolledCertifications ?? []).find(
    (item) => String(item.certificationId) === String(certificationId),
  )

  const examsQuery = useQuery({ queryKey: ["exams"], queryFn: () => getExams(), staleTime: 60_000 })
  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: getExamTypes,
    staleTime: 5 * 60_000,
  })

  const examTypesById = useMemo(
    () =>
      new Map(
        (examTypesQuery.data ?? []).map((type) => [
          String(type.examTypeId),
          String(type.examTypeText ?? "").toUpperCase(),
        ]),
      ),
    [examTypesQuery.data],
  )

  const lessonById = useMemo(
    () => new Map((data?.lessons ?? []).map((lesson) => [String(lesson.lessonId), lesson])),
    [data?.lessons],
  )

  const certificationExams = useMemo(
    () =>
      (examsQuery.data ?? []).filter(
        (exam) => String(exam.certificationId) === String(certificationId),
      ),
    [examsQuery.data, certificationId],
  )

  // Fetched as soon as the certification is known rather than gated on the
  // diagnostic: a learner who hasn't sat it yet just gets bktAvailable=false
  // back, which is harmless, and gating on diagnosticDone would create a
  // circular dependency since diagnosticDone itself comes from `curriculum`.
  // Polling (rather than a one-shot check) is what lets the "processing"
  // screen below flip itself over the moment mastery finishes computing,
  // instead of making the learner refresh to find out.
  const masteryQuery = useQuery({
    queryKey: ["learner-progress-analytics", certificationId],
    queryFn: () => getProgressAnalytics(certificationId),
    enabled: Boolean(certificationId),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.bktAvailable ? false : 4000),
  })

  const lessonPriorityById = useMemo(() => {
    const map = new Map()
    for (const topic of masteryQuery.data?.lessonPriorities ?? []) {
      if (topic.lessonId != null) map.set(String(topic.lessonId), topic.priorityTag)
    }
    return map
  }, [masteryQuery.data])

  const curriculum = useMemo(() => {
    if (!certification) return null
    return buildCurriculum({
      certification,
      lessonById,
      exams: certificationExams,
      examTypesById,
      lessonPriorityById,
    })
  }, [certification, lessonById, certificationExams, examTypesById, lessonPriorityById])

  // How many not-yet-done lessons carry each priority tag, so the learner
  // sees at a glance where the study plan wants them to focus before opening
  // a single unit. Ordered worst-first: critical is the tag that means
  // "behind on this", so it leads and gets the loudest colour.
  const priorityCounts = useMemo(() => {
    const counts = {}
    for (const major of curriculum?.majors ?? []) {
      for (const middle of major.middles) {
        for (const lesson of middle.lessons) {
          if (lesson.completed || !lesson.priorityTag) continue
          counts[lesson.priorityTag] = (counts[lesson.priorityTag] ?? 0) + 1
        }
      }
    }
    return counts
  }, [curriculum])

  const diagnosticDone = useMemo(() => {
    if (!curriculum) return false
    return hasSatDiagnostic({
      diagnostic: curriculum.diagnostic,
      examResults: data?.examResults ?? [],
      certificationId,
    })
  }, [curriculum, data?.examResults, certificationId])

  const [skippedMasteryWait, setSkippedMasteryWait] = useState(false)
  const masteryReady =
    !diagnosticDone || skippedMasteryWait || masteryQuery.data?.bktAvailable === true

  if (!certification) {
    return (
      <LearnerEmptyState
        icon={BookOpen}
        title="Certification not found"
        description="You are not enrolled in this certification, or it is no longer published."
        action={
          <TactileButton variant="macaw" size="sm" onClick={() => navigate("/learner/learning")}>
            Back to my learning
          </TactileButton>
        }
      />
    )
  }

  // The exam list decides what is locked and what a unit contains, so the page
  // waits for it rather than flashing an unlocked curriculum with no quizzes.
  if (examsQuery.isLoading || examTypesQuery.isLoading || !curriculum) {
    return (
      <LearnerEmptyState
        icon={BookOpen}
        title="Loading curriculum"
        description="Preparing your units, lessons and assessments."
      />
    )
  }

  // Diagnostic taken, mastery not back yet: hold here rather than dropping the
  // learner straight into "continue learning" against a curriculum that has no
  // priority order yet. Polls itself off this screen the moment bktAvailable
  // flips true -- no refresh needed.
  if (diagnosticDone && !masteryReady) {
    return (
      <div className="rebyu-ds flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-rb-polar px-5">
        <div className="w-full max-w-md rounded-rb-card border-2 border-rb-swan bg-rb-snow p-8 text-center shadow-[0_5px_0_var(--color-rb-swan)]">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-rb-macaw-wash text-rb-macaw-lip">
            <Brain className="size-7" aria-hidden="true" />
          </span>

          <h1 className="mt-5 font-rb-display text-xl font-extrabold text-rb-eel">
            Processing your mastery
          </h1>

          <p className="mt-2 text-sm leading-6 text-rb-wolf">
            We're turning your diagnostic answers into a priority-ordered study plan. This
            usually takes a few seconds.
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-rb-macaw-lip">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Analyzing results…
          </div>

          <button
            type="button"
            onClick={() => setSkippedMasteryWait(true)}
            className="mt-6 text-xs font-bold text-rb-hare underline decoration-dotted underline-offset-4 hover:text-rb-wolf"
          >
            Taking too long? Continue without waiting
          </button>
        </div>
      </div>
    )
  }

  function openTopic(middle) {
    navigate(`/learner/learning/${certificationId}/topics/${middle.id}`)
  }

  function openDiagnostic() {
    setDialogOpen(false)
    navigate(
      curriculum.diagnostic
        ? `/learner/assessments/${curriculum.diagnostic.examId}`
        : `/learner/learning/${certificationId}/diagnostic`,
      { state: { certification } },
    )
  }

  return (
    <div className="rebyu-ds -mx-4 -my-6 min-h-dvh bg-rb-polar pb-20 sm:-mx-6 lg:-mx-8">
      {/* ------------------------------------------------------------ header */}
      <header className="relative overflow-hidden px-5 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center gap-3">
            <BackButton asChild label="Back to my learning">
              <Link to="/learner/learning" />
            </BackButton>
            <span className="rb-chip">enrolled certification</span>
          </div>

          <h1 className="mt-3 max-w-3xl font-rb-display text-2xl font-extrabold tracking-tight text-rb-eel sm:text-3xl lg:text-4xl">
            {String(certification.title ?? "certification").toLowerCase()}.
          </h1>

          {certification.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-rb-wolf">
              {certification.description}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rb-chip">
              <BookOpen className="size-4" aria-hidden="true" />
              {curriculum.majors.length} unit{curriculum.majors.length === 1 ? "" : "s"} ·{" "}
              {curriculum.lessonTotal} lessons
            </div>

            {curriculum.mockExam ? (
              <div className="rb-chip">
                <Trophy className="size-4" aria-hidden="true" />1 mock exam
              </div>
            ) : null}

            <div className="flex items-center gap-3 rounded-full border-2 border-rb-swan bg-rb-polar py-2 pl-4 pr-5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-rb-wolf">
                progress
              </span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-rb-swan sm:w-32">
                <motion.div
                  className="h-full rounded-full bg-rb-macaw"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, curriculum.progress))}%` }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <CountUp value={curriculum.progress} suffix="%" className="rb-numeric text-sm text-rb-eel" />
            </div>
          </div>

          {/* Priority summary -- how many not-yet-done lessons need attention,
              worst tag first, so the learner knows before opening a unit
              whether anything here is urgent. Only shown once the diagnostic
              has produced a priority order; before that every lesson's tag
              is null and the row would just be empty. */}
          {diagnosticDone && PRIORITY_SUMMARY_ORDER.some((tag) => priorityCounts[tag]) ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-rb-wolf">
                priority focus
              </span>

              {PRIORITY_SUMMARY_ORDER.map((tag) => {
                const count = priorityCounts[tag]
                if (!count) return null

                const config = PRIORITY_CONFIG[tag]
                const Icon = config.icon
                const isCritical = tag === "CRITICAL_PRIORITY"

                return (
                  <motion.span
                    key={tag}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${config.bgColor} ${config.textColor} ${
                      isCritical ? "ring-2 ring-rb-cardinal/40" : ""
                    }`}
                    animate={isCritical ? { scale: [1, 1.06, 1] } : undefined}
                    transition={
                      isCritical
                        ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                        : undefined
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    <CountUp value={count} className="rb-numeric" />
                    {PRIORITY_SUMMARY_LABEL[tag]}
                  </motion.span>
                )
              })}
            </div>
          ) : null}

          {/* The gate, stated once at the top and then enforced on every card
              below. Gone entirely once the diagnostic is sat, rather than
              turning into a banner nobody needs to keep reading. */}
          {!diagnosticDone ? (
            <Reveal
              variants={popIn}
              amount={0}
              className="mt-7 flex flex-col gap-4 rounded-rb-card border-2 border-rb-swan bg-rb-fox-wash p-5 sm:flex-row sm:items-center"
            >
              <motion.span
                className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rb-fox text-white"
                // A slow, small pulse. The gate is the one thing on this page
                // that has to be noticed before anything else can happen.
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Lock className="size-5" aria-hidden="true" />
              </motion.span>

              <div className="min-w-0 flex-1">
                <p className="font-rb-display text-base font-extrabold text-rb-eel">
                  Take your diagnostic to unlock the curriculum
                </p>
                <p className="mt-1 text-sm font-medium text-rb-wolf">
                  It decides which topics your study plan puts first.
                </p>
              </div>

              <TactileButton variant="fox" size="sm" onClick={() => setDialogOpen(true)}>
                <ClipboardCheck className="size-4" />
                take diagnostic
              </TactileButton>
            </Reveal>
          ) : null}
        </div>
      </header>

      {/* ------------------------------------------------------------- units */}
      <main className="mx-auto max-w-[1600px] px-5 py-10 lg:px-8">
        {curriculum.majors.length === 0 ? (
          <LearnerEmptyState
            icon={BookOpen}
            title="No curriculum published yet"
            description="This certification has no units with published lessons. Check back once content is released."
          />
        ) : (
          /* Bands arrive one after another as you scroll. The stagger is the
             page saying the stack has an order — which is the whole reason
             units are a column rather than a grid. */
          <StaggerList className="space-y-6" stagger={0.09}>
            {curriculum.majors.map((major) => (
              <StaggerItem key={major.id} variants={fadeUp}>
                <MajorCard
                  major={major}
                  locked={!diagnosticDone}
                  onLocked={() => setDialogOpen(true)}
                  onStudy={openTopic}
                />
              </StaggerItem>
            ))}

            {curriculum.mockExam ? (
              <StaggerItem variants={fadeUp}>
                <MockExamCard
                  exam={curriculum.mockExam}
                  locked={!diagnosticDone}
                  onLocked={() => setDialogOpen(true)}
                />
              </StaggerItem>
            ) : null}
          </StaggerList>
        )}
      </main>

      {/* -------------------------------------------------- diagnostic dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 grid size-14 place-items-center rounded-2xl bg-rb-fox-wash text-rb-fox-lip">
              <ClipboardCheck className="size-7" aria-hidden="true" />
            </div>

            <DialogTitle>Diagnostic exam</DialogTitle>

            <DialogDescription>
              The curriculum stays locked until we know where you are starting from. The diagnostic
              samples every unit, so the result decides the order you study them in.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 rounded-rb-card border-2 border-rb-swan bg-rb-polar p-4">
            {[
              [
                Clock,
                curriculum.diagnostic?.durationMinutes
                  ? `About ${curriculum.diagnostic.durationMinutes} minutes`
                  : "Self-paced",
              ],
              [
                CircleHelp,
                curriculum.diagnostic
                  ? `${curriculum.diagnostic.totalQuestions} questions across the certification`
                  : "Questions across the certification",
              ],
              [CheckCircle2, "No pass mark — it only sets your plan"],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-sm font-bold text-rb-eel">
                <Icon className="size-4 shrink-0 text-rb-wolf" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>

          <DialogFooter>
            <TactileButton variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              not now
            </TactileButton>

            <TactileButton variant="fox" size="sm" onClick={openDiagnostic}>
              start diagnostic
              <ArrowRight className="size-4" />
            </TactileButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
