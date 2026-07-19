import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  FileQuestionIcon,
  Loader2,
  MegaphoneIcon,
  PinIcon,
  Trash2,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  formatDateTime,
} from "@/components/enterprise/enterprise-ui.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import {
  archiveGroupAnnouncement,
  createGroupAnnouncement,
  getEnterpriseGroupAssignees,
  getEnterpriseGroupById,
  getGroupAnnouncements,
} from "@/services/enterpriseService.js"

function lessonCount(certification) {
  return (certification?.majorCategory ?? []).reduce(
    (total, major) =>
      total +
      (major.middleCategory ?? []).reduce(
        (moduleTotal, module) => moduleTotal + (module.lessons?.length ?? 0),
        0
      ),
    0
  )
}

function backendMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function AnnouncementsTab({ groupId }) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pinned, setPinned] = useState(false)

  const announcementsQuery = useQuery({
    queryKey: ["group-announcements", groupId],
    queryFn: () => getGroupAnnouncements(groupId),
    enabled: Number.isFinite(groupId),
  })

  const key = ["group-announcements", groupId]
  const announcements = Array.isArray(announcementsQuery.data) ? announcementsQuery.data : []

  const createMutation = useMutation({
    mutationFn: () =>
      createGroupAnnouncement(groupId, { title: title.trim(), body: body.trim(), pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      toast.success("Announcement posted.")
      setTitle("")
      setBody("")
      setPinned(false)
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to post this announcement.")),
  })

  const archiveMutation = useMutation({
    mutationFn: (announcementId) => archiveGroupAnnouncement(groupId, announcementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      toast.success("Announcement archived.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to archive this announcement.")),
  })

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Post an announcement</CardTitle>
          <CardDescription>Share updates, deadlines, or reminders with this group.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm assessment on Friday"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announcement-body">Message</Label>
            <Textarea
              id="announcement-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="What do your learners need to know?"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(Boolean(v))} />
              Pin to top
            </label>
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!title.trim() || !body.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Posting...
                </>
              ) : (
                "Post announcement"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {announcementsQuery.isLoading ? (
        <EnterpriseLoadingSkeleton rows={2} />
      ) : announcements.length === 0 ? (
        <EnterpriseEmptyState
          icon={MegaphoneIcon}
          title="No announcements yet"
          description="Your first announcement to this group will appear here."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => (
            <Card key={item.groupAnnouncementId}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {item.pinned ? (
                      <PinIcon className="size-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                    {item.title}
                  </CardTitle>
                  <CardDescription>
                    {item.createdByEmail ?? "You"} · {formatDateTime(item.createdAt)}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archiveMutation.mutate(item.groupAnnouncementId)}
                  disabled={archiveMutation.isPending}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                {item.body}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EnterpriseGroupWorkspacePage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const groupQuery = useQuery({
    queryKey: ["enterprise-group", id],
    queryFn: () => getEnterpriseGroupById(id),
    enabled: Number.isFinite(id),
  })
  const assigneesQuery = useQuery({
    queryKey: ["enterprise-group-assignees", id],
    queryFn: () => getEnterpriseGroupAssignees({ groupId: id }),
    enabled: Number.isFinite(id),
  })
  const certificationsQuery = useQuery({
    queryKey: ["certifications"],
    queryFn: getAllCertifications,
    staleTime: 5 * 60_000,
  })

  if (groupQuery.isLoading || assigneesQuery.isLoading || certificationsQuery.isLoading) {
    return <EnterpriseLoadingSkeleton />
  }
  if (groupQuery.isError) {
    return (
      <EnterpriseErrorState
        title="Unable to load this group"
        onRetry={groupQuery.refetch}
      />
    )
  }

  const group = groupQuery.data
  if (!group) {
    return (
      <EnterpriseEmptyState
        title="Group not found"
        description="This group is unavailable or you no longer have access to it."
      />
    )
  }

  const certification = (certificationsQuery.data ?? []).find(
    (item) =>
      item.certificationId === group.certificationId ||
      item.certificationId === group.orgCert?.certificationId
  )
  const learners = (assigneesQuery.data ?? []).filter((item) => item.status === "active")
  const modules = (certification?.majorCategory ?? []).flatMap(
    (major) => major.middleCategory ?? []
  )

  return (
    <div className="space-y-6">
      <Link
        to="/enterprise/member"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        My groups
      </Link>
      <EnterprisePageHeader
        title={group.groupName}
        subtitle={group.groupDescription || "Your assigned group workspace."}
        actions={<Badge>Assigned group</Badge>}
      />
      <Tabs defaultValue="curriculum">
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="learners">Learners ({learners.length})</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum" className="mt-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{certification?.title ?? "Official curriculum"}</CardTitle>
              <CardDescription>
                Read-only certification guide with {lessonCount(certification)} lesson(s).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {modules.length ? (
                modules.map((module, index) => (
                  <div key={module.middleCategoryId ?? index} className="rounded-lg border p-3">
                    <p className="font-medium">{module.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {(module.lessons ?? []).map((lesson) => lesson.name).join(" · ") ||
                        "No lessons yet."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No curriculum is available for this certification yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-5">
          <EnterpriseEmptyState
            icon={FileQuestionIcon}
            title="Group content workspace"
            description="Group-specific lessons and assessments will appear here. Questions can be prepared from the shared question bank today."
            action={
              <Button asChild>
                <Link to="/enterprise/question-bank">
                  <FileQuestionIcon className="size-4" />
                  Open Question Bank
                </Link>
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="learners" className="mt-5 space-y-3">
          {learners.length ? (
            learners.map((learner) => (
              <Card key={learner.enterpriseGroupAssigneeId}>
                <CardContent className="flex items-center gap-3 p-4">
                  <UsersIcon className="size-5 text-primary" />
                  <div>
                    <p className="font-medium">Learner #{learner.learnerId}</p>
                    <p className="text-sm text-muted-foreground">
                      {learner.role === "lead" ? "Peer lead" : "Learner"} · Added{" "}
                      {new Date(learner.assignedAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <EnterpriseEmptyState
              icon={UsersIcon}
              title="No learners assigned"
              description="Ask your Institution Administrator to add learners to this group."
            />
          )}
        </TabsContent>

        <TabsContent value="announcements" className="mt-5">
          <AnnouncementsTab groupId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
