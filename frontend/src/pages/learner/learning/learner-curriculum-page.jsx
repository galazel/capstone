import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CircleHelp,
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
import { BackButton, ProgressBar, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { CURRICULUM } from "./curriculum-fixtures.js"

/**
 * The curriculum a learner lands on after opening an enrolled certification.
 *
 * Card shape is the admin arena card's colour language on the landing page's
 * *band* geometry: a saturated identity panel on the left with the unit's
 * wordmark bled off it, and the body running the full width beside it. A unit
 * has three or four sentences of description, a middle-category list, and a
 * progress bar; in a 3-up grid that content wraps to six lines and the units
 * stop being scannable. Long horizontal bands give each unit one line of the
 * page and let the stack itself read as the order of study.
 *
 * Two levels of accordion, because that is what the curriculum is: the unit
 * opens to its middle categories, and a middle category opens to the lessons,
 * quizzes, and assessment inside it. Only the middle category is actionable —
 * lessons and quizzes are shown so the learner can see what a category
 * contains, but they are entered through the study surface, not from here.
 *
 * Until the diagnostic is sat, every unit carries a lock and opens the
 * diagnostic dialog instead of expanding. The lock is on the card rather than
 * on a banner above the list so it is impossible to scroll past.
 *
 * PREVIEW: renders the fixture curriculum and calls no API.
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
    chip: "bg-rb-bee-wash text-[#8a6d00]",
    ink: "text-[#8a6d00]",
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
  fox: {
    face: "bg-rb-fox",
    wash: "bg-rb-fox-wash",
    chip: "bg-rb-fox-wash text-rb-fox-lip",
    ink: "text-rb-fox-lip",
    btn: "fox",
    bar: "fox",
  },
}

function countMajor(major) {
  const middles = major.middles ?? []
  const lessons = middles.flatMap((middle) => middle.lessons ?? [])
  const quizzes = middles.flatMap((middle) => Object.values(middle.quizzes ?? {}))
  const done = lessons.filter((lesson) => lesson.completed).length

  return {
    middles: middles.length,
    lessons: lessons.length,
    quizzes: quizzes.length,
    assessments: middles.filter((middle) => middle.assessment).length,
    done,
    progress: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
  }
}

/* ------------------------------------------------------------------- pieces */

/** One row inside an opened middle category. Not a control — the icon and the
 *  label say what the item is, and the middle category above it is what the
 *  learner acts on. */
function ItemRow({ icon: Icon, tone, label, meta, done }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full ${
          done ? "bg-rb-feather text-white" : TONE[tone].chip
        }`}
      >
        {done ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Icon className="size-4" aria-hidden="true" />
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-bold text-rb-eel">{label}</span>

      {meta ? (
        <span className="shrink-0 text-xs font-bold text-rb-wolf">{meta}</span>
      ) : null}
    </li>
  )
}

function MiddleRow({ middle, tone, index, onStudy }) {
  const [open, setOpen] = useState(false)

  const lessons = middle.lessons ?? []
  const quizzes = middle.quizzes ?? {}
  const done = lessons.filter((lesson) => lesson.completed).length
  const progress = lessons.length ? Math.round((done / lessons.length) * 100) : 0

  return (
    <li className="overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow">
      {/* The header is the accordion toggle; the key beside it is the only
          thing that leaves the page. Splitting them means opening a category
          to look inside never costs you your place. */}
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

          <ChevronDown
            className={`size-4 shrink-0 text-rb-hare transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        <div className="flex shrink-0 items-center gap-3 sm:pl-2">
          <span className="hidden w-28 sm:block">
            <ProgressBar
              value={progress}
              tone={TONE[tone].bar}
              label={`${middle.name} progress`}
              className="!h-3"
            />
          </span>

          <TactileButton
            variant={TONE[tone].btn}
            size="sm"
            onClick={() => onStudy(middle)}
            className="shrink-0"
          >
            {done === 0 ? "start" : done === lessons.length ? "review" : "continue"}
            <ArrowRight className="size-4" />
          </TactileButton>
        </div>
      </div>

      {open ? (
        <div className={`border-t-2 border-rb-swan px-4 py-3 ${TONE[tone].wash}`}>
          <ul className="divide-y divide-black/5">
            {lessons.map((lessonItem) => (
              <ItemRow
                key={lessonItem.id}
                icon={BookOpen}
                tone={tone}
                label={lessonItem.name}
                meta={`${lessonItem.minutes} min`}
                done={lessonItem.completed}
              />
            ))}

            {/* Quizzes are listed after the lessons rather than interleaved:
                the fixture keys them by lesson, and reading "lesson, quiz,
                lesson, quiz" in a nested list made the category look twice as
                long as it is. */}
            {Object.values(quizzes).map((quizItem) => (
              <ItemRow
                key={quizItem.id}
                icon={CircleHelp}
                tone={tone}
                label={quizItem.name}
                meta={`${quizItem.questions} questions`}
              />
            ))}

            {middle.assessment ? (
              <ItemRow
                icon={ClipboardCheck}
                tone={tone}
                label={middle.assessment.name}
                meta={`${middle.assessment.questions} questions · ${middle.assessment.passMark}% to pass`}
              />
            ) : null}
          </ul>
        </div>
      ) : null}
    </li>
  )
}

