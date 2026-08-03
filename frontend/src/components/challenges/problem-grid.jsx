import { useEffect, useRef } from "react"
import { Check, Lock } from "@/components/icons"

import { ProgressBar } from "@/components/rebyu/rebyu-ui.jsx"

/**
 * Numbered problem *roadmap* shared by CodeStrike and Blueprint Arena.
 *
 * Drawn as a road, not a rule: a thick carriageway with a dashed centre line
 * that snakes across the frame and switches back at each end, with the problem
 * nodes hung off it on short stems. A run is an ordered journey, and the road
 * is the only element on the page that says so — a block of numbered tiles, or
 * a hairline with circles on it, communicates none of that order.
 *
 * The serpentine matters as much as the thickness. The path used to be one long
 * left-to-right wave that ran several screens wide, so the shape of the run was
 * never visible at once and you scrolled to find your place. Wrapping it into
 * rows joined by U-turns puts the whole route in one frame: you can see how far
 * it goes, and where you are on it, without moving anything.
 *
 * Horizontal roadmap on web, single vertical road on mobile — each picks the
 * axis with room, rather than squeezing switchbacks onto a phone.
 *
 * States are carried by colour *and* an icon, so the run never depends on
 * colour alone. Locked nodes stay on the road rather than being hidden — seeing
 * how far it goes is part of what makes it read as an endurance run.
 */

export function buildProblems(count, titles, solvedCount) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: titles[i % titles.length],
    difficulty: i < count * 0.3 ? "easy" : i < count * 0.7 ? "medium" : "hard",
    state: i < solvedCount ? "solved" : i === solvedCount ? "current" : "locked",
  }))
}

/* ------------------------------------------------------------------ geometry */

/* The roadmap is drawn at its intrinsic pixel size rather than scaled to fit:
   one SVG user unit is one CSS pixel, so the HTML node buttons can be placed at
   the very coordinates the road is drawn through. Scaling the whole banner down
   on a narrow window would take the numbers and difficulty tags down with it —
   below `sm` we drop to the vertical road instead, and in between the frame
   scrolls sideways. */
const VB_WIDTH = 1200
const PAD_X = 110
/* Clears a node hung on the *up* side of the first row: the stem, the node's
   own radius, and the wave that can push its row 24px further up. Anything less
   and the top row of circles is cropped by the frame. */
const PAD_Y = 175
const ROW_H = 330
const COLS = 5

/** Radius of a node, and how far off the road it is hung. */
const NODE_R = 42
const STEM = 96

/** How far a node drifts off its row's centre line, alternating by column, so a
 *  row reads as a stretch of road rather than a ruler. */
const WAVE = 24

function layout(count) {
  const cols = Math.min(COLS, count)
  const rows = Math.ceil(count / cols)
  const stepX = cols > 1 ? (VB_WIDTH - PAD_X * 2) / (cols - 1) : 0
  const height = PAD_Y * 2 + (rows - 1) * ROW_H

  const points = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    // Boustrophedon: every other row runs right-to-left, so the end of one row
    // is directly above the start of the next and the join becomes a U-turn
    // rather than a diagonal sweep back across the whole frame.
    const x = PAD_X + (row % 2 === 0 ? col : cols - 1 - col) * stepX
    const y = PAD_Y + row * ROW_H + (col % 2 === 0 ? -WAVE : WAVE)
    // Nodes hang above and below the road alternately, the way callouts sit on
    // either side of a route. Keyed to the absolute index so the alternation
    // carries across a U-turn instead of resetting each row.
    return { x, y, dir: i % 2 === 0 ? -1 : 1 }
  })

  return { points, height, cols, rows }
}

/**
 * The whole road as one Catmull-Rom spline through the node centres.
 *
 * One path rather than a path per gap: the centre line is a dash pattern, and
 * dashes restart at the start of every element, so twenty separate segments
 * gave twenty stutters where the pattern reset. Tangents taken from the
 * neighbour on either side (over six) make consecutive curves meet at the same
 * slope, so the switchbacks read as one continuous carriageway.
 */
