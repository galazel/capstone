import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardCheckIcon,
  FileQuestionIcon,
  FolderTree,
  Layers3,
  Loader2,
  MailIcon,
  MegaphoneIcon,
  PinIcon,
  Plus,
  SquarePen,
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
import { createMajorCategory, deleteMajorCategory } from "@/services/majorCategoryService.js"
import { createMiddleCategory, deleteMiddleCategory } from "@/services/middleCategoryService.js"
import { createLesson, deleteLesson } from "@/services/lessonService.js"
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
 * looks the same in both places. No edit/create actions here -- an Enterprise
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

/**
 * A group's own authored content -- Major Categories owned by this group
 * (ownerGroupId === groupId), created and edited alongside the read-only
 * official curriculum, never mixed into it for anyone else. Middle
 * categories/lessons inherit ownership from their major category, so no
 * ownerGroupId is passed for those creates -- see MiddleCategoryService/
 * LessonService.
 *
 * The building UI deliberately mirrors the admin's CertificationModules
 * component (collapsible numbered major cards, folder-tree modules, lesson
 * rows, dashed add buttons, floating "+") so authoring content feels the
 * same in both places -- the difference is each action here persists
 * immediately (ownership must be resolved server-side per create).
 */
function ContentTab({ groupId, certification }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addingMajor, setAddingMajor] = useState(false)
  const [collapsedMajors, setCollapsedMajors] = useState(() => new Set())
  const [collapsedMiddles, setCollapsedMiddles] = useState(() => new Set())
  const [addingMiddleTo, setAddingMiddleTo] = useState(null)
  const [addingLessonTo, setAddingLessonTo] = useState(null)

  const ownMajorCategories = (certification?.majorCategory ?? []).filter(
    (major) => major.ownerGroupId === groupId
  )

  const toggle = (setter, id) =>
    setter((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Patch just the affected certification in the cached tree instead of
  // refetching the whole thing -- refetching getAllCertifications on every
  // add/delete was what made each action feel slow. The create/delete
  // endpoints return (or identify) the exact row, so the cache update is
  // authoritative, not a guess.
  const contentKey = ["certifications", "group", groupId]
  const patchCert = (updater) =>
    queryClient.setQueryData(contentKey, (old) =>
      (old ?? []).map((cert) =>
        cert.certificationId === certification.certificationId ? updater(cert) : cert
      )
    )
  const mapMajors = (cert, fn) => ({ ...cert, majorCategory: (cert.majorCategory ?? []).map(fn) })

  const createMajorMutation = useMutation({
    mutationFn: (title) =>
      createMajorCategory({ certificationId: certification.certificationId, title }, groupId),
    onSuccess: (major) => {
      patchCert((cert) => ({
        ...cert,
        majorCategory: [...(cert.majorCategory ?? []), { ...major, middleCategory: major.middleCategory ?? [] }],
      }))
      toast.success("Category created.")
      setAddingMajor(false)
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to create this category.")),
  })

  const createMiddleMutation = useMutation({
    mutationFn: ({ majorCategoryId, title }) => createMiddleCategory({ majorCategoryId, title }),
    onSuccess: (middle) => {
      patchCert((cert) =>
        mapMajors(cert, (major) =>
          major.majorCategoryId === middle.majorCategoryId
            ? { ...major, middleCategory: [...(major.middleCategory ?? []), { ...middle, lessons: middle.lessons ?? [] }] }
            : major
        )
      )
      toast.success("Module created.")
      setAddingMiddleTo(null)
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to create this module.")),
  })

  const createLessonMutation = useMutation({
    mutationFn: ({ middleCategoryId, name }) => createLesson({ middleCategoryId, name }),
    onSuccess: (lesson) => {
      patchCert((cert) =>
        mapMajors(cert, (major) => ({
          ...major,
          middleCategory: (major.middleCategory ?? []).map((middle) =>
            middle.middleCategoryId === lesson.middleCategoryId
              ? { ...middle, lessons: [...(middle.lessons ?? []), lesson] }
              : middle
          ),
        }))
      )
      setAddingLessonTo(null)
      navigate(`/enterprise/lessons/${encodeURIComponent(lesson.name)}/create`, {
        state: { lessonId: lesson.lessonId, lessonName: lesson.name },
      })
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to create this lesson.")),
  })

  const deleteMajorMutation = useMutation({
    mutationFn: (id) => deleteMajorCategory(id),
    onSuccess: (_data, majorId) => {
      patchCert((cert) => ({
        ...cert,
        majorCategory: (cert.majorCategory ?? []).filter((major) => major.majorCategoryId !== majorId),
      }))
      toast.success("Category deleted.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to delete this category.")),
  })

  const deleteMiddleMutation = useMutation({
    mutationFn: (id) => deleteMiddleCategory(id),
    onSuccess: (_data, middleId) => {
      patchCert((cert) =>
        mapMajors(cert, (major) => ({
          ...major,
          middleCategory: (major.middleCategory ?? []).filter((middle) => middle.middleCategoryId !== middleId),
        }))
      )
      toast.success("Module deleted.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to delete this module.")),
  })

  const deleteLessonMutation = useMutation({
    mutationFn: (id) => deleteLesson(id),
    onSuccess: (_data, lessonId) => {
      patchCert((cert) =>
        mapMajors(cert, (major) => ({
          ...major,
          middleCategory: (major.middleCategory ?? []).map((middle) => ({
            ...middle,
            lessons: (middle.lessons ?? []).filter((lesson) => lesson.lessonId !== lessonId),
          })),
        }))
      )
      toast.success("Lesson deleted.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to delete this lesson.")),
  })

  if (!certification) {
    return (
      <EnterpriseEmptyState
        icon={FolderTree}
        title="No certification linked to this group yet"
        description="Content can be authored once this group's certification allocation is set."
      />
    )
  }

  const openLesson = (lesson) =>
    navigate(`/enterprise/lessons/${encodeURIComponent(lesson.name)}/create`, {
      state: { lessonId: lesson.lessonId, lessonName: lesson.name },
    })

  return (
    <section className="w-full">
      <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-foreground">Your group's content</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Build your own categories, modules, and lessons for this group. They sit alongside
          the official curriculum but stay visible only to your group.
        </p>
        <p className="mt-3 text-xs font-medium text-muted-foreground/70">
          {ownMajorCategories.length} categor{ownMajorCategories.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {ownMajorCategories.length === 0 && !addingMajor ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-foreground shadow-sm">
            <FolderTree size={24} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Start building your group's content
          </h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            Use the button below to create your first major category, then add modules and
            lessons under it.
          </p>
          <Button className="mt-4" onClick={() => setAddingMajor(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add category
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {ownMajorCategories.map((major, majorIndex) => {
            const middles = major.middleCategory ?? []
            const majorOpen = !collapsedMajors.has(major.majorCategoryId)
            return (
              <div
                key={major.majorCategoryId}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="flex items-center gap-3 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => toggle(setCollapsedMajors, major.majorCategoryId)}
                    aria-label="Show or hide modules"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
                  >
                    {majorOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <span className="w-8 text-xl font-semibold tracking-tight text-muted-foreground/60">
                    {String(majorIndex + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{major.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {middles.length} {middles.length === 1 ? "module" : "modules"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Add module"
                      onClick={() => {
                        setAddingMiddleTo(major.majorCategoryId)
                        setCollapsedMajors((c) => {
                          const n = new Set(c)
                          n.delete(major.majorCategoryId)
                          return n
                        })
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Plus size={17} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete category"
                      onClick={() => deleteMajorMutation.mutate(major.majorCategoryId)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {majorOpen ? (
                  <div className="space-y-3 border-t border-border bg-muted/30 px-4 py-4">
                    {middles.map((middle) => {
                      const lessons = middle.lessons ?? []
                      const middleOpen = !collapsedMiddles.has(middle.middleCategoryId)
                      return (
                        <div
                          key={middle.middleCategoryId}
                          className="overflow-hidden rounded-xl border border-border bg-card"
                        >
                          <div className="flex items-center gap-3 px-3 py-3">
                            <button
                              type="button"
                              onClick={() => toggle(setCollapsedMiddles, middle.middleCategoryId)}
                              aria-label="Show or hide lessons"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
                            >
                              {middleOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                            </button>
                            <FolderTree size={16} className="shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {middle.title}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="Add lesson"
                                onClick={() => {
                                  setAddingLessonTo(middle.middleCategoryId)
                                  setCollapsedMiddles((c) => {
                                    const n = new Set(c)
                                    n.delete(middle.middleCategoryId)
                                    return n
                                  })
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete module"
                                onClick={() => deleteMiddleMutation.mutate(middle.middleCategoryId)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {middleOpen ? (
                            <div className="space-y-2 border-t border-border bg-muted/20 px-3 py-3">
                              {lessons.map((lesson, lessonIndex) => (
                                <div
                                  key={lesson.lessonId}
                                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                                >
                                  <span className="w-5 text-xs font-semibold text-muted-foreground/60">
                                    {String(lessonIndex + 1).padStart(2, "0")}
                                  </span>
                                  <BookOpen size={15} className="shrink-0 text-muted-foreground" />
                                  <button
                                    type="button"
                                    onClick={() => openLesson(lesson)}
                                    className="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:underline"
                                  >
                                    {lesson.name}
                                  </button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 gap-1 px-2 text-primary hover:text-primary"
                                    onClick={() => openLesson(lesson)}
                                  >
                                    <SquarePen size={14} aria-hidden="true" />
                                    Create content
                                  </Button>
                                  <button
                                    type="button"
                                    aria-label="Delete lesson"
                                    onClick={() => deleteLessonMutation.mutate(lesson.lessonId)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              ))}

                              {addingLessonTo === middle.middleCategoryId ? (
                                <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/50 bg-card px-3 py-2.5">
                                  <BookOpen size={15} className="shrink-0 text-muted-foreground" />
                                  <InlineNameInput
                                    placeholder="Lesson name"
                                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                                    onSubmit={(name) =>
                                      createLessonMutation.mutate({
                                        middleCategoryId: middle.middleCategoryId,
                                        name,
                                      })
                                    }
                                    onCancel={() => setAddingLessonTo(null)}
                                    isPending={createLessonMutation.isPending}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAddingLessonTo(middle.middleCategoryId)}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
                                >
                                  <Plus size={15} />
                                  {lessons.length ? "Add another lesson" : "Add first lesson"}
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}

                    {addingMiddleTo === major.majorCategoryId ? (
                      <div className="overflow-hidden rounded-xl border border-dashed border-primary/50 bg-card">
                        <div className="flex items-center gap-3 px-3 py-3">
                          <FolderTree size={16} className="shrink-0 text-muted-foreground" />
                          <InlineNameInput
                            placeholder="Module title"
                            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                            onSubmit={(title) =>
                              createMiddleMutation.mutate({
                                majorCategoryId: major.majorCategoryId,
                                title,
                              })
                            }
                            onCancel={() => setAddingMiddleTo(null)}
                            isPending={createMiddleMutation.isPending}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingMiddleTo(major.majorCategoryId)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
                      >
                        <Plus size={16} />
                        {middles.length ? "Add another module" : "Add first module"}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}

          {/* In-flow add control -- renders the same major-category card shape
              as a real one, with the title as an input you type into. */}
          {addingMajor ? (
            <div className="overflow-hidden rounded-2xl border border-dashed border-primary/50 bg-card shadow-sm">
              <div className="flex items-center gap-3 px-4 py-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
                  <ChevronDown size={18} />
                </span>
                <span className="w-8 text-xl font-semibold tracking-tight text-muted-foreground/60">
                  {String(ownMajorCategories.length + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <InlineNameInput
                    placeholder="Major category title"
                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                    onSubmit={(title) => createMajorMutation.mutate(title)}
                    onCancel={() => setAddingMajor(false)}
                    isPending={createMajorMutation.isPending}
                  />
                  <p className="mt-0.5 text-xs text-muted-foreground">New category</p>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingMajor(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
            >
              <Plus size={16} />
              Add {ownMajorCategories.length ? "another " : ""}major category
            </button>
          )}
        </div>
      )}
    </section>
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
                  to={`/enterprise/certifications/${certification.certificationId}/view?groupId=${id}`}
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
                    `/enterprise/certifications/${certification.certificationId}/view?groupId=${id}&lessonId=${lessonId}`
                  }
                />
              ))}
            </div>
          )}

          {/* Official assessments belong with the official curriculum -- the
              Assessments tab is only for this group's own (enterprise-owned) exams. */}
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
          <ContentTab groupId={id} certification={certification} />
        </TabsContent>

        <TabsContent value="assessments" className="mt-5 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheckIcon className="size-4 text-primary" aria-hidden="true" />
                Your group's assessments
              </CardTitle>
              <CardDescription>
                Exams your group has authored. Official certification assessments live in the
                Curriculum tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ownGroupExams.length ? (
                <ul className="divide-y rounded-lg border">
                  {ownGroupExams.map((exam) => (
                    <li
                      key={exam.examId}
                      className="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium">{exam.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {examTypeById.get(exam.examTypeId) ?? "Assessment"}
                        </Badge>
                        <EnterpriseStatusBadge status={exam.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No assessments authored for this group yet.
                </p>
              )}
            </CardContent>
          </Card>

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
