import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ClipboardCheckIcon,
  FileQuestionIcon,
  FolderTreeIcon,
  Loader2,
  MailIcon,
  MegaphoneIcon,
  PinIcon,
  PlusIcon,
  Trash2,
  UserPlusIcon,
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
  EnterpriseStatusBadge,
  formatDateTime,
} from "@/components/enterprise/enterprise-ui.jsx"
import { getExamTypes, getExams } from "@/services/assessmentService.js"
import { getAllCertifications } from "@/services/certificationService.js"
import { createMajorCategory } from "@/services/majorCategoryService.js"
import { createMiddleCategory } from "@/services/middleCategoryService.js"
import { createLesson } from "@/services/lessonService.js"
import {
  archiveGroupAnnouncement,
  createGroupAnnouncement,
  getEnterpriseGroupAssignees,
  getEnterpriseGroupById,
  getGroupAnnouncements,
} from "@/services/enterpriseService.js"
import {
  cancelEnterpriseInvitation,
  getEnterpriseInvitations,
  sendEnterpriseInvitations,
} from "@/services/partnershipService.js"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

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

/**
 * A group's own authored content -- Major Categories owned by this group
 * (ownerGroupId === groupId), created and edited alongside the read-only
 * official curriculum, never mixed into it for anyone else. Middle
 * categories/lessons inherit ownership from their major category, so no
 * ownerGroupId is passed for those creates -- see MiddleCategoryService/
 * LessonService.
 */
