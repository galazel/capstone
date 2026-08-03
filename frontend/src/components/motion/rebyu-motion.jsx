import { useEffect, useRef } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useInView,
  useMotionValue,
  useReducedMotion,
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
 * `overflow: hidden` is only applied while animating — leaving it on clips
 * focus rings and any popover the panel contains once it is open.
 */
export function Collapse({ open, children, duration = 0.34 }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration, ease: EASE }, opacity: { duration: duration * 0.6 } }}
          style={{ overflow: "hidden" }}
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

export { AnimatePresence, motion, useAnimationControls, useReducedMotion }
