import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BookOpenIcon, UsersRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EnterpriseEmptyState, EnterpriseErrorState, EnterpriseLoadingSkeleton, EnterpriseMemberSubNav, EnterprisePageHeader } from "@/components/enterprise/enterprise-ui.jsx"
import { getEnterpriseGroups } from "@/services/enterpriseService.js"

/** Home for teachers/facilitators. The API returns only their active authorities. */
export default function EnterpriseMemberDashboardPage() {
  const groupsQuery = useQuery({ queryKey: ["my-enterprise-groups"], queryFn: getEnterpriseGroups, retry: 1 })
  if (groupsQuery.isLoading) return <EnterpriseLoadingSkeleton />
  if (groupsQuery.isError) return <EnterpriseErrorState title="Unable to load your groups" onRetry={groupsQuery.refetch} />
  const groups = (groupsQuery.data ?? []).filter((group) => group.status === "active")
  return <div className="space-y-6">
    <EnterpriseMemberSubNav />
    <EnterprisePageHeader title="My Groups" subtitle="Choose a group to view its curriculum, instructional content, and learners." />
    {groups.length === 0 ? <EnterpriseEmptyState icon={UsersRoundIcon} title="No groups assigned" description="Ask your Institution Administrator to assign you as a group authority." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groups.map((group) => <Card key={group.enterpriseGroupId} className="flex flex-col"><CardHeader><UsersRoundIcon className="mb-2 size-5 text-primary" /><CardTitle>{group.groupName}</CardTitle><CardDescription>{group.groupDescription || "Assigned learning group"}</CardDescription></CardHeader><CardContent className="mt-auto"><Button asChild className="w-full"><Link to={`/enterprise/groups/${group.enterpriseGroupId}`}><BookOpenIcon className="size-4" />Open workspace</Link></Button></CardContent></Card>)}</div>}
  </div>
}
