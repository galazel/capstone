import { useMemo, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CircleHelp,
  Loader2,
  Lock,
  Trophy,
  Zap,
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
import { ASSESSMENT_MAX_XP, LESSON_COMPLETION_XP } from "@/lib/xp.js"
import { getExams, getExamTypes } from "@/services/assessmentService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"
import { STUDY_PLAN_QUERY_KEY, getActiveStudyPlan } from "@/services/studyPlanService.js"
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
/**
 * What finishing this row pays, in the row itself.
 *
 * Awards are idempotent server-side, so once a row is done the pill switches
 * from a promise ("+100 XP") to a receipt and drops its saturated fill -- a
 * banked reward should not keep advertising itself as available.
 *
 * `upTo` marks a variable award (assessments pay by outcome: 30 finished,
 * 100 passed, 200 perfect). There the number is a ceiling rather than a
 * figure, and once earned the pill drops it entirely rather than quoting a
 * total the learner may not have reached.
 */
function XpPill({ amount, earned, upTo = false }) {
  const label = earned
    ? (upTo ? "XP earned" : `${amount} XP`)
    : (upTo ? `up to ${amount} XP` : `+${amount} XP`)

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${
        earned ? "bg-rb-swan text-rb-wolf" : "bg-rb-bee-wash text-rb-bee-lip"
      }`}
      title={
        earned
          ? "Already earned"
          : upTo
            ? "30 XP for finishing, 100 for passing, 200 for a perfect score"
            : "Earned once, the first time you finish this"
      }
    >
      <Zap className="size-3" aria-hidden="true" />
      {label}
    </span>
  )
}

function ItemRow({ icon: Icon, label, meta, done, priorityTag, historyHref, xp, xpUpTo = false }) {
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

      {xp ? <XpPill amount={xp} earned={Boolean(done)} upTo={xpUpTo} /> : null}

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

function MiddleRow({ middle, tone, index, onStudy, takenExamIds }) {
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
                    xp={LESSON_COMPLETION_XP}
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
                      xp={ASSESSMENT_MAX_XP}
                      xpUpTo
                      done={takenExamIds?.has(String(lesson.quiz.examId))}
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
                    xp={ASSESSMENT_MAX_XP}
                    xpUpTo
                    done={takenExamIds?.has(String(middle.assessment.examId))}
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

/**
 * How badly this unit needs attention: the worst priority sitting on any
 * *unfinished* lesson inside it. A finished lesson keeps whatever tag it was
 * given, so counting those would leave a unit agitating over work already
 * done.
 */
function urgencyOf(major) {
  let high = false

  for (const middle of major.middles) {
    for (const lesson of middle.lessons) {
      if (lesson.completed) continue
      if (lesson.priorityTag === "CRITICAL_PRIORITY") return "CRITICAL_PRIORITY"
      if (lesson.priorityTag === "HIGH_PRIORITY") high = true
    }
  }

  return high ? "HIGH_PRIORITY" : null
}

/* A unit with urgent work in it does not sit still.
   Two tiers, because one shake for everything would flatten the difference the
   priority tags exist to draw: critical shudders harder and comes back around
   twice as often as high. Both pause between bursts -- a permanently vibrating
   card stops reading as urgent within about ten seconds and just becomes
   noise you scroll past. The rotation is what makes it read as a temper rather
   than a slider: pure x-translation reads mechanical. */
const URGENCY_SHAKE = {
  CRITICAL_PRIORITY: {
    x: [0, -7, 7, -5, 5, -2.5, 2.5, 0],
    rotate: [0, -1.1, 1.1, -0.7, 0.7, -0.3, 0.3, 0],
    transition: { duration: 0.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" },
  },
  HIGH_PRIORITY: {
    x: [0, -4, 4, -2.5, 2.5, 0],
    rotate: [0, -0.6, 0.6, -0.3, 0.3, 0],
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 4.4, ease: "easeInOut" },
  },
}

function MajorCard({ major, locked, onLocked, onStudy, takenExamIds }) {
  const [open, setOpen] = useState(false)
  const shake = useAnimationControls()
  const tone = TONE[major.tone]
  const Icon = major.icon
  const urgency = useMemo(() => urgencyOf(major), [major])

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
    /* The urgency loop rides on a wrapper rather than sharing the article's
       `animate` with the lock shake. One element cannot hold both a declarative
       loop and imperative controls -- whichever ran last would own `x`, and
       pressing a locked unit would kill its agitation for good. Nested, the two
       transforms simply compose. */
    <motion.div
      // Never while locked. Priorities only exist after the diagnostic, so this
      // should not arise -- but a unit demanding attention it will not let you
      // give is the one version of this that would just be irritating.
      animate={urgency && !locked ? URGENCY_SHAKE[urgency] : undefined}
      className="rounded-rb-card"
    >
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

          <div className="flex flex-wrap items-center gap-2.5">
            <p className={`rb-eyebrow ${tone.ink}`}>unit {major.index}</p>

            {/* The shake is the attention-getter, but it cannot be the only
                carrier: MotionConfig honours prefers-reduced-motion app-wide,
                which reduces the whole loop to nothing for the learners most
                likely to need the warning. The tag says the same thing in
                text. */}
            {urgency && !locked ? <PriorityTag tag={urgency} size="sm" /> : null}
          </div>

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
                  takenExamIds={takenExamIds}
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
                <XpPill
                  amount={ASSESSMENT_MAX_XP}
                  upTo
                  earned={Boolean(takenExamIds?.has(String(major.assessment.examId)))}
                />
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
    </motion.div>
  )
}

function MockExamCard({ exam, locked, onLocked, takenExamIds }) {
  const tone = TONE.fox
  const passMark = Math.round(Number(exam.passingScore ?? 0))
  const taken = Boolean(takenExamIds?.has(String(exam.examId)))

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
            <li className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}>
              {taken ? "XP earned" : `up to ${ASSESSMENT_MAX_XP} XP`}
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

/**
 * Certification progress as a ring beside the title.
 *
 * In the band's flex row rather than absolutely pinned to its corner. Pinned,
 * it floated free of everything it described — it drifted with the height of
 * the copy, sat level with whichever row happened to be last, and left a
 * corner of the band that nothing else could use. In flow it reads as the
 * band's second column: the certification on the left, how far through it you
 * are on the right.
 *
 * Large screens only; the inline pill below is the small-screen form.
 */
function HeroProgressRing({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className="pointer-events-none relative hidden size-28 shrink-0 place-items-center lg:grid"
      role="img"
      aria-label={`${pct}% of this certification complete`}
    >
      {/* -rotate-90 so the arc starts at twelve o'clock rather than three. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.2)"
          strokeWidth="8"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (circumference * pct) / 100 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>

      <span className="relative flex flex-col items-center leading-none">
        <CountUp value={pct} suffix="%" className="rb-numeric !text-white text-2xl" />
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
          complete
        </span>
      </span>
    </div>
  )
}

/* --------------------------------------------------------------------- page */

/**
 * The curriculum while it loads.
 *
 * This used to be `LearnerEmptyState` -- an empty state, borrowed to mean
 * "waiting". It said "Loading curriculum" inside the component the page uses
 * for "there is nothing here", so the screen a learner met while their course
 * was fetching was the same one they would meet if the course did not exist:
 * one icon, centred in an otherwise blank box, with the page's real shape
 * nowhere in sight.
 *
 * This draws the shape instead -- the header band, then unit cards -- so the
 * layout is already there and only the content arrives. Nothing pretends to be
 * data: no titles, no counts, just the blocks they will occupy.
 */
function CurriculumSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading curriculum">
      {/* The ink band the page opens on. */}
      <div className="rounded-rb-card bg-rb-eel/10 p-6 sm:p-8">
        <div className="h-3 w-28 animate-pulse rounded bg-rb-eel/20" />
        <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-rb-eel/20 sm:h-10" />
        <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-rb-eel/15" />

        <div className="mt-6 flex gap-3">
          <div className="h-10 w-36 animate-pulse rounded-rb-pill bg-rb-eel/20" />
          <div className="h-10 w-28 animate-pulse rounded-rb-pill bg-rb-eel/15" />
        </div>
      </div>

      {/* Two unit cards. Two rather than one so the page reads as a list, and
          not so many that the skeleton claims a length the course may not have. */}
      {[0, 1].map((unit) => (
        <div
          key={unit}
          className="grid overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow lg:grid-cols-[260px_1fr]"
        >
          <div className="space-y-3 bg-rb-polar p-6">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-rb-swan" />
            <div className="h-5 w-32 animate-pulse rounded bg-rb-swan" />
            <div className="h-3 w-24 animate-pulse rounded bg-rb-swan" />
          </div>

          <div className="space-y-3 p-6">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <div className="size-8 shrink-0 animate-pulse rounded-full bg-rb-swan" />
                <div className="h-4 flex-1 animate-pulse rounded bg-rb-swan" />
                <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-rb-swan" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

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

  // Assessment XP is paid once per exam, however many times it is retaken (see
  // AssessmentAttemptService, which keys the award by examId). A learner who
  // has a result for an exam has already banked it, so the row shows what they
  // earned rather than dangling XP they cannot earn twice.
  const takenExamIds = useMemo(
    () =>
      new Set(
        (data?.examResults ?? [])
          .map((result) => (result.examId == null ? null : String(result.examId)))
          .filter(Boolean),
      ),
    [data?.examResults],
  )

  const [skippedMasteryWait, setSkippedMasteryWait] = useState(false)
  const masteryReady =
    !diagnosticDone || skippedMasteryWait || masteryQuery.data?.bktAvailable === true

  // --------------------------------------------------------------- study plan
  // Read-only here. The plan is built on My Learning, at the click that starts
  // the studying; this page only needs to know whether one exists so it can
  // offer the way through to the calendar.
  const planQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, certificationId],
    queryFn: () => getActiveStudyPlan(certificationId),
    enabled: Boolean(certificationId) && diagnosticDone,
    staleTime: 30_000,
  })
  const hasPlan = Boolean(planQuery.data?.planId)

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
    return <CurriculumSkeleton />
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
    /* No negative margins: the layout hands this route the full window width
       (see `isCurriculumPage` in learner-layout), so the band and the unit
       stack set their own gutters rather than clawing back the page's. */
    <div className="rebyu-ds min-h-dvh w-full bg-rb-polar pb-20">
      {/* ------------------------------------------------------------ header */}
      <header className="rb-hero-ink px-5 py-8 lg:px-8 lg:py-11">
        {/* The product's bubble figure, same as `bubble-card`'s cap and the
            landing page's tiles: two white/10 circles off opposite corners,
            scaled from a card to a band. Before the content in the DOM so the
            copy paints over them without either needing a z-index.

            Sized off the band now rather than fixed at 24/30rem — on a band
            this much shorter, a 30rem circle was most of the surface and the
            figure stopped reading as a motif. */}
        <div className="pointer-events-none absolute -right-20 -top-28 size-[20rem] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 size-[22rem] rounded-full bg-white/10" />

        {/* Two columns: the certification on the left, how far through it you
            are on the right. `items-start` so the ring holds the top of the
            band instead of centring against copy of unpredictable length. */}
        <div className="relative mx-auto flex max-w-[1600px] items-start gap-10">
          <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <BackButton asChild label="Back to my learning">
              <Link to="/learner/learning" />
            </BackButton>
            <span className="rb-chip">enrolled certification</span>
          </div>

          {/* Deliberately off the design system's lowercase display rule. A
              certification is a formal credential with a real name, and the
              band is the one place it is stated in full — the lowercase voice
              stays on the wordmark behind it and on the unit cards below, so
              the idiom is not lost, just not applied to a proper noun.

              `capitalize` rather than a JS transform: it only touches the
              first letter of each word, so titles already stored in caps
              (TOPCIT, AWS) pass through untouched. */}
          {/* Down from 7xl. At that size a two-word certification title was
              taller than every unit card below it and the learner had to
              scroll past the name of the thing they had just opened to reach
              the curriculum they came for. */}
          <h1 className="mt-5 max-w-3xl font-rb-display text-4xl font-extrabold capitalize leading-[1.05] tracking-tight text-white sm:text-5xl">
            {certification.title ?? "Certification"}
          </h1>

          {/* Clamped: descriptions are author-entered and unbounded, and a long
              one pushed the entire curriculum below the fold. */}
          {certification.description ? (
            <p className="mt-3 line-clamp-2 max-w-2xl leading-7 text-white/75">
              {certification.description}
            </p>
          ) : null}

          {/* One meta row. The counts, the mock-exam marker and the priority
              summary were three separately-spaced rows of small chips saying
              small things; stacked, they read as three sections rather than as
              one line of facts about this certification. */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
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

            {/* Small-screen form of the ring above, which is hidden below lg
                because at that size it would sit on top of these chips. */}
            <div className="flex items-center gap-3 rounded-full bg-white/10 py-2 pl-4 pr-5 lg:hidden">
              <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">
                progress
              </span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-white/20 sm:w-32">
                <motion.div
                  /* White, not Macaw: on a blue band the brand blue lands at
                     2.81:1 against it and the bar stops reading as filled. */
                  className="h-full rounded-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, curriculum.progress))}%` }}
                  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <CountUp value={curriculum.progress} suffix="%" className="rb-numeric !text-white text-sm" />
            </div>

          {/* Priority summary -- how many not-yet-done lessons need attention,
              worst tag first, so the learner knows before opening a unit
              whether anything here is urgent. Only shown once the diagnostic
              has produced a priority order; before that every lesson's tag
              is null and the row would be meaningless. Stays visible even
              when nothing is pending, so "all caught up" reads as a result
              rather than the row just disappearing.

              Runs on into the meta row rather than starting its own, with a
              hairline to mark where the facts stop and the triage begins. */}
          {diagnosticDone ? (
            <>
              <span
                className="mx-1 hidden h-5 w-px shrink-0 bg-white/25 sm:block"
                aria-hidden="true"
              />

              <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">
                priority focus
              </span>

              {PRIORITY_SUMMARY_ORDER.some((tag) => priorityCounts[tag]) ? (
                PRIORITY_SUMMARY_ORDER.map((tag) => {
                  const count = priorityCounts[tag]
                  if (!count) return null

                  const config = PRIORITY_CONFIG[tag]
                  const Icon = config.icon
                  const isCritical = tag === "CRITICAL_PRIORITY"
                  const isHigh = tag === "HIGH_PRIORITY"
                  const isUrgent = isCritical || isHigh

                  return (
                    <motion.span
                      key={tag}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
                        isUrgent
                          ? "bg-rb-cardinal-wash text-rb-cardinal-lip"
                          : `${config.bgColor} ${config.textColor}`
                      } ${isUrgent ? "ring-2 ring-rb-cardinal/40" : ""}`}
                      animate={isUrgent ? { scale: [1, 1.06, 1] } : undefined}
                      transition={
                        isUrgent
                          ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                          : undefined
                      }
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <CountUp value={count} className="rb-numeric" />
                      {PRIORITY_SUMMARY_LABEL[tag]}
                    </motion.span>
                  )
                })
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rb-feather-wash px-3 py-1.5 text-sm font-bold text-rb-feather-ink">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  all caught up
                </span>
              )}
            </>
          ) : null}

          {/* The plan itself is built on My Learning, at the click that starts
              the studying -- this is only the way through to it once one
              exists. Last in the meta row: it is the one item here that leaves
              the page, and it had a 28px band of its own to say so. */}
          {diagnosticDone && hasPlan ? (
            <Link
              to="/learner/plan"
              className="inline-flex items-center gap-1.5 rounded-rb-pill px-1 text-[13px] font-bold text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              view study calendar
            </Link>
          ) : null}
          </div>

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

          <HeroProgressRing value={curriculum.progress} />
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
                  takenExamIds={takenExamIds}
                />
              </StaggerItem>
            ))}

            {curriculum.mockExam ? (
              <StaggerItem variants={fadeUp}>
                <MockExamCard
                  exam={curriculum.mockExam}
                  locked={!diagnosticDone}
                  onLocked={() => setDialogOpen(true)}
                  takenExamIds={takenExamIds}
                />
              </StaggerItem>
            ) : null}

            {/* Everything the units and the mock card do not already show.
                The curriculum places one quiz per lesson and one exam per unit,
                so a second exam on the same target -- or a certification-level
                exam that is not the chosen mock -- was rendered nowhere, and
                the page accounted for four assessments while the certification
                held nine. They are listed rather than slotted into the units,
                because the one-per-place layout is deliberate and widening it
                would make an authoring mistake look like structure. */}
            {curriculum.extraExams?.length ? (
              <StaggerItem variants={fadeUp}>
                <section className="rounded-rb-card border-2 border-rb-swan bg-rb-snow p-5 sm:p-6">
                  <h2 className="font-rb-display text-lg font-extrabold lowercase text-rb-eel">
                    other assessments
                  </h2>
                  <p className="mt-1 text-sm text-rb-wolf">
                    Published for this certification but not attached to a unit above.
                  </p>

                  <ul className="mt-4 space-y-2">
                    {curriculum.extraExams.map((exam) => {
                      const taken = takenExamIds?.has?.(String(exam.examId))
                      return (
                        <li
                          key={exam.examId}
                          className="flex flex-wrap items-center gap-3 rounded-rb-tile border-2 border-rb-swan bg-rb-polar p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-rb-eel">
                              {exam.title ?? `Exam ${exam.examId}`}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-rb-wolf">
                              {[
                                exam.questionCount ? `${exam.questionCount} questions` : null,
                                exam.passingScore != null ? `${exam.passingScore}% to pass` : null,
                                taken ? "attempted" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>

                          <TactileButton
                            asChild={diagnosticDone}
                            size="sm"
                            variant="macaw"
                            onClick={diagnosticDone ? undefined : () => setDialogOpen(true)}
                          >
                            {diagnosticDone ? (
                              <Link to={`/learner/assessments/${exam.examId}`}>
                                start
                                <ArrowRight className="size-4" aria-hidden="true" />
                              </Link>
                            ) : (
                              <span>locked</span>
                            )}
                          </TactileButton>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </StaggerItem>
            ) : null}
          </StaggerList>
        )}
      </main>

      {/* -------------------------------------------------- diagnostic dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* `rebyu-ds` on the content itself: the dialog portals to <body>, so
            without it the `rb-btn` footer keys resolve to unstyled buttons. */}
        <DialogContent className="rebyu-ds sm:max-w-md">
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
