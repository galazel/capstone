import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Circle,
  CircleHelp,
  Clock,
  ListChecks,
  Loader2,
  PanelLeft,
  Sparkles,
} from "@/components/icons"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { TactileButton, ProgressBar } from "@/components/rebyu/rebyu-ui.jsx"
import {
  AnimatePresence,
  Collapse,
  CountUp,
  Reveal,
  StaggerList,
  TickPop,
  fadeUp,
  motion,
  popIn,
} from "@/components/motion/rebyu-motion.jsx"
import { LearnerEmptyState } from "@/components/learner/learner-ui.jsx"
import { LessonAiTutor } from "@/components/learner/lesson-ai-tutor.jsx"
import { LessonTool } from "@/components/certifications/lesson-content-renderer.jsx"
import {
  getLessonById,
  markLessonComplete,
  parseLessonStructure,
} from "@/services/learnerService.js"
import { getExams, getExamTypes } from "@/services/assessmentService.js"
import { buildCurriculum, findMiddle } from "./curriculum-model.js"

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
 * Lessons carry their own sections and their own quick check nested underneath,
 * so the outline doubles as the position indicator inside a long lesson.
 *
 * A lesson's quiz belongs to the lesson, not to the topic: it is rendered at
 * the foot of the lesson and nested under it in the rail. Only the unit
 * assessment is a track entry of its own.
 */

/* --------------------------------------------------------------------- data */

function useIsXl() {
  const [isXl, setIsXl] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches,
  )

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)")
    const handle = (event) => setIsXl(event.matches)
    query.addEventListener("change", handle)
    return () => query.removeEventListener("change", handle)
  }, [])

  return isXl
}

/** Ordered run a learner walks: lesson, lesson, …, then the unit assessment. */
function buildTrack(middle) {
  const track = middle.lessons.map((lesson) => ({ ...lesson, kind: "lesson" }))

  if (middle.assessment) {
    track.push({
      kind: "assessment",
      id: `assessment-${middle.assessment.examId}`,
      exam: middle.assessment,
      name: middle.assessment.title,
    })
  }

  return track
}

/** The structure JSON gives sections a name and a tool list, not always an id. */
function readSectionsOf(structure) {
  return parseLessonStructure(structure).map((section, index) => ({
    ...section,
    key: String(section.id ?? `section-${index}`),
    name: section.sectionName ?? section.name ?? `Section ${index + 1}`,
    tools: Array.isArray(section.content) ? section.content : [],
  }))
}

/* ------------------------------------------------------------------- outline */

const ROW_ICON = { lesson: BookOpen, assessment: ClipboardCheck }