function roadPath(points) {
  if (points.length < 2) return ""

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? points[i + 1]

    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${
      p2.x - (p3.x - p1.x) / 6
    } ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`
  }
  return d
}

/* --------------------------------------------------------------------- paint */

/** Stroke colour for a node's stem and its marker on the road. */
const DIFFICULTY_STROKE = {
  easy: "var(--color-rb-feather)",
  medium: "var(--color-rb-fox)",
  hard: "var(--color-rb-cardinal)",
}

/** Node colour per difficulty. The run was blue end to end, which was both
 *  dull and wasteful: every problem already carries a difficulty, so the path
 *  can say how hard the road ahead is without a single extra word. Same ramp
 *  as `DIFFICULTY_CHIP` below -- green, orange, red -- so the chip on a
 *  problem matches the node you clicked to reach it. */
const DIFFICULTY_NODE = {
  easy: "border-rb-feather bg-rb-feather text-white shadow-[0_4px_0_var(--color-rb-feather-lip)]",
  medium: "border-rb-fox bg-rb-fox text-white shadow-[0_4px_0_var(--color-rb-fox-lip)]",
  hard: "border-rb-cardinal bg-rb-cardinal text-white shadow-[0_4px_0_var(--color-rb-cardinal-lip)]",
}

/** The same ramp, washed out, for problems not yet reached.
 *
 *  Locked nodes were a uniform grey, which meant seventeen of twenty nodes
 *  carried no information and the whole path read as one colour. Tinting them
 *  shows the difficulty curve of the run from the first glance -- you can see
 *  the road get harder -- while staying clearly unreached: pale fill, muted
 *  ink, no lip, so a locked node is never mistaken for a solved one. */
const DIFFICULTY_NODE_LOCKED = {
  easy: "border-rb-feather/40 bg-rb-feather-wash text-rb-feather-lip shadow-[0_4px_0_var(--color-rb-swan)]",
  medium: "border-rb-fox/40 bg-rb-fox-wash text-rb-fox-lip shadow-[0_4px_0_var(--color-rb-swan)]",
  hard: "border-rb-cardinal/40 bg-rb-cardinal-wash text-rb-cardinal-lip shadow-[0_4px_0_var(--color-rb-swan)]",
}

/** Tag worn by each node. Solid rather than washed so it stays legible on
 *  both a filled node and a pale locked one. */
const DIFFICULTY_TAG = {
  easy: "bg-rb-feather text-white",
  medium: "bg-rb-fox text-white",
  hard: "bg-rb-cardinal text-white",
}

export const DIFFICULTY_CHIP = {
  easy: "bg-rb-feather-wash text-[#3d6b06]",
  medium: "bg-rb-fox-wash text-rb-fox-lip",
  hard: "bg-rb-cardinal-wash text-rb-cardinal-lip",
}

/** Width of the carriageway, and of the dashed line down the middle of it. */
const ROAD_W = 44
const CENTRE_W = 5

/**
 * The drawn road. Purely decorative — the ordered list of buttons over it is
 * what carries the run to assistive tech.
 *
 * Road behind you is the arena's own colour; road ahead is the neutral rule, so
 * how far you have come and how far is left are both legible from the shape
 * alone. Both are dark enough for the white centre line to hold across the
 * whole length, which is what keeps it reading as one road with a painted line
 * rather than two roads of different colours.
 */
function Road({ points, height, travelled, roadDone = "var(--color-rb-feather-lip)" }) {
  const d = roadPath(points)

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      width={VB_WIDTH}
      height={height}
      viewBox={`0 0 ${VB_WIDTH} ${height}`}
      fill="none"
    >
      {/* Kerb: a hair wider and darker, so the road sits on the page rather
          than floating on it. */}
      <path
        d={d}
        stroke="rgb(0 0 0 / 0.10)"
        strokeWidth={ROAD_W + 8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        stroke="var(--color-rb-hare)"
        strokeWidth={ROAD_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* `pathLength="1"` normalises the spline's arc length, so the travelled
          share can be drawn as a dash of exactly that fraction without having
          to measure twenty cubics. */}
      {travelled > 0 ? (
        <path
          d={d}
          pathLength="1"
          strokeDasharray={`${travelled} 1`}
          stroke={roadDone}
          strokeWidth={ROAD_W}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      <path
        d={d}
        stroke="white"
        strokeWidth={CENTRE_W}
        strokeDasharray="20 22"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  )
}

/** Stems and road markers, drawn over the road but under the buttons. */
function Stems({ points, height, problems }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      width={VB_WIDTH}
      height={height}
      viewBox={`0 0 ${VB_WIDTH} ${height}`}
      fill="none"
    >
      {points.map((p, i) => {
        const problem = problems[i]
        const colour =
          problem.state === "locked"
            ? "var(--color-rb-hare)"
            : DIFFICULTY_STROKE[problem.difficulty] ?? DIFFICULTY_STROKE.easy
        // Stop the stem at the node's edge rather than its centre, so it reads
        // as a tether rather than a line running under the circle.
        const endY = p.y + p.dir * (STEM - NODE_R)

        return (
          <g key={i}>
            <line x1={p.x} y1={p.y} x2={p.x} y2={endY} stroke={colour} strokeWidth="4" />
            <circle cx={p.x} cy={p.y} r="10" fill="white" stroke={colour} strokeWidth="4" />
          </g>
        )
      })}
    </svg>
  )
}

function Cell({ problem, onOpen, tone, nodeRef }) {
  const locked = problem.state === "locked"
  const solved = problem.state === "solved"
  const current = problem.state === "current"

  return (
    <button
      ref={nodeRef}
      type="button"
      onClick={() => onOpen(problem.id)}
      aria-label={`Problem ${problem.id} — ${problem.title} — ${problem.state}`}
      className={`relative z-10 grid size-20 shrink-0 place-items-center rounded-full border-2 transition active:translate-y-[3px] active:shadow-none ${
        solved
          ? DIFFICULTY_NODE[problem.difficulty] ?? DIFFICULTY_NODE.easy
          : current
            ? `${tone.border} ${tone.face} text-white shadow-[0_4px_0_rgb(0_0_0/0.18)]`
            : DIFFICULTY_NODE_LOCKED[problem.difficulty] ?? DIFFICULTY_NODE_LOCKED.easy
      }`}
      style={{ width: NODE_R * 2, height: NODE_R * 2 }}
    >
      <span className="rb-numeric text-3xl leading-none sm:text-4xl">{problem.id}</span>

      <span className="absolute right-2.5 top-2.5">
        {solved ? <Check className="size-4" aria-hidden="true" /> : null}
        {locked ? <Lock className="size-3.5 opacity-60" aria-hidden="true" /> : null}
      </span>

      {/* The difficulty rides on the node instead of a legend under the path.
          A key three colours long made you look away from the map and back to
          decode it; the tag is readable where you already are. */}
      <span
        className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-rb-pill px-2 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-wide ${DIFFICULTY_TAG[problem.difficulty] ?? DIFFICULTY_TAG.easy}`}
      >
        {problem.difficulty}
      </span>

      {current ? (
        <span className="absolute -bottom-px left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-white/80" />
      ) : null}
    </button>
  )
}

