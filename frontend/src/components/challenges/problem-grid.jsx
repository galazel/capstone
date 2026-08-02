import { useEffect, useRef } from "react"
import { Check, Lock } from "lucide-react"

import { ProgressBar } from "@/components/rebyu/rebyu-ui.jsx"

/**
 * Numbered problem *path* shared by CodeStrike and Blueprint Arena.
 *
 * Laid out as a road of connected nodes rather than a grid of squares: a run
 * is an ordered journey, and a block of numbered tiles communicates none of
 * that order. The connector between nodes fills in behind you as problems are
 * solved, so progress is legible from the shape alone.
 *
 * Horizontal on web and vertical on mobile -- each picks the axis with room,
 * rather than squeezing a ten-wide row onto a phone.
 *
 * States are carried by colour *and* an icon, so the grid never depends on
 * colour alone. Locked cells stay in the grid rather than being hidden — seeing
 * how far the run goes is part of what makes it read as an endurance run.
 */

export function buildProblems(count, titles, solvedCount) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: titles[i % titles.length],
    difficulty: i < count * 0.3 ? "easy" : i < count * 0.7 ? "medium" : "hard",
    state: i < solvedCount ? "solved" : i === solvedCount ? "current" : "locked",
  }))
}

/** One period of the weave, in pixels. Smooth rather than zig-zag: it steps
 *  out and back rather than alternating, so consecutive nodes are never far
 *  apart and the eye follows the run in order.
 *
 *  Twelve steps rather than eight, and a much taller swing: the short wave
 *  read as a wobble in a straight line rather than a route. A long period is
 *  what makes it a curve -- the nodes drift away and come back over six steps
 *  instead of two, so no single gap looks like a jump. */
const PATH_WAVE = [0, -34, -56, -64, -56, -34, 0, 34, 56, 64, 56, 34]

/* Geometry of the horizontal (sm and up) run, in pixels. These mirror the
   Tailwind classes on the list -- `sm:size-24` and `sm:gap-12` -- because the
   rail is drawn, not laid out, and has to land on the same centres the flex
   row puts the nodes at. Change one and you must change the other. */
const NODE_SIZE = 96
const NODE_GAP = 48
const NODE_STEP = NODE_SIZE + NODE_GAP
/** Tall enough for the full swing (+/-64) plus a node radius either side. */
const RAIL_HEIGHT = 224

/** Node centres in the rail's own coordinate space. */
function railPoints(count) {
  return Array.from({ length: count }, (_, i) => ({
    x: NODE_SIZE / 2 + i * NODE_STEP,
    y: RAIL_HEIGHT / 2 + PATH_WAVE[i % PATH_WAVE.length],
  }))
}

/**
 * The segment of road between two nodes, as a cubic.
 *
 * The rail used to be a straight bar behind a weaving row of nodes, which is
 * the one thing a path must not be: the nodes drifted off it and the page read
 * as circles scattered over a rule. Catmull-Rom tangents (the neighbour on
 * either side, over six) make consecutive segments meet at the same slope, so
 * twenty separate cubics still read as one continuous curve -- and because
 * each gap is its own element, the road behind you can be coloured without
 * guessing at arc lengths.
 */
