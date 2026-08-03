import { useQuery } from "@tanstack/react-query"
import { Flame, Zap } from "@/components/icons"

import { base } from "@/services/base"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * The learner's gamification counters, in the portal header.
 *
 * Two numbers only: the streak they do not want to break, and the XP they are
 * accumulating. Coins and AI credits are balances you spend deliberately from
 * the page that spends them, not things you glance at between lessons — in the
 * header they were two more numbers competing with the two that drive study.
 * Both lived only on the dashboard before, which meant the streak was invisible
 * on every page where breaking it was actually a risk.
 *
 * Each counter is an icon *and* a number. The icon is what makes them scannable
 * in a 16px-tall strip, and each keeps a text label in its tooltip and its
 * accessible name, so the icon is never the only carrier.
 *
 * XP comes from the portal payload the layout has already fetched, so it costs
 * no extra request. Only the streak needs its own call.
 */

const TONES = {
  flame: "text-rb-fox",
  xp: "text-rb-macaw-lip",
}

function Counter({ icon: Icon, tone, value, label, hint }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A span, not a button: these are readouts, and giving them a
            button's affordance promised an action none of them perform. */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold tabular-nums"
          aria-label={`${label}: ${value}`}
        >
          {/* No flame animation here: `rb-flicker` is scoped to `.rebyu-ds`,
              which the portal header does not sit inside, and opting this strip
              into that layer would drag its type and colour rules in with it. */}
          <Icon className={`size-4 shrink-0 ${TONES[tone] ?? ""}`} aria-hidden="true" />
          <span>{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint ?? label}</TooltipContent>
    </Tooltip>
  )
}

export function LearnerStatusStrip({ portalData }) {
  const streakQuery = useQuery({
    queryKey: ["learner-streak"],
    queryFn: () => base("streaks/me"),
    staleTime: 60_000,
    // A missing streak row is the normal state for a learner who has not
    // studied yet, not an error worth retrying against the API.
    retry: false,
  })

  const streak = Number(streakQuery.data?.currentStreak) || 0
  const best = Number(streakQuery.data?.bestStreak) || 0
  const xp = Number(portalData?.totalXp) || 0

  return (
    // Hidden on small screens: at 375px the counters and the action icons
    // cannot both fit, and the actions are the ones you can't get to any other
    // way. The dashboard still carries the full set.
    <div className="mr-1 hidden items-center gap-0.5 md:flex" aria-label="Your progress">
      <Counter
        icon={Flame}
        tone="flame"
        value={streak}
        label="Day streak"
        hint={best > 0 ? `${streak}-day streak · best ${best}` : "Day streak"}
      />
      <Counter icon={Zap} tone="xp" value={xp.toLocaleString()} label="Total XP" hint="Total XP earned" />
    </div>
  )
}
