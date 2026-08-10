import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Zap } from "@/components/icons"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { CountUp, motion } from "@/components/motion/rebyu-motion.jsx"

/**
 * The "you just earned XP" moment, as a modal.
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
 */

let currentListener = null

function publish(award) {
  currentListener?.(award)
}

function XpAwardModal() {
  const [award, setAward] = useState(null)

  useEffect(() => {
    currentListener = setAward
    return () => {
      currentListener = null
    }
  }, [])

  const open = award != null

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : setAward(null))}>
      {/* `rebyu-ds` on the content, not an ancestor: the dialog renders through
          a portal at <body>, outside whatever page opened it, and the design
          system's component classes (`rb-btn`) are scoped to that layer. Its
          colour tokens are global (@theme) and would have resolved either way;
          the button would not have. */}
      <DialogContent className="rebyu-ds max-w-sm border-2 border-rb-swan bg-rb-snow text-center sm:max-w-sm">
        <DialogTitle className="sr-only">{award?.title ?? "XP earned"}</DialogTitle>

        {award ? (
          <div className="flex flex-col items-center px-2 py-3">
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
              {award.title}
            </p>

            <motion.p
              className="mt-3 font-rb-display text-4xl font-black leading-none text-rb-bee-lip"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3 }}
            >
              +{award.gained} XP
            </motion.p>

            <p className="mt-2 text-sm font-bold text-rb-wolf">
              {/* Counts from zero, not from the previous balance: the header
                  counter behind the overlay has already been refetched, so
                  animating between the two would read as a correction. */}
              <CountUp value={award.total} className="tabular-nums" /> XP total
            </p>

            <TactileButton
              type="button"
              variant="macaw"
              size="sm"
              className="mt-6 w-full"
              onClick={() => setAward(null)}
              autoFocus
            >
              keep going
            </TactileButton>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export { XpAwardModal }

/**
 * Measures what an award actually credited, then announces it.
 *
 * Reads the cached balance, refetches the portal payload the award just
 * changed, and diffs. That refetch is also what updates the header counter, so
 * the number and the modal can never disagree.
 *
 * The amount shown is the real delta, never the nominal 100/300. Both awards
 * are idempotent server-side -- a lesson re-marked complete or an exam retaken
 * pays nothing -- so quoting the nominal figure would promise XP that was
 * never credited. A no-op award gets a plain toast instead of a modal: there
 * is no reward to celebrate, and blocking the page to say "nothing happened"
 * is the one case where an interruption is not earned.
 *
 * @param queryClient  the react-query client
 * @param title        headline for the modal ("Lesson complete")
 * @param fallback     toast text when the award credited nothing
 */
export async function announceXpAward({ queryClient, title, fallback }) {
  const before = Number(queryClient.getQueryData(["learner-portal-data"])?.totalXp) || 0

  // Awaits the refetch of the active portal query, so the header's XP counter
  // has already moved by the time the modal appears.
  await queryClient.invalidateQueries({ queryKey: ["learner-portal-data"] })

  const after = Number(queryClient.getQueryData(["learner-portal-data"])?.totalXp) || 0
  const gained = after - before

  if (gained <= 0) {
    toast.success(title, fallback ? { description: fallback } : undefined)
    return 0
  }

  publish({ title, gained, total: after })
  return gained
}
