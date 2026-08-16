import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

/**
 * Boot screen.
 *
 * A spinner says "wait"; this says what the product is. The figure is the same
 * road the arenas draw for a run of problems — a path with checkpoints on it —
 * so the first thing a learner ever sees is the metaphor the rest of the app
 * uses for progress. The road paints itself, and each checkpoint lights as the
 * paint reaches it, which is the same lighting-up the curriculum's ticks do
 * when a lesson is finished.
 *
 * Built to be seen for a quarter of a second. Everything is on screen by the
 * first frame — nothing fades in from nothing, no build-up before the figure
 * exists — because a boot screen that looks good only after a second is a boot
 * screen you have never actually looked at. The loop runs about two seconds and
 * is designed to be entered and left at any point in its cycle.
 *
 * The honest caveat: the best loading screen is one nobody has time to admire.
 * If this is on screen long enough to enjoy, something upstream is too slow.
 */

/* Each line wears a tag, and the tag takes one of the road's own tones, so the
   label under the figure is visibly part of the same palette rather than a
   caption bolted beneath it. Kept to one word: it is a marker for what is being
   prepared, not a second sentence competing with the first. */
const MESSAGES = [
  { tag: "confidence", text: "Building your confidence...", tone: "macaw" },
  { tag: "mastery", text: "Syncing your mastery...", tone: "bee" },
  { tag: "study plan", text: "Leveling up your study plan...", tone: "beetle" },
  { tag: "challenge", text: "Loading your next challenge...", tone: "fox" },
]

/**
 * Copy for the wait after submitting an assessment.
 *
 * A different wait deserves different words. Submitting runs real work — string
 * and structural marking, an AI pass over written answers, Judge0 over any code
 * — and "Loading your next challenge..." during it would describe something
 * that is not happening. These name the actual stages, in the order the server
 * performs them, so the screen reads as progress rather than as a stall.
 */
export const GRADING_MESSAGES = [
  { tag: "answers", text: "Checking your answers...", tone: "macaw" },
  { tag: "written", text: "Marking your written responses...", tone: "beetle" },
  { tag: "code", text: "Running your code against the tests...", tone: "fox" },
  { tag: "score", text: "Totalling your score...", tone: "bee" },
]

/**
 * Copy for the wait before an attempt opens.
 *
 * Starting one is not free either: the server creates the attempt, snapshots
 * every question learner-safe so a later edit to the bank cannot change a paper
 * mid-sitting, picks the question set (a retake's set is chosen against what
 * was missed last time), and hands back any answers already autosaved.
 *
 * This replaces three grey blocks. A skeleton is a promise about layout —
 * "text goes here, a box goes there" — which is the right shape for a list
 * arriving, and the wrong one for a paper being built: nothing on this screen
 * is laid out until the server has said what the questions are.
 */
export const ATTEMPT_MESSAGES = [
  { tag: "paper", text: "Setting out your paper...", tone: "macaw" },
  { tag: "questions", text: "Picking your questions...", tone: "beetle" },
  { tag: "answers", text: "Restoring any answers you saved...", tone: "bee" },
  { tag: "ready", text: "Almost ready...", tone: "fox" },
]

const TAG_TONE = {
  macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
  bee: "bg-rb-bee-wash text-rb-bee-ink",
  beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
  fox: "bg-rb-fox-wash text-rb-fox-lip",
}

/* ------------------------------------------------------------------ geometry */

/* Checkpoints first, road second: the path is built *through* these points, so
   a node can never drift off the line it is supposed to sit on. Alternating y
   is what makes it read as a journey rather than a progress bar with dots. */
const NODES = [
  { x: 26, y: 74, tone: "var(--color-rb-macaw)", lip: "var(--color-rb-macaw-lip)" },
  { x: 94, y: 42, tone: "var(--color-rb-bee)", lip: "var(--color-rb-bee-lip)" },
  { x: 162, y: 76, tone: "var(--color-rb-beetle)", lip: "var(--color-rb-beetle-lip)" },
  { x: 230, y: 40, tone: "var(--color-rb-fox)", lip: "var(--color-rb-fox-lip)" },
  { x: 298, y: 70, tone: "var(--color-rb-feather)", lip: "var(--color-rb-feather-lip)" },
]

/** Catmull-Rom through the checkpoints, so consecutive curves meet at the same
 *  slope and the whole thing reads as one continuous road. */
