import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion"

/**
 * REBYU motion primitives.
 *
 * The design system already had a motion layer in `rebyu-ds.css` — `rb-pop-in`,
 * `rb-rise`, `rb-reveal` — for things CSS can do on its own. This module covers
 * what it cannot: entrances that need to know when an element scrolled into
 * view, lists that stagger, accordions that animate to `height: auto`, and
 * numbers that count. Reach for the CSS classes first; use these when the
 * animation depends on state or timing.
 *
 * Two rules hold everything together:
 *
 * 1. **One easing curve.** `EASE` is the same cubic-bezier the CSS layer uses,
 *    so a card that reveals with JS and a bar that fills with CSS decelerate
 *    identically. Mixing curves is what makes an interface feel assembled from
 *    parts.
 *
 * 2. **Reduced motion is not this module's job.** `<MotionConfig
 *    reducedMotion="user">` wraps the app in `main.jsx`, which makes every
 *    animation here collapse to an opacity change automatically. Checking the
 *    media query in each component would be four more places to forget.
 *
 * Nothing here animates layout-affecting properties on scroll except height on
 * an accordion the user just opened — transform and opacity only, so a long
 * curriculum page does not repaint on every frame.
 */

/** Shared deceleration curve. Matches `rb-reveal` in rebyu-ds.css. */
export const EASE = [0.22, 1, 0.36, 1]

/** Overshoot, for things that should feel physical: ticks, medals, badges. */
export const SPRING = { type: "spring", stiffness: 520, damping: 26, mass: 0.7 }

/* ------------------------------------------------------------------ variants */

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35, ease: EASE } },
}

export const popIn = {
  hidden: { opacity: 0, scale: 0.94, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] } },
}

/** Parent for any stagger. `delayChildren` lets a heading land first. */
export function staggerParent(stagger = 0.07, delayChildren = 0) {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  }
}

/* ---------------------------------------------------------------- components */

/**
 * Reveals its children the first time they scroll into view.
 *
 * `once` is the default and should almost always stay on: re-animating on the
 * way back up makes a page feel like it is fighting the scroll. `amount: 0.15`
 * fires when a sliver is showing, so tall cards do not wait until they are
 * nearly centred.
 */
export function Reveal({
  children,
  variants = fadeUp,
  delay = 0,
  once = true,
  amount = 0.15,
  as = "div",
  ...props
}) {
  const Component = motion[as] ?? motion.div

  return (
    <Component
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={variants}
      transition={delay ? { delay } : undefined}
      {...props}
    >
      {children}
    </Component>
  )
}

/**
 * A list whose children arrive one after another.
 *
 * Children must be `<StaggerItem>` (or any motion element using the `hidden` /
 * `show` variant names) — the parent only orchestrates timing, it does not
 * animate itself.
 */
export function StaggerList({
  children,
  stagger = 0.07,
  delayChildren = 0,
  once = true,
  amount = 0.1,
  as = "div",
  ...props
}) {
  const Component = motion[as] ?? motion.div

  return (
    <Component
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={staggerParent(stagger, delayChildren)}
      {...props}
    >
      {children}
    </Component>
  )
}

export function StaggerItem({ children, variants = fadeUp, as = "div", ...props }) {
  const Component = motion[as] ?? motion.div

  return (
    <Component variants={variants} {...props}>
      {children}
    </Component>
  )
}

/**
 * Accordion body. Animates to the content's real height rather than a guessed
 * max-height, which is the difference between an accordion that opens and one
 * that snaps at the end because the guess was too small.
 *
 * `overflow: hidden` is applied only while the height is actually moving. It
 * has to be on then, or the panel's contents spill past the animating box; it
 * must come off after, or it clips anything the open panel legitimately hangs
 * outside itself -- a focus ring, a popover, or the "start" bubble that sits
 * above the first stop on the learning path, which is how this was found: the
 * bubble was cut in half by a box that had finished animating half a second
 * earlier.
 *
 * The comment above described this behaviour before the code did.
 */
