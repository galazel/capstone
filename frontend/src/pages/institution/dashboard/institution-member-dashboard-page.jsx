import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BookOpenIcon, UsersRoundIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  InstitutionEmptyState,
  InstitutionErrorState,
  InstitutionLoadingSkeleton,
  InstitutionMemberSubNav,
} from "@/components/institution/institution-ui.jsx"
import { BubbleCard, toneForIndex } from "@/components/commons/bubble-card.jsx"
import { getInstitutionGroups } from "@/services/institutionService.js"

/** Home for teachers/facilitators. The API returns only their active authorities. */
export default function InstitutionMemberDashboardPage() {
  const groupsQuery = useQuery({
    queryKey: ["my-institution-groups"],
    queryFn: getInstitutionGroups,
    retry: 1,
  })

  if (groupsQuery.isLoading) return <InstitutionLoadingSkeleton />
  if (groupsQuery.isError)
    return <InstitutionErrorState title="Unable to load your groups" onRetry={groupsQuery.refetch} />

  const groups = (groupsQuery.data ?? []).filter((group) => group.status === "active")

  return (
    <div className="space-y-6">
      <InstitutionMemberSubNav />

      {/* TEMPORARILY REMOVED (2026-08-24): the "group analytics" section --
          a "completion by group" bar and a "where your learners are" donut.
          Both were correctly wired to real data (`getInstitutionGroupStats`,
          i.e. GET /api/institution/me/group-stats); they were taken out because
          with one learner at 0% progress they had nothing to show yet, not
          because anything was wrong with them.

          To restore: re-add the `groupStatsQuery` useQuery for
          `getInstitutionGroupStats`, the `completionMix` bucketing derived from
          it, and the two BentoTile charts. Full markup is in git history for
          this file. */}
      <section className="space-y-4">
        <div>
          <h2 className="font-rb-display text-xl font-extrabold lowercase">your groups</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a group to view its curriculum, instructional content, and learners.
          </p>
        </div>

        {groups.length === 0 ? (
          <InstitutionEmptyState
            icon={UsersRoundIcon}
            title="No groups assigned"
            description="Ask your Institution Administrator to assign you as a group authority."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* Same bubble card as the challenge arenas — a group is an entity you
                pick from a shelf, which is exactly what that card is for. */}
            {groups.map((group, index) => (
              <BubbleCard
                key={group.institutionGroupId}
                tone={toneForIndex(index)}
                icon={UsersRoundIcon}
                eyebrow="Learning group"
                title={group.groupName}
                footer={
                  <Button asChild className="w-full rounded-full">
                    <Link to={`/institution/groups/${group.institutionGroupId}`}>
                      <BookOpenIcon className="size-4" />
                      Open workspace
                    </Link>
                  </Button>
                }
              >
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {group.groupDescription || "Assigned learning group"}
                </p>
              </BubbleCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
