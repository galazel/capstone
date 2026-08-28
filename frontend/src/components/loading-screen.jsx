import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

/**
 * Boot screen.
 *
 * An atom: three tilted orbits turning against each other, in the product's
 * own tones. It
 * replaces a road that painted itself checkpoint by checkpoint: the road was
 * the better metaphor, but it was a wide horizontal figure that only worked at
 * a size which left the rest of the screen empty, and it took two seconds to
 * complete a statement nobody waits around to read. A disc says "working" in
 * the first frame and is honest at any size.
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
/* The bar's segments, left to right, each in its own tone.

   Five is the count that reads as a bar rather than as a row of separate
   things: at three the gaps dominate and it looks like a rating, and past six
   the segments get too narrow to carry a colour at this width.

   Tones rather than one repeated colour, because a five-segment bar in a
   single hue is a progress bar, and this measures nothing -- the sweep is the
   product's palette moving, not a percentage climbing. */
const BAR_TONES = [
  "var(--color-rb-macaw)",
  "var(--color-rb-bee)",
  "var(--color-rb-beetle)",
  "var(--color-rb-fox)",
  "var(--color-rb-feather)",
]

/** One full pass of the bar, in seconds. */
const BAR_CYCLE = 1.9

/**
 * The figure: five boxes filling left to right, over and over.
 *
 * Each segment wipes in from its own left edge rather than fading, so the
 * motion has a direction -- a row of boxes pulsing in place reads as an error
 * state, and a row that travels reads as work being done. The stagger is a
 * fraction of the cycle rather than the whole of it, so segments overlap and
 * the bar is never entirely empty mid-pass.
 */
function LoadingBar({ still }) {
  return (
    <div className="flex w-full items-center gap-2" aria-hidden="true">
      {BAR_TONES.map((tone, index) => (
        /* The track holds the segment's shape while it is empty. Without it
           the bar collapses to nothing between passes and the layout jumps. */
        <span
          key={tone}
          className="h-3.5 flex-1 overflow-hidden rounded-rb-pill bg-rb-swan"
        >
          <motion.span
            className="block h-full w-full rounded-rb-pill"
            style={{ background: tone, transformOrigin: "left center" }}
            initial={{ scaleX: still ? 1 : 0 }}
            animate={still ? { scaleX: 1 } : { scaleX: [0, 1, 1, 0] }}
            transition={
              still
                ? undefined
                : {
                    duration: BAR_CYCLE,
                    // Fill quickly, hold, then clear — a linear 0..1 alone
                    // would spend the whole cycle mid-wipe and never look full.
                    times: [0, 0.4, 0.75, 1],
                    ease: "easeInOut",
                    repeat: Infinity,
                    delay: index * (BAR_CYCLE / BAR_TONES.length) * 0.45,
                  }
            }
          />
        </span>
      ))}
    </div>
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
    /* Figure, then a line worth reading, centred as one block on the
       product's own light ground.

       There was a second indicator at the foot of the screen -- a sweeping
       ring, from the splash screen this layout was taken from. On that screen
       the thing above it was an illustration; here it is a loading bar, and
       two indicators for one wait is one too many. The bar keeps the job and
       the ring is gone, which also lets the composition centre instead of
       being spread to reach a foot it no longer has. */
    <div className="rebyu-ds flex min-h-svh flex-col items-center justify-center bg-rb-snow px-6 py-14">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="w-64 max-w-full">
          <LoadingBar still={reduced} />
        </div>

        {/* The live region is this container, not the line inside it. A live
            region has to be in the DOM *before* its contents change for the
            change to be announced, and AnimatePresence unmounts and remounts
            the line on every swap -- announcing from there is unreliable.

            The fixed height stops the atom above from shifting when a longer
            message arrives. */}
        <div
          className="mt-10 flex h-36 w-full flex-col items-center justify-start"
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
              className="flex flex-col items-center"
            >
              {/* The line is the hero now, at display size. It carries no
                  quotation marks: these are statements about what the product
                  is doing, and punctuating them as quotations would attribute
                  them to someone. */}
              <p className="text-balance text-center font-rb-display text-3xl font-extrabold lowercase leading-tight text-rb-eel sm:text-4xl">
                {current.text}
              </p>

              {/* The rule and the label under it: the reference's attribution
                  slot, holding the stage rather than a name. */}
              <span className="mt-5 block h-0.5 w-10 rounded-rb-pill bg-rb-swan" aria-hidden="true" />

              <p
                className={`mt-4 rounded-rb-control px-3 py-1 font-rb-display text-[11px] font-extrabold uppercase tracking-[0.18em] ${
                  TAG_TONE[current.tone]
                }`}
              >
                {current.tag}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </div>
  )
}