export function Collapse({ open, children, duration = 0.34 }) {
  // Starts true: the open animation runs on mount, so the first frames need
  // clipping just as much as a later toggle does.
  const [animating, setAnimating] = useState(true)

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration, ease: EASE }, opacity: { duration: duration * 0.6 } }}
          onAnimationStart={() => setAnimating(true)}
          onAnimationComplete={() => setAnimating(false)}
          style={{ overflow: animating ? "hidden" : "visible" }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * A number that counts up to its value the first time it scrolls into view.
 *
 * A motion value rendered straight as a child — framer-motion subscribes to it
 * and writes the text node itself, so counting never costs a React render per
 * frame. `useInView` starts it, rather than `whileInView`, because the thing
 * being animated is the value, not a style on the element.
 */
export function CountUp({ value, duration = 0.9, suffix = "", className }) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })

  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))

  useEffect(() => {
    if (!inView) return undefined
    if (reduced) {
      count.set(value)
      return undefined
    }

    const controls = animate(count, value, { duration, ease: EASE })
    return () => controls.stop()
  }, [inView, reduced, value, duration, count])

  return (
    <span ref={ref} className={className}>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  )
}

/**
 * The circular "pop" a tick makes when it turns green.
 *
 * Keyed on `done` so the spring re-fires on the transition into the done state
 * and never on a re-render that happens to pass the same value.
 */
export function TickPop({ done, children, className }) {
  return (
    <motion.span
      className={className}
      animate={done ? { scale: [1, 1.28, 1] } : { scale: 1 }}
      transition={done ? { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] } : { duration: 0.2 }}
    >
      {children}
    </motion.span>
  )
}

/**
 * A short horizontal shake. Used for a refused action — clicking a locked unit
 * — where the answer is "no" and the control should say so where the finger
 * already is, rather than only in a dialog that appears elsewhere.
 */
export function useShake() {
  return {
    shake: { x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: 0.45 } },
    still: { x: 0 },
  }
}

/**
 * Hover and press response for a card-shaped target.
 *
 * A wrapper rather than a prop on `RebyuCard` because the card is a plain div
 * that does not forward refs, and because the lift belongs to the whole grid
 * cell rather than to the card's own surface — nesting keeps the DS card
 * untouched, and leaves the card's own transform free for the CSS reveal layer.
 *
 * The spring is soft on purpose. `SPRING` above is tuned for a tick popping
 * green; reused on a 400px card it reads as a wobble.
 */
export const HOVER_SPRING = { type: "spring", stiffness: 320, damping: 30, mass: 0.8 }

export function HoverLift({ children, lift = -6, scale = 1.015, as = "div", ...props }) {
  const Component = motion[as] ?? motion.div

  return (
    <Component
      whileHover={{ y: lift, scale }}
      whileTap={{ y: lift / 2, scale: 0.995 }}
      transition={HOVER_SPRING}
      {...props}
    >
      {children}
    </Component>
  )
}

/* ----------------------------------------------------------------- lettering */

/**
 * Types a line out one character at a time when it scrolls into view.
 *
 * Three things this has to get right, and only the first is the animation:
 *
 * 1. **No layout shift.** A span that grows from empty to full width reflows
 *    everything beside it on every frame. The full string is rendered first as
 *    an invisible spacer and the typed text is laid over it absolutely, so the
 *    box is its final size before the first character lands.
 * 2. **Screen readers get the sentence, not the performance.** The visual half
 *    is `aria-hidden` and the full string is repeated in an `sr-only` span —
 *    otherwise assistive tech announces a partial word on every keystroke.
 * 3. **The caret retires.** A cursor that blinks forever beside finished copy
 *    reads as a page still loading. It fades out shortly after the last
 *    character.
 *
 * Reduced motion prints the whole line immediately: `MotionConfig` cannot help
 * here because the typing is state, not a transition.
 */
