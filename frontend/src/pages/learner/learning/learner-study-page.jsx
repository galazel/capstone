import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Circle,
  CircleHelp,
  Clock,
  ListChecks,
  PanelLeft,
  SendHorizontal,
  Sparkles,
  X,
} from "@/components/icons"

import { TactileButton, ProgressBar } from "@/components/rebyu/rebyu-ui.jsx"
import { CURRICULUM, SAMPLE_QUIZ } from "./curriculum-fixtures.js"

/**
 * The study surface: one middle category, start to finish.
 *
 * Three columns — outline, content, tutor — but the third only exists when it
 * is asked for. A tutor panel pinned open costs a third of the reading width
 * for a conversation most learners are not having, so it is a circular key in
 * the corner that opens the column, and the content re-centres when it closes.
 *
 * The outline is one middle category rather than the whole certification. This
 * page is entered from a topic, and listing four units' worth of lessons in the
 * rail made the thing you are actually studying a small part of a long list.
 * Lessons carry their own sections nested underneath, so the outline doubles as
 * the position indicator inside a long lesson.
 *
 * Every row type has its own icon — lesson, quiz, unit assessment — because in
 * a collapsed rail indentation disappears and the icon is all that is left to
 * say what a row is.
 *
 * PREVIEW: renders the fixture curriculum and calls no API.
 */

/* ------------------------------------------------------------------- outline */

const ROW_ICON = {
  lesson: BookOpen,
  quiz: CircleHelp,
  assessment: ClipboardCheck,
}

/**
 * Flattens a middle category into the ordered run a learner actually walks:
 * lesson, lesson, …, then the unit assessment.
 *
 * A lesson's quick check is *part of that lesson*, not a step after it — it is
 * carried on the lesson as `quiz` and rendered at the foot of the lesson page.
 * Listing it as its own track entry doubled the apparent length of every topic
 * and made a three-question check look like the same size of commitment as a
 * fifteen-minute lesson. The unit assessment stays a track entry of its own,
 * because it belongs to the topic rather than to any one lesson.
 */
function buildTrack(middle) {
  const track = (middle.lessons ?? []).map((lessonItem) => ({
    ...lessonItem,
    kind: "lesson",
    quiz: (middle.quizzes ?? {})[lessonItem.id] ?? null,
  }))

  if (middle.assessment) {
    track.push({ ...middle.assessment, kind: "assessment" })
  }

  return track
}