function roadPath(points) {
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

const ROAD = roadPath(NODES)

/** One full paint of the road, in seconds. */
const SWEEP = 2.1

/* --------------------------------------------------------------- components */

function Road({ still }) {
  return (
    <svg
      viewBox="0 0 324 116"
      className="w-full"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      {/* Kerb, then carriageway. Two strokes rather than one with a border,
          because SVG has no border and a filter would cost a repaint a frame. */}
      <path d={ROAD} stroke="rgb(0 0 0 / 0.06)" strokeWidth={18} strokeLinecap="round" />
      <path d={ROAD} stroke="var(--color-rb-swan)" strokeWidth={14} strokeLinecap="round" />

      {/* The paint. `pathLength="1"` normalises the curve's arc length so the
          travelled share is a plain 0..1 number rather than something that has
          to be measured off four cubics. */}
      <motion.path
        d={ROAD}
        pathLength="1"
        stroke="var(--color-rb-feather)"
        strokeWidth={14}
        strokeLinecap="round"
        initial={{ pathLength: still ? 1 : 0 }}
        animate={still ? { pathLength: 1 } : { pathLength: [0, 1] }}
        transition={
          still
            ? { duration: 0 }
            : { duration: SWEEP, ease: [0.45, 0, 0.55, 1], repeat: Infinity, repeatDelay: 0.35 }
        }
      />

      {/* Centre line last, so it sits on top of both the unpainted road and the
          painted one and the road reads as one surface throughout. */}
      <path
        d={ROAD}
        stroke="white"
        strokeWidth={2.5}
        strokeDasharray="7 9"
        strokeLinecap="round"
        opacity={0.85}
      />

      {NODES.map((node, index) => {
        // Each checkpoint lights as the paint arrives, so the sequence is a
        // consequence of the sweep rather than a second animation running
        // alongside it and slowly drifting out of step.
        const arrival = (index / (NODES.length - 1)) * SWEEP

        return (
          <g key={node.x}>
            {/* Checkpoints ride about twice the road's width, the same ratio
                the arena roadmap uses — any closer and they read as bulges in
                the road rather than stops on it. The offset circle underneath
                is the lip, so a node has the same solid-with-a-lip weight as
                every other control in the system. */}
            <circle cx={node.x} cy={node.y + 3} r={15} fill={node.lip} opacity={0.9} />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={15}
              fill={node.tone}
              initial={{ scale: still ? 1 : 0.55 }}
              animate={still ? { scale: 1 } : { scale: [0.55, 1.18, 1] }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              transition={
                still
                  ? { duration: 0 }
                  : {
                      duration: 0.5,
                      times: [0, 0.55, 1],
                      ease: [0.34, 1.56, 0.64, 1],
                      repeat: Infinity,
                      repeatDelay: SWEEP + 0.35 - 0.5,
                      delay: arrival,
                    }
              }
            />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * @param messages  Optional replacement for the boot copy — pass
 *                  `GRADING_MESSAGES` when the wait is a submission being
 *                  marked. The figure is deliberately unchanged: it is the
 *                  product's shape for "something is in progress", and swapping
 *                  it per wait would make each one look like a different app.
 */
export function LoadingScreen({ messages = MESSAGES }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const reduced = useReducedMotion()
  // Guarded against an empty array, and modulo'd rather than indexed directly:
  // the interval below keeps counting against whatever list was current when it
  // was scheduled, so a shorter list arriving mid-cycle must not read past its
  // own end and blank the line.
  const list = messages?.length ? messages : MESSAGES
  const current = list[messageIndex % list.length]

  useEffect(() => {
    if (reduced) return undefined
    const id = setInterval(() => {
      setMessageIndex((current) => (current + 1) % list.length)
    }, 1900)
    return () => clearInterval(id)
  }, [reduced, list.length])

  return (
    <div className="rebyu-ds flex min-h-svh flex-col items-center justify-center bg-rb-snow px-6">
      {/* No wordmark. The figure is the whole screen — a logo above it would
          make the road decoration under a title, which is the arrangement every
          other splash screen already uses. Capped so it does not sprawl on an
          ultrawide. */}
      <div className="flex w-full max-w-4xl flex-col items-center">
        <div className="w-full">
          <Road still={reduced} />
        </div>

        {/* Tag and line swap together as one unit, so the colour, the label and
            the sentence never disagree about which stage is being shown. The
            fixed height stops the road above from shifting when a longer
            message arrives. */}
        {/* The live region is this container, not the line inside it. A live
            region has to be in the DOM *before* its contents change for the
            change to be announced, and AnimatePresence unmounts and remounts
            the line on every swap — announcing from there is unreliable. */}
        <div
          className="mt-12 flex h-24 flex-col items-center justify-start"
          role="status"
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={messageIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-4"
            >
              <span
                className={`rounded-rb-pill px-4 py-1.5 font-rb-display text-xs font-extrabold uppercase tracking-[0.18em] ${
                  TAG_TONE[current.tone]
                }`}
              >
                {current.tag}
              </span>

              <p className="text-center text-xl font-bold text-rb-wolf sm:text-2xl">
                {current.text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
