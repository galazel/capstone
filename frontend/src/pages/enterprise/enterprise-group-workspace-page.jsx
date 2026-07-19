import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, BookOpenIcon, FileQuestionIcon, UsersIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnterpriseEmptyState, EnterpriseErrorState, EnterpriseLoadingSkeleton, EnterprisePageHeader } from "@/components/enterprise/enterprise-ui.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import { getEnterpriseGroupAssignees, getEnterpriseGroupById } from "@/services/enterpriseService.js"

function lessonCount(certification) {
  return (certification?.majorCategory ?? []).reduce(
    (total, major) => total + (major.middleCategory ?? []).reduce(
      (moduleTotal, module) => moduleTotal + (module.lessons?.length ?? 0), 0),
    0
  )
}

export default function EnterpriseGroupWorkspacePage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const groupQuery = useQuery({ queryKey: ["enterprise-group", id], queryFn: () => getEnterpriseGroupById(id), enabled: Number.isFinite(id) })
  const assigneesQuery = useQuery({ queryKey: ["enterprise-group-assignees", id], queryFn: () => getEnterpriseGroupAssignees({ groupId: id }), enabled: Number.isFinite(id) })
  const certificationsQuery = useQuery({ queryKey: ["certifications"], queryFn: getAllCertifications, staleTime: 5 * 60_000 })

  if (groupQuery.isLoading || assigneesQuery.isLoading || certificationsQuery.isLoading) return <EnterpriseLoadingSkeleton />
  if (groupQuery.isError || assigneesQuery.isError || certificationsQuery.isError) return <EnterpriseErrorState title="Unable to load this group" onRetry={() => { groupQuery.refetch(); assigneesQuery.refetch(); certificationsQuery.refetch() }} />

  const group = groupQuery.data
  if (!group) return <EnterpriseEmptyState title="Group not found" description="This group is unavailable or you no longer have access to it." />

  const certification = (certificationsQuery.data ?? []).find((item) => item.certificationId === group.certificationId || item.certificationId === group.orgCert?.certificationId)
  const learners = (assigneesQuery.data ?? []).filter((item) => item.status === "active")
  const modules = (certification?.majorCategory ?? []).flatMap((major) => major.middleCategory ?? [])

  return <div className="space-y-6">
    <Link to="/enterprise/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" />My groups</Link>
    <EnterprisePageHeader title={group.groupName} subtitle={group.groupDescription || "Your assigned group workspace."} actions={<Badge>Assigned group</Badge>} />
    <Tabs defaultValue="curriculum">
      <TabsList><TabsTrigger value="curriculum">Curriculum</TabsTrigger><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="learners">Learners ({learners.length})</TabsTrigger></TabsList>
      <TabsContent value="curriculum" className="mt-5 space-y-4">
        <Card><CardHeader><CardTitle>{certification?.title ?? "Official curriculum"}</CardTitle><CardDescription>Read-only certification guide with {lessonCount(certification)} lesson(s).</CardDescription></CardHeader><CardContent className="space-y-3">{modules.length ? modules.map((module, index) => <div key={module.middleCategoryId ?? index} className="rounded-lg border p-3"><p className="font-medium">{module.title}</p><p className="mt-1 text-sm text-muted-foreground">{(module.lessons ?? []).map((lesson) => lesson.name).join(" · ") || "No lessons yet."}</p></div>) : <p className="text-sm text-muted-foreground">No curriculum is available for this certification yet.</p>}</CardContent></Card>
      </TabsContent>
      <TabsContent value="content" className="mt-5"><EnterpriseEmptyState icon={FileQuestionIcon} title="Group content workspace" description="Group-specific lessons and assessments will appear here. Questions can be prepared from the shared question bank today." action={<Button asChild><Link to="/enterprise/question-bank"><FileQuestionIcon className="size-4" />Open Question Bank</Link></Button>} /></TabsContent>
      <TabsContent value="learners" className="mt-5 space-y-3">{learners.length ? learners.map((learner) => <Card key={learner.enterpriseGroupAssigneeId}><CardContent className="flex items-center gap-3 p-4"><UsersIcon className="size-5 text-primary" /><div><p className="font-medium">Learner #{learner.learnerId}</p><p className="text-sm text-muted-foreground">{learner.role === "lead" ? "Peer lead" : "Learner"} · Added {new Date(learner.assignedAt).toLocaleDateString()}</p></div></CardContent></Card>) : <EnterpriseEmptyState icon={UsersIcon} title="No learners assigned" description="Ask your Institution Administrator to add learners to this group." />}</TabsContent>
    </Tabs>
  </div>
}
