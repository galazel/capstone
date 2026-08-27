import { useRef, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardCheckIcon,
  Layers3,
  Loader2,
  MailIcon,
  MegaphoneIcon,
  PinIcon,
  Plus,
  Trash2,
  UserPlusIcon,
  UsersIcon,
} from "@/components/icons"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TABLE_SURFACE } from "@/components/commons/data-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  InstitutionEmptyState,
  InstitutionErrorState,
  InstitutionLoadingSkeleton,
  InstitutionMemberSubNav,
  InstitutionPageHeader,
  InstitutionStatusBadge,
  formatDateTime,
} from "@/components/institution/institution-ui.jsx"
import {
  deleteExam,
  getExamQuestions,
  getExamTypes,
  getExams,
  publishExam,
} from "@/services/assessmentService.js"
import { getQuestions } from "@/services/questionService.js"
import AssessmentPreviewDialog from "@/components/assessments/admin/assessment-preview-dialog.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import {
  archiveGroupAnnouncement,
  createGroupAnnouncement,
  getInstitutionGroupAssignees,
  getInstitutionGroupById,
  getGroupAnnouncements,
  getGroupLearnerRoster,
  removeLearnerFromGroup,
} from "@/services/institutionService.js"
import {
  cancelInstitutionInvitation,
  getInstitutionInvitations,
  sendInstitutionInvitations,
} from "@/services/partnershipService.js"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function backendMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function lessonTitle(lesson) {
  return lesson?.name ?? lesson?.title ?? "Untitled lesson"
}

/**
 * Read-only rendering of the official curriculum, mirroring the admin's
 * ViewCertificationAdmin design (numbered "Major Category N:" headings,
 * collapsible middle-category cards, numbered lesson rows) so the curriculum
 * looks the same in both places. No edit/create actions here -- an Institution
 * Member views the official curriculum but cannot change it.
 */
function OfficialMiddleCard({ middleCategory, buildLessonHref }) {
  const [isOpen, setIsOpen] = useState(false)
  const lessons = middleCategory.lessons ?? []

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-bold text-foreground">
            {middleCategory.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Middle Category · {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
          </p>
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
            isOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-border bg-muted/20 px-5 py-4">
          {lessons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
              No lessons have been added yet.
            </div>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson, lessonIndex) => (
                <Link
                  key={lesson.lessonId ?? lessonIndex}
                  to={buildLessonHref(lesson.lessonId)}
                  className="group flex items-center gap-3 rounded-xl border border-transparent bg-background px-4 py-3 transition hover:border-border hover:bg-muted/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-muted-foreground">
                    {lessonIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {lessonTitle(lesson)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Lesson {lessonIndex + 1}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  )
}

function OfficialMajorSection({ majorCategory, majorIndex, buildLessonHref }) {
  const middleCategories = majorCategory.middleCategory ?? []

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-heading text-lg font-bold text-foreground">
          <span className="text-primary">Major Category {majorIndex + 1}:</span>{" "}
          {majorCategory.title}
        </p>
      </div>

      {middleCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          No middle categories under this major category.
        </div>
      ) : (
        <div className="space-y-3">
          {middleCategories.map((middleCategory, middleIndex) => (
            <OfficialMiddleCard
              key={middleCategory.middleCategoryId ?? middleIndex}
              middleCategory={middleCategory}
              buildLessonHref={buildLessonHref}
            />
          ))}
        </div>
      )}
    </section>
  )
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
        <InstitutionLoadingSkeleton rows={2} />
      ) : announcements.length === 0 ? (
        <InstitutionEmptyState
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

function InlineNameInput({ placeholder, onSubmit, onCancel, isPending, className }) {
  const [value, setValue] = useState("")
  // Enter and blur can both fire on the same commit (e.g. Enter then unmount
  // blur); guard so the create only happens once.
  const doneRef = useRef(false)

  const commit = () => {
    if (doneRef.current) return
    const trimmed = value.trim()
    if (!trimmed) {
      onCancel()
      return
    }
    doneRef.current = true
    onSubmit(trimmed)
  }

  return (
    <input
      autoFocus
      value={value}
      disabled={isPending}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          commit()
        } else if (e.key === "Escape") {
          doneRef.current = true
          onCancel()
        }
      }}
      onBlur={commit}
      placeholder={placeholder}
      className={
        className ??
        "w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-foreground/40 disabled:opacity-60"
      }
    />
  )
}