function segmentPath(points, i) {
  const p0 = points[i - 1] ?? points[i]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[i + 2] ?? points[i + 1]

  const c1x = p1.x + (p2.x - p0.x) / 6
  const c1y = p1.y + (p2.y - p0.y) / 6
  const c2x = p2.x - (p3.x - p1.x) / 6
  const c2y = p2.y - (p3.y - p1.y) / 6

  return `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
}

/** The drawn road. Purely decorative -- the ordered list behind it is what
 *  carries the run to assistive tech. */
function PathRail({ problems }) {
  const points = railPoints(problems.length)
  const width = problems.length * NODE_SIZE + (problems.length - 1) * NODE_GAP

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 sm:block"
      width={width}
      height={RAIL_HEIGHT}
      viewBox={`0 0 ${width} ${RAIL_HEIGHT}`}
      fill="none"
    >
      {points.slice(0, -1).map((_, i) => (
        <path
          key={i}
          d={segmentPath(points, i)}
          // Road already travelled reads as covered ground; ahead of you it
          // stays the neutral rule so the run's remaining length is still legible.
          stroke={
            problems[i + 1].state === "locked"
              ? "var(--color-rb-swan)"
              : "var(--color-rb-feather)"
          }
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
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
      className={`relative z-10 grid size-20 shrink-0 place-items-center rounded-full border-2 transition active:translate-y-[3px] active:shadow-none sm:size-24 ${
        solved
          ? DIFFICULTY_NODE[problem.difficulty] ?? DIFFICULTY_NODE.easy
          : current
            ? `${tone.border} ${tone.face} text-white shadow-[0_4px_0_rgb(0_0_0/0.18)]`
            : DIFFICULTY_NODE_LOCKED[problem.difficulty] ?? DIFFICULTY_NODE_LOCKED.easy
      }`}
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

export default function ProblemGrid({
  problems,
  onOpen,
  tone,
}) {
  const solved = problems.filter((p) => p.state === "solved").length
  const trackRef = useRef(null)
  const currentRef = useRef(null)

  // Land on the problem you are actually up to. The path is far wider than the
  // window, so starting at scrollLeft 0 put you at problem 1 with no hint that
  // your next problem was several screens away -- "centred" has to mean centred
  // on where you are, not on the middle of a route you have mostly finished.
  useEffect(() => {
    const node = currentRef.current
    if (!node) return
    // Deferred a frame: measured straight after mount the track still had the
    // stacked mobile layout, so the computed offset came out at zero and the
    // path stayed pinned to problem 1.
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ inline: "center", block: "nearest" })
    })
    return () => cancelAnimationFrame(frame)
  }, [solved])


  return (
    <div className="flex min-h-full w-full flex-col justify-center px-2 py-10 sm:px-3">
      {/* No card around the path. A lesson map is the page, not a widget on
          it -- boxing it made the run feel like one panel among several. */}
      <div className="mt-10">
        {/* A meandering path, the way a lesson map reads: the nodes themselves
            trace the route by weaving off the centre line, with no connecting
            rules drawn between them. A straight line of circles is just a grid
            with rounded corners -- it is the wander that says "route".

            The offset is one repeating 8-step wave, applied on the axis the
            layout is NOT running along: vertical page, horizontal weave; and
            the reverse on web. Carried as a custom property because the two
            axes need the same number at different breakpoints, which an inline
            transform cannot express.

            Web scrolls horizontally rather than wrapping. A wrapped wave
            restarts its phase on every row, which reads as several broken
            paths instead of one continuous run. */}
        {/* Scrolling lives on the wrapper, not the list. With `overflow-x-auto`
            on the list itself, the rail -- absolutely positioned with `w-full`
            -- sized to the *visible* width rather than the content width: the
            path ran 1676px and the rail stopped at 984px, so it vanished as
            soon as you scrolled. The list is now the scroll content and the
            rail spans it. */}
        <div
          ref={trackRef}
          className="mt-8 [&::-webkit-scrollbar]:hidden sm:overflow-x-auto"
          // The `scrollbar-hide` utility in globals.css does not reach this
          // component -- the class applied but a 15px bar still claimed space,
          // measured in the browser. Set here instead: the arbitrary variant
          // covers WebKit, the inline property covers Firefox and Chrome 121+.
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onWheel={(event) => {
            // A mouse wheel only emits deltaY, so a horizontal track is
            // unreachable without this -- you could see the path run off the
            // edge and had no way to follow it.
            const track = event.currentTarget
            if (track.scrollWidth <= track.clientWidth) return
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
            track.scrollLeft += event.deltaY
          }}
        >
        <ol
          className="relative flex flex-col items-center gap-4 sm:w-max sm:flex-row sm:justify-center sm:gap-12 sm:py-16"
          aria-label="Problem path"
        >
          {/* The road itself, drawn through the node centres. Cells carry
              z-10, so it always passes behind them. */}
          <PathRail problems={problems} />
          {/* Below sm the run is a single column and the rail is a plain rule:
              a weave on a phone-width column pushed nodes off both edges, and
              the wave is what the drawn curve exists to follow -- one straight
              road with the nodes centred on it beats a curve that has nowhere
              to go. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-rb-swan sm:hidden"
          />
          {problems.map((problem, index) => (
            <li
              key={problem.id}
              className="shrink-0 sm:translate-y-[var(--path-offset)]"
              style={{ "--path-offset": `${PATH_WAVE[index % PATH_WAVE.length]}px` }}
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

        {/* Below the path, not above it: the map is what the page is for, and
            a progress bar over the top pushed it down and read as a header. */}
        <div className="mx-auto mt-10 w-full max-w-2xl px-3">
          <div className="flex items-baseline justify-between">
            <span className="rb-eyebrow">Progress</span>
            <span className="rb-numeric text-base text-rb-wolf">
              {solved} / {problems.length} solved
            </span>
          </div>
          <ProgressBar
            value={(solved / problems.length) * 100}
            label="Run progress"
            className="mt-3 !h-5"
          />
        </div>

      </div>

    </div>
  )
}