function ContentTab({ groupId, certification, onContentChanged }) {
  const navigate = useNavigate()
  const [newMajorTitle, setNewMajorTitle] = useState("")
  const [addingMiddleTo, setAddingMiddleTo] = useState(null)
  const [newMiddleTitle, setNewMiddleTitle] = useState("")
  const [addingLessonTo, setAddingLessonTo] = useState(null)
  const [newLessonName, setNewLessonName] = useState("")

  const ownMajorCategories = (certification?.majorCategory ?? []).filter(
    (major) => major.ownerGroupId === groupId
  )

  const createMajorMutation = useMutation({
    mutationFn: () =>
      createMajorCategory(
        { certificationId: certification.certificationId, title: newMajorTitle.trim() },
        groupId
      ),
    onSuccess: () => {
      toast.success("Category created.")
      setNewMajorTitle("")
      onContentChanged()
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to create this category.")),
  })

  const createMiddleMutation = useMutation({
    mutationFn: (majorCategoryId) =>
      createMiddleCategory({ majorCategoryId, title: newMiddleTitle.trim() }),
    onSuccess: () => {
      toast.success("Module created.")
      setNewMiddleTitle("")
      setAddingMiddleTo(null)
      onContentChanged()
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to create this module.")),
  })

  const createLessonMutation = useMutation({
    mutationFn: (middleCategoryId) =>
      createLesson({ middleCategoryId, name: newLessonName.trim() }),
    onSuccess: (lesson) => {
      toast.success("Lesson created.")
      setNewLessonName("")
      setAddingLessonTo(null)
      onContentChanged()
      navigate(`/enterprise/lessons/${encodeURIComponent(lesson.name)}/create`, {
        state: { lessonId: lesson.lessonId, lessonName: lesson.name },
      })
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to create this lesson.")),
  })

  if (!certification) {
    return (
      <EnterpriseEmptyState
        icon={FileQuestionIcon}
        title="No certification linked to this group yet"
        description="Content can be authored once this group's certification allocation is set."
      />
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add a category</CardTitle>
          <CardDescription>
            Your own major category, kept separate from the official curriculum above and
            visible only to your group.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={newMajorTitle}
            onChange={(e) => setNewMajorTitle(e.target.value)}
            placeholder="e.g. Extra practice: Networking basics"
          />
          <Button
            type="button"
            onClick={() => createMajorMutation.mutate()}
            disabled={!newMajorTitle.trim() || createMajorMutation.isPending}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Add
          </Button>
        </CardContent>
      </Card>

      {ownMajorCategories.length === 0 ? (
        <EnterpriseEmptyState
          icon={FolderTreeIcon}
          title="No group content yet"
          description="Add your first category above, then build out modules and lessons under it."
        />
      ) : (
        <div className="space-y-3">
          {ownMajorCategories.map((major) => (
            <Card key={major.majorCategoryId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{major.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(major.middleCategory ?? []).map((middle) => (
                  <div key={middle.middleCategoryId} className="rounded-lg border p-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <FolderTreeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {middle.title}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {(middle.lessons ?? []).map((lesson) => (
                        <button
                          key={lesson.lessonId}
                          type="button"
                          onClick={() =>
                            navigate(`/enterprise/lessons/${encodeURIComponent(lesson.name)}/create`, {
                              state: { lessonId: lesson.lessonId, lessonName: lesson.name },
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                        >
                          <BookOpenIcon className="size-3.5" aria-hidden="true" />
                          {lesson.name}
                        </button>
                      ))}
                    </div>

                    {addingLessonTo === middle.middleCategoryId ? (
                      <div className="mt-2 flex gap-2">
                        <Input
                          autoFocus
                          value={newLessonName}
                          onChange={(e) => setNewLessonName(e.target.value)}
                          placeholder="Lesson name"
                        />
                        <Button
                          size="sm"
                          onClick={() => createLessonMutation.mutate(middle.middleCategoryId)}
                          disabled={!newLessonName.trim() || createLessonMutation.isPending}
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingLessonTo(null)
                            setNewLessonName("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => setAddingLessonTo(middle.middleCategoryId)}
                      >
                        <PlusIcon className="size-3.5" aria-hidden="true" />
                        Add lesson
                      </Button>
                    )}
                  </div>
                ))}

                {addingMiddleTo === major.majorCategoryId ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={newMiddleTitle}
                      onChange={(e) => setNewMiddleTitle(e.target.value)}
                      placeholder="Module title"
                    />
                    <Button
                      size="sm"
                      onClick={() => createMiddleMutation.mutate(major.majorCategoryId)}
                      disabled={!newMiddleTitle.trim() || createMiddleMutation.isPending}
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingMiddleTo(null)
                        setNewMiddleTitle("")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddingMiddleTo(major.majorCategoryId)}
                  >
                    <PlusIcon className="size-4" aria-hidden="true" />
                    Add module
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function LearnersTab({ groupId, group, learners }) {
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [draftEmail, setDraftEmail] = useState("")
  const [emails, setEmails] = useState([])
  const [error, setError] = useState("")

  const invitationsQuery = useQuery({
    queryKey: ["group-invitations", groupId],
    queryFn: () => getEnterpriseInvitations(),
    enabled: Number.isFinite(groupId),
  })
  const groupInvitations = (
    Array.isArray(invitationsQuery.data) ? invitationsQuery.data : []
  ).filter((inv) => inv.enterpriseGroupId === groupId)
  const pendingInvitations = groupInvitations.filter((inv) => inv.status === "PENDING")

  const remainingSlots = Math.max(0, (group.totalSlots ?? 0) - (group.usedSlots ?? 0))

  const resetForm = () => {
    setDraftEmail("")
    setEmails([])
    setError("")
  }

  const addEmail = (value) => {
    const email = value.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(`"${email}" is not a valid email.`)
      return
    }
    if (emails.includes(email)) {
      setError("That email is already in the list.")
      return
    }
    if (emails.length >= remainingSlots) {
      setError(`Only ${remainingSlots} slot(s) remaining in this group.`)
      return
    }
    setEmails((current) => [...current, email])
    setDraftEmail("")
    setError("")
  }

  const inviteMutation = useMutation({
    mutationFn: () => sendEnterpriseInvitations({ enterpriseGroupId: groupId, emails }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["group-invitations", groupId] })
      queryClient.invalidateQueries({ queryKey: ["enterprise-group", groupId] })
      toast.success(
        `${response.created} invitation(s) sent.` +
          (response.skipped?.length ? ` ${response.skipped.length} skipped.` : "")
      )
      resetForm()
      setInviteOpen(false)
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to send invitations.")),
  })

  const cancelMutation = useMutation({
    mutationFn: (invitationId) => cancelEnterpriseInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-invitations", groupId] })
      queryClient.invalidateQueries({ queryKey: ["enterprise-group", groupId] })
      toast.success("Invitation cancelled. Slot restored.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to cancel this invitation.")),
  })

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Invite learners</CardTitle>
            <CardDescription>
              {remainingSlots} of {group.totalSlots ?? 0} slot(s) remaining in this group.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setInviteOpen((prev) => !prev)}
            disabled={remainingSlots <= 0}
          >
            <UserPlusIcon className="size-4" aria-hidden="true" />
            {inviteOpen ? "Cancel" : "Invite"}
          </Button>
        </CardHeader>
        {inviteOpen ? (
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addEmail(draftEmail)
                  }
                }}
                placeholder="learner@example.com"
              />
              <Button type="button" variant="outline" onClick={() => addEmail(draftEmail)}>
                Add
              </Button>
            </div>
            {emails.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {emails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 py-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => setEmails((current) => current.filter((e) => e !== email))}
                      aria-label={`Remove ${email}`}
                      className="rounded-full outline-none hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={emails.length === 0 || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                `Send ${emails.length || ""} invitation${emails.length === 1 ? "" : "s"}`
              )}
            </Button>
          </CardContent>
        ) : null}
      </Card>

      {pendingInvitations.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.invitationId}
                className="flex items-center justify-between gap-2 px-4 py-2.5"
              >
                <div className="flex items-center gap-2 text-sm">
                  <MailIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {inv.email}
                  <EnterpriseStatusBadge status={inv.status} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelMutation.mutate(inv.invitationId)}
                  disabled={cancelMutation.isPending}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
      ) : pendingInvitations.length === 0 ? (
        <EnterpriseEmptyState
          icon={UsersIcon}
          title="No learners yet"
          description="Invite your first learner into this group above."
        />
      ) : null}
    </div>
  )
}

export default function EnterpriseGroupWorkspacePage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const queryClient = useQueryClient()
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
  // includeGroupId mixes this group's own authored content in alongside the
  // official curriculum -- omitted everywhere else in the app, so every
  // other reader is unaffected. See CertificationController/Service.
  const certificationsQuery = useQuery({
    queryKey: ["certifications", "group", id],
    queryFn: () => getAllCertifications(id),
    enabled: Number.isFinite(id),
    staleTime: 5 * 60_000,
  })
  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: getExams,
    staleTime: 60_000,
  })
  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: getExamTypes,
    staleTime: 5 * 60_000,
  })

  if (
    groupQuery.isLoading ||
    assigneesQuery.isLoading ||
    certificationsQuery.isLoading ||
    examsQuery.isLoading ||
    examTypesQuery.isLoading
  ) {
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

  const examTypeById = new Map(
    asArray(examTypesQuery.data).map((type) => [type.examTypeId, type.examTypeText])
  )
  // Official assessments for this certification -- diagnostics, mock exams,
  // and other exam types the admin published. Read-only here, same as the
  // rest of the official curriculum.
  const certificationExams = asArray(examsQuery.data).filter(
    (exam) => exam.certificationId === certification?.certificationId && exam.status === "PUBLISHED"
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

        {/*
        */}
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheckIcon className="size-4 text-primary" aria-hidden="true" />
                Certification assessments
              </CardTitle>
              <CardDescription>
                Diagnostics, mock exams, and other assessments the Institution Administrator
                published for this certification. Read-only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {certificationExams.length ? (
                <ul className="divide-y rounded-lg border">
                  {certificationExams.map((exam) => (
                    <li
                      key={exam.examId}
                      className="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium">{exam.title}</span>
                      <Badge variant="outline">
                        {examTypeById.get(exam.examTypeId) ?? "Assessment"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No published assessments for this certification yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-5 space-y-4">
          <ContentTab
            groupId={id}
            certification={certification}
            onContentChanged={() =>
              queryClient.invalidateQueries({ queryKey: ["certifications", "group", id] })
            }
          />
          <EnterpriseEmptyState
            icon={FileQuestionIcon}
            title="Need questions for an assessment?"
            description="Prepare questions from the shared question bank, then build an assessment from your own content."
            action={
              <Button asChild variant="outline">
                <Link to="/enterprise/question-bank">
                  <FileQuestionIcon className="size-4" />
                  Open Question Bank
                </Link>
              </Button>
            }
          />
        </TabsContent>

        <TabsContent value="learners" className="mt-5">
          <LearnersTab groupId={id} group={group} learners={learners} />
        </TabsContent>

        <TabsContent value="announcements" className="mt-5">
          <AnnouncementsTab groupId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