function MajorCard({ major, locked, onLocked, onStudy }) {
  const [open, setOpen] = useState(false)
  const tone = TONE[major.tone]
  const stats = countMajor(major)
  const Icon = major.icon

  function toggle() {
    if (locked) {
      onLocked()
      return
    }
    setOpen((value) => !value)
  }

  return (
    <article className="overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_5px_0_var(--color-rb-swan)]">
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
              <span className="rb-numeric block text-xl text-white">{stats.lessons}</span>
              lessons
            </span>
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">{stats.quizzes}</span>
              quizzes
            </span>
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">{stats.assessments}</span>
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

          <p className="rb-body mt-3 max-w-3xl pr-24">{major.summary}</p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {(major.middles ?? []).map((middle) => (
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
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-rb-wolf">
                  {stats.done} of {stats.lessons} lessons
                </span>
                <span className="rb-numeric text-sm">{stats.progress}%</span>
              </div>
              <ProgressBar
                value={stats.progress}
                tone={tone.bar}
                label={`${major.name} progress`}
                className="mt-2"
              />
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

      {open && !locked ? (
        <div className="border-t-2 border-rb-swan bg-rb-polar p-5">
          <p className="rb-eyebrow">topics in this unit</p>

          <ul className="mt-4 space-y-3">
            {(major.middles ?? []).map((middle, index) => (
              <MiddleRow
                key={middle.id}
                middle={middle}
                tone={major.tone}
                index={`${major.index}.${index + 1}`}
                onStudy={onStudy}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

function MockExamCard({ exam, locked, onLocked }) {
  const tone = TONE[exam.tone]

  return (
    <article className="overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow shadow-[0_5px_0_var(--color-rb-swan)]">
      <div className="grid lg:grid-cols-[300px_1fr]">
        <div className={`relative overflow-hidden p-7 ${tone.face}`}>
          <span className="pointer-events-none absolute -bottom-7 -right-3 select-none font-rb-display text-[5rem] font-black lowercase leading-none text-white/20">
            {exam.wordmark}
          </span>

          <Trophy className="relative size-9 text-white" aria-hidden="true" />

          <h3 className="relative mt-4 font-rb-display text-3xl font-extrabold lowercase leading-none text-white">
            {exam.name}
          </h3>

          <div className="relative mt-5 flex gap-4 text-white">
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">{exam.questions}</span>
              questions
            </span>
            <span className="text-sm font-bold">
              <span className="rb-numeric block text-xl text-white">{exam.minutes}</span>
              minutes
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

          <p className={`rb-eyebrow ${tone.ink}`}>final</p>

          <p className="rb-body mt-3 max-w-3xl pr-24">{exam.summary}</p>

          <ul className="mt-5 flex flex-wrap gap-2">
            <li className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}>
              {exam.passMark}% to pass
            </li>
            <li className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}>
              exam conditions
            </li>
            <li className={`rounded-rb-pill px-3.5 py-2 text-sm font-bold ${tone.chip}`}>
              all units
            </li>
          </ul>

          <div className="mt-auto pt-6">
            <TactileButton
              variant={locked ? "snow" : tone.btn}
              size="sm"
              onClick={locked ? onLocked : undefined}
              className="w-fit"
            >
              {locked ? <Lock className="size-4" /> : <Trophy className="size-4" />}
              {locked ? "unlock mock exam" : "start mock exam"}
            </TactileButton>
          </div>
        </div>
      </div>
    </article>
  )
}

/* --------------------------------------------------------------------- page */

export default function LearnerCurriculumPage() {
  const navigate = useNavigate()

  // Flipped from the dialog so the locked and unlocked curriculum can both be
  // reviewed without a backend.
  const [diagnosticDone, setDiagnosticDone] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { certification, majors, mockExam } = CURRICULUM

  const allLessons = majors.flatMap((major) =>
    (major.middles ?? []).flatMap((middle) => middle.lessons ?? []),
  )
  const completed = allLessons.filter((lessonItem) => lessonItem.completed).length
  const progress = allLessons.length ? Math.round((completed / allLessons.length) * 100) : 0

  function openStudy(middle) {
    navigate(`/learner/study-preview?middle=${middle.id}`)
  }

  return (
    <div className="rebyu-ds min-h-dvh bg-rb-polar pb-20">
      {/* ------------------------------------------------------------ header */}
      <header className="border-b-2 border-rb-swan bg-rb-snow px-5 py-8 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-center gap-3">
            <BackButton asChild label="Back to my learning">
              <Link to="/learner/learning" />
            </BackButton>
            <p className="rb-eyebrow">enrolled certification</p>
          </div>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="rb-display rb-display-lg">{certification.title.toLowerCase()}.</h1>
              <p className="rb-body-lg mt-3 max-w-2xl">{certification.summary}</p>
            </div>

            <div className="w-full max-w-sm shrink-0">
              <div className="flex items-baseline justify-between">
                <span className="rb-eyebrow">overall progress</span>
                <span className="rb-numeric text-lg">{progress}%</span>
              </div>
              <ProgressBar
                value={progress}
                label="Certification progress"
                className="mt-3 !h-5"
              />
              <p className="mt-2 text-xs font-bold text-rb-wolf">
                {completed} of {allLessons.length} lessons · {majors.length} units · 1 mock exam
              </p>
            </div>
          </div>

          {/* The gate, stated once at the top and then enforced on every card
              below. Removed entirely once the diagnostic is sat rather than
              turning into a "completed" banner nobody needs to keep reading. */}
          {!diagnosticDone ? (
            <div className="mt-7 flex flex-col gap-4 rounded-rb-card border-2 border-rb-swan bg-rb-fox-wash p-5 sm:flex-row sm:items-center">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rb-fox text-white">
                <Lock className="size-5" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-rb-display text-base font-extrabold text-rb-eel">
                  Take your diagnostic to unlock the curriculum
                </p>
                <p className="mt-1 text-sm font-medium text-rb-wolf">
                  It takes about 25 minutes and decides which topics your study plan puts first.
                </p>
              </div>

              <TactileButton variant="fox" size="sm" onClick={() => setDialogOpen(true)}>
                <ClipboardCheck className="size-4" />
                take diagnostic
              </TactileButton>
            </div>
          ) : null}
        </div>
      </header>

      {/* ------------------------------------------------------------- units */}
      <main className="mx-auto max-w-[1280px] px-5 py-10 lg:px-8">
        <div className="space-y-6">
          {majors.map((major) => (
            <MajorCard
              key={major.id}
              major={major}
              locked={!diagnosticDone}
              onLocked={() => setDialogOpen(true)}
              onStudy={openStudy}
            />
          ))}

          <MockExamCard
            exam={mockExam}
            locked={!diagnosticDone}
            onLocked={() => setDialogOpen(true)}
          />
        </div>
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
              [Clock, "About 25 minutes"],
              [CircleHelp, "30 questions across all 4 units"],
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

            {/* PREVIEW: unlocks the page locally instead of starting an attempt. */}
            <TactileButton
              variant="fox"
              size="sm"
              onClick={() => {
                setDiagnosticDone(true)
                setDialogOpen(false)
              }}
            >
              start diagnostic
              <ArrowRight className="size-4" />
            </TactileButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
