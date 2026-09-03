import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom"
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
  Loader2,
  PanelLeft,
  Sparkles,
  Zap,
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
import { PriorityBookmark } from "@/components/learner/priority-tag.jsx"
import { ASSESSMENT_MAX_XP, LESSON_COMPLETION_XP } from "@/lib/xp.js"
import { announceRewards, snapshotRewards } from "@/components/learner/xp-award-modal.jsx"
import { LessonTool } from "@/components/certifications/lesson-content-renderer.jsx"
import {
  getLessonById,
  getReadSections,
  markLessonComplete,
  markSectionRead,
  markSectionUnread,
  parseLessonStructure,
} from "@/services/learnerService.js"
import { getExams, getExamTypes } from "@/services/assessmentService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"
import { buildCurriculum, findMiddle } from "./curriculum-model.js"
import {
  SectionStackSkeleton,
  TopicPageSkeleton,
} from "@/components/learner/learning-skeletons.jsx"

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
  const parsed = parseLessonStructure(structure).map((section, index) => ({
    ...section,
    key: String(section.id ?? `section-${index}`),
    name: section.sectionName ?? section.name ?? `Section ${index + 1}`,
    tools: Array.isArray(section.content) ? section.content : [],
  }))

  // netacad's course intros fold "what this covers" straight into the intro
  // rather than giving Learning Objectives (and Prerequisites) a heading of
  // their own. Every generated lesson orders them adjacently starting with
  // Introduction, so merge whichever of the two follow it into one section --
  // and one read-tracking key.
  const merged = []
  for (let index = 0; index < parsed.length; index += 1) {
    const current = parsed[index]
    const name = current.name.trim().toLowerCase()

    if (name === "introduction") {
      const group = [current]
      let lookahead = index + 1

      if (parsed[lookahead]?.name.trim().toLowerCase() === "learning objectives") {
        group.push(parsed[lookahead])
        lookahead += 1
      }
      if (parsed[lookahead]?.name.trim().toLowerCase().startsWith("prerequisite")) {
        group.push(parsed[lookahead])
        lookahead += 1
      }

      if (group.length > 1) {
        merged.push({
          ...current,
          key: group.map((section) => section.key).join("+"),
          name: "Introduction & Learning Objectives",
          tools: group.flatMap((section) => section.tools),
        })
        index = lookahead - 1
        continue
      }
    }

    merged.push(current)
  }

  return merged
}

/* ------------------------------------------------------------------- outline */

const ROW_ICON = { lesson: BookOpen, assessment: ClipboardCheck }

function OutlineRow({
  item,
  mastery,
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
        {/* Reserves the width the active bar occupies, so a row does not shift
            when it becomes active. Dropped while collapsed: there it is the
            only thing left of the icon, and 4px of spacer plus the row's 4px
            gap push every icon 8px right of the rail's centre -- which is what
            made the collapsed icons look off-axis against the toggle above. */}
        {!collapsed ? <span className="w-1 shrink-0" aria-hidden="true" /> : null}
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
                className={`line-clamp-2 text-sm leading-snug ${
                  active ? "font-extrabold text-rb-macaw-lip" : "font-bold text-rb-eel"
                }`}
                title={item.name}
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

        {/* The lesson's priority, as a bookmark on the row.
            Where the words used to be: a full "🔴 Critical" pill under every
            lesson turned the rail into a column of coloured labels, each one as
            loud as the lesson name above it.

            On finished lessons too. Completion says the pages were read;
            mastery says whether they stuck, and it keeps moving -- score zero
            on the unit exam and a lesson ticked off last week is critical
            today. That is exactly when the mark is worth having, so hiding it
            on completion hid it from the learner who most needed it.

            Rides the row's right edge, outside the select button, so it is a
            mark on the row rather than another thing inside the target. */}
        {item.kind === "lesson" && item.priorityTag ? (
          <span className={collapsed ? "absolute right-0.5 top-1" : "pr-2"}>
            <PriorityBookmark
              tag={item.priorityTag}
              masteryProbability={mastery}
              size={collapsed ? 11 : 14}
            />
          </span>
        ) : null}

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
                    sectionRead ? "text-rb-feather-ink" : "text-rb-wolf"
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
  masteryByLessonId,
  activeId,
  collapsed,
  onCollapse,
  onSelect,
  activeSections,
  readSections,
  isDone,
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
      {/* RB_TOPBAR_H, shared with the lesson header in <LessonView>. The two
          sit side by side at the top of the page, so their bottom borders read
          as one continuous rule across the screen -- but only if both are
          exactly this tall. Anything that would grow this box (the progress
          readout, previously in here) belongs below it instead, otherwise the
          rule steps down over the outline and the alignment is lost the moment
          a topic title wraps.

          `justify-center` when collapsed, not `justify-between`: with the
          title gone the toggle is the only child, and `between` pins a lone
          child to the left of the rail instead of centring it in it. */}
      <div
        className={`flex h-[var(--rb-topbar-h)] shrink-0 items-center border-b-2 border-rb-swan ${
          collapsed ? "justify-center px-2" : "gap-2 px-4"
        }`}
      >
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="rb-eyebrow line-clamp-1" title={`Unit ${major.index} · ${major.name}`}>
              unit {major.index} · {major.name}
            </p>
            <p
              className="mt-0.5 line-clamp-1 font-rb-display text-base font-extrabold leading-snug text-rb-eel"
              title={middle.name}
            >
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

      {/* Moved out of the header above so that box can hold a fixed height.
          Pinned to RB_SUBBAR_H from xl up -- the width at which the outline is
          actually beside the lesson column and the two rules have to agree.
          Below xl the outline is a drawer over the page, nothing to align to,
          so it keeps its natural padding. */}
      {!collapsed ? (
        <div className="shrink-0 border-b-2 border-rb-swan px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-rb-wolf">
              {done} of {lessons.length} lessons
            </span>
            <CountUp value={progress} suffix="%" className="rb-numeric text-xs" />
          </div>
          <ProgressBar value={progress} tone="macaw" label="Topic progress" className="mt-2 !h-3" />
        </div>
      ) : null}

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
                mastery={masteryByLessonId?.get(String(item.id))}
                readSections={readSections}
                done={item.kind === "lesson" && isDone(item.id)}
              />
            )
          })}
        </StaggerList>
      </nav>
    </div>
  )
}

