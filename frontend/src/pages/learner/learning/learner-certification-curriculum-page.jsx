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
import { useStudyPlanGate } from "@/components/learner/use-study-plan-gate.jsx"
import { PRIORITY_CONFIG } from "@/components/learner/priority-tag.jsx"
import { ASSESSMENT_MAX_XP } from "@/lib/xp.js"
import {
  certificationProgressPercent,
  findCertificationProgress,
} from "@/lib/certification-progress.js"
import { getExams, getExamTypes } from "@/services/assessmentService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"
import { STUDY_PLAN_QUERY_KEY, getActiveStudyPlan } from "@/services/studyPlanService.js"
import { buildCurriculum, hasSatDiagnostic } from "./curriculum-model.js"

/**
 * The curriculum a learner lands on after opening an enrolled certification.
 *
 * A road, not a table of contents.
 *
 * This was a stack of unit bands, each opening an accordion of topics, each
 * opening a list of lessons -- three levels of disclosure between arriving and
 * pressing the thing you came to press, and no answer at all to "where was I?"
 * without opening them. The curriculum is a sequence, so it is drawn as one:
 * every topic and exam is a stop on a dotted trail that swings down the page,
 * a sticky banner names the unit whose stretch you are in, and the first
 * unfinished stop carries a start bubble.
 *
 * A stop is a single target with a single action -- a topic opens the topic
 * surface, an exam opens the attempt. The lessons and quizzes inside a topic
 * are not repeated here: the topic page is where they live, and listing them
 * twice is what made this page a directory in the first place.
 *
 * Ordering is not gating. Once the diagnostic is sat every stop is open, just
 * as every unit card was; the road states the order of study without enforcing
 * it. Before the diagnostic every stop is locked, shakes when pressed, and
 * opens the dialog that explains why.
 */

