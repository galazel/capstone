import { useMemo, useState } from "react"
import { Link, Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom"
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
  RotateCcw,
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
import { useCertificationStudyPlan } from "@/components/learner/use-certification-study-plan.js"
import { ASSESSMENT_MAX_XP } from "@/lib/xp.js"
import {
  certificationProgressPercent,
  findCertificationProgress,
} from "@/lib/certification-progress.js"
import { getExams, getExamTypes } from "@/services/assessmentService.js"
import { getProgressAnalytics } from "@/services/learnerAnalyticsService.js"
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
    faceVar: "var(--color-rb-macaw)",
    lipVar: "var(--color-rb-macaw-lip)",
    wash: "bg-rb-macaw-wash",
    chip: "bg-rb-macaw-wash text-rb-macaw-lip",
    ink: "text-rb-macaw-lip",
    btn: "macaw",
    bar: "macaw",
  },
  bee: {
    face: "bg-rb-bee",
    faceVar: "var(--color-rb-bee)",
    lipVar: "var(--color-rb-bee-lip)",
    wash: "bg-rb-bee-wash",
    chip: "bg-rb-bee-wash text-rb-bee-ink",
    ink: "text-rb-bee-ink",
    btn: "fox",
    bar: "bee",
  },
  beetle: {
    face: "bg-rb-beetle",
    faceVar: "var(--color-rb-beetle)",
    lipVar: "var(--color-rb-beetle-lip)",
    wash: "bg-rb-beetle-wash",
    chip: "bg-rb-beetle-wash text-rb-beetle-lip",
    ink: "text-rb-beetle-lip",
    btn: "beetle",
    bar: "beetle",
  },
  cardinal: {
    face: "bg-rb-cardinal",
    faceVar: "var(--color-rb-cardinal)",
    lipVar: "var(--color-rb-cardinal-lip)",
    wash: "bg-rb-cardinal-wash",
    chip: "bg-rb-cardinal-wash text-rb-cardinal-lip",
    ink: "text-rb-cardinal-lip",
    btn: "cardinal",
    bar: "mask",
  },
  feather: {
    face: "bg-rb-feather",
    faceVar: "var(--color-rb-feather)",
    lipVar: "var(--color-rb-feather-lip)",
    wash: "bg-rb-feather-wash",
    chip: "bg-rb-feather-wash text-rb-feather-ink",
    ink: "text-rb-feather-ink",
    btn: "feather",
    bar: "feather",
  },
  fox: {
    face: "bg-rb-fox",
    faceVar: "var(--color-rb-fox)",
    lipVar: "var(--color-rb-fox-lip)",
    wash: "bg-rb-fox-wash",
    chip: "bg-rb-fox-wash text-rb-fox-lip",
    ink: "text-rb-fox-lip",
    btn: "fox",
    bar: "fox",
  },
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
/* The name no longer hangs below the node -- it stands beside it -- so a row
   only has to be as tall as the node itself plus the gap the connector needs
   to read as a line between two stops. That is most of where the page's old
   length went: 208px per stop with the lower half reserved for text that is
   now in space the row already had. */
const PATH_ROW = 158

/* The node is an isometric plinth, not a disc: a top face in the unit's colour
   with two shaded faces under it, and the icon standing on top. `PLINTH_H` is
   the top face alone (2:1, which is what makes it read as isometric rather
   than as a squashed square) and `PLINTH_D` the extruded depth beneath it. */
const NODE_W = 132
const PLINTH_H = 66
const PLINTH_D = 20
/* How far the icon floats above the plinth's centre. Sitting it flat on the
   face made it look printed on; lifted, it reads as standing there. */
const ICON_LIFT = 30
const NODE_H = PLINTH_H + PLINTH_D + ICON_LIFT

/* A two-position zig-zag, not the old eight-step swing.

   The swing existed to keep a *centred* column moving. Now that each stop
   carries its name out to one side, the side itself is the rhythm: left stop,
   right stop, and the label always on the outer edge where there is nothing to
   collide with. An eight-step swing on top of that would put two consecutive
   nodes on the same side with their labels overlapping. */
