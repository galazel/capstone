import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BookOpenIcon, UsersRoundIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterpriseMemberSubNav,
  EnterprisePageHeader,
} from "@/components/enterprise/enterprise-ui.jsx"
import {
  BarBreakdownChart,
  DonutChart,
} from "@/components/charts/rebyu-charts.jsx"
import { BentoGrid, BentoHeading, BentoTile } from "@/components/commons/bento.jsx"
import { BubbleCard, toneForIndex } from "@/components/commons/bubble-card.jsx"
import { getEnterpriseGroups } from "@/services/enterpriseService.js"
import { getEnterpriseGroupStats } from "@/services/enterpriseLearningStatsService.js"

/** Home for teachers/facilitators. The API returns only their active authorities. */
export default function EnterpriseMemberDashboardPage() {
  const groupsQuery = useQuery({
    queryKey: ["my-enterprise-groups"],
    queryFn: getEnterpriseGroups,
    retry: 1,
  })

  /* Real completion per group, from the organization's own assignment rows. */
  const groupStatsQuery = useQuery({
    queryKey: ["enterprise-group-stats"],
    queryFn: getEnterpriseGroupStats,
    retry: 1,
  })

  const groupStats = Array.isArray(groupStatsQuery.data) ? groupStatsQuery.data : []

  /* "Where your learners are" as three real buckets rather than an invented mix.
     Bucketed on progress because that is the question the panel asks -- who has
     not started, who is mid-way, who is done -- and it is answerable from the
     same rows without a second endpoint. */
  const completionMix = (() => {
    let notStarted = 0
    let inProgress = 0
    let completed = 0
    for (const group of groupStats) {
      completed += Number(group.completedLearners ?? 0)
      const remaining = Number(group.learners ?? 0) - Number(group.completedLearners ?? 0)
      if (Number(group.averageProgress ?? 0) > 0) {
        inProgress += remaining
      } else {
        notStarted += remaining
      }
    }
    const buckets = [
      { name: "Completed", value: completed },
      { name: "In progress", value: inProgress },
      { name: "Not started", value: notStarted },
    ].filter((bucket) => bucket.value > 0)
    return { buckets, total: completed + inProgress + notStarted }
  })()

  if (groupsQuery.isLoading) return <EnterpriseLoadingSkeleton />
  if (groupsQuery.isError)
    return <EnterpriseErrorState title="Unable to load your groups" onRetry={groupsQuery.refetch} />

  const groups = (groupsQuery.data ?? []).filter((group) => group.status === "active")

  return (
    <div className="space-y-6">
      <EnterpriseMemberSubNav />
      <EnterprisePageHeader
        title="My Groups"
        subtitle="Choose a group to view its curriculum, instructional content, and learners."
      />

      {groups.length === 0 ? (
        <EnterpriseEmptyState
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
              key={group.enterpriseGroupId}
              tone={toneForIndex(index)}
              icon={UsersRoundIcon}
              eyebrow="Learning group"
              title={group.groupName}
              footer={
                <Button asChild className="w-full rounded-full">
                  <Link to={`/enterprise/groups/${group.enterpriseGroupId}`}>
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

      <section className="space-y-4">
        <div>
          <h2 className="font-rb-display text-xl font-extrabold lowercase">group analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completion across the groups you lead.
          </p>
        </div>

        {groupStatsQuery.isError ? (
          <p className="text-sm text-muted-foreground">
            Group analytics could not be loaded.
          </p>
        ) : (
          <BentoGrid>
            <BentoTile col={3} row={2}>
              <BentoHeading
                title="Completion by group"
                hint="Average progress across each group's active learners"
              />
              <BarBreakdownChart
                data={groupStats.map((group) => ({
                  group: group.groupName,
                  completion: Number(group.averageProgress ?? 0),
                }))}
                categoryKey="group"
                valueKey="completion"
                unit="%"
                target={60}
                height={168}
              />
            </BentoTile>

            <BentoTile col={3} row={2}>
              <BentoHeading
                title="Where your learners are"
                hint="Across every group you lead"
              />
              <DonutChart
                data={completionMix.buckets}
                height={168}
                centerValue={String(completionMix.total)}
                centerLabel={completionMix.total === 1 ? "learner" : "learners"}
              />
            </BentoTile>
          </BentoGrid>
        )}
      </section>
    </div>
  )
}