export function Typewriter({
  text,
  as = "span",
  className,
  speed = 45,
  startDelay = 0.2,
  caret = true,
  startOnMount = false,
}) {
  const Component = motion[as] ?? motion.span
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [typed, setTyped] = useState(0)

  /* `startOnMount` for anything in the fold. An observer cannot report an
     element that was already on screen before it was created, so a hero line
     gated on `inView` sits empty until the first scroll — which, on a page
     whose first line this is, may be never. */
  const active = startOnMount || inView
  const done = typed >= text.length

  useEffect(() => {
    if (!active) return undefined
    if (reduced) {
      setTyped(text.length)
      return undefined
    }

    setTyped(0)
    let index = 0
    let ticker

    const opening = window.setTimeout(() => {
      ticker = window.setInterval(() => {
        index += 1
        setTyped(index)
        if (index >= text.length) window.clearInterval(ticker)
      }, speed)
    }, startDelay * 1000)

    return () => {
      window.clearTimeout(opening)
      window.clearInterval(ticker)
    }
  }, [active, reduced, text, speed, startDelay])

  return (
    <Component ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="relative inline-block whitespace-pre">
        <span className="invisible">{text}</span>
        <span className="absolute inset-0">
          {text.slice(0, typed)}
          {caret && !reduced ? (
            <motion.span
              className="ml-0.5 inline-block w-[0.07em] self-stretch bg-current align-[-0.1em]"
              style={{ height: "1em" }}
              animate={done ? { opacity: 0 } : { opacity: [1, 1, 0, 0] }}
              transition={
                done
                  ? { duration: 0.4, delay: 0.9, ease: EASE }
                  : { duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }
              }
            />
          ) : null}
        </span>
      </span>
    </Component>
  )
}

/**
 * One slot, several words, swapped on a timer.
 *
 * The words are all rendered stacked in a single grid cell — every one of them,
 * invisibly — so the slot is as wide as the longest and as tall as the tallest
 * before anything rotates. Sizing to the current word instead is what makes the
 * sentence beside it twitch on every swap.
 *
 * `mode="wait"` so the outgoing word is gone before the next arrives: two words
 * crossfading in the same cell is unreadable at any speed.
 *
 * Reduced motion holds the first word and never starts the timer. This is
 * content that changes on its own, which is exactly what that setting is for.
 */
export function RotatingText({
  words,
  interval = 2400,
  className,
  itemClassName,
  travel = "0.55em",
}) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduced || words.length < 2) return undefined

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length)
    }, interval)

    return () => window.clearInterval(timer)
  }, [reduced, words.length, interval])

  return (
    <span className={`inline-grid align-bottom ${className ?? ""}`}>
      {words.map((word) => (
        <span
          key={word}
          aria-hidden="true"
          className={`invisible col-start-1 row-start-1 ${itemClassName ?? ""}`}
        >
          {word}
        </span>
      ))}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[index]}
          className={`col-start-1 row-start-1 ${itemClassName ?? ""}`}
          initial={{ opacity: 0, y: `-${travel}` }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: travel }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * A heading that arrives a word at a time.
 *
 * Split on words, never on characters: a headline dealt out letter by letter
 * takes long enough that the reader starts reading before it finishes, and each
 * character needs its own box, which breaks the line-breaking the type was set
 * for. Words keep the wrap intact and still give the line its cadence.
 *
 * `inherit` hands the timing to an ancestor that is already running a stagger —
 * the hero, where the eyebrow, claim, lead and buttons are one sequence. On its
 * own it fires when scrolled into view.
 */