function OutlineRow({
  item,
  active,
  collapsed,
  expanded,
  onSelect,
  onToggle,
  index,
  readSections,
  doneLessons,
}) {
  const Icon = ROW_ICON[item.kind] ?? BookOpen
  const done = item.kind === "lesson" && doneLessons.has(item.id)
  // A lesson opens to what is inside it: its sections, then its quick check.
  const hasChildren =
    item.kind === "lesson" && ((item.sections?.length ?? 0) > 0 || Boolean(item.quiz))

  return (
    <li>
      <div
        className={`flex items-center gap-1 border-l-4 transition-colors ${
          active ? "border-rb-macaw bg-rb-macaw-wash" : "border-transparent hover:bg-rb-polar"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(item)}
          title={collapsed ? item.name : undefined}
          aria-current={active ? "step" : undefined}
          className={`flex min-w-0 flex-1 items-center gap-3 py-3 text-left ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full ${
              done
                ? "bg-rb-feather text-white"
                : active
                  ? "bg-rb-macaw text-white"
                  : item.kind === "assessment"
                    ? "bg-rb-fox-wash text-rb-fox-lip"
                    : item.kind === "quiz"
                      ? "bg-rb-beetle-wash text-rb-beetle-lip"
                      : "bg-rb-swan text-rb-wolf"
            }`}
          >
            {done ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Icon className="size-4" aria-hidden="true" />
            )}
          </span>

          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-sm ${
                  active ? "font-extrabold text-rb-macaw-lip" : "font-bold text-rb-eel"
                }`}
              >
                {index ? `${index} ` : ""}
                {item.name}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-bold uppercase tracking-wide text-rb-wolf">
                {item.kind === "lesson"
                  ? `lesson · ${item.minutes} min${item.quiz ? " · 1 quiz" : ""}`
                  : `unit assessment · ${item.questions} questions`}
              </span>
            </span>
          ) : null}
        </button>

        {hasChildren && !collapsed ? (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} contents of ${item.name}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-rb-hare hover:bg-rb-swan hover:text-rb-eel"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      {hasChildren && expanded && !collapsed ? (
        <ul className="border-l-4 border-transparent bg-rb-polar/60 py-1 pl-[2.75rem] pr-3">
          {(item.sections ?? []).map((section) => {
            const sectionRead = readSections.has(section.id)

            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={`flex items-center gap-2 py-1.5 text-xs font-bold hover:text-rb-macaw-lip ${
                    sectionRead ? "text-[#3d6b06]" : "text-rb-wolf"
                  }`}
                >
                  <span className="grid size-5 shrink-0 place-items-center">
                    {sectionRead ? (
                      <Check className="size-3 text-rb-feather" aria-hidden="true" />
                    ) : (
                      <Circle className="size-1.5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 truncate">{section.name}</span>
                </a>
              </li>
            )
          })}

          {/* The quick check closes the lesson, so it is the last child rather
              than the next sibling. Given an icon of its own — a section is a
              heading you scroll to, a quiz is something you answer, and at this
              indent the dot alone could not tell them apart. */}
          {item.quiz ? (
            <li>
              <a
                href={`#quiz-${item.quiz.id}`}
                className="flex items-center gap-2 py-1.5 text-xs font-bold text-rb-beetle-lip hover:underline"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-rb-beetle-wash">
                  <CircleHelp className="size-3" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate">
                  Quick check · {item.quiz.questions} questions
                </span>
              </a>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  )
}

function Outline({
  middle,
  major,
  track,
  activeId,
  collapsed,
  onCollapse,
  onSelect,
  readSections,
  doneLessons,
}) {
  const [expanded, setExpanded] = useState(() => new Set([track[0]?.id]))

  function toggle(id) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const lessons = middle.lessons ?? []
  const done = lessons.filter((item) => doneLessons.has(item.id)).length
  const progress = lessons.length ? Math.round((done / lessons.length) * 100) : 0

  let lessonNumber = 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-rb-snow">
      <div
        className={`shrink-0 border-b-2 border-rb-swan ${collapsed ? "px-2 py-4" : "px-4 py-5"}`}
      >
        <div className="flex items-center justify-between gap-2">
          {!collapsed ? (
            <div className="min-w-0">
              <p className="rb-eyebrow truncate">unit {major.index} · {major.name}</p>
              <p className="mt-1 truncate font-rb-display text-base font-extrabold text-rb-eel">
                {middle.name}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onCollapse}
            aria-label={collapsed ? "Expand outline" : "Collapse outline"}
            title={collapsed ? "Expand outline" : "Collapse outline"}
            className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-rb-swan bg-rb-snow text-rb-wolf transition hover:text-rb-eel"
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>
        </div>

        {!collapsed ? (
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-rb-wolf">
                {done} of {lessons.length} lessons
              </span>
              <span className="rb-numeric text-xs">{progress}%</span>
            </div>
            <ProgressBar
              value={progress}
              tone="macaw"
              label="Topic progress"
              className="mt-2 !h-3"
            />
          </div>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Topic outline">
        <ul>
          {track.map((item) => {
            if (item.kind === "lesson") lessonNumber += 1

            return (
              <OutlineRow
                key={item.id}
                item={item}
                index={item.kind === "lesson" ? `${lessonNumber}.` : ""}
                active={item.id === activeId}
                collapsed={collapsed}
                expanded={expanded.has(item.id)}
                onSelect={onSelect}
                onToggle={toggle}
                readSections={readSections}
                doneLessons={doneLessons}
              />
            )
          })}
        </ul>
      </nav>

      {!collapsed ? (
        <div className="shrink-0 border-t-2 border-rb-swan p-3">
          <TactileButton asChild variant="ghost" size="sm" className="w-full">
            <Link to="/learner/curriculum-preview">
              <ArrowLeft className="size-4" />
              back to curriculum
            </Link>
          </TactileButton>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------- centre */

/**
 * A section's tick. Scrolling past the end of a section ticks it; the tick is
 * also a button, because progress that can only be earned by scrolling cannot
 * be corrected by a learner who skimmed ahead and came back.
 */
function ReadCheck({ done, label, onToggle, size = "size-8" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={label}
      title={label}
      className={`grid ${size} shrink-0 place-items-center rounded-full border-2 transition ${
        done
          ? "border-rb-feather bg-rb-feather text-white"
          : "border-rb-swan bg-rb-snow text-rb-hare hover:border-rb-hare"
      }`}
    >
      <Check className="size-4" aria-hidden="true" />
    </button>
  )
}

function LessonView({
  lessonItem,
  position,
  total,
  readSections,
  lessonDone,
  onReadSection,
  onToggleSection,
  onReadLesson,
  onToggleLesson,
  onPrev,
  onNext,
}) {
  const articleRef = useRef(null)
  const sections = lessonItem.sections

  /* Sentinels sit at the *end* of each section and at the end of the lesson, so
     a section ticks once you have scrolled past its last paragraph rather than
     the moment its heading appears.

     Measured against the current scroll position on every scroll, rather than
     with an IntersectionObserver. An observer only reports *transitions*, so
     anything jumped over between two frames — End, a table-of-contents link, a
     fast flick — is never reported as having been seen, and sections stayed
     unticked under a lesson that was plainly finished. A position test asks
     "is this above the line now?", which is true however you got there. */
  useEffect(() => {
    const root = articleRef.current
    if (!root) return undefined

    function check() {
      // Nine tenths down the window: high enough that a sentinel only just
      // peeking into view does not count, low enough to be reachable at the
      // very bottom of the page where the lesson sentinel lives.
      const line = window.innerHeight * 0.9

      root.querySelectorAll("[data-read-section]").forEach((node) => {
        if (node.getBoundingClientRect().top < line) {
          onReadSection(node.dataset.readSection)
        }
      })

      const end = root.querySelector("[data-read-lesson]")
      if (end && end.getBoundingClientRect().top < line) {
        // Reaching the end means every section above it was passed.
        sections.forEach((section) => onReadSection(section.id))
        onReadLesson()
      }
    }

    // Not run on mount on purpose: a lesson short enough to fit on one screen
    // would mark itself complete before it had been read. Those are what the
    // tick buttons are for.
    window.addEventListener("scroll", check, { passive: true })
    window.addEventListener("resize", check)

    return () => {
      window.removeEventListener("scroll", check)
      window.removeEventListener("resize", check)
    }
  }, [sections, onReadSection, onReadLesson])

  const readCount = sections.filter((section) => readSections.has(section.id)).length

  return (
    <article ref={articleRef} className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-10 lg:px-14">
      <p className="rb-eyebrow">
        lesson {position} of {total}
      </p>

      <h1 className="rb-display rb-display-sm mt-3">{lessonItem.name}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rb-chip bg-rb-macaw-wash text-rb-macaw-lip">
          <Clock className="size-3.5" aria-hidden="true" />
          {lessonItem.minutes} min
        </span>
        <span className="rb-chip">
          <ListChecks className="size-3.5" aria-hidden="true" />
          {lessonItem.sections.length} sections
        </span>
        {lessonItem.quiz ? (
          <span className="rb-chip bg-rb-beetle-wash text-rb-beetle-lip">
            <CircleHelp className="size-3.5" aria-hidden="true" />
            quick check · {lessonItem.quiz.questions} questions
          </span>
        ) : null}
        <span
          className={`rb-chip ${lessonDone ? "bg-rb-feather-wash text-[#3d6b06]" : ""}`}
          aria-live="polite"
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {lessonDone
            ? "lesson complete"
            : `${readCount} of ${lessonItem.sections.length} sections read`}
        </span>
      </div>

      {/* Introduction — the welcome, then what the lesson is for. Every lesson
          opens the same way, so a learner always knows what they are about to
          spend the next quarter of an hour on before they spend it. */}
      <section className="mt-8 rounded-rb-card border-2 border-rb-swan bg-rb-macaw-wash p-6">
        <p className="font-rb-display text-lg font-extrabold text-rb-eel">
          Welcome to {lessonItem.name.toLowerCase()}.
        </p>

        <p className="rb-body mt-3">
          This lesson takes about {lessonItem.minutes} minutes and covers{" "}
          {lessonItem.sections.length} section
          {lessonItem.sections.length === 1 ? "" : "s"}. Work through it in order — each section
          assumes the one before it — and the quick check at the end will ask you to apply it
          rather than recall it.
        </p>

        <p className="mt-5 font-rb-display text-sm font-extrabold uppercase tracking-wide text-rb-macaw-lip">
          In this lesson, you will learn how to do the following:
        </p>

        <ul className="mt-3 space-y-2">
          {lessonItem.objectives.map((objective) => (
            <li key={objective} className="flex gap-3 text-sm font-medium text-rb-eel">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rb-macaw text-white">
                <Check className="size-3" aria-hidden="true" />
              </span>
              {objective}
            </li>
          ))}
        </ul>
      </section>

      {/* Table of contents. Sections are also in the rail, but the rail is
          collapsible and this is the one place the learner is already looking. */}
      <nav className="mt-6 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-6" aria-label="Table of contents">
        <p className="rb-eyebrow">table of contents</p>

        <ol className="mt-4 space-y-1">
          {lessonItem.sections.map((section, index) => {
            const done = readSections.has(section.id)

            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-bold text-rb-eel transition hover:bg-rb-polar"
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${
                      done ? "bg-rb-feather text-white" : "rb-numeric bg-rb-swan"
                    }`}
                  >
                    {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{section.name}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-rb-hare" aria-hidden="true" />
                </a>
              </li>
            )
          })}

          {lessonItem.quiz ? (
            <li>
              <a
                href={`#quiz-${lessonItem.quiz.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-bold text-rb-eel transition hover:bg-rb-polar"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rb-beetle-wash text-rb-beetle-lip">
                  <CircleHelp className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">Test your skills</span>
                <ArrowRight className="size-3.5 shrink-0 text-rb-hare" aria-hidden="true" />
              </a>
            </li>
          ) : null}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {lessonItem.sections.map((section, index) => {
          const done = readSections.has(section.id)

          return (
            <section key={section.id} id={section.id} className="scroll-mt-8">
              <div className="flex items-start gap-4">
                <ReadCheck
                  done={done}
                  label={`Mark "${section.name}" as ${done ? "unread" : "read"}`}
                  onToggle={() => onToggleSection(section.id)}
                />

                <div className="min-w-0 flex-1">
                  <p className={`rb-eyebrow ${done ? "!text-[#3d6b06]" : ""}`}>
                    section {index + 1}
                    {done ? " · read" : ""}
                  </p>

                  <h2 className="mt-1 font-rb-display text-2xl font-extrabold text-rb-eel">
                    {section.name}
                  </h2>
                </div>
              </div>

              <div className="mt-4 space-y-4 sm:pl-12">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="rb-body">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Trailing sentinel: scrolling past this is what ticks the
                  section above it. */}
              <span aria-hidden="true" data-read-section={section.id} className="block h-px" />
            </section>
          )
        })}
      </div>

      {/* The lesson's own quick check, bled to the column edges so the band
          reads as a change of activity rather than one more card in the
          reading column. */}
      {lessonItem.quiz ? (
        <div className="-mx-5 mt-14 sm:-mx-10 lg:-mx-14">
          <QuizBlock quizItem={lessonItem.quiz} />
        </div>
      ) : null}

      {/* End of the lesson. The tick goes green on its own when you get here —
          the sentinel below it is what the observer is watching — and can also
          be pressed, so a learner who jumped to the end can still set it. */}
      <div
        aria-live="polite"
        className={`mt-12 flex items-center gap-4 rounded-rb-card border-2 p-5 transition-colors ${
          lessonDone ? "border-rb-feather bg-rb-feather-wash" : "border-rb-swan bg-rb-polar"
        }`}
      >
        <ReadCheck
          done={lessonDone}
          size="size-11"
          label={lessonDone ? "Mark lesson incomplete" : "Mark lesson complete"}
          onToggle={onToggleLesson}
        />

        <div className="min-w-0">
          <p className="font-rb-display text-base font-extrabold text-rb-eel">
            {lessonDone ? "Lesson complete" : "You reached the end of this lesson"}
          </p>
          <p className="mt-0.5 text-sm font-medium text-rb-wolf">
            {lessonDone
              ? "This lesson is ticked off in your outline."
              : "Completion is saved automatically once you reach the end."}
          </p>
        </div>
      </div>

      <span aria-hidden="true" data-read-lesson="true" className="block h-px" />

      <div className="mt-12 flex flex-col gap-3 border-t-2 border-rb-swan pt-6 sm:flex-row sm:items-center sm:justify-between">
        <TactileButton variant="ghost" size="sm" onClick={onPrev} disabled={!onPrev}>
          <ArrowLeft className="size-4" />
          previous
        </TactileButton>

        <TactileButton variant="macaw" size="sm" onClick={onNext} disabled={!onNext}>
          next
          <ArrowRight className="size-4" />
        </TactileButton>
      </div>
    </article>
  )
}

/**
 * A lesson's quick check, on the "test your skills" layout: a coloured band,
 * one scenario card floating on it, and options that stay the same size whether
 * or not they are chosen, so answering never moves the page.
 *
 * Rendered inside the lesson it belongs to rather than as a page of its own —
 * a three-question check is the end of a lesson, not a separate destination.
 */
function QuizBlock({ quizItem }) {
  const [choice, setChoice] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const correct = choice === SAMPLE_QUIZ.answerIndex

  return (
    <section id={`quiz-${quizItem.id}`} className="scroll-mt-8 bg-rb-bee px-5 py-12 sm:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-6xl">
        <p className="font-rb-display text-2xl font-extrabold text-white">
          {SAMPLE_QUIZ.eyebrow}
        </p>
        <p className="mt-1 text-sm font-bold text-white/80">
          {quizItem.name} · {quizItem.questions} questions
        </p>

        <div className="mt-6 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-6 sm:p-8">
          {SAMPLE_QUIZ.prompt.split("\n\n").map((paragraph) => (
            <p key={paragraph.slice(0, 30)} className="rb-body mt-4 first:mt-0">
              {paragraph}
            </p>
          ))}

          <hr className="my-6 border-rb-swan" />

          <ul className="space-y-3">
            {SAMPLE_QUIZ.options.map((option, index) => {
              const chosen = choice === index
              const isAnswer = index === SAMPLE_QUIZ.answerIndex

              const state = !submitted
                ? chosen
                  ? "border-rb-macaw bg-rb-macaw-wash"
                  : "border-rb-swan bg-rb-snow hover:border-rb-hare"
                : isAnswer
                  ? "border-rb-feather bg-rb-feather-wash"
                  : chosen
                    ? "border-rb-cardinal bg-rb-cardinal-wash"
                    : "border-rb-swan bg-rb-snow opacity-70"

              return (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => !submitted && setChoice(index)}
                    aria-pressed={chosen}
                    className={`flex w-full items-start gap-3 rounded-rb-card border-2 p-4 text-left transition ${state}`}
                  >
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                        chosen ? "border-rb-macaw bg-rb-macaw text-white" : "border-rb-hare bg-rb-snow"
                      }`}
                    >
                      {chosen ? <Check className="size-3" aria-hidden="true" /> : null}
                    </span>

                    <span className="min-w-0 flex-1 text-sm font-medium text-rb-eel">{option}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {submitted ? (
            <div
              className={`mt-6 rounded-rb-card border-2 p-4 ${
                correct
                  ? "border-rb-feather bg-rb-feather-wash"
                  : "border-rb-cardinal bg-rb-cardinal-wash"
              }`}
            >
              <p className="font-rb-display text-base font-extrabold text-rb-eel">
                {correct ? "Correct." : "Not quite."}
              </p>
              <p className="rb-body mt-2">{SAMPLE_QUIZ.explanation}</p>
            </div>
          ) : null}

          <div className="mt-8 flex justify-center">
            {submitted ? (
              <TactileButton variant="ghost" onClick={() => { setSubmitted(false); setChoice(null) }}>
                try again
              </TactileButton>
            ) : (
              <TactileButton
                variant="macaw"
                onClick={() => setSubmitted(true)}
                disabled={choice === null}
              >
                submit
              </TactileButton>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** The unit assessment splash: what it takes to pass, and one key. */
function AssessmentView({ assessmentItem, position, total }) {
  return (
    <div className="px-5 py-16 sm:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-6xl rounded-rb-card border-2 border-rb-swan bg-rb-snow p-8 shadow-[0_5px_0_var(--color-rb-swan)] sm:p-12">
        <p className="rb-eyebrow">
          lesson {position} of {total}
        </p>

        <h1 className="rb-display rb-display-sm mt-3">assessment</h1>

        <span className="mt-5 block h-1.5 w-24 rounded-full bg-rb-fox" aria-hidden="true" />

        <p className="rb-body-lg mt-7">
          You must score {assessmentItem.passMark} percent or higher on this assessment to pass the
          module. You have unlimited chances. Good luck!
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            [ClipboardCheck, `${assessmentItem.questions} questions`],
            [CheckCircle2, `${assessmentItem.passMark}% to pass`],
            [Clock, "Unlimited attempts"],
          ].map(([Icon, label]) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-rb-card border-2 border-rb-swan bg-rb-polar p-4"
            >
              <Icon className="size-5 shrink-0 text-rb-fox-lip" aria-hidden="true" />
              <span className="text-sm font-bold text-rb-eel">{label}</span>
            </li>
          ))}
        </ul>

        <TactileButton variant="fox" className="mt-9">
          start quiz
          <ArrowRight className="size-4" />
        </TactileButton>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- tutor */

const TUTOR_SEED = [
  {
    id: "t-1",
    from: "tutor",
    text: "I can see you are on this topic. Ask me to explain a section, compare two services, or turn what you just read into practice questions.",
  },
]

const TUTOR_PROMPTS = [
  "Explain this section more simply",
  "How is this different from the last lesson?",
  "Give me three practice questions",
]

function TutorPanel({ context, onClose }) {
  const [messages, setMessages] = useState(TUTOR_SEED)
  const [draft, setDraft] = useState("")

  function send(text) {
    const value = text.trim()
    if (!value) return

    setMessages((current) => [
      ...current,
      { id: `u-${current.length}`, from: "learner", text: value },
      {
        id: `t-${current.length}`,
        from: "tutor",
        // PREVIEW: canned reply — the real panel posts to the tutor endpoint.
        text: `Here is where I would answer "${value}" using the content of ${context}. This preview does not call the tutor service.`,
      },
    ])
    setDraft("")
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-rb-snow">
      <div className="flex shrink-0 items-center gap-3 border-b-2 border-rb-swan px-4 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rb-beetle text-white">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-rb-display text-base font-extrabold text-rb-eel">AI Tutor</p>
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-rb-wolf">
            {context}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI tutor"
          className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-rb-swan text-rb-wolf transition hover:text-rb-eel"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.from === "learner" ? "flex justify-end" : "flex gap-2"}
          >
            {message.from === "tutor" ? (
              <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-rb-beetle-wash text-rb-beetle-lip">
                <Bot className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}

            <p
              className={`max-w-[85%] rounded-rb-card px-4 py-3 text-sm font-medium ${
                message.from === "learner"
                  ? "bg-rb-macaw text-white"
                  : "border-2 border-rb-swan bg-rb-polar text-rb-eel"
              }`}
            >
              {message.text}
            </p>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t-2 border-rb-swan p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {TUTOR_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => send(prompt)}
              className="rounded-rb-pill border-2 border-rb-swan bg-rb-snow px-3 py-1.5 text-[11px] font-bold text-rb-wolf transition hover:border-rb-beetle hover:text-rb-beetle-lip"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            send(draft)
          }}
          className="flex items-center gap-2 rounded-rb-card border-2 border-rb-swan bg-rb-polar p-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about this lesson…"
            aria-label="Ask the AI tutor"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-rb-eel outline-none placeholder:text-rb-hare"
          />

          <button
            type="submit"
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-rb-beetle text-white transition hover:brightness-105"
          >
            <SendHorizontal className="size-4" aria-hidden="true" />
          </button>
        </form>

        <p className="mt-2 text-center text-[10px] font-medium text-rb-hare">
          AI answers can be wrong. Check them against the lesson.
        </p>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- page */

export default function LearnerStudyPage() {
  const [params] = useSearchParams()

  const { major, middle } = useMemo(() => {
    const wanted = params.get("middle")

    for (const candidate of CURRICULUM.majors) {
      const found = (candidate.middles ?? []).find((item) => item.id === wanted)
      if (found) return { major: candidate, middle: found }
    }

    const fallback = CURRICULUM.majors[1]
    return { major: fallback, middle: fallback.middles[0] }
  }, [params])

  const track = useMemo(() => buildTrack(middle), [middle])

  const [activeId, setActiveId] = useState(() => track[0]?.id)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)

  /* Read state lives here rather than in the lesson, because the rail draws
     the same ticks and would otherwise reset every time you changed lesson.
     Seeded from the fixture's `completed` flag so a returning learner's history
     is already on the page.

     PREVIEW: held in memory only — the real page posts lesson completion. */
  const [readSections, setReadSections] = useState(() => new Set())
  const [doneLessons, setDoneLessons] = useState(
    () => new Set((middle.lessons ?? []).filter((item) => item.completed).map((item) => item.id)),
  )

  const activeIndex = Math.max(
    0,
    track.findIndex((item) => item.id === activeId),
  )
  const active = track[activeIndex] ?? track[0]

  const prev = track[activeIndex - 1]
  const next = track[activeIndex + 1]

  // Stable identities: the lesson's IntersectionObserver is rebuilt whenever
  // these change, and a fresh closure each render would tear it down on every
  // tick it fired.
  const readSection = useCallback((sectionId) => {
    setReadSections((current) =>
      current.has(sectionId) ? current : new Set(current).add(sectionId),
    )
  }, [])

  const toggleSection = useCallback((sectionId) => {
    setReadSections((current) => {
      const nextSet = new Set(current)
      if (nextSet.has(sectionId)) nextSet.delete(sectionId)
      else nextSet.add(sectionId)
      return nextSet
    })
  }, [])

  const activeLessonId = active?.kind === "lesson" ? active.id : null

  // Two entry points, deliberately different: the observer only ever *sets*
  // (reaching the end twice must not untick the lesson), the button toggles.
  const readLesson = useCallback(() => {
    if (!activeLessonId) return
    setDoneLessons((current) =>
      current.has(activeLessonId) ? current : new Set(current).add(activeLessonId),
    )
  }, [activeLessonId])

  const toggleLesson = useCallback(() => {
    if (!activeLessonId) return
    setDoneLessons((current) => {
      const nextSet = new Set(current)
      if (nextSet.has(activeLessonId)) nextSet.delete(activeLessonId)
      else nextSet.add(activeLessonId)
      return nextSet
    })
  }, [activeLessonId])

  const columns = outlineCollapsed
    ? tutorOpen
      ? "xl:grid-cols-[72px_minmax(0,1fr)_380px]"
      : "xl:grid-cols-[72px_minmax(0,1fr)]"
    : tutorOpen
      ? "xl:grid-cols-[320px_minmax(0,1fr)_380px]"
      : "xl:grid-cols-[320px_minmax(0,1fr)]"

  return (
    <div className="rebyu-ds min-h-dvh bg-rb-polar">
      <div className={`grid min-h-dvh ${columns}`}>
        {/* ---------------------------------------------------------- left */}
        <aside className="hidden min-h-0 border-r-2 border-rb-swan xl:block">
          <div className="sticky top-0 h-dvh">
            <Outline
              middle={middle}
              major={major}
              track={track}
              activeId={active?.id}
              collapsed={outlineCollapsed}
              onCollapse={() => setOutlineCollapsed((value) => !value)}
              onSelect={(item) => setActiveId(item.id)}
              readSections={readSections}
              doneLessons={doneLessons}
            />
          </div>
        </aside>

        {/* -------------------------------------------------------- centre */}
        <main className="min-w-0 bg-rb-snow">
          {/* Mobile and narrow-window header: the outline column is xl-only, so
              without this the topic you are in has no name on a laptop. */}
          <div className="flex items-center gap-3 border-b-2 border-rb-swan px-5 py-4 xl:hidden">
            <TactileButton asChild variant="ghost" size="sm">
              <Link to="/learner/curriculum-preview">
                <ArrowLeft className="size-4" />
              </Link>
            </TactileButton>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-rb-wolf">
                unit {major.index} · {major.name}
              </p>
              <p className="truncate font-rb-display text-sm font-extrabold text-rb-eel">
                {middle.name}
              </p>
            </div>
          </div>

          {active?.kind === "lesson" ? (
            <LessonView
              key={active.id}
              lessonItem={active}
              position={activeIndex + 1}
              total={track.length}
              readSections={readSections}
              lessonDone={doneLessons.has(active.id)}
              onReadSection={readSection}
              onToggleSection={toggleSection}
              onReadLesson={readLesson}
              onToggleLesson={toggleLesson}
              onPrev={prev ? () => setActiveId(prev.id) : undefined}
              onNext={next ? () => setActiveId(next.id) : undefined}
            />
          ) : (
            <AssessmentView
              assessmentItem={active}
              position={activeIndex + 1}
              total={track.length}
            />
          )}
        </main>

        {/* --------------------------------------------------------- right */}
        {tutorOpen ? (
          <aside className="hidden min-h-0 border-l-2 border-rb-swan xl:block">
            <div className="sticky top-0 h-dvh overflow-hidden">
              <TutorPanel
                context={active?.name ?? middle.name}
                onClose={() => setTutorOpen(false)}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* The circle. Only shown while the column is closed — once the tutor is
          on screen a second control to open it is noise. */}
      {!tutorOpen ? (
        <button
          type="button"
          onClick={() => setTutorOpen(true)}
          aria-label="Open AI tutor"
          className="fixed bottom-6 right-6 z-50 grid size-16 place-items-center rounded-full bg-rb-beetle text-white shadow-[0_6px_0_var(--color-rb-beetle-lip)] transition active:translate-y-[4px] active:shadow-[0_2px_0_var(--color-rb-beetle-lip)]"
        >
          <Sparkles className="size-7" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
