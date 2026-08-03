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
  ChartPanel,
  DonutChart,
} from "@/components/charts/rebyu-charts.jsx"
import { BubbleCard, toneForIndex } from "@/components/commons/bubble-card.jsx"
import {
  ENTERPRISE_COMPLETION_MIX,
  ENTERPRISE_GROUP_PROGRESS,
} from "@/components/charts/sample-data.js"
import { getEnterpriseGroups } from "@/services/enterpriseService.js"

/** Home for teachers/facilitators. The API returns only their active authorities. */
export default function EnterpriseMemberDashboardPage() {
  const groupsQuery = useQuery({
    queryKey: ["my-enterprise-groups"],
    queryFn: getEnterpriseGroups,
    retry: 1,
  })

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

      {/* Layout preview for per-group analytics. Placeholder series live in
          components/charts/sample-data.js, each naming its future endpoint. */}
      <section className="space-y-4">
        <div>
          <h2 className="font-rb-display text-xl font-extrabold lowercase">group analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Layout preview — these plots run on placeholder numbers, not your groups' data.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel title="Completion by group" subtitle="Share of assigned work done" sample>
            <BarBreakdownChart
              data={ENTERPRISE_GROUP_PROGRESS}
              categoryKey="group"
              valueKey="completion"
              unit="%"
              target={60}
            />
          </ChartPanel>

          <ChartPanel title="Where your learners are" subtitle="Across every group you lead" sample>
            <DonutChart
              data={ENTERPRISE_COMPLETION_MIX}
              centerValue="120"
              centerLabel="learners"
            />
          </ChartPanel>
        </div>
      </section>
    </div>
  )
}