function OutlineRow({
  item,
  active,
  collapsed,
  expanded,
  onSelect,
  onToggle,
  index,
  sections,
  readSections,
  done,
}) {
  const Icon = ROW_ICON[item.kind] ?? BookOpen
  // A lesson opens to what is inside it: its sections, then its quick check.
  const hasChildren = item.kind === "lesson" && (sections.length > 0 || Boolean(item.quiz))

  return (
    // A variant participant, so the parent <StaggerList> can time its entrance.
    <motion.li variants={fadeUp}>
      <div
        className={`relative flex items-center gap-1 transition-colors ${
          active ? "bg-rb-macaw-wash" : "hover:bg-rb-polar"
        }`}
      >
        {/* One shared bar that travels between rows rather than a border that
            blinks off one and on at the next. `layoutId` is what makes the
            move continuous — this is the clearest signal in the rail that you
            changed lesson rather than opened a different page. */}
        {active ? (
          <motion.span
            layoutId="rail-active"
            className="absolute inset-y-0 left-0 w-1 bg-rb-macaw"
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            aria-hidden="true"
          />
        ) : null}
        <span className="w-1 shrink-0" aria-hidden="true" />
        <button
          type="button"
          onClick={() => onSelect(item)}
          title={collapsed ? item.name : undefined}
          aria-current={active ? "step" : undefined}
          className={`flex min-w-0 flex-1 items-center gap-3 py-3 text-left ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <TickPop
            done={done}
            className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
              done
                ? "bg-rb-feather text-white"
                : active
                  ? "bg-rb-macaw text-white"
                  : item.kind === "assessment"
                    ? "bg-rb-fox-wash text-rb-fox-lip"
                    : "bg-rb-swan text-rb-wolf"
            }`}
          >
            {done ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Icon className="size-4" aria-hidden="true" />
            )}
          </TickPop>

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
                  ? `lesson${item.quiz ? " · 1 quiz" : ""}`
                  : `unit assessment · ${item.exam.totalQuestions} questions`}
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
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="grid place-items-center"
            >
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </motion.span>
          </button>
        ) : null}
      </div>

      <Collapse open={Boolean(hasChildren && expanded && !collapsed)} duration={0.26}>
        <ul className="border-l-4 border-transparent bg-rb-polar/60 py-1 pl-[2.75rem] pr-3">
          {sections.map((section) => {
            const sectionRead = readSections.has(section.key)

            return (
              <li key={section.key}>
                <a
                  href={`#${section.key}`}
                  className={`flex items-center gap-2 py-1.5 text-xs font-bold hover:text-rb-macaw-lip ${
                    sectionRead ? "text-[#3d6b06]" : "text-rb-wolf"
                  }`}
                >
                  <TickPop done={sectionRead} className="grid size-5 shrink-0 place-items-center">
                    {sectionRead ? (
                      <Check className="size-3 text-rb-feather" aria-hidden="true" />
                    ) : (
                      <Circle className="size-1.5" aria-hidden="true" />
                    )}
                  </TickPop>
                  <span className="min-w-0 truncate">{section.name}</span>
                </a>
              </li>
            )
          })}

          {/* The quick check closes the lesson, so it is the last child rather
              than the next sibling. Given an icon of its own — a section is a
              heading you scroll to, a quiz is something you answer. */}
          {item.quiz ? (
            <li>
              <a
                href={`#quiz-${item.quiz.examId}`}
                className="flex items-center gap-2 py-1.5 text-xs font-bold text-rb-beetle-lip hover:underline"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-rb-beetle-wash">
                  <CircleHelp className="size-3" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate">
                  Quick check · {item.quiz.totalQuestions} questions
                </span>
              </a>
            </li>
          ) : null}
        </ul>
      </Collapse>
    </motion.li>
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
  activeSections,
  readSections,
  isDone,
  backTo,
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

  const lessons = middle.lessons
  const done = lessons.filter((lesson) => isDone(lesson.id)).length
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
              <p className="rb-eyebrow truncate">
                unit {major.index} · {major.name}
              </p>
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
              <CountUp value={progress} suffix="%" className="rb-numeric text-xs" />
            </div>
            <ProgressBar value={progress} tone="macaw" label="Topic progress" className="mt-2 !h-3" />
          </div>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Topic outline">
        {/* `amount: 0` — the rail is on screen from the moment the page mounts,
            so there is nothing to scroll into view. */}
        <StaggerList as="ul" stagger={0.045} amount={0}>
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
                // Sections are only known for the lesson currently open — the
                // structure is fetched per lesson, and prefetching every one to
                // fill the rail would be a request per row.
                sections={item.id === activeId ? activeSections : []}
                readSections={readSections}
                done={item.kind === "lesson" && isDone(item.id)}
              />
            )
          })}
        </StaggerList>
      </nav>

      {!collapsed ? (
        <div className="shrink-0 border-t-2 border-rb-swan p-3">
          <TactileButton asChild variant="ghost" size="sm" className="w-full">
            <Link to={backTo}>
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
function ReadCheck({ done, label, onToggle, pending, size = "size-8" }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.88 }}
      // The pop only fires on the transition into done, so ticking is
      // rewarding and unticking is quiet.
      animate={done ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={
        done ? { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] } : { duration: 0.18 }
      }
      className={`grid ${size} shrink-0 place-items-center rounded-full border-2 transition-colors ${
        done
          ? "border-rb-feather bg-rb-feather text-white"
          : "border-rb-swan bg-rb-snow text-rb-hare hover:border-rb-hare"
      }`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Check className="size-4" aria-hidden="true" />
      )}
    </motion.button>
  )
}

