import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Award, Zap } from "@/components/icons"
import { AnimatePresence, CountUp, motion } from "@/components/motion/rebyu-motion.jsx"
import { Confetti } from "@/components/motion/confetti.jsx"
import { achievementBadge, achievementKey, earnedAchievementKeys } from "@/lib/achievements.js"
import { getLearnerPortalData } from "@/services/learnerService.js"
import { playAchievementChime } from "@/lib/sound.js"

/**
 * The "you just earned something" moment, as a modal.
 *
 * A toast first, which was wrong: XP lands at exactly the moment other toasts
 * do (lesson saved, attempt submitted, streak recorded), so the one message
 * the learner actually wants to see got stacked in with the plumbing and
 * scrolled past. This is the payoff for finishing something -- it earns the
 * interruption, and it is the only thing on screen while it is up.
 *
 * Hosted once at the app root rather than per page. The assessment flow
 * navigates to the results page immediately after submitting, and a modal
 * owned by the submitting page would unmount mid-animation.
 *
 * One host, one queue, for every kind of payoff. A lesson can pay XP *and*
 * unlock an achievement in the same submit; two independently-hosted dialogs
 * would then both open and fight over the overlay, so they take turns here
 * instead -- "keep going" advances to the next card.
 */

let currentListener = null
// Buffers anything published while the host is between mounts (a hard
// navigation right after a completion), so that award is shown rather than
// dropped on the floor.
let pending = []

/* Identity for a card, so the queue can tell two of them apart.
   Two achievements unlocked by one action can carry the same title and the
   same badge; without an id of its own the second would look to React — and
   to the confetti and the chime — like the first still being on screen, and
   would arrive in silence with no burst. */
let nextCardId = 0

function publishCelebration(card) {
  nextCardId += 1
  const withId = { ...card, id: nextCardId }
  if (currentListener) {
    currentListener((queue) => [...queue, withId])
    return
  }
  pending = [...pending, withId]
}

/* How long a card holds the screen before the next one takes over. An
   achievement carries a name and a sentence to read; an XP card is a number.
   Both are floors rather than guesses at reading speed — nothing is dismissed
   by them, the celebration simply ends. */
const HOLD_MS = { achievement: 3600, xp: 2600 }

