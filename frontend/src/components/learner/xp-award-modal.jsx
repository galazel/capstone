import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Award, Zap } from "@/components/icons"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { CountUp, motion } from "@/components/motion/rebyu-motion.jsx"
import { achievementBadge, achievementKey, earnedAchievementKeys } from "@/lib/achievements.js"
import { getLearnerPortalData } from "@/services/learnerService.js"

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

function publishCelebration(card) {
  if (currentListener) {
    currentListener((queue) => [...queue, card])
    return
  }
  pending = [...pending, card]
}

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

  return (
    <Dialog open={card != null} onOpenChange={(next) => (next ? null : dismiss())}>
      {/* `rebyu-ds` on the content, not an ancestor: the dialog renders through
          a portal at <body>, outside whatever page opened it, and the design
          system's component classes (`rb-btn`) are scoped to that layer. Its
          colour tokens are global (@theme) and would have resolved either way;
          the button would not have. */}
      <DialogContent className="rebyu-ds max-w-sm border-2 border-rb-swan bg-rb-snow text-center sm:max-w-sm">
        <DialogTitle className="sr-only">{card?.title ?? "Reward earned"}</DialogTitle>

        {card ? (
          <div className="flex flex-col items-center px-2 py-3">
            {card.kind === "achievement" ? (
              <AchievementCard card={card} />
            ) : (
              <XpCard card={card} />
            )}

            <TactileButton
              type="button"
              variant="macaw"
              size="sm"
              className="mt-6 w-full"
              onClick={dismiss}
              autoFocus
            >
              {queue.length > 1 ? "next" : "keep going"}
            </TactileButton>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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
 * Every achievement unlocked by one action, on one card.
 *
 * A single card each, shown back to back, made finishing a certification --
 * which can land Finisher, Top Achiever and Rebyu Legend at once -- into four
 * dialogs to dismiss in a row. The badges arrived together, so they are
 * announced together; only the singular case gets the full-size hero
 * treatment, since a lone badge is the common one and deserves the moment.
 */
function AchievementCard({ card }) {
  const achievements = card.achievements ?? []
  const single = achievements.length === 1

  if (single) {
    const achievement = achievements[0]
    return (
      <>
        <motion.div
          className="grid size-28 place-items-center"
          initial={{ scale: 0.4, rotate: -14 }}
          animate={{ scale: [0.4, 1.14, 1], rotate: 0 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Badge achievement={achievement} className="size-full" />
        </motion.div>

        <p className="mt-3 text-xs font-black uppercase tracking-widest text-rb-wolf">
          Achievement unlocked
        </p>

        <p className="mt-2 font-rb-display text-2xl font-extrabold lowercase leading-none text-rb-eel">
          {achievement?.title}
        </p>

        <p className="mt-3 text-sm font-bold leading-6 text-rb-wolf">
          {achievement?.description}
        </p>
      </>
    )
  }

  return (
    <>
      <p className="text-xs font-black uppercase tracking-widest text-rb-wolf">
        {achievements.length} achievements unlocked
      </p>

      {/* Scrolls rather than growing: Rebyu Legend arrives alongside whichever
          badge completed the set, and the card still has to fit a phone. */}
      <div className="mt-4 max-h-72 w-full space-y-3 overflow-y-auto pr-1">
        {achievements.map((achievement, index) => (
          <motion.div
            key={achievementKey(achievement)}
            className="flex items-center gap-3 rounded-2xl border-2 border-rb-swan p-3 text-left"
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            // Staggered so the badges read as arriving one after another,
            // which is the part the single-card sequence got right.
            transition={{ delay: 0.08 * index, duration: 0.34, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Badge achievement={achievement} className="size-12 shrink-0" />
            <span className="min-w-0">
              <span className="block font-rb-display text-base font-extrabold lowercase leading-tight text-rb-eel">
                {achievement?.title}
              </span>
              <span className="mt-0.5 block text-xs font-bold leading-5 text-rb-wolf">
                {achievement?.description}
              </span>
            </span>
          </motion.div>
        ))}
      </div>
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
  // One card for all of them, not one card each: they were earned by the same
  // action, so dismissing them one at a time is busywork.
  if (unlocked.length > 0) {
    publishCelebration({
      kind: "achievement",
      title: unlocked.length === 1 ? unlocked[0].title : "Achievements unlocked",
      achievements: unlocked,
    })
  }

  return { gained, unlocked: unlocked.length }
}