export default function ProblemGrid({ problems, onOpen, tone }) {
  const solved = problems.filter((p) => p.state === "solved").length
  const currentRef = useRef(null)
  const trackRef = useRef(null)

  const { points, height } = layout(problems.length)
  // Road behind you runs to the node you are up to. With every problem solved
  // the whole road is covered, which is the only case where the run is over.
  const travelled = problems.length > 1 ? solved / (problems.length - 1) : 0

  // Land on the problem you are actually up to. On a window too narrow for the
  // full roadmap the frame scrolls, and starting at scrollLeft 0 put you at
  // problem 1 with no hint that your next problem was off to the side.
  //
  // Driven by `scrollLeft` rather than `scrollIntoView`: the latter also walks
  // every scrollable ancestor, and measured here it left the frame at 0 while
  // scrolling the page instead. Setting the offset directly touches only the
  // frame, and the node is positioned against it so `offsetLeft` is exactly the
  // coordinate the road was drawn through.
  useEffect(() => {
    const node = currentRef.current
    const track = trackRef.current
    if (!node || !track) return undefined
    // Waits for the frame to actually have a width. One deferred frame was not
    // enough: measured on mount the track reported clientWidth 0 -- and with
    // scrollWidth 0 too, the clamp below pinned the offset to 0 and the roadmap
    // sat on problem 1. Retried until it has laid out, then given up rather
    // than spinning if this breakpoint never shows the roadmap at all.
    let frame = 0
    let tries = 0
    const place = () => {
      if (track.clientWidth === 0 || track.scrollWidth === 0) {
        if (tries++ > 30) return
        frame = requestAnimationFrame(place)
        return
      }
      // Measured against the track rather than via `offsetLeft`: the node is a
      // button inside an absolutely-positioned `li`, so its offset parent is
      // that `li` and `offsetLeft` is 0 -- which put the target far left of the
      // frame and clamped every run back to problem 1.
      const nodeBox = node.getBoundingClientRect()
      const trackBox = track.getBoundingClientRect()
      const centre = nodeBox.left - trackBox.left + track.scrollLeft + nodeBox.width / 2
      const target = centre - track.clientWidth / 2
      track.scrollLeft = Math.max(0, Math.min(target, track.scrollWidth - track.clientWidth))
    }
    frame = requestAnimationFrame(place)
    return () => cancelAnimationFrame(frame)
  }, [solved])

  return (
    <div className="flex min-h-full w-full flex-col justify-center px-2 py-10 sm:px-3">
      {/* No card around the roadmap. A lesson map is the page, not a widget on
          it — boxing it made the run feel like one panel among several. */}

      {/* ------------------------------------------------------ web: roadmap */}
      <div
        ref={trackRef}
        className="hidden [&::-webkit-scrollbar]:hidden sm:block sm:overflow-x-auto"
        // The `scrollbar-hide` utility in globals.css does not reach this
        // component -- the class applied but a 15px bar still claimed space,
        // measured in the browser. Set here instead: the arbitrary variant
        // covers WebKit, the inline property covers Firefox and Chrome 121+.
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onWheel={(event) => {
          // A mouse wheel only emits deltaY, so a horizontal frame is
          // unreachable without this on a window narrower than the roadmap.
          const frame = event.currentTarget
          if (frame.scrollWidth <= frame.clientWidth) return
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
          frame.scrollLeft += event.deltaY
        }}
      >
        <div
          className="relative mx-auto"
          style={{ width: VB_WIDTH, height }}
        >
          <Road points={points} height={height} travelled={travelled} roadDone={tone.road} />
          <Stems points={points} height={height} problems={problems} />

          <ol className="contents" aria-label="Problem roadmap">
            {problems.map((problem, i) => (
              <li
                key={problem.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: points[i].x,
                  top: points[i].y + points[i].dir * STEM,
                }}
              >
                <Cell
                  problem={problem}
                  onOpen={onOpen}
                  tone={tone}
                  nodeRef={problem.state === "current" ? currentRef : undefined}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* --------------------------------------------------- mobile: one road */}
      {/* Below sm the run is a single column on a straight road: switchbacks on
          a phone-width column have nowhere to go, and the U-turn is the whole
          point of the shape. One road with the nodes centred on it beats a
          serpentine squeezed until it reads as noise. */}
      <ol
        className="relative flex flex-col items-center gap-6 py-4 sm:hidden"
        aria-label="Problem roadmap"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-full w-11 -translate-x-1/2 rounded-full bg-rb-hare"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-full w-[5px] -translate-x-1/2 rounded-full bg-white/90"
          style={{
            maskImage: "repeating-linear-gradient(to bottom, black 0 20px, transparent 20px 42px)",
            WebkitMaskImage:
              "repeating-linear-gradient(to bottom, black 0 20px, transparent 20px 42px)",
          }}
        />
        {problems.map((problem) => (
          <li key={problem.id} className="relative">
            <Cell problem={problem} onOpen={onOpen} tone={tone} />
          </li>
        ))}
      </ol>

      {/* Below the roadmap, not above it: the map is what the page is for, and
          a progress bar over the top pushed it down and read as a header. */}
      <div className="mx-auto mt-10 w-full max-w-2xl px-3">
        <div className="flex items-baseline justify-between">
          <span className="rb-eyebrow">Progress</span>
          <span className="rb-numeric text-base text-rb-wolf">
            {solved} / {problems.length} solved
          </span>
        </div>
        <ProgressBar value={(solved / problems.length) * 100} label="Run progress" className="mt-3 !h-5" />
      </div>
    </div>
  )
}