function XpAwardModal() {
  const [queue, setQueue] = useState([])

  useEffect(() => {
    currentListener = setQueue
    if (pending.length > 0) {
      const buffered = pending
      pending = []
      setQueue((current) => [...current, ...buffered])
    }
    return () => {
      currentListener = null
    }
  }, [])

  const card = queue[0] ?? null
  const dismiss = () => setQueue((current) => current.slice(1))

  /* The card leaves on its own.

     This was a modal: an overlay, a focus trap, and a button you had to press
     before the app would respond again. That is the right shape for a question
     and the wrong one for a compliment -- finishing a lesson put a wall in
     front of the learner and made them clear it, and a certification that
     landed three achievements made them clear it three times. Nothing here
     asks anything, so nothing here waits for an answer.

     Keyed on the id rather than the object: `queue[0]` is a fresh reference on
     every render, which would restart the timer continuously and leave the
     first card up forever. */
  useEffect(() => {
    if (!card) return undefined
    const id = setTimeout(dismiss, HOLD_MS[card.kind] ?? HOLD_MS.xp)
    return () => clearTimeout(id)
  }, [card?.id])

  /* Achievements only. XP is the ordinary outcome of finishing anything --
     every lesson and every attempt pays it -- and paper for the ordinary case
     leaves nothing to mark the rare one. Keyed by card id so a second
     achievement queued behind the first gets its own burst rather than
     sitting under one already thrown. */
  const confettiKey = card?.kind === "achievement" ? String(card.id) : null

  /* An effect rather than a call during render: render runs twice under
     StrictMode in development, and a sound played from the render body would
     be audibly doubled. */
  useEffect(() => {
    if (!confettiKey) return
    playAchievementChime()
  }, [confettiKey])

  return (
    <>
      <Confetti fire={confettiKey} />

      {/* A full-page takeover for the moment of the award.

          It was a card floating at the top of the page, which put it over
          whatever the learner was reading -- on the results screen it landed
          squarely on the score summary, so the thing they came to see looked
          missing until the card timed out. Covering the page states plainly
          that this is a moment of its own: nothing behind it competes, and
          nothing behind it appears broken.

          Still not a dialog. Nothing traps focus, and it leaves on its own
          after its hold -- `role="status"` with `aria-live="polite"`
          announces the award without dragging a keyboard user out of what
          they were doing.

          `rebyu-ds` because this renders outside whatever page is underneath
          it and the design system's component classes are scoped to that
          layer. */}
      <AnimatePresence mode="wait">
        {card ? (
          <motion.div
            key={card.id}
            /* `m-auto` on the child rather than `justify-center` here: a
               centred flex item that grows taller than the scroll container
               has its top clipped *outside* the scrollable area, so on a short
               window the badge would be unreachable. Auto margins collapse to
               zero when the content no longer fits, which leaves it scrollable
               instead. */
            className="rebyu-ds fixed inset-0 z-[60] flex overflow-y-auto bg-rb-polar px-6 py-10 text-center"
            role="status"
            aria-live="polite"
            // The ground fades; the content inside it arrives with the spring
            // the rest of the product moves by (see the inner element).
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            // Anywhere on the page dismisses it. With the award covering
            // everything, a click can only mean "I have seen it" -- and
            // hunting for the one link to press would be a toll gate.
            onClick={dismiss}
          >
            <motion.div
              className="m-auto w-full max-w-md"
              initial={{ opacity: 0, y: -48, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="flex flex-col items-center">
                {card.kind === "achievement" ? (
                  <AchievementCard card={card} />
                ) : (
                  <XpCard card={card} />
                )}
              </div>

              {/* The named way out. Pressing anywhere does the same thing,
                  but a celebration should still say how to leave rather than
                  make the learner guess that the page is clickable.

                  A text link rather than the filled button it was: the button
                  was the loudest thing on screen and read as a call to action
                  for something the learner never asked to start. Nothing here
                  asks a question, so nothing here needs a primary control.

                  `stopPropagation` because the overlay behind it dismisses on
                  click too, and two dismissals in one event pop two cards off
                  the queue -- so pressing this on the first of three
                  achievements would silently eat the second.

                  `queue.length > 1` names what pressing it does. On the last
                  card it ends the celebration; before that it advances to the
                  next badge, and "next" is the honest word for that. */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  dismiss()
                }}
                className="mt-4 inline-block rounded-rb-control px-3 py-1 font-rb-display text-sm font-extrabold lowercase text-rb-wolf underline-offset-4 transition-colors hover:text-rb-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw"
              >
                {queue.length > 1 ? "next" : "continue"}
              </button>

              {/* The hold, drawn. Without it the award vanishing mid-read
                  looks like a bug; with it the learner can see the time
                  running and knows pressing is a shortcut, not the only way
                  out. */}
              <motion.span
                className="mt-3 block h-1 rounded-rb-pill bg-rb-swan"
                aria-hidden="true"
              >
                <motion.span
                  className="block h-full rounded-rb-pill bg-rb-macaw"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: (HOLD_MS[card.kind] ?? HOLD_MS.xp) / 1000, ease: "linear" }}
                />
              </motion.span>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function XpCard({ card }) {
  return (
    <>
      <motion.span
        className="grid size-16 place-items-center rounded-3xl bg-rb-bee text-white"
        initial={{ scale: 0.5, rotate: -20 }}
        animate={{ scale: [0.5, 1.16, 1], rotate: 0 }}
        transition={{ duration: 0.52, ease: [0.34, 1.56, 0.64, 1] }}
        aria-hidden="true"
      >
        <Zap className="size-8" />
      </motion.span>

      <p className="mt-4 font-rb-display text-2xl font-extrabold lowercase leading-none text-rb-eel">
        {card.title}
      </p>

      <motion.p
        className="mt-3 font-rb-display text-4xl font-black leading-none text-rb-bee-lip"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.3 }}
      >
        +{card.gained} XP
      </motion.p>

      <p className="mt-2 text-sm font-bold text-rb-wolf">
        {/* Counts from zero, not from the previous balance: the header
            counter behind the overlay has already been refetched, so
            animating between the two would read as a correction. */}
        <CountUp value={card.total} className="tabular-nums" /> XP total
      </p>
    </>
  )
}

function Badge({ achievement, className }) {
  const badge = achievementBadge(achievement)
  return badge ? (
    <img src={badge} alt="" className={`object-contain drop-shadow ${className}`} />
  ) : (
    <span className={`grid place-items-center rounded-3xl bg-rb-bee text-white ${className}`}>
      <Award className="size-1/2" aria-hidden="true" />
    </span>
  )
}

/**
 * One unlocked achievement: badge over a title ribbon.
 *
 * The arrangement games have used for a reward screen for twenty years, and
 * they use it because it reads in the half-second before anyone chooses to
 * look. The badge breaks the top edge of the ribbon rather than sitting neatly
 * inside a box, which is the whole trick -- an object that overlaps its own
 * frame reads as having *arrived* on the card rather than as having been laid
 * out on it.
 *
 * Singular by construction: `announceRewards` publishes a card per badge.
 */
function AchievementCard({ card }) {
  const achievement = card.achievement

  return (
    <>
      <div className="relative flex w-full flex-col items-center">
        {/* The shine behind the badge. A soft radial rather than a hard ring:
            a ring would draw a second edge competing with the badge's own. */}
        <motion.span
          className="pointer-events-none absolute -top-4 size-60 rounded-full bg-rb-beetle/25 blur-2xl"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          aria-hidden="true"
        />

        {/* The badge, above the ribbon and overlapping it. `z-10` because the
            ribbon that follows would otherwise paint over its lower half. */}
        <motion.div
          className="relative z-10 grid size-44 place-items-center drop-shadow-[0_10px_10px_rgb(0_0_0/0.26)]"
          initial={{ scale: 0.3, rotate: -18, y: -10 }}
          animate={{ scale: [0.3, 1.18, 1], rotate: 0, y: 0 }}
          transition={{ duration: 0.62, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Badge achievement={achievement} className="size-full" />
        </motion.div>

        {/* The ribbon. Its ends are notched inward, which is what makes a band
            of colour read as a ribbon rather than as a coloured rectangle, and
            the darker tails behind it are the fold. Unrolls from the centre so
            the badge lands first and the name arrives under it. */}
        <motion.div
          className="relative -mt-9 w-full"
          initial={{ scaleX: 0.2, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.16, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* The folds, behind and a shade darker, poking out at each end. */}
          <span
            className="absolute -left-1 top-2 h-8 w-8 bg-rb-beetle-lip"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 70%)" }}
            aria-hidden="true"
          />
          <span
            className="absolute -right-1 top-2 h-8 w-8 bg-rb-beetle-lip"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 70%, 0 100%)" }}
            aria-hidden="true"
          />

          <div
            className="relative grid h-12 place-items-center bg-rb-beetle px-8"
            style={{
              clipPath:
                "polygon(0 0, 100% 0, calc(100% - 18px) 50%, 100% 100%, 0 100%, 18px 50%)",
            }}
          >
            <p className="truncate font-rb-display text-lg font-extrabold lowercase leading-none text-white">
              {achievement?.title}
            </p>
          </div>
        </motion.div>
      </div>

      <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-rb-wolf">
        Achievement unlocked
      </p>

      <p className="mt-2 text-sm font-bold leading-5 text-rb-wolf">
        {achievement?.description}
      </p>
    </>
  )
}

export { XpAwardModal }

const PORTAL_KEY = ["learner-portal-data"]

/**
 * What the learner had before the thing they just did.
 *
 * Take it BEFORE the request is sent (react-query's `onMutate` is the spot),
 * because both announcements are before/after diffs: XP and achievements are
 * decided server-side, so the payload the browser gets back is the only
 * evidence either changed.
 *
 * `ensureQueryData`, not `getQueryData`: the assessment pages render outside
 * `LearnerLayout` and never subscribe to the portal query, so on a hard load
 * straight into an attempt there is nothing in the cache to diff against.
 * Reading `undefined` there would make every already-earned badge look new.
 */
export async function snapshotRewards(queryClient) {
  const data = await queryClient
    .ensureQueryData({ queryKey: PORTAL_KEY, queryFn: getLearnerPortalData })
    .catch(() => null)

  return {
    xp: Number(data?.totalXp) || 0,
    achievements: earnedAchievementKeys(data?.achievements),
  }
}

/**
 * Refetches the portal payload the completion just changed and celebrates
 * whatever it gained: the XP delta, then every newly unlocked achievement.
 *
 * `fetchQuery`, not `invalidateQueries`: invalidate only refetches queries
 * that something is currently observing. The assessment attempt page observes
 * nothing here, so the "after" read returned the very same pre-award snapshot
 * -- the XP modal quietly degraded to its "nothing was credited" toast and an
 * achievement earned by that submission could never be noticed. Fetching
 * directly also updates the cache every observer shares, so the header's XP
 * counter has already moved by the time the modal appears.
 *
 * The XP amount shown is the real delta, never the nominal 100/300. Awards are
 * idempotent server-side -- a lesson re-marked complete or an exam retaken pays
 * nothing -- so quoting the nominal figure would promise XP that was never
 * credited. A no-op award gets a plain toast instead of a modal: there is no
 * reward to celebrate, and blocking the page to say "nothing happened" is the
 * one case where an interruption is not earned. Achievements have no such
 * fallback; an unchanged catalog simply says nothing.
 *
 * @param before   the snapshot from {@link snapshotRewards}
 * @param title    headline for the XP modal ("Lesson complete")
 * @param fallback toast text when the award credited nothing
 * @param silentXp skip the XP announcement entirely (flows that pay no XP)
 */
export async function announceRewards({ queryClient, before, title, fallback, silentXp = false }) {
  const data = await queryClient
    .fetchQuery({ queryKey: PORTAL_KEY, queryFn: getLearnerPortalData, staleTime: 0 })
    .catch(() => null)

  const total = Number(data?.totalXp) || 0
  const gained = total - (before?.xp ?? 0)

  if (!silentXp) {
    if (gained > 0) {
      publishCelebration({ kind: "xp", title, gained, total })
    } else {
      toast.success(title, fallback ? { description: fallback } : undefined)
    }
  }

  const earnedBefore = before?.achievements ?? new Set()
  const unlocked = (Array.isArray(data?.achievements) ? data.achievements : []).filter(
    (achievement) => achievement?.earned && !earnedBefore.has(achievementKey(achievement))
  )
  /* One card each, in the order they were earned.

     They used to share a card, because back then a card was a modal and three
     of them meant three dismissals -- grouping was the lesser evil. The cards
     announce themselves and leave on their own now, so the tradeoff is gone,
     and the reason to separate them stands on its own: a badge crammed into a
     scrolling list beside two others is not a moment, and finishing a
     certification should feel like three arrivals rather than one receipt. */
  unlocked.forEach((achievement) => {
    publishCelebration({
      kind: "achievement",
      title: achievement.title,
      achievement,
    })
  })

  return { gained, unlocked: unlocked.length }
}