/* ------------------------------------------------------------------- centre */

/**
 * A section's tick. Scrolling past the end of a section ticks it; the tick is
 * also a button, because progress that can only be earned by scrolling cannot
 * be corrected by a learner who skimmed ahead and came back.
 */
function ReadCheck({ done, label, onToggle, pending, disabled = false, size = "size-8" }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={done}
      aria-label={label}
      title={label}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      // The pop only fires on the transition into done, so ticking is
      // rewarding and unticking is quiet.
      animate={done ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={
        done ? { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] } : { duration: 0.18 }
      }
      className={`grid ${size} shrink-0 place-items-center rounded-full border-2 transition-colors ${
        done
          ? "border-rb-feather bg-rb-feather text-white"
          : disabled
            ? "cursor-not-allowed border-rb-swan bg-rb-polar text-rb-hare/60"
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

/* How much *reading* a section holds. Media keys are skipped -- an S3 object
   key is a long string that represents no reading at all, and counting it made
   a section with one image look denser than three paragraphs. */
const MEDIA_KEY = /(Key|Url)$/

function textVolume(value) {
  if (typeof value === "string") return value.length
  if (Array.isArray(value)) return value.reduce((total, item) => total + textVolume(item), 0)

  if (value && typeof value === "object") {
    return Object.entries(value).reduce(
      (total, [key, item]) => (MEDIA_KEY.test(key) ? total : total + textVolume(item)),
      0,
    )
  }

  return 0
}

/**
 * Which surface a section sits on.
 *
 * Alternating, not content-derived. One section per screen means two surfaces
 * are never visible at once, so any scheme keyed on the section's *contents*
 * cannot be perceived as a scheme -- it just looks arbitrary. Worse, it clumps:
 * a run of similar sections produces a run of identical screens and the
 * background stops signalling that you moved at all. Alternating guarantees
 * every snap lands somewhere visibly different, which is the clearest
 * transition cue this layout has.
 *
 * Both alternates are light. The obvious version of this pairs white with the
 * deep blue, but that puts half a lesson's prose in reverse -- fine for a line
 * of emphasis, tiring for eight paragraphs, and body copy is where legibility
 * matters most.
 *
 * The deep blue is kept as an exception for sections short enough that
 * reversing them out is emphasis rather than endurance. It overrides whichever
 * alternate its position would otherwise have given it -- a statement should
 * look like a statement wherever it falls in the order.
 *
 * A section carrying an image or video is never a statement however little
 * text it has: the media is the content, and reversing it onto a saturated
 * panel fights it.
 */
function sectionTone(section, index) {
  const hasMedia = section.tools.some(
    (tool) =>
      tool.type === "image" || tool.type === "video" || tool.type === "image-hotspot",
  )
  const volume = section.tools.reduce((total, tool) => total + textVolume(tool.data ?? {}), 0)

  if (!hasMedia && volume < 420) return "statement"
  return index % 2 === 0 ? "plain" : "wash"
}

/* Each tone also carries the colours for the section's own furniture: the
   eyebrow above the title and the rule under it. Kept here rather than derived
   at the call site so a tone stays one decision -- adding a fourth surface
   means filling in one object, not hunting four conditionals through the JSX.

   There was a third: a huge ghost numeral in the bottom-left corner of every
   section, repeating the number the eyebrow states in words directly above the
   title. Removed -- on a section whose copy did not fill the screen it was the
   loudest thing on it, and it said nothing the eyebrow had not.

   Plain and wash share one accent. They used to differ -- Fox on plain, Macaw
   on wash -- on the reasoning that the alternation should be felt rather than
   merely present. In a portal that is Azure everywhere else, what that produced
   was an orange rule under one heading and a blue rule under the next, in the
   same lesson, with nothing about the content to explain the switch: it read as
   inconsistency, not rhythm. The alternation still runs, carried by the surface
   the section sits on, which is the part that separates them. */
const SECTION_TONE = {
  statement: {
    /* Surface only. Geometry -- the bleed, the padding, the full-screen
       height -- is shared by every section and lives on the element itself;
       a tone that also carried padding could disagree with its neighbours
       and shift the copy sideways on every snap. */
    shell: "bg-rb-humpback-lip",
    heading: "text-white",
    eyebrow: "text-white/70",
    rule: "bg-white/30",
    /* Reversing the tools out of the panel has to be done from outside them:
       LessonTool renders body copy in `text-foreground`/`text-muted-foreground`
       and knows nothing about sitting on a dark surface, and it is shared with
       the admin preview and the institution viewer, so it cannot be taught about
       this one place.
       Scoped to the tools wrapper rather than the whole section on purpose --
       `[&_h2]` from the section would also catch the section's own title, and
       the heading tool's accent panel would land a light wash behind it.
       That accent panel is the reason for the bg/border overrides: left alone
       it paints a pale block under white text. */
    content:
      "[&_h2]:text-white [&_h2]:border-white/50 [&_h2]:bg-white/10 " +
      "[&_h3]:text-white [&_p]:text-white/90 [&_li]:text-white/90 " +
      "[&_strong]:text-white [&_a]:text-white [&_a]:underline " +
      "[&_.text-muted-foreground]:text-white/85 " +
      /* List bullets and number chips carry a chart accent, which is tuned
         for a light card and goes muddy on this blue. Same reason as the
         rules above: the renderer is shared and cannot know it landed here. */
      "[&_[data-marker]]:!bg-white/25 [&_[data-marker]]:!text-white",
  },
  wash: {
    shell: "bg-rb-polar",
    heading: "text-rb-eel",
    eyebrow: "text-rb-macaw-lip",
    rule: "bg-rb-macaw",
    content: "",
  },
  /* No background of its own -- it is the page showing through, and that is
     what makes the alternation read. The old top hairline is gone with it:
     alternating surfaces already separate the sections, and a rule between
     two of them just drew a seam. */
  plain: {
    shell: "",
    heading: "text-rb-eel",
    eyebrow: "text-rb-macaw-lip",
    rule: "bg-rb-macaw",
    content: "",
  },
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
  backTo,
  takenExamIds,
  quizPending,
}) {
  const articleRef = useRef(null)
  const headerRef = useRef(null)

  /* The scroll handler below is bound once per lesson, but it has to test the
     current tick state. Through a ref rather than the prop, or the effect would
     rebind on every one of the fifteen sections as it ticks. */
  const readSectionsRef = useRef(readSections)
  readSectionsRef.current = readSections

  /* The sticky header's height, published as a custom property the sections
     below size themselves against.
     Measured rather than hardcoded: the chip row wraps to two lines on narrow
     viewports and gains a chip when a lesson has a quiz or a priority tag, so
     any constant would be right at one width and wrong at the next -- leaving
     sections either overflowing the screen or snapping their heading under the
     bar. */
  useEffect(() => {
    const header = headerRef.current
    const article = articleRef.current
    if (!header || !article) return undefined

    // offsetHeight, not the entry's contentRect: the header carries `py-4` and
    // a 2px bottom border, and the content box excludes both -- sizing against
    // it would leave every section 34px too tall.
    const observer = new ResizeObserver(() => {
      article.style.setProperty("--lesson-header-h", `${header.offsetHeight}px`)
    })

    observer.observe(header)
    return () => observer.disconnect()
  }, [])

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

      /* Reaching the end is necessary but not sufficient.
         This used to read "reaching the end means every section above it was
         passed" and back-fill all of them, which is only true of someone who
         scrolled there. A table-of-contents link, the End key, or one fast
         flick jumps the sentinel into view having passed nothing, and the
         lesson ticked all fifteen sections and completed itself unread.
         Each section now has to have crossed the line on its own. */
      const end = root.querySelector("[data-read-lesson]")
      if (!end || end.getBoundingClientRect().top >= line) return

      const read = readSectionsRef.current
      if (sections.every((section) => read.has(section.key))) {
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


  return (
    <article
      ref={articleRef}
      // Fallback until the ResizeObserver above reports the real height, so the
      // first paint is close rather than full-viewport-plus-a-header tall.
      style={{ "--lesson-header-h": "116px" }}
      className="w-full px-4 pb-10 sm:px-6 lg:px-8"
    >
      {/* RB_TOPBAR_H again -- see the note in <Outline>. This bar and the
          outline's own header are the two halves of one rule across the top of
          the page, so the height lives in a variable on the page root rather
          than being set twice and drifting. The chips that used to sit in here
          are their own bar below: a second row of content is what made this
          box a head taller than the outline beside it. */}
      <div ref={headerRef} className="sticky top-0 z-10 -mx-4 border-b-2 border-rb-swan bg-rb-snow/95 px-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur supports-[backdrop-filter]:bg-rb-snow/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex h-[var(--rb-topbar-h)] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="rb-eyebrow">
              lesson {position} of {total}
            </p>

            <h1 className="mt-0.5 truncate font-rb-display text-lg font-extrabold text-rb-eel sm:text-xl">
              {lessonItem.name}
            </h1>
          </div>

          {/* Feather, the portal's primary: this is the one key in the header,
              and Macaw is the focus/secondary blue. Two different blues on the
              same page for the same weight of action is what made the header
              look like it belonged to another screen. */}
          {backTo ? (
            <TactileButton asChild variant="feather" size="sm" className="shrink-0">
              <Link to={backTo}>
                <ArrowLeft className="size-4" />
                back to curriculum
              </Link>
            </TactileButton>
          ) : null}
        </div>
      </div>


      {/* Full width, not capped. The cap moved down onto the things inside it,
          because the section bands have to reach the column's edges while
          their copy stays at a readable measure -- a wrapper capping both
          cannot do that. */}
      <div className="w-full">
        {loading ? (
        /* Switching lessons used to drop the column to a single spinner line,
           so the page collapsed to nothing and sprang back. Same blocks as the
           topic skeleton, in the measure the sections themselves take. */
        <div
          className="mx-auto mt-10 w-full max-w-6xl px-5 sm:px-8"
          role="status"
          aria-label="Loading lesson content"
        >
          <SectionStackSkeleton />
        </div>
      ) : sections.length === 0 ? (
        <div className="mx-auto mt-10 w-full max-w-6xl">
          <LearnerEmptyState
            icon={BookOpen}
            title="No lesson content yet"
            description="This lesson exists, but no learner-facing content has been published for it."
          />
        </div>
      ) : (
        <>
          {/* Bled to the column edges with the same negative margins the
              sticky header and the quick-check band above already use, so a
              section reads as a full band of the page rather than one more
              card in the reading column.

              No `space-y`: gaps between full-bleed bands show up as strips of
              page colour cutting across the run, which is exactly the seam the
              old `divide-y` was removed for. The alternating surfaces are what
              separate sections. */}
          <div className="-mx-4 mt-6 sm:-mx-6 lg:-mx-8">
            {sections.map((section, sectionIndex) => {
              const tone = SECTION_TONE[sectionTone(section, sectionIndex)]

              return (
                /* Each section rises as it is reached. `once` matters here more
                   than anywhere: re-animating body copy on the way back up
                   would make re-reading the lesson unpleasant. */
                <Reveal
                  as="section"
                  key={section.key}
                  id={section.key}
                  amount={0.05}
                  /* One section per screen, snapping into place, its content
                     centred in the screen it occupies.
                     `min-h` is measured against the space *below* the sticky
                     lesson header, not the whole viewport, so a section fills
                     the screen exactly instead of overflowing it by the height
                     of the bar sitting on top of it. The scroll margin matches
                     that offset: scroll margin is what the snap position is
                     measured from, so without it a snapped heading lands
                     underneath the header. */
                  className={`relative flex min-h-[calc(100dvh-var(--lesson-header-h))] snap-start scroll-mt-[var(--lesson-header-h)] flex-col justify-center overflow-hidden px-4 py-14 sm:px-6 lg:px-8 ${tone.shell}`}
                >
                  {/* The band runs edge to edge; its copy does not. */}
                  <div className="relative mx-auto w-full max-w-6xl">
                    <p
                      className={`text-[11px] font-bold uppercase tracking-[0.16em] ${tone.eyebrow}`}
                    >
                      section {sectionIndex + 1} of {sections.length}
                    </p>

                    <h2 className={`mt-2 font-rb-display text-3xl font-extrabold ${tone.heading}`}>
                      {section.name}
                    </h2>

                    {/* A short rule rather than a full-width one: it reads as a
                        mark under the title, not as a divider cutting the
                        screen in half. */}
                    <span
                      aria-hidden="true"
                      className={`mt-4 block h-1.5 w-14 rounded-full ${tone.rule}`}
                    />
                  </div>

                  <div className={`relative mx-auto mt-6 w-full max-w-6xl space-y-6 ${tone.content}`}>
                    {section.tools.map((tool, toolIndex) => (
                      <div key={tool.id ?? toolIndex}>
                        <LessonTool tool={tool} index={toolIndex} />
                      </div>
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
      </div>

      {/* The lesson's own quick check, bled to the column edges so the band
          reads as a change of activity rather than one more card in the
          reading column. */}
      {lessonItem.quiz ? (
        <div className="-mx-4 mt-10 sm:-mx-6 lg:-mx-8">
          <QuizBand
            quiz={lessonItem.quiz}
            taken={Boolean(takenExamIds?.has(String(lessonItem.quiz.examId)))}
          />
        </div>
      ) : null}

      {/* End of the lesson. The tick goes green on its own when you get here —
          the sentinel below it is what the scroll check watches — and can also
          be pressed, so a learner who jumped to the end can still set it. */}
      <div className="mx-auto w-full max-w-6xl">
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
          disabled={!lessonDone && quizPending}
          size="size-11"
          label={
            lessonDone
              ? "Lesson complete"
              : quizPending
                ? "Sit the quick check to complete this lesson"
                : "Mark lesson complete"
          }
          onToggle={onToggleLesson}
        />

        {/* The card names what is actually outstanding. It used to announce
            "You reached the end of this lesson" over a quick check that had
            never been opened, which is how a lesson came to read as complete
            with its quiz untouched. */}
        <div className="min-w-0">
          <p className="font-rb-display text-base font-extrabold text-rb-eel">
            {lessonDone
              ? "Lesson complete"
              : completing
                ? "Saving your progress…"
                : quizPending
                  ? "One thing left: the quick check"
                  : "You reached the end of this lesson"}
          </p>
          <p className="mt-0.5 text-sm font-medium text-rb-wolf">
            {lessonDone
              ? "This lesson is ticked off in your outline."
              : quizPending
                ? `Sit the quick check above to finish this lesson and earn its ${LESSON_COMPLETION_XP} XP.`
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
function QuizBand({ quiz, taken }) {
  return (
    <section id={`quiz-${quiz.examId}`} className="scroll-mt-8 bg-rb-bee px-5 py-12 sm:px-10 lg:px-14">
      <div className="w-full">
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

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [CircleHelp, `${quiz.totalQuestions} questions`],
              [CheckCircle2, `${Math.round(Number(quiz.passingScore ?? 0))}% to pass`],
              [Clock, quiz.durationMinutes ? `${quiz.durationMinutes} minutes` : "Self-paced"],
              [Zap, `up to ${ASSESSMENT_MAX_XP} XP`],
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

          {/* "start" is a lie once there is an attempt behind it, and the
              learner is the one person who knows it -- they sat this quiz and
              the page offered to start it as though nothing had happened.

              The history link appears only alongside a retake: with no attempts
              yet it would lead to an empty page, and offering it would suggest
              there was something to see. */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <TactileButton asChild variant="macaw">
              <Link to={`/learner/assessments/${quiz.examId}`}>
                {taken ? "retake quiz" : "start quiz"}
                <ArrowRight className="size-4" />
              </Link>
            </TactileButton>

            {taken ? (
              <Link
                to={`/learner/assessments/${quiz.examId}/history`}
                className="text-sm font-bold text-rb-macaw-lip underline decoration-dotted underline-offset-4 hover:text-rb-macaw"
              >
                view past attempts
              </Link>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** The unit assessment splash: what it takes to pass, and one key. */
function AssessmentView({ exam, position, total, backTo, taken }) {
  const passMark = Math.round(Number(exam.passingScore ?? 0))

  return (
    <div className="w-full pb-10">
      {/* Same sticky frame the lesson view wears, so stepping from the last
          lesson onto the assessment does not drop the title and the way out. */}
      <div className="sticky top-0 z-10 border-b-2 border-rb-swan bg-rb-snow/95 px-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur supports-[backdrop-filter]:bg-rb-snow/80 sm:px-10 lg:px-14">
        <div className="flex h-[var(--rb-topbar-h)] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="rb-eyebrow">
              lesson {position} of {total}
            </p>

            <h1 className="mt-0.5 truncate font-rb-display text-lg font-extrabold text-rb-eel sm:text-xl">
              {exam.title}
            </h1>
          </div>

          {/* Feather, the portal's primary: this is the one key in the header,
              and Macaw is the focus/secondary blue. Two different blues on the
              same page for the same weight of action is what made the header
              look like it belonged to another screen. */}
          {backTo ? (
            <TactileButton asChild variant="feather" size="sm" className="shrink-0">
              <Link to={backTo}>
                <ArrowLeft className="size-4" />
                back to curriculum
              </Link>
            </TactileButton>
          ) : null}
        </div>

      </div>


      <div className="px-5 py-16 sm:px-10 lg:px-14">
      <Reveal
        variants={popIn}
        amount={0}
        className="mx-auto w-full max-w-6xl rounded-rb-card border-2 border-rb-swan bg-rb-snow p-8 shadow-[0_5px_0_var(--color-rb-swan)] sm:p-12"
      >
        <p className="rb-display rb-display-sm">assessment</p>

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

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <TactileButton asChild variant="fox" className="w-fit">
            <Link to={`/learner/assessments/${exam.examId}`}>
              {taken ? "retake exam" : "start exam"}
              <ArrowRight className="size-4" />
            </Link>
          </TactileButton>

          {taken ? (
            <Link
              to={`/learner/assessments/${exam.examId}/history`}
              className="text-sm font-bold text-rb-fox-lip underline decoration-dotted underline-offset-4 hover:text-rb-fox"
            >
              view past attempts
            </Link>
          ) : null}
        </div>
      </Reveal>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- page */

/* One grey block, one pulse, everywhere on this page. Two loading states drawn
   at two different rhythms read as two different things happening. */
export default function LearnerTopicPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { certificationId, middleCategoryId } = useParams()
  const { data } = useOutletContext()
  const isXl = useIsXl()

  const [searchParams] = useSearchParams()
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

  /* Which exams this learner has already sat -- one entry per exam, however
     many attempts are behind it. Read off `examResults` exactly as the
     curriculum page does, so the two screens cannot disagree about whether
     something has been taken. "Taken", note, not "passed": a failed attempt
     still means the launcher must offer a retake rather than a first go. */
  const takenExamIds = useMemo(
    () =>
      new Set(
        (data?.examResults ?? [])
          .map((result) => (result.examId == null ? null : String(result.examId)))
          .filter(Boolean),
      ),
    [data?.examResults],
  )

  // Same per-lesson priority tags the curriculum page shows -- fetched here
  // too so the rail (which is entered directly, not only by drilling in from
  // the curriculum page) can show them on each lesson as well.
  const masteryQuery = useQuery({
    queryKey: ["learner-progress-analytics", certificationId],
    queryFn: () => getProgressAnalytics(certificationId),
    enabled: Boolean(certificationId),
    staleTime: 30_000,
  })

  const lessonPriorityById = useMemo(() => {
    const map = new Map()
    for (const topic of masteryQuery.data?.lessonPriorities ?? []) {
      if (topic.lessonId != null) map.set(String(topic.lessonId), topic.priorityTag)
    }
    return map
  }, [masteryQuery.data])

  /* Mastery kept beside the tag rather than folded into it: the tag is what the
     bookmark is coloured by, the probability is what its tooltip says when a
     learner wants the number behind the colour. `buildCurriculum` only carries
     tags, so this stays a lookup of its own. */
  const lessonMasteryById = useMemo(() => {
    const map = new Map()
    for (const topic of masteryQuery.data?.lessonPriorities ?? []) {
      if (topic.lessonId != null && topic.masteryProbability != null) {
        map.set(String(topic.lessonId), topic.masteryProbability)
      }
    }
    return map
  }, [masteryQuery.data])

  const curriculum = useMemo(() => {
    if (!certification) return null
    return buildCurriculum({
      certification,
      lessonById,
      exams: (examsQuery.data ?? []).filter(
        (exam) => String(exam.certificationId) === String(certificationId),
      ),
      examTypesById,
      lessonPriorityById,
    })
  }, [certification, lessonById, examsQuery.data, certificationId, examTypesById, lessonPriorityById])

  const { major, middle } = useMemo(
    () => (curriculum ? findMiddle(curriculum, middleCategoryId) : { major: null, middle: null }),
    [curriculum, middleCategoryId],
  )

  const track = useMemo(() => (middle ? buildTrack(middle) : []), [middle])

  /* Land on the first unfinished lesson rather than always on lesson one —
     unless `?lesson=` names one, which is how links that recommend a specific
     lesson (the analytics board's "study now") open the thing they named. A
     recommendation is for one lesson in particular, and without this the page
     would quietly open a different one whenever an earlier lesson in the same
     topic was still unfinished.

     The requested lesson is honoured only if it is actually in this topic's
     track; a stale or hand-edited id falls through to the usual behaviour
     rather than leaving the page with nothing selected. */
  useEffect(() => {
    if (activeId || track.length === 0) return

    const requestedLessonId = searchParams.get("lesson")
    const requested = requestedLessonId
      ? track.find(
          (item) => item.kind === "lesson" && String(item.id) === String(requestedLessonId),
        )
      : null

    const next =
      requested ??
      track.find((item) => item.kind === "lesson" && !item.completed) ??
      track[0]

    setActiveId(next.id)
  }, [track, activeId, searchParams])

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

  const readSectionsQuery = useQuery({
    queryKey: ["learner-read-sections", activeLessonId],
    queryFn: () => getReadSections(activeLessonId),
    enabled: Boolean(activeLessonId) && Boolean(data?.learnerId),
  })

  // Keys already confirmed saved on the server for the active lesson, so the
  // scroll check (which fires on every scroll frame) doesn't re-POST a
  // section that is already marked read.
  const persistedReadRef = useRef(new Set())

  const isDone = useCallback(
    (lessonId) => locallyDone.has(lessonId) || Boolean(lessonById.get(lessonId)?.completed),
    [locallyDone, lessonById],
  )

  const completeMutation = useMutation({
    mutationFn: (lessonId) =>
      markLessonComplete({
        learnerId: data?.learnerId,
        lessonId: Number(lessonId),
        // The backend's `completedAt` is a LocalDateTime and rejects an ISO
        // string with a trailing `Z` (offset) — see markSectionRead below,
        // which never had this bug because it doesn't send a timestamp.
        completedAt: new Date().toISOString().slice(0, 19),
      }),
    // Before the request: the announcement diffs the portal payload, and this
    // completion is what moves it.
    onMutate: () => snapshotRewards(queryClient),
    onSuccess: async (_result, lessonId, before) => {
      setLocallyDone((current) => new Set(current).add(lessonId))
      await announceRewards({
        queryClient,
        before,
        title: "Lesson complete",
        fallback: "You had already earned the XP for this lesson.",
      })
      await queryClient.invalidateQueries({ queryKey: ["learner-streak"] })
    },
    onError: (error) => {
      toast.error("Could not mark lesson complete", {
        description: error?.response?.data?.message ?? error?.message ?? "Please try again.",
      })
    },
  })

  // Stable identities: the lesson's scroll check is rebuilt whenever these
  // change, and a fresh closure each render would tear it down on every tick.
  const readSection = useCallback(
    (key) => {
      setReadSections((current) => (current.has(key) ? current : new Set(current).add(key)))

      if (!activeLessonId || persistedReadRef.current.has(key)) return
      persistedReadRef.current.add(key)
      markSectionRead(activeLessonId, key).catch(() => {
        persistedReadRef.current.delete(key)
      })
    },
    [activeLessonId],
  )

  const toggleSection = useCallback(
    (key) => {
      const willBeRead = !readSections.has(key)

      setReadSections((current) => {
        const nextSet = new Set(current)
        if (nextSet.has(key)) nextSet.delete(key)
        else nextSet.add(key)
        return nextSet
      })

      if (!activeLessonId) return

      if (willBeRead) {
        persistedReadRef.current.add(key)
        markSectionRead(activeLessonId, key).catch(() => {
          persistedReadRef.current.delete(key)
        })
      } else {
        persistedReadRef.current.delete(key)
        markSectionUnread(activeLessonId, key).catch(() => {
          persistedReadRef.current.add(key)
        })
      }
    },
    [activeLessonId, readSections],
  )

  /* The snap container has to be the element that actually scrolls, and on this
     page that is the document -- the sidebars are `sticky`, the centre column
     is not its own scrollport. So the property goes on <html>, scoped to this
     page's lifetime rather than living in the stylesheet where it would snap
     every other page too.

     `proximity`, not `mandatory`: a section longer than the screen still has to
     be scrollable to its end, and mandatory snapping fights a learner trying to
     read the bottom of one by yanking them to the next. */
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollSnapType
    root.style.scrollSnapType = "y proximity"

    return () => {
      root.style.scrollSnapType = previous
    }
  }, [])

  const alreadyDone = activeLessonId ? isDone(activeLessonId) : false
  const completing = completeMutation.isPending

  /* A lesson that carries a quick check is not finished until that check has
     been sat.
     The sentinel that completes a lesson sits *below* the quiz band, so
     scrolling to the bottom of the page proved only that the learner had
     scrolled past the quiz -- and the lesson completed, paid out its XP, and
     ticked itself in the outline with the five questions never opened.
     "Taken", not "passed", deliberately: a failed attempt is still an attempt,
     and the retake lives on the same launcher. Matching `takenExamIds`, which
     the curriculum page reads the same way, so the two screens cannot disagree
     about whether something has been sat. */
  const activeQuiz = active?.kind === "lesson" ? active.quiz : null
  const quizPending = Boolean(activeQuiz) && !takenExamIds.has(String(activeQuiz.examId))

  // Two entry points, deliberately different: the scroll check only ever
  // *sets* (reaching the end twice must not re-post), the button is what a
  // learner presses and is a no-op once the lesson is already recorded.
  // Both are gated on the quick check, so neither route can complete around it.
  const readLesson = useCallback(() => {
    if (!activeLessonId || alreadyDone || completing || quizPending || !data?.learnerId) return
    completeMutation.mutate(activeLessonId)
  }, [activeLessonId, alreadyDone, completing, quizPending, data?.learnerId, completeMutation])

  // Seed per-lesson reading state from the server once it loads, so refreshing
  // the page (or coming back to a lesson) restores the ticks instead of
  // starting empty. Resets immediately on lesson change so the previous
  // lesson's ticks don't flash under the new one while the fetch is in flight.
  useEffect(() => {
    const saved = new Set(readSectionsQuery.data ?? [])
    persistedReadRef.current = saved
    setReadSections(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId, readSectionsQuery.data])

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
    return <TopicPageSkeleton />
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

  /* The tutor is a lesson companion: it answers from the lesson's own
     material. On the unit assessment there is no material to answer from and
     no help to be had mid-exam, so it is not offered at all -- not the panel,
     not the sheet, not the floating opener. `tutorOpen` is left alone so the
     panel comes back on its own when the learner steps onto a lesson again. */
  const tutorVisible = tutorOpen && active?.kind === "lesson"

  const columns = outlineCollapsed
    ? tutorVisible
      ? "xl:grid-cols-[88px_minmax(0,1fr)_400px]"
      : "xl:grid-cols-[88px_minmax(0,1fr)]"
    : tutorVisible
      ? "xl:grid-cols-[340px_minmax(0,1fr)_400px]"
      : "xl:grid-cols-[340px_minmax(0,1fr)]"

  const outline = (
    <Outline
      middle={middle}
      major={major}
      track={track}
      masteryByLessonId={lessonMasteryById}
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
    />
  )

  return (
    // `--rb-topbar-h` is the height of BOTH top bars -- the outline's header
    // and the lesson header in the column beside it. Declared once here, on
    // the ancestor of both, so the rule they draw across the top of the page
    // stays one unbroken line instead of two that have to be kept in sync by
    // hand.
    <div className="rebyu-ds min-h-dvh w-full bg-rb-polar" style={{ "--rb-topbar-h": "72px" }}>
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
              takenExamIds={takenExamIds}
              quizPending={quizPending}
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
              backTo={backTo}
            />
          ) : (
            <AssessmentView
              exam={active.exam}
              position={activeIndex + 1}
              total={track.length}
              backTo={backTo}
              taken={Boolean(takenExamIds.has(String(active.exam.examId)))}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* --------------------------------------------------------- right */}
        {tutorVisible && isXl ? (
          <aside className="hidden min-h-0 border-l-2 border-rb-swan xl:block">
            <div className="sticky top-0 h-dvh overflow-hidden">
              <LessonAiTutor
                lessonId={activeLessonId}
                lessonName={active?.name}
                learnerName={data?.user?.firstName ?? data?.learner?.firstName ?? "Learner"}
                learnerId={data?.learnerId}
                onClose={() => setTutorOpen(false)}
              />
            </div>
          </aside>
        ) : null}
      </div>

      {/* The circle, portaled straight to <body>. Hidden while the tutor
          column is open (no second control to open it needed) and while the
          mobile outline Sheet is open (it would otherwise render on top of
          that Sheet's overlay, poking through a modal that is supposed to be
          covering the page).

          Portaled rather than rendered inline: every route is wrapped by
          `RouteTransition` in App.jsx (the `.rb-route-enter` class), whose
          entrance keyframe applies a real `transform` for the run of that
          animation. Any non-`none` transform on an ancestor creates a new
          containing block *and* stacking context for `position: fixed`
          descendants — this button stops being fixed to the viewport and its
          z-index stops being comparable to page-level UI (like the Sheets
          below, which Radix portals straight to `<body>`) for as long as
          that ancestor's transform is live. Rendering here via
          `createPortal` sidesteps that entirely by never being a descendant
          of `.rb-route-enter` in the first place, so it stays fixed to the
          real viewport and stacks by z-index alone against Radix's own
          body-level portals.

          `z-[60]`, one step above the Sheets' `z-50`, covers the moment
          right after either Sheet closes: Radix keeps a closed Sheet's
          portal (overlay + content) mounted with `pointer-events: auto`
          until its own CSS exit animation fires `animationend`, which is not
          instant. At equal z-index the Sheet's portal would win that
          stacking tie and silently swallow clicks on this button right after
          closing it (or picking a lesson from the mobile outline).
          Outranking it here keeps the button clickable regardless. */}
      {createPortal(
        <AnimatePresence>
          {!tutorVisible && !railOpen && active?.kind === "lesson" ? (
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
              className="fixed bottom-6 right-6 z-[60] grid size-16 place-items-center rounded-full bg-rb-beetle text-white shadow-[0_6px_0_var(--color-rb-beetle-lip)]"
            >
              <Sparkles className="size-7" aria-hidden="true" />
            </motion.button>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}

      {/* Narrow windows get the outline and the tutor as sheets rather than
          columns — three columns on a laptop leaves nothing for the reading. */}
      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent side="left" className="rebyu-ds p-0">
          <SheetTitle className="sr-only">Topic outline</SheetTitle>
          {outline}
        </SheetContent>
      </Sheet>

      <Sheet open={tutorVisible && !isXl} onOpenChange={(open) => !open && setTutorOpen(false)}>
        <SheetContent side="right" className="rebyu-ds gap-0 p-0">
          <SheetTitle className="sr-only">AI tutor</SheetTitle>
          <LessonAiTutor
            lessonId={activeLessonId}
            lessonName={active?.name}
            learnerName={data?.user?.firstName ?? data?.learner?.firstName ?? "Learner"}
            learnerId={data?.learnerId}
            onClose={() => setTutorOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