const PATH_OFFSETS = [88, -88]

function offsetAt(index) {
  return PATH_OFFSETS[index % PATH_OFFSETS.length]
}

/** Which side of the node its name stands on: always the outer one. */
function labelSideAt(index) {
  return offsetAt(index) > 0 ? "right" : "left"
}

/**
 * The road behind the nodes.
 *
 * Drawn from the same offsets the nodes are placed with, so the two can never
 * disagree: each segment is a vertical-tangent cubic, which is what gives the
 * road its S-bends rather than the corners a polyline would put between them.
 *
 * A hairline rather than the fat line of dots it used to be. The dots were
 * competing with the stops for attention on a page whose whole subject is the
 * stops -- a road is context, and context should be the quietest thing on the
 * page. It also lands lower now, at the plinths' feet rather than through the
 * middle of the icons, so the nodes stand *on* it instead of being threaded
 * onto it.
 */
function PathTrail({ count }) {
  if (count < 2) return null

  /* The middle of the plinth's top face, not its bottom edge.

     Anchoring at the bottom edge (`ICON_LIFT + PLINTH_H`) put the stroke's
     round cap just outside the plinth's own footprint, so the road did not
     quite end *under* the thing it connects. Whenever a node was occluded --
     which happens to the first node of every unit, the moment the sticky unit
     banner scrolls over it -- that cap was left hanging below the banner with
     nothing attached to it: a line running to a stop that is no longer on
     screen. Anchored half a face higher the cap is always beneath the plinth,
     so an occluded node takes its road end with it and the remaining curve is
     cut cleanly by the banner's edge instead of stopping in mid-air. */
  const footY = ICON_LIFT + PLINTH_H / 2

  const points = Array.from({ length: count }, (_, index) => [
    PATH_WIDTH / 2 + offsetAt(index),
    PATH_ROW * index + (PATH_ROW - NODE_H) / 2 + footY,
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
      {/* Swan is the border grey and disappears against the page on its own;
          mixed toward Hare it holds as a hairline without ever competing with
          what is standing on it. */}
      <path
        d={d}
        fill="none"
        stroke="color-mix(in oklab, var(--color-rb-hare) 55%, var(--color-rb-swan))"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * "start" over the node the learner is on.
 *
 * The one node out of a whole certification that answers "where was I?", so it
 * is the only one that gets a label of its own. It hops rather than pulses: a
 * pulse is what every other alert on this page does, and the point is that
 * this one is an invitation.
 *
 * Above the node now rather than beside it. Beside was a workaround for names
 * that hung below their nodes and left no room overhead; the names have moved
 * out to the sides, so the bubble can sit where it points straight down at the
 * thing it is talking about.
 */
function StartBubble({ tone }) {
  return (
    <motion.span
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    >
      <span
        className={`block whitespace-nowrap rounded-rb-control px-4 py-1.5 font-rb-display text-sm font-extrabold lowercase text-white shadow-[0_3px_0_var(--bubble-lip)] ${tone.face}`}
        style={{ "--bubble-lip": tone.lipVar }}
      >
        start
      </span>

      {/* The tail, pointing down at the plinth. One triangle rather than the
          two the old outlined bubble needed -- a solid fill has no border for
          a second triangle to read through. */}
      <span
        className="absolute left-1/2 top-full size-0 -translate-x-1/2 border-x-8 border-x-transparent border-t-8"
        style={{ borderTopColor: tone.lipVar }}
      />
    </motion.span>
  )
}

/**
 * The plinth a stop stands on.
 *
 * Three faces of one box in isometric projection: a 2:1 rhombus on top and the
 * two extruded sides beneath it, each a step darker so the light reads as
 * coming from the upper left. Drawn rather than fetched — an image per node
 * would be a network request per stop and a licence per illustration, and a
 * drawn plinth takes the unit's own colour, which a stock illustration cannot.
 *
 * `face`/`lip` are the unit's tone, so a plinth belongs to its unit the same
 * way the banner above it does.
 */
function Plinth({ face, lip, top }) {
  const w = NODE_W
  const h = PLINTH_H
  const d = PLINTH_D

  return (
    <svg
      className="absolute left-1/2 -translate-x-1/2"
      style={{ top: ICON_LIFT }}
      width={w}
      height={h + d}
      viewBox={`0 0 ${w} ${h + d}`}
      aria-hidden="true"
    >
      {/* Sides first so the top face draws over their shared edges. */}
      <path d={`M 0 ${h / 2} L ${w / 2} ${h} L ${w / 2} ${h + d} L 0 ${h / 2 + d} Z`} fill={lip} />
      <path
        d={`M ${w} ${h / 2} L ${w / 2} ${h} L ${w / 2} ${h + d} L ${w} ${h / 2 + d} Z`}
        fill={face}
      />
      <path d={`M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`} fill={top} />
    </svg>
  )
}

/**
 * How far through a topic the learner is.
 *
 * A rail under the name, not a ring around the node. The ring was drawn on the
 * node's bounding circle, and the node is no longer a circle -- traced around a
 * plinth it read as an ellipse floating behind the icon. Under the name it also
 * sits with the other things the label already says about the stop.
 */
function NodeProgress({ value }) {
  const pct = Math.max(0, Math.min(100, value))

  return (
    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-rb-pill bg-rb-swan">
      <motion.span
        className="block h-full rounded-rb-pill bg-rb-bee"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </span>
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

  /* A finished exam is not finished the way a finished topic is. Reading a
     topic is done once; an assessment can always be sat again, and the whole
     point of the retake loop is that sitting it again is what a learner does
     next. A check told them there was nothing left here. This says the stop is
     still live -- every exam on this road (unit exams and the final mock) is
     retakeable, and the one-shot diagnostic is a gate rather than a node, so it
     never reaches this. */
  const retakeable = done && node.kind === "exam"

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

  /* Three faces from one tone. The top catches the light, the near side is the
     tone itself and the far side is its lip, which is the same solid-shadow
     colour the buttons use -- so a plinth is lit by the same lamp as every
     other control in the system rather than by one invented here.

     A stop the learner has not opened is a pale plinth with its colour kept for
     the icon standing on it; locked is grey throughout. */
  const filled = done || current
  const faces = locked
    ? {
        top: "var(--color-rb-swan)",
        face: "color-mix(in oklab, var(--color-rb-swan) 78%, var(--color-rb-hare))",
        lip: "var(--color-rb-hare)",
      }
    : filled
      ? {
          top: `color-mix(in oklab, ${tone.faceVar} 84%, white)`,
          face: tone.faceVar,
          lip: tone.lipVar,
        }
      : {
          top: "var(--color-rb-snow)",
          face: "var(--color-rb-polar)",
          lip: "var(--color-rb-swan)",
        }

  const iconInk = locked
    ? "text-rb-hare"
    : filled
      ? "text-white"
      : tone.ink

  const side = labelSideAt(index)

  return (
    <div className="relative" style={{ height: PATH_ROW }}>
      {/* Sized to the node and nothing else. The name hangs off it absolutely
          rather than sitting beside it in flow: in flow the *pair* is what gets
          centred on the row, so a long topic name would drag the plinth off the
          line the road is drawn along -- and by a different amount for every
          node, depending on how long its name was.

          Both axes in one inline transform rather than mixing a utility with
          it: an inline `transform` replaces the class's outright, so a
          `-translate-y-1/2` here would simply be dropped. */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: NODE_W,
          height: NODE_H,
          transform: `translate(calc(-50% + ${offsetAt(index)}px), -50%)`,
        }}
      >
        <motion.div animate={shake} className="relative h-full">
          {current ? <StartBubble tone={tone} /> : null}

          {/* The one node that has to be found before anything else can happen
              gets a halo. Never on a locked board -- a beacon on something that
              will not open is just irritating.

              An ellipse rather than the circle it was: on the ground under an
              isometric plinth, a circle is seen at the same 2:1 squash as the
              plinth's own top face. A true circle read as a bubble hanging in
              front of the node instead of light pooling around its foot. */}
          {current ? (
            <motion.span
              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] ${tone.face} opacity-25`}
              style={{ top: ICON_LIFT - 6, width: NODE_W + 26, height: PLINTH_H + 20 }}
              animate={{ scale: [1, 1.14, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />
          ) : null}

          {/* The plinth is the button. It travels down onto its own depth when
              pressed, the way every key in the system travels onto its lip --
              here the depth is drawn rather than cast, so the movement is the
              whole of the press and there is no shadow to shrink alongside it. */}
          <button
            type="button"
            onClick={press}
            aria-label={`${node.label}${
              locked ? " (locked)" : retakeable ? " (already sat -- retake)" : ""
            }`}
            className="group absolute inset-0 block transition-transform duration-100 active:translate-y-[5px]"
          >
            <Plinth top={faces.top} face={faces.face} lip={faces.lip} />

            {/* Standing on the plinth, not printed on it: the object is lifted
                clear of the top face and carries its own drop shadow onto it,
                which is what sells the two as objects in one space.

                `node.art` is the seam for real illustration. Nothing sets it
                yet — an icon is the fallback, not the plan — but a topic that
                names an image gets that image standing on its plinth instead,
                so putting drawn objects on this road is a matter of filling the
                field in `curriculum-model.js` rather than of touching this
                component. Kept out of the state branches deliberately: a topic
                that is done or locked still shows its own object, and the
                plinth beneath it is what carries the state. */}
            <span
              className={`absolute left-1/2 grid -translate-x-1/2 place-items-center drop-shadow-[0_6px_3px_rgb(0_0_0/0.18)] ${iconInk}`}
              style={{ top: 0, width: NODE_W, height: ICON_LIFT + PLINTH_H / 2 }}
            >
              {/* The icon always renders; the illustration covers it when there
                  is one. That order is what makes the fallback real -- an image
                  that 404s or that a slow connection never delivers hides
                  itself and uncovers the icon, rather than leaving an empty
                  plinth where a stop should be. */}
              {locked ? (
                <Lock className="size-11" aria-hidden="true" />
              ) : retakeable ? (
                <RotateCcw className="size-11" aria-hidden="true" />
              ) : done ? (
                <Check className="size-12" aria-hidden="true" />
              ) : (
                <Icon className="size-11" aria-hidden="true" />
              )}

              {node.art && !locked ? (
                <img
                  src={node.art}
                  alt=""
                  className="absolute size-14 object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = "none"
                  }}
                />
              ) : null}
            </span>

            {/* A topic the plan says is urgent -- finished or not. The same red
                dot the old list used, kept because it is the one thing on a
                node that priority order has to be able to say. */}
            {node.urgent && !locked ? (
              <motion.span
                className="absolute right-1 size-5 rounded-full bg-rb-cardinal ring-4 ring-rb-polar"
                style={{ top: ICON_LIFT - 4 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden="true"
              />
            ) : null}
          </button>
        </motion.div>

        {/* The name beside the node, on whichever side the zig-zag has put it —
            always the outer one, where there is nothing for it to collide with.
            A stop can be a topic, a unit exam or the final, and which one it is
            decides whether the learner has ten minutes or an hour, so it is
            named rather than left to its icon.

            `pointer-events-none` so a two-line name never covers a neighbouring
            node as a click target -- the plinth is the control, the label only
            says what it is. */}
        <div
          className={`pointer-events-none absolute w-[210px] ${
            side === "right" ? "left-full ml-4 text-left" : "right-full mr-4 text-right"
          }`}
          style={{ top: ICON_LIFT, height: PLINTH_H, display: "grid", alignContent: "center" }}
        >
          <p className="font-rb-display text-[15px] font-extrabold leading-tight text-rb-eel">
            {node.label}
          </p>

          {node.meta ? (
            <p className="mt-1 text-[12px] font-bold text-rb-wolf">{node.meta}</p>
          ) : null}

          {/* Only where it says something: a topic part-way through. A rail at
              0% or 100% is the state the plinth already carries. */}
          {node.progress != null && node.progress > 0 && node.progress < 100 ? (
            <NodeProgress value={node.progress} />
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
 * nodes belong to about four stops in. The offset clears the one sticky thing
 * above it -- the portal nav (`top-0`, 4rem).
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
    /* 4.25rem = the portal nav (4rem) plus a little air, now that this page
       has no header bar of its own for the banner to clear.

       That air is painted in the page's own colour rather than left
       transparent. A bare offset showed the road sliding through the gap above
       the banner, which reads as the card floating over a leak; painted, the
       nodes disappear cleanly behind the header as they scroll up.

       Only sticky while open -- a stack of collapsed banners would otherwise
       pile up against the top of the window, each one pinning the next. */
    <motion.div
      animate={shake}
      className={open ? "sticky top-[4.25rem] z-20 bg-rb-polar pb-1 pt-3" : ""}
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
/**
 * The " · 2 attempts" tail on an exam's meta line, or "" before it is ever sat.
 *
 * Left off at zero deliberately: "0 attempts" is the same statement the absence
 * of the phrase already makes, and it would put a number on every unsat exam on
 * the road for nothing.
 */
function attemptsSuffix(attemptsByExamId, examId) {
  const count = attemptsByExamId?.get(String(examId)) ?? 0
  if (count <= 0) return ""
  return ` · ${count} ${count === 1 ? "attempt" : "attempts"}`
}

function unitNodes(major, takenExamIds, attemptsByExamId) {
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
      meta: `unit exam · ${major.assessment.totalQuestions} questions${attemptsSuffix(
        attemptsByExamId,
        major.assessment.examId,
      )}`,
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

        {/* Four stops on the same zig-zag the road uses, each a plinth-shaped
            block and a bar where its name will be -- so nothing moves when the
            real nodes arrive. */}
        <div className="relative mx-auto mt-6" style={{ width: PATH_WIDTH, height: PATH_ROW * 4 }}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="relative" style={{ height: PATH_ROW }}>
              <div
                className="absolute left-1/2 top-1/2"
                style={{
                  width: NODE_W,
                  height: NODE_H,
                  transform: `translate(calc(-50% + ${offsetAt(index)}px), -50%)`,
                }}
              >
                <div
                  className="absolute left-1/2 w-full -translate-x-1/2 animate-pulse rounded-rb-tile bg-rb-swan"
                  style={{ top: ICON_LIFT, height: PLINTH_H + PLINTH_D }}
                />
                <div
                  className={`absolute h-4 w-[150px] animate-pulse rounded-rb-pill bg-rb-swan ${
                    labelSideAt(index) === "right" ? "left-full ml-4" : "right-full mr-4"
                  }`}
                  style={{ top: ICON_LIFT + PLINTH_H / 2 - 8 }}
                />
              </div>
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

  /* How many times each exam has been sat, for the road to say under the node.
     There is one result row per attempt, so this reads the highest `attemptNo`
     rather than counting rows: the count is what the learner's NEXT sitting
     would be numbered from, and a single result row that never got written
     would quietly make a tally disagree with the attempt the server hands
     back. Rows with no attemptNo still contribute 1 so an exam known to be sat
     never reports zero. */
  const attemptsByExamId = useMemo(() => {
    const counts = new Map()
    for (const result of data?.examResults ?? []) {
      if (result?.examId == null) continue
      const key = String(result.examId)
      const attemptNo = Number(result.attemptNo)
      const seen = Number.isFinite(attemptNo) && attemptNo > 0 ? attemptNo : 1
      counts.set(key, Math.max(counts.get(key) ?? 0, seen))
    }
    return counts
  }, [data?.examResults])

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
      nodes: unitNodes(major, takenExamIds, attemptsByExamId),
    }))

    const mock = curriculum?.mockExam
      ? {
          key: `mock-${curriculum.mockExam.examId}`,
          kind: "exam",
          exam: curriculum.mockExam,
          tone: "fox",
          icon: Trophy,
          label: curriculum.mockExam.title,
          meta: `final · ${curriculum.mockExam.totalQuestions} questions${attemptsSuffix(
            attemptsByExamId,
            curriculum.mockExam.examId,
          )}`,
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
  }, [curriculum, takenExamIds, attemptsByExamId, diagnosticDone])

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
  /* Through the shared hook, so an overall plan counts.
   *
   * This asked only for *this certification's* plan. A learner whose one plan
   * spans several certifications has none by that reading, so the gate below
   * would send them off to build a second plan they already had. The hook
   * falls back to the overall plan and checks it actually covers this
   * certification.
   *
   * This page reads plans; it does not build them.
   */
  const {
    plan: activePlan,
    isLoading: planLoading,
    isError: planLookupFailed,
    hasAnyPlan,
  } = useCertificationStudyPlan(certificationId)
  const hasPlan = Boolean(activePlan?.planId)

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
  /* Studying starts from a plan, here as well as on the analytics board.
   *
   * Sent to the generator rather than shown a wall. This page used to answer
   * the click with its own full-page "Build your study plan" screen -- a
   * second generator, a second set of words, and a page that refused to show
   * what was asked for. Redirecting keeps one generator and one flow, and
   * `returnTo` brings the learner back here the moment it is saved.
   *
   * Only once the diagnostic is done: the plan is built from its priorities,
   * so before it there is nothing to generate and the road below is where the
   * diagnostic itself is offered.
   *
   * A failed lookup lets them through. Not knowing whether a plan exists is
   * not the same as knowing there is none, and a curriculum locked by a
   * timed-out request is worse than an unplanned lesson.
   */
  /* `hasAnyPlan`, not `hasPlan`: a certification outside an existing overall
     plan is unplanned, but its owner is not unplanned, and sending them to
     build a second plan is asking for something they cannot give. */
  if (diagnosticDone && !planLoading && !planLookupFailed && !hasAnyPlan) {
    const returnTo = `/learner/learning/${certificationId}`
    return (
      <Navigate
        to={`/learner/analytics?certification=${certificationId}`
          + `&plan=1&returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
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
      {/* Controls, not a header bar.
          A full-width bar with a title, a subtitle, a chip and a link was more
          chrome than the page it introduced -- and it repeated what the unit
          card underneath already says. What is left is the two things that are
          actually actions, as icons, with the progress they qualify. */}
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-5 pb-1 pt-4 lg:px-8">
        <BackButton asChild label="Back to my learning">
          <Link to="/learner/learning" />
        </BackButton>

        {/* The page still needs a name -- for the document outline and for
            anyone arriving by screen reader -- but not a banner across the top.
            The unit card below states where you are. */}
        <h1 className="sr-only">{certification.title ?? "Certification"}</h1>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {/* One number, so it is drawn as one: a bar and a figure, not a card. */}
          <div
            className="flex items-center gap-2"
            title={`${Math.round(headerProgress)}% of this certification complete`}
          >
            <div className="h-2.5 w-24 overflow-hidden rounded-full bg-rb-swan sm:w-32">
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

          {diagnosticDone && hasPlan ? (
            <TactileButton
              variant="ghost"
              size="md"
              asChild
              aria-label="Study calendar"
              title="Study calendar"
              className="rb-btn-icon"
            >
              <Link to="/learner/plan">
                <CalendarDays className="size-5" aria-hidden="true" />
              </Link>
            </TactileButton>
          ) : null}
        </div>
      </div>

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
          /* One column. There used to be a second one for the assessments
             that win no slot on the road, and the grid existed to make room
             for it; with the road as the only thing here it keeps the full
             width rather than being pinned into a narrow left lane beside
             nothing. */
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
                        {/* Headroom for the "start" bubble, which hangs above
                            the first stop and therefore above this box. A
                            margin rather than padding: the road's SVG and its
                            nodes are positioned against this element, so
                            padding would move the stops off the line the road
                            is drawn along. */}
                        <div
                          className="relative mx-auto mt-6"
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