export function WordReveal({
  text,
  as = "span",
  className,
  wordClassName,
  stagger = 0.055,
  inherit = false,
  once = true,
}) {
  const Component = motion[as] ?? motion.span
  const words = text.split(" ")
  const ref = useRef(null)
  const inView = useInView(ref, { once, amount: 0.4 })
  const [rescued, setRescued] = useState(false)

  /* Safety net, and the reason this drives `animate` by hand instead of using
     `whileInView`. Every heading on a page is hidden until an observer says
     otherwise, so an observer that never reports is not a missed animation —
     it is a page with no headings on it. Once, shortly after mount, anything
     already inside the viewport is shown regardless. Headings further down are
     left alone: they have a scroll coming that will report them normally.

     `.rb-reveal` in the landing page does the same thing for the same reason. */
  useEffect(() => {
    if (inherit) return undefined

    const timer = window.setTimeout(() => {
      const node = ref.current
      if (!node) return
      const box = node.getBoundingClientRect()
      if (box.top < window.innerHeight && box.bottom > 0) setRescued(true)
    }, 1400)

    return () => window.clearTimeout(timer)
  }, [inherit])

  const parent = staggerParent(stagger)
  const child = {
    hidden: { opacity: 0, y: "0.35em" },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  }

  const driver = inherit
    ? {}
    : { initial: "hidden", animate: inView || rescued ? "show" : "hidden" }

  return (
    <Component ref={inherit ? undefined : ref} className={className} variants={parent} {...driver}>
      {words.map((word, i) => (
        /* `inline-block` on a wrapper that keeps the trailing space outside it:
           a transformed inline box collapses its own whitespace, so words would
           run together the moment they animated. */
        <span key={`${word}-${i}`} className="inline-block whitespace-pre">
          <motion.span variants={child} className={`inline-block ${wordClassName ?? ""}`}>
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </Component>
  )
}

/**
 * Hover response for something inline — a nav link, a footer link, a stat.
 *
 * `HoverLift` above is for cards: it moves the target up the page, which only
 * makes sense for a block with room around it. Scaling in place is the inline
 * equivalent, and `inline-block` is required — `transform` does nothing to a
 * plain inline box.
 */
export function HoverScale({ children, scale = 1.06, as = "span", className, ...props }) {
  const Component = motion[as] ?? motion.span

  return (
    <Component
      className={`inline-block ${className ?? ""}`}
      whileHover={{ scale }}
      whileTap={{ scale: 1 + (scale - 1) * 0.4 }}
      transition={HOVER_SPRING}
      {...props}
    >
      {children}
    </Component>
  )
}

/**
 * Turns the scroll through a section into a step counter and a fill.
 *
 * For a sequence whose whole point is its order — a four-step method, a
 * pipeline — laid out as a row. A row reveals all of itself at once, which is
 * the one thing an ordered list should not do: the reader is told "in this
 * order, every time" and then handed four boxes that arrived together. Tying
 * the steps to scroll position puts them back in sequence, and gives the
 * section a progress bar that is the section's own progress.
 *
 * Returns `fill`, a 0–1 motion value for `style={{ scaleX }}` on the rail, and
 * `active`, how many steps have been reached. `active` is state rather than a
 * motion value because it drives class names, not just style.
 *
 * `Math.ceil` so step one lights the moment the section is entered rather than
 * a quarter of the way through it — the first step of four should not need
 * scrolling to earn.
 *
 * Reduced motion reports everything reached immediately. A reader who has asked
 * for less movement still needs all four steps.
 */
export function useScrollSteps(ref, count, offset = ["start 72%", "end 62%"]) {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const smoothed = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 })
  const fill = useTransform(smoothed, (value) =>
    reduced ? 1 : Math.min(1, Math.max(0, value)),
  )
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (reduced) {
      setActive(count)
      return undefined
    }

    const sync = (value) => {
      const next = Math.min(count, Math.max(0, Math.ceil(value * count)))
      setActive((current) => (current === next ? current : next))
    }

    /* Counted off the raw progress, not the spring. The spring exists to keep
       the rail from stepping with the wheel's own quantisation; a step that
       lights up is a discrete event, and running it through a spring only makes
       it late. The bar eases, the count does not. */
    sync(scrollYProgress.get())
    return scrollYProgress.on("change", sync)
  }, [scrollYProgress, count, reduced])

  return { fill, active }
}

/**
 * Scroll-linked vertical parallax for a decorative element.
 *
 * Returns a motion value for `style={{ y }}`. It travels from `+distance` to
 * `-distance` across the window the target spends on screen, so the element
 * drifts against the scroll instead of riding with it.
 *
 * Two things this has to do itself:
 *
 * 1. **Reduced motion.** `<MotionConfig reducedMotion="user">` only rewrites
 *    animations it drives. A motion value piped straight into `style` is not
 *    an animation as far as that setting is concerned, so it would keep moving.
 *    Pinned to 0 here instead — the one exception to rule 2 at the top of this
 *    file, and the reason it is spelled out rather than left implied.
 *
 * 2. **Smoothing.** Raw `scrollYProgress` is exact but steps with the scroll
 *    wheel's own quantisation. A light spring turns those steps into a glide.
 *
 * Only pass elements that carry no meaning — a wash blob, an oversized
 * wordmark. Parallaxing text is how a reader loses their line.
 */
export function useParallax(ref, distance = 60, offset = ["start end", "end start"]) {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const smoothed = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 })
  const travel = reduced ? 0 : distance

  return useTransform(smoothed, [0, 1], [travel, -travel])
}

export { AnimatePresence, motion, useAnimationControls, useReducedMotion }