const TONE = {
  macaw: {
    face: "bg-rb-macaw",
    lipVar: "var(--color-rb-macaw-lip)",
    wash: "bg-rb-macaw-wash",
    chip: "bg-rb-macaw-wash text-rb-macaw-lip",
    ink: "text-rb-macaw-lip",
    btn: "macaw",
    bar: "macaw",
  },
  bee: {
    face: "bg-rb-bee",
    lipVar: "var(--color-rb-bee-lip)",
    wash: "bg-rb-bee-wash",
    chip: "bg-rb-bee-wash text-rb-bee-ink",
    ink: "text-rb-bee-ink",
    btn: "fox",
    bar: "bee",
  },
  beetle: {
    face: "bg-rb-beetle",
    lipVar: "var(--color-rb-beetle-lip)",
    wash: "bg-rb-beetle-wash",
    chip: "bg-rb-beetle-wash text-rb-beetle-lip",
    ink: "text-rb-beetle-lip",
    btn: "beetle",
    bar: "beetle",
  },
  cardinal: {
    face: "bg-rb-cardinal",
    lipVar: "var(--color-rb-cardinal-lip)",
    wash: "bg-rb-cardinal-wash",
    chip: "bg-rb-cardinal-wash text-rb-cardinal-lip",
    ink: "text-rb-cardinal-lip",
    btn: "cardinal",
    bar: "mask",
  },
  feather: {
    face: "bg-rb-feather",
    lipVar: "var(--color-rb-feather-lip)",
    wash: "bg-rb-feather-wash",
    chip: "bg-rb-feather-wash text-rb-feather-ink",
    ink: "text-rb-feather-ink",
    btn: "feather",
    bar: "feather",
  },
  fox: {
    face: "bg-rb-fox",
    lipVar: "var(--color-rb-fox-lip)",
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

/* ---------------------------------------------------------------- the path */

/**
 * The trail's geometry.
 *
 * Fixed numbers rather than a fluid column: the nodes are a fixed size, so a
 * column that stretched with the viewport would stretch the curve between them
 * and the road would wander differently on every screen. A fixed-width column,
 * centred, is also what makes the swing read as a road at all -- the eye needs
 * the same amplitude every time it comes back around.
 */
const PATH_WIDTH = 440
/* Tall enough for the worst case under a node: a two-line topic name, its
   counts, and (on an exam) the XP pill -- all of which hang below the node into
   the row's lower half. Tighter than this and a long name reached the next
   node. */
const PATH_ROW = 208
const NODE_SIZE = 116

/* One period of the swing. Out, further out, back to centre, and the mirror of
   that on the other side -- eight steps, so a unit of any length keeps moving
   instead of settling into a zigzag of two positions. Scaled with the node: the
   swing has to clear a node's own width or the road stops looking like it
   goes anywhere. */
const PATH_OFFSETS = [0, 66, 104, 66, 0, -66, -104, -66]

function offsetAt(index) {
  return PATH_OFFSETS[index % PATH_OFFSETS.length]
}

/**
 * The dotted road behind the nodes.
 *
 * Drawn from the same offsets the nodes are placed with, so the two can never
 * disagree: each segment is a vertical-tangent cubic, which is what gives the
 * road its S-bends rather than the corners a polyline would put between them.
 * Round caps on a mostly-gap dash array turn the stroke into a line of dots.
 */
function PathTrail({ count }) {
  if (count < 2) return null

  const points = Array.from({ length: count }, (_, index) => [
    PATH_WIDTH / 2 + offsetAt(index),
    PATH_ROW * index + PATH_ROW / 2,
  ])

  const d = points
    .map(([x, y], index) => {
      if (index === 0) return `M ${x} ${y}`
      const [px, py] = points[index - 1]
      const midY = (py + y) / 2
      return `C ${px} ${midY}, ${x} ${midY}, ${x} ${y}`
    })
    .join(" ")

  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
      width={PATH_WIDTH}
      height={PATH_ROW * count}
      aria-hidden="true"
    >
      {/* Swan is the border grey and disappeared against the page at this
          size; mixed with Hare it reads as a road without competing with the
          nodes standing on it. */}
      <path
        d={d}
        fill="none"
        stroke="color-mix(in oklab, var(--color-rb-hare) 45%, var(--color-rb-swan))"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray="0.1 30"
      />
    </svg>
  )
}

/**
 * "start" over the node the learner is on.
 *
 * The one node out of a whole certification that answers "where was I?", so it
 * is the only one that gets a label of its own. It hops rather than pulses:
 * a pulse is what every other alert on this page does, and the point is that
 * this one is an invitation.
 */
function StartBubble({ tone, side }) {
  const right = side === "right"

  return (
    <motion.span
      className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 ${
        right ? "left-full ml-3" : "right-full mr-3"
      }`}
      animate={{ x: right ? [0, 4, 0] : [0, -4, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    >
      <span
        className={`block whitespace-nowrap rounded-rb-pill border-2 border-rb-swan bg-rb-snow px-4 py-2 font-rb-display text-sm font-extrabold uppercase tracking-wide shadow-[0_4px_0_var(--color-rb-swan)] ${tone.ink}`}
      >
        start
      </span>

      {/* The tail, pointing back at the node. Two stacked triangles so the
          bubble's border reads through it. */}
      <span
        className={`absolute top-1/2 size-0 -translate-y-1/2 border-y-8 border-y-transparent ${
          right
            ? "right-full border-r-8 border-r-rb-swan"
            : "left-full border-l-8 border-l-rb-swan"
        }`}
      />
      <span
        className={`absolute top-1/2 size-0 -translate-y-1/2 border-y-[6px] border-y-transparent ${
          right
            ? "right-full border-r-[6px] border-r-rb-snow"
            : "left-full border-l-[6px] border-l-rb-snow"
        }`}
      />
    </motion.span>
  )
}

/** How far through a topic the learner is, as a ring around its node. */
function NodeRing({ value }) {
  const pct = Math.max(0, Math.min(100, value))
  const radius = NODE_SIZE / 2 - 3
  const circumference = 2 * Math.PI * radius

  return (
    <svg
      className="pointer-events-none absolute -inset-[6px] -rotate-90"
      viewBox={`0 0 ${NODE_SIZE + 12} ${NODE_SIZE + 12}`}
      aria-hidden="true"
    >
      <circle
        cx={(NODE_SIZE + 12) / 2}
        cy={(NODE_SIZE + 12) / 2}
        r={radius}
        fill="none"
        stroke="var(--color-rb-swan)"
        strokeWidth="7"
      />
      <motion.circle
        cx={(NODE_SIZE + 12) / 2}
        cy={(NODE_SIZE + 12) / 2}
        r={radius}
        fill="none"
        stroke="var(--color-rb-bee)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (circumference * pct) / 100 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

/**
 * One stop on the road: a topic, a unit exam, or the final mock.
 *
 * Four states, and the difference between them is carried by the face rather
 * than by a badge: done is the unit's colour with a check, current is the
 * unit's colour under a "start" bubble, open is a white key with the colour on
 * its rim, locked is grey. A learner scanning the column should be able to see
 * where they stopped without reading a word.
 *
 * The key physics are the design system's: 2px rim, a solid lip under the face,
 * and the whole thing travelling down onto the lip when pressed.
 */
function PathNode({ node, index, onSelect, onLocked }) {
  const shake = useAnimationControls()
  const tone = TONE[node.tone]
  const Icon = node.icon
  const { state } = node

  const locked = state === "locked"
  const done = state === "done"
  const current = state === "current"

  function press() {
    if (locked) {
      // The dialog explains the lock, but it opens elsewhere on screen. The
      // shake answers where the finger already is.
      shake.start({ x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.45 } })
      onLocked()
      return
    }
    onSelect(node)
  }

  /* The lip travels with the face, so it is one variable rather than a class
     per state: pressing a node has to sink it onto its own lip, and a fixed
     `active:` shadow would have every node sink onto a grey one. */
  const filled = done || current
  const face = locked
    ? "border-rb-swan bg-rb-polar text-rb-hare"
    : filled
      ? `border-black/10 text-white ${tone.face}`
      : `border-rb-swan bg-rb-snow ${tone.ink}`
  const lip = filled && !locked ? tone.lipVar : "var(--color-rb-swan)"

  return (
    <div className="relative" style={{ height: PATH_ROW }}>
      {/* Sized to the node and nothing else. The label hangs off it absolutely
          rather than sitting under it in flow: in flow the *column* is what
          gets centred on the row, so a long topic name pushed the node up off
          the trail the dots are drawn along -- and by a different amount for
          every node, depending on how long its name was.

          Both axes in one inline transform rather than mixing a utility with
          it: an inline `transform` replaces the class's outright, so a
          `-translate-y-1/2` here would simply be dropped. */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: NODE_SIZE,
          height: NODE_SIZE,
          transform: `translate(calc(-50% + ${offsetAt(index)}px), -50%)`,
        }}
      >
        <motion.div animate={shake} className="relative">
          {/* Beside the node, on whichever side has room -- a node sitting
              left of centre gets its bubble on the right, and vice versa.
              Above the node (where Duolingo puts it) it landed straight on the
              previous stop's name, because the labels here hang below their
              nodes and the two met in the gap. */}
          {current ? <StartBubble tone={tone} side={offsetAt(index) <= 0 ? "right" : "left"} /> : null}

          {/* Only where it says something: a topic part-way through. A ring at
              0% or 100% is the state the face already carries. */}
          {node.progress != null && node.progress > 0 && node.progress < 100 ? (
            <NodeRing value={node.progress} />
          ) : null}

          {/* The one node that has to be found before anything else can happen
              gets a halo. Never on a locked board -- a beacon on something that
              will not open is just irritating. */}
          {current ? (
            <motion.span
              className={`pointer-events-none absolute -inset-3 rounded-full ${tone.face} opacity-25`}
              animate={{ scale: [1, 1.16, 1], opacity: [0.28, 0, 0.28] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />
          ) : null}

          <button
            type="button"
            onClick={press}
            aria-label={`${node.label}${locked ? " (locked)" : ""}`}
            className={`relative grid place-items-center rounded-full border-[3px] shadow-[0_9px_0_var(--node-lip)] transition-[transform,box-shadow] duration-100 active:translate-y-[5px] active:shadow-[0_4px_0_var(--node-lip)] ${face}`}
            style={{ width: NODE_SIZE, height: NODE_SIZE, "--node-lip": lip }}
          >
            {locked ? (
              <Lock className="size-10" aria-hidden="true" />
            ) : done ? (
              <Check className="size-12" aria-hidden="true" />
            ) : (
              <Icon className="size-11" aria-hidden="true" />
            )}

            {/* A topic the plan says is urgent -- finished or not. The
                same red dot the old list used, kept because it is the one
                thing on a node that priority order has to be able to say. */}
            {node.urgent && !locked ? (
              <motion.span
                className="absolute -right-1 -top-1 size-5 rounded-full bg-rb-cardinal ring-4 ring-rb-polar"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden="true"
              />
            ) : null}
          </button>
        </motion.div>

        {/* The name under the node, not on it. Duolingo can leave its nodes
            unlabelled because every one of them is the same kind of thing;
            here a stop can be a topic, a unit exam or the final, and which one
            it is decides whether the learner has ten minutes or an hour.

            `pointer-events-none` so a two-line name never covers the node
            below it as a click target -- the node is the control, the label
            only says what it is. */}
        <div className="pointer-events-none absolute left-1/2 top-full w-[230px] -translate-x-1/2 pt-2.5 text-center">
          <p className="font-rb-display text-[15px] font-extrabold leading-tight text-rb-eel">
            {node.label}
          </p>

          {node.meta ? (
            <p className="mt-1 text-[12px] font-bold text-rb-wolf">{node.meta}</p>
          ) : null}

          {/* Only on the exams. A topic pays per lesson, which is a number that
              belongs on the lessons themselves; an exam is one sitting for one
              award, so the road can state it. */}
          {node.xp && !locked ? (
            <span className="mt-1 inline-flex">
              <XpPill amount={node.xp} earned={done} upTo />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * The banner that opens a unit's stretch of road -- and the control that opens
 * the unit itself.
 *
 * A certification with six units is six roads, and all of them unrolled at once
 * is a page you scroll for a minute to reach unit four. So the banner is the
 * accordion header: pressed, it reveals that unit's topics. The unit the
 * learner is up to is the one open when the page arrives, which is the only
 * one they asked for.
 *
 * Sticky while its section is open, the way a section header is on Duolingo:
 * once the road is longer than the viewport the learner loses which unit the
 * nodes belong to about four stops in. The offset clears the two sticky things
 * above it -- the portal nav (`top-0`, 4rem) and this page's header bar.
 *
 * The unit's colour lives here rather than on a card behind every node: one
 * saturated band per section, with the road on the page's own ground. That is
 * what stops a certification with six units reading as six posters.
 */
function UnitBanner({ major, locked, exam, open, onToggle, onLocked, takenExamIds }) {
  const tone = TONE[major.tone]
  const examTaken = Boolean(exam && takenExamIds?.has(String(exam.examId)))
  const shake = useAnimationControls()

  function press() {
    if (locked) {
      shake.start({ x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.45 } })
      onLocked()
      return
    }
    onToggle()
  }

  return (
    /* 7.5rem = the portal nav (4rem) plus this page's header bar (a 40px
       control in 12px padding, so 4rem), less the padding below -- so the card
       itself lands half a rem under the header with air above it.

       That air is painted in the page's own colour rather than left
       transparent. A bare offset showed the road sliding through the gap above
       the banner, which reads as the card floating over a leak; painted, the
       nodes disappear cleanly behind the header as they scroll up.

       Only sticky while open -- a stack of collapsed banners would otherwise
       pile up against the top of the window, each one pinning the next. */
    <motion.div
      animate={shake}
      className={open ? "sticky top-[7.5rem] z-20 bg-rb-polar pb-1 pt-3" : ""}
    >
      <button
        type="button"
        onClick={press}
        aria-expanded={locked ? undefined : open}
        className={`flex w-full flex-wrap items-center gap-x-5 gap-y-3 rounded-rb-card border-[3px] border-black/10 px-7 py-6 text-left text-white shadow-[0_6px_0_rgb(0_0_0/0.16)] transition-[transform,box-shadow] duration-100 active:translate-y-[3px] active:shadow-[0_3px_0_rgb(0_0_0/0.16)] ${tone.face}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/75">
            unit {major.index}
          </p>
          <h2 className="mt-1 truncate font-rb-display text-2xl font-extrabold lowercase leading-tight text-white sm:text-3xl">
            {major.name}
          </h2>
        </div>

        {/* One status, stated once. Lessons done while the unit is open, the
            lock while it is not -- they are answers to the same question. */}
        <span className="flex shrink-0 items-center gap-2 rounded-rb-pill bg-white/15 px-4 py-2 text-sm font-extrabold text-white">
          {locked ? (
            <>
              <Lock className="size-4" aria-hidden="true" />
              locked
            </>
          ) : (
            <>
              {major.doneCount}/{major.lessonCount} lessons
              {examTaken ? " · exam sat" : ""}
            </>
          )}
        </span>

        {/* How many stops are behind this banner, so a collapsed unit still
            says how much is in it. */}
        {!locked ? (
          <span className="hidden shrink-0 text-sm font-extrabold text-white/80 sm:block">
            {major.middles.length} topic{major.middles.length === 1 ? "" : "s"}
            {exam ? " · unit exam" : ""}
          </span>
        ) : null}

        <motion.span
          animate={{ rotate: open && !locked ? 180 : 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15"
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </motion.span>
      </button>

      {/* Outside the button: a link inside a button is not a control anyone can
          reach with a keyboard, and pressing it would toggle the unit too. */}
      {exam && !locked && open ? (
        <div className="flex justify-end pt-2">
          <Link
            to={`/learner/assessments/${exam.examId}/history`}
            className="rounded-rb-pill px-2 text-xs font-bold text-rb-macaw-lip underline decoration-dotted underline-offset-4 hover:text-rb-macaw"
          >
            unit exam attempts
          </Link>
        </div>
      ) : null}
    </motion.div>
  )
}

/**
 * Every stop on a unit's road, in study order: its topics, then its unit exam.
 *
 * A topic is done when every lesson in it is; an exam when the learner has a
 * result for it. `current` is decided by the caller across the whole
 * certification, because there is only ever one place you are up to.
 */
function unitNodes(major, takenExamIds) {
  const nodes = major.middles.map((middle, index) => {
    const total = middle.lessons.length
    const done = total > 0 && middle.done === total

    return {
      key: `topic-${middle.id}`,
      kind: "topic",
      middle,
      tone: major.tone,
      icon: BookOpen,
      label: middle.name,
      meta: total === 0 ? "no lessons yet" : `${middle.done}/${total} lessons`,
      progress: total === 0 ? null : (middle.done / total) * 100,
      done,
      empty: total === 0,
      /* Completion is not part of this test. A topic whose lessons are all
         read can still be the weakest thing on the certification -- mastery
         moves with every answered question, and a bad unit exam turns a
         finished topic critical. Excluding completed lessons meant the road
         went quiet exactly when it had something to say. */
      urgent: middle.lessons.some(
        (lesson) => lesson.priorityTag === "CRITICAL_PRIORITY",
      ),
      index,
    }
  })

  if (major.assessment) {
    nodes.push({
      key: `exam-${major.assessment.examId}`,
      kind: "exam",
      exam: major.assessment,
      tone: "fox",
      icon: ClipboardCheck,
      label: major.assessment.title,
      meta: `unit exam · ${major.assessment.totalQuestions} questions`,
      xp: ASSESSMENT_MAX_XP,
      done: Boolean(takenExamIds?.has(String(major.assessment.examId))),
    })
  }

  return nodes
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
 * This draws the shape instead -- the header bar, a unit banner, then the road
 * itself -- so the layout is already there and only the content arrives.
 * Nothing pretends to be data: no titles, no counts, just the blocks and the
 * circles they will occupy.
 */
function CurriculumSkeleton() {
  return (
    <div role="status" aria-label="Loading curriculum">
      {/* The header bar. */}
      <div className="flex items-center gap-4 border-b-2 border-rb-swan bg-rb-snow px-5 py-3 lg:px-8">
        <div className="size-10 shrink-0 animate-pulse rounded-full bg-rb-swan" />
        <div className="h-5 w-52 animate-pulse rounded bg-rb-swan" />
        <div className="ml-auto h-2.5 w-40 animate-pulse rounded-full bg-rb-swan" />
      </div>

      <div className="mx-auto max-w-[720px] px-5 py-10">
        <div className="h-16 animate-pulse rounded-rb-card bg-rb-swan" />

        {/* Four stops, on the same swing the road uses -- so the circles land
            where the nodes will, and nothing jumps when they arrive. */}
        <div className="relative mx-auto mt-6" style={{ width: PATH_WIDTH, height: PATH_ROW * 4 }}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="relative" style={{ height: PATH_ROW }}>
              <div
                className="absolute left-1/2 top-1/2 animate-pulse rounded-full bg-rb-swan"
                style={{
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                  transform: `translate(calc(-50% + ${offsetAt(index)}px), -50%)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
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

  /* ------------------------------------------------------------------ road
   *
   * The whole certification as one ordered list of stops -- each unit's topics
   * followed by its exam, and the mock at the end -- so "where am I up to" can
   * be answered once, across the whole thing, rather than per unit. The first
   * unfinished stop is `current`, and it is the only node that gets the start
   * bubble; everything else is done, open, or (before the diagnostic) locked.
   *
   * Nothing here gates access. Once the diagnostic is sat every stop is open,
   * exactly as the unit cards were -- the road describes the order of study, it
   * does not enforce it. A learner who wants to jump to unit three still can.
   */
  const { sections, finalNode, currentUnitId } = useMemo(() => {
    const built = (curriculum?.majors ?? []).map((major) => ({
      major,
      nodes: unitNodes(major, takenExamIds),
    }))

    const mock = curriculum?.mockExam
      ? {
          key: `mock-${curriculum.mockExam.examId}`,
          kind: "exam",
          exam: curriculum.mockExam,
          tone: "fox",
          icon: Trophy,
          label: curriculum.mockExam.title,
          meta: `final · ${curriculum.mockExam.totalQuestions} questions`,
          xp: ASSESSMENT_MAX_XP,
          done: Boolean(takenExamIds?.has(String(curriculum.mockExam.examId))),
        }
      : null

    const ordered = [...built.flatMap((section) => section.nodes), ...(mock ? [mock] : [])]

    let currentTaken = false
    for (const node of ordered) {
      if (!diagnosticDone) {
        node.state = "locked"
        continue
      }
      if (node.done) {
        node.state = "done"
        continue
      }
      // An empty topic cannot be the stop you are on -- there is nothing in it
      // to do, so marking it current would strand the learner on a dead end.
      if (!currentTaken && !node.empty) {
        node.state = "current"
        currentTaken = true
        continue
      }
      node.state = "open"
    }

    const currentSection = built.find((section) =>
      section.nodes.some((node) => node.state === "current"),
    )

    return { sections: built, finalNode: mock, currentUnitId: currentSection?.major.id ?? null }
  }, [curriculum, takenExamIds, diagnosticDone])

  /* Which units are unrolled.
   *
   * `null` means "nobody has chosen yet", which is not the same as "none are
   * open" -- it is what lets the unit the learner is up to be open on arrival
   * while still letting them close it. Storing the default as a real set on
   * first render would freeze whichever unit was current when the page mounted,
   * and it moves as they finish topics.
   */
  const [openUnitIds, setOpenUnitIds] = useState(null)
  const openUnits = openUnitIds ?? new Set(currentUnitId ? [currentUnitId] : [])

  function toggleUnit(id) {
    setOpenUnitIds(() => {
      const next = new Set(openUnits)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* The same figure the My Learning card and the analytics board show: lessons
     read and assessments passed, over what the certification requires. The
     curriculum model's own `progress` counts lessons alone, so this header used
     to read 100% for a learner the board had at 20%. Falls back to it only when
     the portal returned no row for this certification. */
  const progressRow = findCertificationProgress(data?.certificationProgress, certificationId)
  const headerProgress = progressRow
    ? certificationProgressPercent(progressRow)
    : (curriculum?.progress ?? 0)

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
  /* The same generator the My Learning and Certifications pages open, so a
     plan built from the gate below is built exactly like one built from a
     card -- one dialog, one save path, no second implementation to drift. */
  const { openStudyPlanFor, studyPlanDialog } = useStudyPlanGate()

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

  /* No study plan yet: build one before the curriculum opens.
   *
   * `useStudyPlanGate` already asks this at every click that leads here, but a
   * click is not the only way in -- a bookmark, a typed URL, a back button or
   * the browser restoring the tab all land on this page directly, and none of
   * them passed through the gate. So the same rule is enforced where the page
   * is, next to the diagnostic and mastery gates, rather than only at the door
   * somebody might not have used.
   *
   * `isSuccess`, not `!hasPlan`: while the lookup is in flight there is no
   * answer yet, and gating on the absence of one would show this screen to
   * every learner for a moment, including those who have a plan. If the lookup
   * *fails*, the learner is let through -- the hook takes the same view, and a
   * plan the app cannot read must not lock somebody out of what they paid for.
   */
  if (diagnosticDone && masteryReady && planQuery.isSuccess && !hasPlan) {
    return (
      <div className="rebyu-ds flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-rb-polar px-5">
        <div className="w-full max-w-md rounded-rb-card border-2 border-rb-swan bg-rb-snow p-8 text-center shadow-[0_5px_0_var(--color-rb-swan)]">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-rb-macaw-wash text-rb-macaw-lip">
            <CalendarDays className="size-7" aria-hidden="true" />
          </span>

          <h1 className="mt-5 font-rb-display text-xl font-extrabold text-rb-eel">
            Build your study plan
          </h1>

          <p className="mt-2 text-sm leading-6 text-rb-wolf">
            Your diagnostic is in, so we can schedule {certification.title} around what
            you already know. Build the plan and the curriculum opens.
          </p>

          <TactileButton
            variant="macaw"
            className="mt-6 w-full"
            onClick={() => openStudyPlanFor(certification)}
          >
            Build a study plan
            <ArrowRight className="size-4" aria-hidden="true" />
          </TactileButton>

          <button
            type="button"
            onClick={() => navigate("/learner/learning")}
            className="mt-4 text-xs font-bold text-rb-hare underline decoration-dotted underline-offset-4 hover:text-rb-wolf"
          >
            Back to my learning
          </button>
        </div>

        {studyPlanDialog}
      </div>
    )
  }

  function openTopic(middle) {
    navigate(`/learner/learning/${certificationId}/topics/${middle.id}`)
  }

  /* One target per stop. A topic opens the topic surface -- the lessons,
     quizzes and exam inside it live there, which is why the road does not
     repeat them -- and an exam node goes straight into the attempt. */
  function openNode(node) {
    if (node.kind === "exam") {
      navigate(`/learner/assessments/${node.exam.examId}`)
      return
    }
    if (node.empty) return
    openTopic(node.middle)
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
      {/* ------------------------------------------------------------ header
          A bar, not a billboard. This was a full-bleed ink slab carrying a
          5xl title, a description, a chip row and a 112px progress ring --
          most of a screen spent restating the name of the thing the learner
          just clicked, before any of the road was visible. The road is the
          page; the header only has to say which certification it belongs to
          and how far along it is. */}
      <header className="sticky top-16 z-30 border-b-2 border-rb-swan bg-rb-snow/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 lg:px-8">
          <BackButton asChild label="Back to my learning">
            <Link to="/learner/learning" />
          </BackButton>

          {/* `capitalize` rather than a JS transform: it only touches the first
              letter of each word, so titles already stored in caps (TOPCIT,
              AWS) pass through untouched. */}
          <h1 className="min-w-0 truncate font-rb-display text-xl font-extrabold capitalize text-rb-eel">
            {certification.title ?? "Certification"}
          </h1>

          <span className="hidden text-xs font-bold text-rb-wolf sm:inline">
            {curriculum.majors.length} unit{curriculum.majors.length === 1 ? "" : "s"} ·{" "}
            {curriculum.lessonTotal} lessons
            {curriculum.mockExam ? " · 1 mock exam" : ""}
          </span>

          {/* Progress as a bar in the flow of the row rather than a ring in a
              corner of a band: it is one number, and it was taking a column. */}
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <div className="h-2.5 w-24 overflow-hidden rounded-full bg-rb-swan sm:w-40">
              <motion.div
                className="h-full rounded-full bg-rb-feather"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, headerProgress))}%` }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <CountUp
              value={headerProgress}
              suffix="%"
              className="rb-numeric text-sm text-rb-eel"
            />
          </div>

          {/* Triage, one chip. The full worst-first breakdown was four pills
              wide on a page whose whole job is now to point at one node. */}
          {diagnosticDone ? (
            <>
              {PRIORITY_SUMMARY_ORDER.some((tag) => priorityCounts[tag]) ? (
                (() => {
                  const tag = PRIORITY_SUMMARY_ORDER.find((item) => priorityCounts[item])
                  const config = PRIORITY_CONFIG[tag]
                  const Icon = config.icon
                  const urgent = tag === "CRITICAL_PRIORITY" || tag === "HIGH_PRIORITY"

                  return (
                    <span
                      className={`hidden shrink-0 items-center gap-1.5 rounded-rb-pill px-3 py-1.5 text-xs font-extrabold md:inline-flex ${
                        urgent
                          ? "bg-rb-cardinal-wash text-rb-cardinal-lip"
                          : `${config.bgColor} ${config.textColor}`
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      <CountUp value={priorityCounts[tag]} className="rb-numeric" />
                      {PRIORITY_SUMMARY_LABEL[tag]}
                    </span>
                  )
                })()
              ) : (
                <span className="hidden shrink-0 items-center gap-1.5 rounded-rb-pill bg-rb-feather-wash px-3 py-1.5 text-xs font-extrabold text-rb-feather-ink md:inline-flex">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  all caught up
                </span>
              )}
            </>
          ) : null}

          {diagnosticDone && hasPlan ? (
            <Link
              to="/learner/plan"
              className="hidden shrink-0 items-center gap-1.5 text-xs font-bold text-rb-macaw-lip underline decoration-dotted underline-offset-4 hover:text-rb-macaw lg:inline-flex"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              study calendar
            </Link>
          ) : null}
        </div>
      </header>

      {/* The gate. Out of the header and into the page, directly above the
          road it locks -- in the header bar it would have to compete with the
          title for a row that is now one line tall. */}
      {!diagnosticDone ? (
        <Reveal
          variants={popIn}
          amount={0}
          className="mx-auto mt-6 flex max-w-[720px] flex-col gap-4 rounded-rb-card border-2 border-rb-swan bg-rb-fox-wash p-5 sm:flex-row sm:items-center"
        >
          <motion.span
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rb-fox text-white"
            // A slow, small pulse. The gate is the one thing on this page that
            // has to be noticed before anything else can happen.
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

      {/* ------------------------------------------------------------- units */}
      <main className="mx-auto max-w-[1600px] px-5 py-10 lg:px-8">
        {curriculum.majors.length === 0 ? (
          <LearnerEmptyState
            icon={BookOpen}
            title="No curriculum published yet"
            description="This certification has no units with published lessons. Check back once content is released."
          />
        ) : (
          <StaggerList className="space-y-6" stagger={0.09}>
            {/* The road. Every unit contributes a banner and a stretch of
                nodes, and the whole certification reads as one continuous
                scroll from the first topic to the final -- which is the point:
                the old stack of cards was a table of contents, and this is a
                route. */}
            <StaggerItem variants={fadeUp}>
              <div className="mx-auto max-w-[820px]">
                {sections.map((section) => {
                  const open = diagnosticDone && openUnits.has(section.major.id)

                  return (
                    <section key={section.major.id} className="pb-4">
                      <UnitBanner
                        major={section.major}
                        exam={section.major.assessment}
                        locked={!diagnosticDone}
                        open={open}
                        onToggle={() => toggleUnit(section.major.id)}
                        onLocked={() => setDialogOpen(true)}
                        takenExamIds={takenExamIds}
                      />

                      <Collapse open={open}>
                        <div
                          className="relative mx-auto"
                          style={{ width: PATH_WIDTH, height: PATH_ROW * section.nodes.length }}
                        >
                          <PathTrail count={section.nodes.length} />

                          {section.nodes.map((node, index) => (
                            <PathNode
                              key={node.key}
                              node={node}
                              index={index}
                              onSelect={openNode}
                              onLocked={() => setDialogOpen(true)}
                            />
                          ))}
                        </div>
                      </Collapse>
                    </section>
                  )
                })}

                {/* The final, on the road rather than in a card of its own.
                    It is the last stop, and a card after the path read as a
                    separate feature rather than as the end of the journey. */}
                {finalNode ? (
                  <section className="pb-2">
                    <div className="relative mx-auto" style={{ width: PATH_WIDTH, height: PATH_ROW }}>
                      <PathNode
                        node={finalNode}
                        index={0}
                        onSelect={openNode}
                        onLocked={() => setDialogOpen(true)}
                      />
                    </div>
                  </section>
                ) : null}
              </div>
            </StaggerItem>

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
