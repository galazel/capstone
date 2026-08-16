import { useQuery } from "@tanstack/react-query"
import { Crown, UsersRound } from "@/components/icons"

import { Skeleton } from "@/components/ui/skeleton"
import { getLeaderboard } from "@/services/gamificationService"

/**
 * The XP leaderboard: one board, all-time.
 *
 * This was a standalone /learner/rankings page reached from its own top-level
 * nav item. It is a competitive standing, which is what the Challenges page is
 * about, and splitting the two meant a learner had to know that "ranked by
 * challenge points" and "ranked by XP" lived on different pages. It is now a
 * panel on Challenges, next to the challenge-points board.
 *
 * Note these two boards genuinely rank different things and are not
 * interchangeable: the challenge board ranks points from completed challenge
 * sessions, this one ranks XP earned across practice. That is why both are
 * shown rather than one replacing the other.
 */
export function XpRankingsPanel() {
  // Only the overall board is offered now that the Community scope is gone; the
  // service still takes a scope, so it is pinned rather than dropped.
  const scope = "overall"
  // Same treatment for the period. The monthly and weekly tabs are gone, so
  // there is one board and it is the all-time one -- which is also what the
  // subtitle promises ("Permanent XP earned across REBYU").
  const period = "all"

  const query = useQuery({
    queryKey: ["leaderboard", scope, period],
    queryFn: () => getLeaderboard(scope, period),
  })
  const entries = Array.isArray(query.data) ? query.data : []

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <Crown className="size-4 text-rb-fox-lip" aria-hidden="true" />
            XP rankings
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanent XP earned across REBYU.
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{entries.length} ranked</span>
      </div>

      {query.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No ranked activity yet. Complete practice to appear here.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {entries.map((entry) => (
            <div
              key={entry.learnerId}
              className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-3.5 ${
                entry.currentLearner ? "bg-rb-macaw-wash dark:bg-rb-macaw/10" : ""
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-muted-foreground">
                {entry.rank}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <UsersRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="truncate text-sm font-semibold text-foreground">
                  {entry.learnerName}
                  {entry.currentLearner ? " (You)" : ""}
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums text-rb-macaw-lip dark:text-rb-macaw">
                {Number(entry.xp).toLocaleString()} XP
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