function LessonView({
  lessonItem,
  sections,
  loading,
  position,
  total,
  readSections,
  lessonDone,
  completing,
  onReadSection,
  onToggleSection,
  onReadLesson,
  onToggleLesson,
  onPrev,
  onNext,
}) {
  const articleRef = useRef(null)

  /* Sentinels sit at the *end* of each section and at the end of the lesson, so
     a section ticks once you have scrolled past its last paragraph rather than
     the moment its heading appears.

     Measured against the current scroll position on every scroll, rather than
     with an IntersectionObserver. An observer only reports *transitions*, so
     anything jumped over between two frames — End, a table-of-contents link, a
     fast flick — is never reported, and sections stayed unticked under a lesson
     that was plainly finished. A position test asks "is this above the line
     now?", which is true however you got there. */
  useEffect(() => {
    const root = articleRef.current
    if (!root || sections.length === 0) return undefined

    function check() {
      const line = window.innerHeight * 0.9

      root.querySelectorAll("[data-read-section]").forEach((node) => {
        if (node.getBoundingClientRect().top < line) {
          onReadSection(node.dataset.readSection)
        }
      })

      const end = root.querySelector("[data-read-lesson]")
      if (end && end.getBoundingClientRect().top < line) {
        // Reaching the end means every section above it was passed.
        sections.forEach((section) => onReadSection(section.key))
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

  const readCount = sections.filter((section) => readSections.has(section.key)).length

  return (
    <article ref={articleRef} className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-10 lg:px-14">
      <p className="rb-eyebrow">
        lesson {position} of {total}
      </p>

      <h1 className="rb-display rb-display-sm mt-3">{lessonItem.name}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rb-chip">
          <ListChecks className="size-3.5" aria-hidden="true" />
          {sections.length} section{sections.length === 1 ? "" : "s"}
        </span>
        {lessonItem.quiz ? (
          <span className="rb-chip bg-rb-beetle-wash text-rb-beetle-lip">
            <CircleHelp className="size-3.5" aria-hidden="true" />
            quick check · {lessonItem.quiz.totalQuestions} questions
          </span>
        ) : null}
        <span
          className={`rb-chip ${lessonDone ? "bg-rb-feather-wash text-[#3d6b06]" : ""}`}
          aria-live="polite"
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {lessonDone ? "lesson complete" : `${readCount} of ${sections.length} sections read`}
        </span>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-sm font-bold text-rb-wolf">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading lesson content…
        </div>
      ) : sections.length === 0 ? (
        <div className="mt-10">
          <LearnerEmptyState
            icon={BookOpen}
            title="No lesson content yet"
            description="This lesson exists, but no learner-facing content has been published for it."
          />
        </div>
      ) : (
        <>
          {/* Introduction — the welcome, then what the lesson covers. Every
              lesson opens the same way, so a learner always knows what they are
              about to spend the next stretch on before they spend it.

              The bullets are the lesson's own section names: categories and
              lessons carry a title and a body, and there is no objectives field
              behind them to read. */}
          <Reveal
            as="section"
            variants={popIn}
            amount={0}
            className="mt-8 rounded-rb-card border-2 border-rb-swan bg-rb-macaw-wash p-6"
          >
            <p className="font-rb-display text-lg font-extrabold text-rb-eel">
              Welcome to {lessonItem.name.toLowerCase()}.
            </p>

            <p className="rb-body mt-3">
              This lesson covers {sections.length} section
              {sections.length === 1 ? "" : "s"}. Work through it in order — each section assumes
              the one before it
              {lessonItem.quiz ? " — and the quick check at the end asks you to apply it." : "."}
            </p>

            <p className="mt-5 font-rb-display text-sm font-extrabold uppercase tracking-wide text-rb-macaw-lip">
              In this lesson, you will cover the following:
            </p>

            <ul className="mt-3 space-y-2">
              {sections.map((section) => (
                <li key={section.key} className="flex gap-3 text-sm font-medium text-rb-eel">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rb-macaw text-white">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  {section.name}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Table of contents. Sections are also in the rail, but the rail is
              collapsible and this is where the learner is already looking. */}
          <nav
            className="mt-6 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-6"
            aria-label="Table of contents"
          >
            <p className="rb-eyebrow">table of contents</p>

            <ol className="mt-4 space-y-1">
              {sections.map((section, index) => {
                const done = readSections.has(section.key)

                return (
                  <li key={section.key}>
                    <a
                      href={`#${section.key}`}
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
                    href={`#quiz-${lessonItem.quiz.examId}`}
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
            {sections.map((section, index) => {
              const done = readSections.has(section.key)

              return (
                /* Each section rises as it is reached. `once` matters here more
                   than anywhere: re-animating body copy on the way back up
                   would make re-reading the lesson unpleasant. */
                <Reveal
                  as="section"
                  key={section.key}
                  id={section.key}
                  amount={0.05}
                  className="scroll-mt-8"
                >
                  <div className="flex items-start gap-4">
                    <ReadCheck
                      done={done}
                      label={`Mark "${section.name}" as ${done ? "unread" : "read"}`}
                      onToggle={() => onToggleSection(section.key)}
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

                  <div className="mt-4 space-y-5 sm:pl-12">
                    {section.tools.map((tool, toolIndex) => (
                      <LessonTool key={tool.id ?? toolIndex} tool={tool} />
                    ))}
                  </div>

                  {/* Trailing sentinel: scrolling past this ticks the section
                      above it. */}
                  <span aria-hidden="true" data-read-section={section.key} className="block h-px" />
                </Reveal>
              )
            })}
          </div>
        </>
      )}

      {/* The lesson's own quick check, bled to the column edges so the band
          reads as a change of activity rather than one more card in the
          reading column. */}
      {lessonItem.quiz ? (
        <div className="-mx-5 mt-14 sm:-mx-10 lg:-mx-14">
          <QuizBand quiz={lessonItem.quiz} />
        </div>
      ) : null}

      {/* End of the lesson. The tick goes green on its own when you get here —
          the sentinel below it is what the scroll check watches — and can also
          be pressed, so a learner who jumped to the end can still set it. */}
      <motion.div
        aria-live="polite"
        // A single settle when the lesson lands, so finishing registers as an
        // event rather than a colour swap you might not look up for.
        animate={lessonDone ? { scale: [1, 1.015, 1] } : { scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className={`mt-12 flex items-center gap-4 rounded-rb-card border-2 p-5 transition-colors ${
          lessonDone ? "border-rb-feather bg-rb-feather-wash" : "border-rb-swan bg-rb-polar"
        }`}
      >
        <ReadCheck
          done={lessonDone}
          pending={completing}
          size="size-11"
          label={lessonDone ? "Lesson complete" : "Mark lesson complete"}
          onToggle={onToggleLesson}
        />

        <div className="min-w-0">
          <p className="font-rb-display text-base font-extrabold text-rb-eel">
            {lessonDone
              ? "Lesson complete"
              : completing
                ? "Saving your progress…"
                : "You reached the end of this lesson"}
          </p>
          <p className="mt-0.5 text-sm font-medium text-rb-wolf">
            {lessonDone
              ? "This lesson is ticked off in your outline."
              : "Completion is saved automatically once you reach the end."}
          </p>
        </div>
      </motion.div>

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
 * A lesson's quick check, on the "test your skills" layout: a coloured band
 * with one card floating on it.
 *
 * A launcher rather than an inline question set. The quiz is a real published
 * exam and answering it means an attempt — scored, recorded, retryable — which
 * is what the attempt engine already does. Rendering our own radio buttons here
 * would produce a score the backend never sees.
 */
function QuizBand({ quiz }) {
  return (
    <section id={`quiz-${quiz.examId}`} className="scroll-mt-8 bg-rb-bee px-5 py-12 sm:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal amount={0.2}>
          <p className="font-rb-display text-2xl font-extrabold text-white">Test your skills</p>
          <p className="mt-1 text-sm font-bold text-white/80">
            {quiz.title} · {quiz.totalQuestions} questions
          </p>
        </Reveal>

        <Reveal
          variants={popIn}
          amount={0.2}
          className="mt-6 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-6 sm:p-8"
        >
          <p className="rb-body">
            {quiz.description ??
              "A short check on what this lesson covered. Answer it while the lesson is fresh — it is scored, and you can retake it."}
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              [CircleHelp, `${quiz.totalQuestions} questions`],
              [CheckCircle2, `${Math.round(Number(quiz.passingScore ?? 0))}% to pass`],
              [Clock, quiz.durationMinutes ? `${quiz.durationMinutes} minutes` : "Self-paced"],
            ].map(([Icon, label]) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-rb-card border-2 border-rb-swan bg-rb-polar p-4"
              >
                <Icon className="size-5 shrink-0 text-rb-beetle-lip" aria-hidden="true" />
                <span className="text-sm font-bold text-rb-eel">{label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex justify-center">
            <TactileButton asChild variant="macaw">
              <Link to={`/learner/assessments/${quiz.examId}`}>
                start quiz
                <ArrowRight className="size-4" />
              </Link>
            </TactileButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** The unit assessment splash: what it takes to pass, and one key. */
function AssessmentView({ exam, position, total }) {
  const passMark = Math.round(Number(exam.passingScore ?? 0))

  return (
    <div className="px-5 py-16 sm:px-10 lg:px-14">
      <Reveal
        variants={popIn}
        amount={0}
        className="mx-auto w-full max-w-6xl rounded-rb-card border-2 border-rb-swan bg-rb-snow p-8 shadow-[0_5px_0_var(--color-rb-swan)] sm:p-12"
      >
        <p className="rb-eyebrow">
          lesson {position} of {total}
        </p>

        <h1 className="rb-display rb-display-sm mt-3">assessment</h1>

        {/* The rule draws itself in — a small piece of choreography that makes
            the splash feel authored rather than printed. */}
        <motion.span
          className="mt-5 block h-1.5 rounded-full bg-rb-fox"
          initial={{ width: 0 }}
          animate={{ width: "6rem" }}
          transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        />

        <p className="rb-body-lg mt-7">
          You must score {passMark} percent or higher on this assessment to pass the module. You
          have unlimited chances. Good luck!
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            [ClipboardCheck, `${exam.totalQuestions} questions`],
            [CheckCircle2, `${passMark}% to pass`],
            [Clock, exam.durationMinutes ? `${exam.durationMinutes} minutes` : "Unlimited attempts"],
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

        <TactileButton asChild variant="fox" className="mt-9 w-fit">
          <Link to={`/learner/assessments/${exam.examId}`}>
            start quiz
            <ArrowRight className="size-4" />
          </Link>
        </TactileButton>
      </Reveal>
    </div>
  )
}

/* --------------------------------------------------------------------- page */

export default function LearnerTopicPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { certificationId, middleCategoryId } = useParams()
  const { data } = useOutletContext()
  const isXl = useIsXl()

  const [activeId, setActiveId] = useState(null)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [readSections, setReadSections] = useState(() => new Set())
  const [locallyDone, setLocallyDone] = useState(() => new Set())

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

  const curriculum = useMemo(() => {
    if (!certification) return null
    return buildCurriculum({
      certification,
      lessonById,
      exams: (examsQuery.data ?? []).filter(
        (exam) => String(exam.certificationId) === String(certificationId),
      ),
      examTypesById,
    })
  }, [certification, lessonById, examsQuery.data, certificationId, examTypesById])

  const { major, middle } = useMemo(
    () => (curriculum ? findMiddle(curriculum, middleCategoryId) : { major: null, middle: null }),
    [curriculum, middleCategoryId],
  )

  const track = useMemo(() => (middle ? buildTrack(middle) : []), [middle])

  // Land on the first unfinished lesson rather than always on lesson one.
  useEffect(() => {
    if (activeId || track.length === 0) return
    const next = track.find((item) => item.kind === "lesson" && !item.completed) ?? track[0]
    setActiveId(next.id)
  }, [track, activeId])

  const activeIndex = Math.max(
    0,
    track.findIndex((item) => item.id === activeId),
  )
  const active = track[activeIndex] ?? track[0]
  const prev = track[activeIndex - 1]
  const next = track[activeIndex + 1]

  const activeLessonId = active?.kind === "lesson" ? active.id : null

  const lessonQuery = useQuery({
    queryKey: ["learner-lesson", activeLessonId],
    queryFn: () => getLessonById(activeLessonId),
    enabled: Boolean(activeLessonId),
  })

  const sections = useMemo(
    () => readSectionsOf(lessonQuery.data?.lessonComponentStructure),
    [lessonQuery.data?.lessonComponentStructure],
  )

  const isDone = useCallback(
    (lessonId) => locallyDone.has(lessonId) || Boolean(lessonById.get(lessonId)?.completed),
    [locallyDone, lessonById],
  )

  const completeMutation = useMutation({
    mutationFn: (lessonId) =>
      markLessonComplete({
        learnerId: data?.learnerId,
        lessonId: Number(lessonId),
        completedAt: new Date().toISOString(),
      }),
    onSuccess: async (_result, lessonId) => {
      setLocallyDone((current) => new Set(current).add(lessonId))
      toast.success("Lesson completed", {
        description: "Your certification progress has been updated.",
      })
      await queryClient.invalidateQueries({ queryKey: ["learner-portal-data"] })
    },
    onError: (error) => {
      toast.error("Could not mark lesson complete", {
        description: error?.response?.data?.message ?? error?.message ?? "Please try again.",
      })
    },
  })

  // Stable identities: the lesson's scroll check is rebuilt whenever these
  // change, and a fresh closure each render would tear it down on every tick.
  const readSection = useCallback((key) => {
    setReadSections((current) => (current.has(key) ? current : new Set(current).add(key)))
  }, [])

  const toggleSection = useCallback((key) => {
    setReadSections((current) => {
      const nextSet = new Set(current)
      if (nextSet.has(key)) nextSet.delete(key)
      else nextSet.add(key)
      return nextSet
    })
  }, [])

  const alreadyDone = activeLessonId ? isDone(activeLessonId) : false
  const completing = completeMutation.isPending

  // Two entry points, deliberately different: the scroll check only ever
  // *sets* (reaching the end twice must not re-post), the button is what a
  // learner presses and is a no-op once the lesson is already recorded.
  const readLesson = useCallback(() => {
    if (!activeLessonId || alreadyDone || completing || !data?.learnerId) return
    completeMutation.mutate(activeLessonId)
  }, [activeLessonId, alreadyDone, completing, data?.learnerId, completeMutation])

  // Reset per-lesson reading state when the lesson changes.
  useEffect(() => {
    setReadSections(new Set())
  }, [activeLessonId])

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

  if (examsQuery.isLoading || examTypesQuery.isLoading || !curriculum) {
    return (
      <LearnerEmptyState
        icon={BookOpen}
        title="Loading topic"
        description="Preparing your lessons and assessments."
      />
    )
  }

  if (!middle || !major) {
    return (
      <LearnerEmptyState
        icon={BookOpen}
        title="Topic not found"
        description="This topic is not part of the certification you are enrolled in."
        action={
          <TactileButton
            variant="macaw"
            size="sm"
            onClick={() => navigate(`/learner/learning/${certificationId}`)}
          >
            Back to curriculum
          </TactileButton>
        }
      />
    )
  }

  const backTo = `/learner/learning/${certificationId}`

  if (track.length === 0) {
    return (
      <LearnerEmptyState
        icon={BookOpen}
        title="No lessons in this topic yet"
        description="Nothing has been published under this topic. Check back once content is released."
        action={
          <TactileButton variant="macaw" size="sm" onClick={() => navigate(backTo)}>
            Back to curriculum
          </TactileButton>
        }
      />
    )
  }

  const columns = outlineCollapsed
    ? tutorOpen
      ? "xl:grid-cols-[72px_minmax(0,1fr)_380px]"
      : "xl:grid-cols-[72px_minmax(0,1fr)]"
    : tutorOpen
      ? "xl:grid-cols-[320px_minmax(0,1fr)_380px]"
      : "xl:grid-cols-[320px_minmax(0,1fr)]"

  const outline = (
    <Outline
      middle={middle}
      major={major}
      track={track}
      activeId={active?.id}
      collapsed={outlineCollapsed}
      onCollapse={() => setOutlineCollapsed((value) => !value)}
      onSelect={(item) => {
        setActiveId(item.id)
        setRailOpen(false)
        window.scrollTo({ top: 0 })
      }}
      activeSections={sections}
      readSections={readSections}
      isDone={isDone}
      backTo={backTo}
    />
  )

  return (
    <div className="rebyu-ds -mx-4 -my-6 min-h-dvh bg-rb-polar sm:-mx-6 lg:-mx-8">
      <div className={`grid min-h-dvh ${columns}`}>
        {/* ---------------------------------------------------------- left */}
        <aside className="hidden min-h-0 border-r-2 border-rb-swan xl:block">
          <div className="sticky top-0 h-dvh">{outline}</div>
        </aside>

        {/* -------------------------------------------------------- centre */}
        <main className="min-w-0 bg-rb-snow">
          {/* Narrow-window header: the outline column is xl-only, so without
              this the topic you are in has no name on a laptop. */}
          <div className="flex items-center gap-3 border-b-2 border-rb-swan px-5 py-4 xl:hidden">
            <TactileButton variant="ghost" size="sm" onClick={() => setRailOpen(true)}>
              <PanelLeft className="size-4" />
              outline
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

          {/* Crossfade between a lesson and the unit assessment. Keyed on the
              item so switching rows in the rail reads as the content changing
              under a fixed frame, rather than the page reloading. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active?.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
          {active?.kind === "lesson" ? (
            <LessonView
              key={active.id}
              lessonItem={active}
              sections={sections}
              loading={lessonQuery.isLoading}
              position={activeIndex + 1}
              total={track.length}
              readSections={readSections}
              lessonDone={alreadyDone}
              completing={completing}
              onReadSection={readSection}
              onToggleSection={toggleSection}
              onReadLesson={readLesson}
              onToggleLesson={readLesson}
              onPrev={
                prev
                  ? () => {
                      setActiveId(prev.id)
                      window.scrollTo({ top: 0 })
                    }
                  : undefined
              }
              onNext={
                next
                  ? () => {
                      setActiveId(next.id)
                      window.scrollTo({ top: 0 })
                    }
                  : undefined
              }
            />
          ) : (
            <AssessmentView
              exam={active.exam}
              position={activeIndex + 1}
              total={track.length}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* --------------------------------------------------------- right */}
        {tutorOpen && isXl ? (
          <aside className="hidden min-h-0 border-l-2 border-rb-swan xl:block">
            <div className="sticky top-0 h-dvh overflow-hidden">
              <LessonAiTutor
                lessonId={activeLessonId}
                lessonName={active?.name}
                learnerName={data?.user?.firstName ?? data?.learner?.firstName ?? "Learner"}
                onClose={() => setTutorOpen(false)}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* The circle. Only shown while the column is closed — once the tutor is
          on screen a second control to open it is noise. */}
      <AnimatePresence>
        {!tutorOpen ? (
          <motion.button
            type="button"
            onClick={() => setTutorOpen(true)}
            aria-label="Open AI tutor"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 480, damping: 22 }}
            className="fixed bottom-6 right-6 z-50 grid size-16 place-items-center rounded-full bg-rb-beetle text-white shadow-[0_6px_0_var(--color-rb-beetle-lip)]"
          >
            <Sparkles className="size-7" aria-hidden="true" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Narrow windows get the outline and the tutor as sheets rather than
          columns — three columns on a laptop leaves nothing for the reading. */}
      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="left" className="w-full p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Topic outline</SheetTitle>
          {outline}
        </SheetContent>
      </Sheet>

      <Sheet open={tutorOpen && !isXl} onOpenChange={(open) => !open && setTutorOpen(false)}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetTitle className="sr-only">AI tutor</SheetTitle>
          <LessonAiTutor
            lessonId={activeLessonId}
            lessonName={active?.name}
            learnerName={data?.user?.firstName ?? data?.learner?.firstName ?? "Learner"}
            onClose={() => setTutorOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