function LearnersTab({ groupId, group }) {
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [draft, setDraft] = useState({ firstName: "", lastName: "", email: "" })
  // Each staged learner: { firstName, lastName, email }.
  const [invitees, setInvitees] = useState([])
  const [error, setError] = useState("")

  const invitationsQuery = useQuery({
    queryKey: ["group-invitations", groupId],
    queryFn: () => getInstitutionInvitations(),
    enabled: Number.isFinite(groupId),
  })
  const groupInvitations = (
    Array.isArray(invitationsQuery.data) ? invitationsQuery.data : []
  ).filter((inv) => inv.institutionGroupId === groupId)
  const pendingInvitations = groupInvitations.filter((inv) => inv.status === "PENDING")

  const remainingSlots = Math.max(0, (group.totalSlots ?? 0) - (group.usedSlots ?? 0))

  const resetForm = () => {
    setDraft({ firstName: "", lastName: "", email: "" })
    setInvitees([])
    setError("")
  }

  const addInvitee = () => {
    const email = draft.email.trim().toLowerCase()
    const firstName = draft.firstName.trim()
    const lastName = draft.lastName.trim()
    if (!email) {
      setError("Enter the learner's email.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(`"${email}" is not a valid email.`)
      return
    }
    if (invitees.some((inv) => inv.email === email)) {
      setError("That email is already in the list.")
      return
    }
    if (invitees.length >= remainingSlots) {
      setError(`Only ${remainingSlots} slot(s) remaining in this group.`)
      return
    }
    setInvitees((current) => [...current, { firstName, lastName, email }])
    setDraft({ firstName: "", lastName: "", email: "" })
    setError("")
  }

  const inviteMutation = useMutation({
    mutationFn: () => sendInstitutionInvitations({ institutionGroupId: groupId, learners: invitees }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["group-invitations", groupId] })
      queryClient.invalidateQueries({ queryKey: ["institution-group", groupId] })
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
    mutationFn: (invitationId) => cancelInstitutionInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-invitations", groupId] })
      queryClient.invalidateQueries({ queryKey: ["institution-group", groupId] })
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
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
              <Input
                value={draft.firstName}
                onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                placeholder="First name"
              />
              <Input
                value={draft.lastName}
                onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                placeholder="Last name"
              />
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addInvitee()
                  }
                }}
                placeholder="learner@example.com"
              />
              <Button type="button" variant="outline" onClick={addInvitee}>
                Add
              </Button>
            </div>
            {invitees.length > 0 ? (
              <div className="divide-y rounded-lg border">
                {invitees.map((inv) => (
                  <div
                    key={inv.email}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">
                        {[inv.firstName, inv.lastName].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="ml-2 text-muted-foreground">{inv.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setInvitees((current) => current.filter((c) => c.email !== inv.email))
                      }
                      aria-label={`Remove ${inv.email}`}
                      className="rounded-full px-1 text-muted-foreground outline-none hover:text-destructive"
                    >
                      ×
                    </button>
                  </div>
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
              disabled={invitees.length === 0 || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : (
                `Send ${invitees.length || ""} invitation${invitees.length === 1 ? "" : "s"}`
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
                  <span>
                    {[inv.firstName, inv.lastName].filter(Boolean).join(" ") ? (
                      <span className="font-medium">
                        {[inv.firstName, inv.lastName].filter(Boolean).join(" ")}{" "}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">{inv.email}</span>
                  </span>
                  <InstitutionStatusBadge status={inv.status} />
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

      <GroupLearnerTable groupId={groupId} hasPendingInvitations={pendingInvitations.length > 0} />
    </div>
  )
}

function LessonProgressCell({ completed, total, percentage }) {
  if (!total) {
    return <span className="text-sm text-muted-foreground">No lessons yet</span>
  }
  const shown = Number.isFinite(Number(percentage)) ? Number(percentage) : 0
  return (
    <div className="flex items-center gap-2">
      <Progress value={Math.min(100, Math.max(0, shown))} className="h-1.5 w-16" />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {completed}/{total}
      </span>
    </div>
  )
}

/**
 * The group's learners with the figures a leader monitors, each row opening
 * that learner's full statistics. Reads the leader-scoped roster endpoint --
 * the group assignee list alone carries no names or progress.
 */
function GroupLearnerTable({ groupId, hasPendingInvitations }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [removeTarget, setRemoveTarget] = useState(null)

  const rosterQuery = useQuery({
    queryKey: ["group-learner-roster", groupId],
    queryFn: () => getGroupLearnerRoster(groupId),
    enabled: Number.isFinite(groupId),
  })

  const removeMutation = useMutation({
    mutationFn: (learnerId) => removeLearnerFromGroup(groupId, learnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-learner-roster", groupId] })
      queryClient.invalidateQueries({ queryKey: ["institution-group-assignees", groupId] })
      queryClient.invalidateQueries({ queryKey: ["institution-group", groupId] })
      toast.success("Learner removed from this group. Their account and progress are unchanged.")
      setRemoveTarget(null)
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to remove this learner.")),
  })

  const rows = asArray(rosterQuery.data)

  if (rosterQuery.isLoading) {
    return <InstitutionLoadingSkeleton rows={3} />
  }
  if (rosterQuery.isError) {
    return (
      <InstitutionErrorState
        title="Unable to load this group's learners"
        onRetry={rosterQuery.refetch}
      />
    )
  }
  if (rows.length === 0) {
    return hasPendingInvitations ? null : (
      <InstitutionEmptyState
        icon={UsersIcon}
        title="No learners yet"
        description="Invite your first learner into this group above."
      />
    )
  }

  return (
    <>
      <Card className={`overflow-hidden py-0 ${TABLE_SURFACE}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead className="w-48">Lessons completed</TableHead>
              <TableHead className="w-28">Joined</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.institutionGroupAssigneeId}
                onClick={() => navigate(`/institution/groups/${groupId}/learners/${row.learnerId}`)}
                className="cursor-pointer"
              >
                <TableCell>
                  <p className="font-medium text-foreground">{row.name}</p>
                  {row.username ? (
                    <p className="text-xs text-muted-foreground">@{row.username}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <LessonProgressCell
                    completed={row.completedLessonCount}
                    total={row.totalLessonCount}
                    percentage={row.completionPercentage}
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.assignedAt ? new Date(row.assignedAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name} from this group`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation()
                      setRemoveTarget(row)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this learner from the group?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name} will be unassigned from this group and the slot returned.
              Their account, enrolment, and progress are kept, so they can be added back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMutation.mutate(removeTarget.learnerId)}
              disabled={removeMutation.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const VALID_TABS = ["curriculum", "assessments", "learners", "announcements"]

export default function InstitutionGroupWorkspacePage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const queryClient = useQueryClient()
  const [deleteExamTarget, setDeleteExamTarget] = useState(null)
  const [previewExam, setPreviewExam] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const activeTab = VALID_TABS.includes(requestedTab) ? requestedTab : "curriculum"

  const deleteExamMutation = useMutation({
    mutationFn: (id) => deleteExam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] })
      toast.success("Assessment deleted.")
      setDeleteExamTarget(null)
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to delete this assessment.")),
  })

  // Learners can never attempt (or even see) a DRAFT exam -- AssessmentAttemptService
  // blocks both paths server-side -- so a group's own assessment needs this
  // explicit publish step before their students can access it.
  const publishExamMutation = useMutation({
    mutationFn: (examId) => publishExam(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] })
      toast.success("Assessment published. Learners can now access it.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to publish this assessment.")),
  })

  const groupQuery = useQuery({
    queryKey: ["institution-group", id],
    queryFn: () => getInstitutionGroupById(id),
    enabled: Number.isFinite(id),
  })
  const assigneesQuery = useQuery({
    queryKey: ["institution-group-assignees", id],
    queryFn: () => getInstitutionGroupAssignees({ groupId: id }),
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
  // includeGroupId mixes this group's own exams in alongside the official
  // ones -- omitted everywhere else, so no other reader is affected.
  const examsQuery = useQuery({
    queryKey: ["exams", "group", id],
    queryFn: () => getExams(id),
    enabled: Number.isFinite(id),
    staleTime: 60_000,
  })
  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: getExamTypes,
    staleTime: 5 * 60_000,
  })
  // Only fetched to power the "view assessment content" preview dialog --
  // getExamQuestions() returns the join rows for every exam, so it's
  // filtered down to the previewed exam's rows inside the dialog itself.
  const examQuestionsQuery = useQuery({
    queryKey: ["exam-questions"],
    queryFn: getExamQuestions,
    staleTime: 60_000,
  })
  const questionsQuery = useQuery({
    queryKey: ["questions", "group", id],
    queryFn: () => getQuestions(id),
    enabled: Number.isFinite(id),
    staleTime: 60_000,
  })

  if (
    groupQuery.isLoading ||
    assigneesQuery.isLoading ||
    certificationsQuery.isLoading ||
    examsQuery.isLoading ||
    examTypesQuery.isLoading
  ) {
    return <InstitutionLoadingSkeleton />
  }
  if (groupQuery.isError) {
    return (
      <InstitutionErrorState
        title="Unable to load this group"
        onRetry={groupQuery.refetch}
      />
    )
  }

  const group = groupQuery.data
  if (!group) {
    return (
      <InstitutionEmptyState
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
  // The official curriculum tree excludes this group's own authored content
  // (that lives in the Content tab); only platform-wide majors appear here.
  const officialMajors = (certification?.majorCategory ?? []).filter(
    (major) => major.ownerGroupId == null
  )
  const officialLessonCount = officialMajors.reduce(
    (total, major) =>
      total +
      (major.middleCategory ?? []).reduce(
        (moduleTotal, module) => moduleTotal + (module.lessons?.length ?? 0),
        0
      ),
    0
  )

  const examTypeById = new Map(
    asArray(examTypesQuery.data).map((type) => [type.examTypeId, type.examTypeText])
  )
  const questionById = new Map(
    asArray(questionsQuery.data).map((question) => [question.questionId, question])
  )
  const examQuestions = asArray(examQuestionsQuery.data)
  // Official assessments for this certification -- diagnostics, mock exams,
  // and other exam types the admin published. Read-only here, same as the
  // rest of the official curriculum.
  const certificationExams = asArray(examsQuery.data).filter(
    (exam) => exam.certificationId === certification?.certificationId && exam.status === "PUBLISHED"
  )
  // This group's own exams -- kept separate from the official list above,
  // visible only within this workspace.
  const ownGroupExams = asArray(examsQuery.data).filter((exam) => exam.ownerGroupId === id)

  return (
    <div className="space-y-6">
      <InstitutionMemberSubNav />
      <InstitutionPageHeader
        title={group.groupName}
        subtitle={group.groupDescription || "Your assigned group workspace."}
        actions={<Badge>Assigned group</Badge>}
      />
      <Tabs
        value={activeTab}
        onValueChange={(next) => setSearchParams((prev) => {
          const params = new URLSearchParams(prev)
          params.set("tab", next)
          return params
        })}
      >
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="learners">Learners ({learners.length})</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        {/*
        */}
        <TabsContent value="curriculum" className="mt-5 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">Certification curriculum</p>
              <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">
                {certification?.title ?? "Course Modules"}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Read-only guide to the major categories, modules, and lessons under this
                certification — {officialLessonCount} lesson(s) in total.
              </p>
            </div>
            {certification ? (
              <Button asChild variant="outline">
                <Link
                  to={`/institution/certifications/${certification.certificationId}/view?groupId=${id}`}
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Read content
                </Link>
              </Button>
            ) : null}
          </div>

          {officialMajors.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Layers3 className="h-7 w-7" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-foreground">
                No curriculum yet
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                No curriculum is available for this certification yet.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {officialMajors.map((majorCategory, majorIndex) => (
                <OfficialMajorSection
                  key={majorCategory.majorCategoryId ?? majorIndex}
                  majorCategory={majorCategory}
                  majorIndex={majorIndex}
                  buildLessonHref={(lessonId) =>
                    `/institution/certifications/${certification.certificationId}/view?groupId=${id}&lessonId=${lessonId}`
                  }
                />
              ))}
            </div>
          )}

          {/* Official assessments belong with the official curriculum -- the
              Assessments tab is only for this group's own (institution-owned) exams. */}
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

        <TabsContent value="assessments" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">Assessments</h2>
              <p className="text-xs text-muted-foreground">
                New assessments start as drafts — publish one before your learners can access it.
              </p>
            </div>
            <Button asChild disabled={!certification}>
              <Link to={`/institution/groups/${id}/assessments/new`}>
                <Plus className="size-4" aria-hidden="true" />
                Create Assessment
              </Link>
            </Button>
          </div>

          {ownGroupExams.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {ownGroupExams.map((exam) => (
                <li key={exam.examId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setPreviewExam(exam)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate text-sm font-medium text-foreground hover:underline">
                      {exam.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {exam.totalQuestions ?? 0}{" "}
                      {(exam.totalQuestions ?? 0) === 1 ? "question" : "questions"}
                      {exam.durationMinutes ? ` · ${exam.durationMinutes} min` : ""}
                      {exam.passingScore != null ? ` · ${exam.passingScore}% to pass` : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">
                      {examTypeById.get(exam.examTypeId) ?? "Assessment"}
                    </Badge>
                    <InstitutionStatusBadge status={exam.status} />
                    {exam.status === "DRAFT" || !exam.status ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => publishExamMutation.mutate(exam.examId)}
                        disabled={publishExamMutation.isPending}
                      >
                        Publish
                      </Button>
                    ) : null}
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/institution/groups/${id}/assessments/${exam.examId}/edit`}>
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${exam.title}`}
                      onClick={() => setDeleteExamTarget(exam)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <ClipboardCheckIcon
                className="mx-auto size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-foreground">No assessments yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your group's first assessment to see it listed here.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="learners" className="mt-5">
          <LearnersTab groupId={id} group={group} />
        </TabsContent>

        <TabsContent value="announcements" className="mt-5">
          <AnnouncementsTab groupId={id} />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={deleteExamTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteExamTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteExamTarget?.title}&quot; will be permanently removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExamMutation.mutate(deleteExamTarget.examId)}
              disabled={deleteExamMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssessmentPreviewDialog
        open={previewExam != null}
        onOpenChange={(open) => {
          if (!open) setPreviewExam(null)
        }}
        exam={previewExam}
        examTypeByIdText={examTypeById}
        examQuestions={examQuestions}
        questionById={questionById}
      />
    </div>
  )
}
