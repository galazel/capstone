import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Sparkles,
  Layers3,
  ListChecks,
  Trash2,
} from "@/components/icons"

import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  addLesson,
  addMajorCategory,
  addMiddleCategory,
  deleteLesson,
  deleteMajorCategory,
  deleteMiddleCategory,
  getAllCertifications,
  updateCertification,
} from "@/services/certificationService.js"
import { apiMessage } from "@/services/base"
import { industries } from "@/constants/industries.js"
import { InlineAdd, InlineEditable } from "@/components/certifications/inline-editable.jsx"
import {
  toCertificationUpdatePayload,
  validateCertificationDescription,
  validateCertificationTitle,
  validateStructureName,
} from "@/utils/certification-edit.js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
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
import { prefetchAssessmentData } from "@/components/assessments/admin/assessments-tab.jsx"
import CertificationPublishingChecklist from "@/components/assessments/admin/certification-publishing-checklist.jsx"
import GenerateMoreDialog from "@/components/certifications/generate-more-dialog.jsx"
import { InlineGenerationMonitor } from "@/components/certifications/inline-generation-monitor.jsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  generationErrorOf,
  useActiveGenerations,
} from "@/hooks/use-active-generations"

function getCertification(location) {
  return (
      location.state?.certification?.certification ??
      location.state?.certification ??
      null
  )
}

/** Which endpoint removes which kind of node. */
const DELETERS = {
  major: deleteMajorCategory,
  middle: deleteMiddleCategory,
  lesson: deleteLesson,
}

function getLessonTitle(lesson) {
  return lesson?.name ?? lesson?.title ?? "Untitled lesson"
}

export default function ViewCertificationAdmin() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id: routeCertificationId } = useParams()
  const pageRef = useRef(null)
  const queryClient = useQueryClient()
  const [certificationOverride, setCertification] = useState(() =>
      getCertification(location)
  )

  /* The certification is handed over in router state when you arrive from the
     list, which is instant and saves a round trip. But state does not survive a
     refresh, a bookmark, or the back button off one of this page's own
     workspaces -- and the page answered all three with "Certification not
     found", which is a lie: the certification is there, the state that carried
     it is not. So the id in the URL is the fallback, and the URL always
     survives. */
  const { data: certifications = [], isLoading: isLoadingCertifications } = useQuery({
    queryKey: ["admin-certifications", "certification-page"],
    queryFn: () => getAllCertifications(),
    staleTime: 5 * 60 * 1000,
  })

  /* Why this certification is empty, when the reason is a rejected run.
     Without it the page can only offer "add a major category to start
     building", which is advice for a certification nobody has filled in yet
     -- not for one whose generation was refused because the documents were
     about a different subject. */
  const { byCertificationId: generationRuns } = useActiveGenerations()

  /* Resolved during render, not in an effect. An effect would leave the first
     frame with nothing to show -- and with the list already cached there is no
     loading flag to hide behind, so that frame rendered "Certification not
     found" before correcting itself.

     The override is whatever this page has been handed or has changed locally:
     router state on arrival, and the edits made here. The fetched copy is what
     the URL alone can reach. */
  const fetchedCertification = certifications.find(
      (item) =>
          String(item.certificationId ?? item.id) === String(routeCertificationId)
  )

  /* Merged, not replaced.

     The override used to win outright, which made it responsible for being a
     whole certification every time anyone wrote to it. It only takes one
     handler doing `{ ...current, oneField }` where `current` is null -- which
     is what it is on any arrival without router state -- for the override to
     become a stub with no title and no majorCategory, and for that stub to
     beat a perfectly good fetched copy. Publishing did exactly that, and it
     surfaced as the curriculum disappearing, which points nowhere near state.

     Merging makes a partial override harmless: it can only override the fields
     it actually carries, and everything it omits still comes from the fetched
     copy. An override for a *different* certification is dropped rather than
     mixed in -- the effect below clears those, but it runs after the render
     that would have blended two certifications into one.

     Memoised so this stays one object across renders; nothing here depends on
     its identity today, but handing children a fresh object on every keystroke
     in an inline editor is a cost with no upside. */
  const overrideId =
      certificationOverride?.certificationId ?? certificationOverride?.id

  const certification = useMemo(() => {
    if (
        certificationOverride &&
        // No id at all means a partial for the page we are on; only an id that
        // names a different certification disqualifies the override.
        (overrideId == null ||
            String(overrideId) === String(routeCertificationId))
    ) {
      return { ...fetchedCertification, ...certificationOverride }
    }

    return fetchedCertification ?? null
  }, [certificationOverride, overrideId, fetchedCertification, routeCertificationId])

  const [isGenerateMoreOpen, setIsGenerateMoreOpen] = useState(false)
  const [isWatchingGeneration, setIsWatchingGeneration] = useState(false)

  /* The node a delete has been asked for, held until it is confirmed.
     `{ kind, id, name, detail }` -- one dialog for all three levels, because
     three dialogs saying the same sentence about different nouns is three
     places for the warning to drift. */
  const [pendingDelete, setPendingDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  /* The assessments tab's reads, started as soon as the certification opens
     rather than when the tab is clicked.

     The tab's content is unmounted while another tab is showing, so its queries
     could not begin until the click -- which is why opening it always meant
     watching four requests resolve behind skeleton rows. Nothing here depends
     on them, so warming them costs the page nothing and gives the tab its data
     already in hand.

     The id comes from the route rather than the fetched certification so the
     exam read can start on the first render, before the certification itself
     has arrived. */
  useEffect(() => {
    prefetchAssessmentData(queryClient, routeCertificationId)
  }, [queryClient, routeCertificationId])

  useEffect(() => {
    pageRef.current?.scrollIntoView({
      behavior: "auto",
      block: "start",
    })

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    })
  }, [location.key])

  /* Router state wins when it is there -- arriving from the list carries the
     certification with it, which saves a round trip. What this must NOT do is
     blank the certification when state is absent: it ran after the fallback
     below and undid it in the same commit, and because neither effect's
     dependencies had changed by the end of it, nothing re-ran and the page sat
     on "Certification not found" while holding the id that would have found it.
     Coming back from the question bank or the lesson editor is exactly that
     case -- a fresh location.key with no state attached. */
  useEffect(() => {
    const fromRouterState = getCertification(location)

    if (fromRouterState) {
      setCertification(fromRouterState)
      return
    }

    // Only clear an override that belongs to a different certification;
    // clearing it simply falls back to the fetched copy.
    setCertification((current) =>
        current &&
        String(current.certificationId ?? current.id) ===
        String(routeCertificationId)
            ? current
            : null
    )
  }, [location.key, routeCertificationId])

  /**
   * One edit, saved where it was made.
   *
   * `produce` returns the certification as it should be after the change; this
   * serialises the whole thing and PUTs it, because that endpoint rebuilds the
   * certification from what it is sent. Sending a partial tree there does not
   * leave the rest alone -- it deletes it -- which is why every edit on this
   * page goes out as the complete, current certification with one field
   * different.
   *
   * The server's own copy comes back and wins: it carries the ids of anything
   * it created and the shape it actually stored.
   */
  async function saveCertificationEdit(produce, successMessage) {
    const next = produce(certification)
    const payload = toCertificationUpdatePayload(next)

    const saved = await updateCertification(payload.certificationId, payload)

    setCertification((current) => ({
      ...current,
      ...next,
      ...(saved && typeof saved === "object" ? saved : {}),
    }))

    await queryClient.invalidateQueries({ queryKey: ["admin-certifications"] })

    toast.success(successMessage)
  }

  /* The three tree renames, each rebuilding only the branch it touches so the
     objects either side keep their identity. */
  function renameMajorCategory(majorIndex, title) {
    return saveCertificationEdit(
        (current) => ({
          ...current,
          majorCategory: (current.majorCategory ?? []).map((major, index) =>
              index === majorIndex ? { ...major, title } : major
          ),
        }),
        "Major category renamed"
    )
  }

  function renameMiddleCategory(majorIndex, middleIndex, title) {
    return saveCertificationEdit(
        (current) => ({
          ...current,
          majorCategory: (current.majorCategory ?? []).map((major, index) =>
              index !== majorIndex
                  ? major
                  : {
                    ...major,
                    middleCategory: (major.middleCategory ?? []).map(
                        (middle, position) =>
                            position === middleIndex
                                ? { ...middle, title }
                                : middle
                    ),
                  }
          ),
        }),
        "Module renamed"
    )
  }

  function renameLesson(majorIndex, middleIndex, lessonIndex, name) {
    return saveCertificationEdit(
        (current) => ({
          ...current,
          majorCategory: (current.majorCategory ?? []).map((major, index) =>
              index !== majorIndex
                  ? major
                  : {
                    ...major,
                    middleCategory: (major.middleCategory ?? []).map(
                        (middle, position) =>
                            position !== middleIndex
                                ? middle
                                : {
                                  ...middle,
                                  lessons: (middle.lessons ?? []).map(
                                      (lesson, lessonPosition) =>
                                          lessonPosition === lessonIndex
                                              ? { ...lesson, name }
                                              : lesson
                                  ),
                                }
                    ),
                  }
          ),
        }),
        "Lesson renamed"
    )
  }

  /**
   * Re-read the certification from the server and let that copy win.
   *
   * Adds and deletes go through the per-node endpoints, which return only the
   * node they touched -- the ids of anything the server minted, and the shape
   * of the tree after a branch was removed, are only knowable by asking again.
   * Patching the local tree instead would work right up until a lesson was
   * added and immediately renamed, with no id to rename it by.
   */
  async function refreshCertification() {
    await queryClient.invalidateQueries({ queryKey: ["admin-certifications"] })
    setCertification(null)
  }

  /* The three adds. Each throws on failure rather than toasting: InlineAdd
     keeps the field open and shows the message, so a rejected name is still
     there to correct. */
  async function addMajor(title) {
    await addMajorCategory({
      certificationId: certification.certificationId ?? certification.id,
      title,
    })
    await refreshCertification()
    toast.success("Major category added")
  }

  async function addMiddle(majorCategoryId, title) {
    await addMiddleCategory({ majorCategoryId, title })
    await refreshCertification()
    toast.success("Module added")
  }

  async function addLessonTo(middleCategoryId, name) {
    await addLesson({ middleCategoryId, name })
    await refreshCertification()
    toast.success("Lesson added")
  }

  /* Deleting is the one thing on this page that is not undoable, so it is the
     one thing that asks first. Everything else saves the moment it is typed. */
  function requestDelete(pending) {
    setPendingDelete(pending)
  }

  async function confirmDelete() {
    if (!pendingDelete || isDeleting) return

    try {
      setIsDeleting(true)
      await DELETERS[pendingDelete.kind](pendingDelete.id)
      await refreshCertification()
      setPendingDelete(null)
      toast.success(`${pendingDelete.name} deleted`)
    } catch (error) {
      // The server refuses a node that has graded learner records under it and
      // names what is in the way; that sentence is the whole point, so it is
      // shown rather than replaced with "could not delete".
      toast.error("Could not delete", {
        description: apiMessage(error, "Something went wrong."),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  /* Everything the tree can do, in one object. Passed down whole because the
     alternative is eight props repeated at each of the two levels, where the
     only thing a reader learns from the repetition is that they were spelled
     the same both times. */
  const curriculumActions = {
    renameMajor: renameMajorCategory,
    renameMiddle: renameMiddleCategory,
    renameLesson,
    addMiddle,
    addLesson: addLessonTo,
    requestDelete,
  }

  /* The checklist's "Create ..." and "Fix ..." buttons, now that the
     assessments they act on live on their own page. The request rides along in
     router state and that page opens the dialog on arrival, so the admin still
     gets one click from a missing requirement to the form that fills it. */
  function handleCreateAssessment(request) {
    navigate(`/admin/certification/${certification.certificationId}/assessments`, {
      state: {
        createAssessment: {
          ...request,
          requestId: `${Date.now()}-${Math.random()}`,
        },
      },
    })
  }

  /* The page's own shape, greyed out -- not a sentence in the middle of an
     empty screen.

     This wait is not short: the certification comes from a list read that
     crosses to a database in another region, and a centred "Loading
     certification..." on a blank page gives an admin nothing to look at and no
     idea whether it is nearly done or broken. Drawing the header band, the
     action row and a few curriculum rows means the layout does not jump when
     the data lands, and the page reads as loading rather than as empty.

     The blue band is the real one (`bg-rb-feather`, same as the header below),
     so the first thing on screen is already correct rather than a grey box
     that is replaced a second later. */
  if (!certification && isLoadingCertifications) {
    return (
        <section
            className="min-h-full overflow-y-auto bg-muted/30 font-sans"
            aria-busy="true"
            aria-live="polite"
        >
          <span className="sr-only">Loading certification</span>

          <header className="relative isolate overflow-hidden border-b border-border bg-rb-feather px-6 py-12 sm:px-10 lg:px-20 lg:py-16">
            <div className="relative z-10 mx-auto max-w-6xl">
              <Skeleton className="mb-5 h-7 w-64 rounded-full bg-white/25" />
              <Skeleton className="h-10 w-[min(28rem,80%)] rounded-xl bg-white/30" />
              <div className="mt-5 space-y-2">
                <Skeleton className="h-4 w-[min(46rem,95%)] rounded bg-white/20" />
                <Skeleton className="h-4 w-[min(34rem,75%)] rounded bg-white/20" />
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Skeleton className="h-9 w-40 rounded-full bg-white/20" />
                <Skeleton className="h-9 w-48 rounded-full bg-white/20" />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:px-20">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-8 w-56 rounded-lg" />
                <Skeleton className="h-4 w-[min(30rem,90%)] rounded" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-11 w-36 rounded-xl" />
                <Skeleton className="h-11 w-36 rounded-xl" />
                <Skeleton className="h-11 w-40 rounded-xl" />
              </div>
            </div>

            <Skeleton className="mb-5 h-6 w-32 rounded" />
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <Skeleton className="h-5 w-[min(24rem,70%)] rounded" />
                    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                      <Skeleton className="h-5 w-64 rounded" />
                      <Skeleton className="mt-2 h-4 w-40 rounded" />
                    </div>
                  </div>
              ))}
            </div>
          </main>
        </section>
    )
  }

  if (!certification) {
    return (
        <section className="flex min-h-full items-center justify-center bg-muted/40 p-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Layers3 className="h-6 w-6" />
            </div>

            <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">
              Certification not found
            </h1>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Go back to the certifications page and select a certification again.
            </p>

            <Button
                type="button"
                className="mt-6 h-10 rounded-xl px-5"
                onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
          </div>
        </section>
    )
  }

  const majorCategories = certification.majorCategory ?? []

  const certificationKey = String(
      certification.certificationId ?? certification.id ?? ""
  )
  const generationRun = generationRuns.get(certificationKey)
  const generationError = generationErrorOf(generationRun)

  /* A run against THIS certification, still going.

     The list page has always been able to watch a build; this page could not,
     which is backwards -- this is where an admin lands to see what a
     certification contains, and during a build it is the page whose content is
     changing under them. They had to go back to the list to watch it. */
  const isGenerating =
      Boolean(generationRun) &&
      !["COMPLETED", "FAILED", "CANCELLED"].includes(generationRun.status)

  const totalMiddleCategories = majorCategories.reduce(
      (total, majorCategory) =>
          total + (majorCategory.middleCategory?.length ?? 0),
      0
  )

  const totalLessons = majorCategories.reduce(
      (total, majorCategory) =>
          total +
          (majorCategory.middleCategory ?? []).reduce(
              (middleTotal, middleCategory) =>
                  middleTotal + (middleCategory.lessons?.length ?? 0),
              0
          ),
      0
  )

  return (
      <section
          ref={pageRef}
          className="min-h-full overflow-y-auto bg-muted/30 font-sans"
      >
        {/* Feather blue, the same default cover the certification wears on every
            card — there is no uploaded image to blur behind this header now. */}
        <header className="relative isolate overflow-hidden border-b border-border bg-rb-feather px-6 py-12 sm:px-10 lg:px-20 lg:py-16">
          <div className="relative z-10 mx-auto max-w-6xl">
            {/* The header is the certification's own record of itself, so it
                is edited here rather than in a panel that covers it. Each
                field is the same markup it always was until you click the
                pencil. */}
            <div className="mb-5 flex items-center gap-2">
              {/* The pill IS the control.
                  It used to be a read-only badge with a separate white circle
                  beside it whose own value was `sr-only` -- so the thing that
                  showed the industry could not change it, and the thing that
                  changed it showed nothing. Two elements for one field, and the
                  live one looked like a stray button.

                  A select rather than the pencil the rest of the page uses,
                  because the industry has to match the one vocabulary
                  certifications and challenge arenas are both filtered by: a
                  typed one silently matches nothing. A chevron inside the pill
                  says "pick from a list", which is what this actually is. */}
              <Select
                  value={certification.industry || ""}
                  onValueChange={(industry) => {
                    void saveCertificationEdit(
                        (current) => ({ ...current, industry }),
                        "Industry updated"
                    ).catch((error) =>
                        toast.error("Could not update the industry", {
                          description: apiMessage(error, "Please try again."),
                        })
                    )
                  }}
              >
                <SelectTrigger
                    size="sm"
                    aria-label="Industry"
                    title="Change industry"
                    className="gap-1.5 rounded-full border-black/10 bg-white/85 px-3 py-1 text-xs font-semibold text-black shadow-sm backdrop-blur-sm hover:bg-white data-[size=sm]:h-auto"
                >
                  <SelectValue placeholder="General" />
                </SelectTrigger>

                <SelectContent>
                  {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <InlineEditable
                value={certification.title}
                label="Certification name"
                tone="dark"
                className="max-w-3xl"
                validate={validateCertificationTitle}
                onSave={(title) =>
                    saveCertificationEdit(
                        (current) => ({ ...current, title }),
                        "Certification name updated"
                    )
                }
                renderValue={(title) => (
                    <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                      {title}
                    </h1>
                )}
            />

            <InlineEditable
                value={certification.description}
                label="Description"
                tone="dark"
                multiline
                className="mt-4 max-w-3xl"
                validate={validateCertificationDescription}
                onSave={(description) =>
                    saveCertificationEdit(
                        (current) => ({ ...current, description }),
                        "Description updated"
                    )
                }
                renderValue={(description) => (
                    <p className="text-sm leading-7 text-white/85 sm:text-base">
                      {description || "No description available."}
                    </p>
                )}
            />

            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm">
                <Layers3 className="h-4 w-4" />

                <span>
                {majorCategories.length} major{" "}
                  {majorCategories.length === 1 ? "category" : "categories"}
              </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white/90 backdrop-blur-sm">
                <BookOpen className="h-4 w-4" />

                <span>
                {totalMiddleCategories} modules · {totalLessons} lessons
              </span>
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 py-10 sm:px-10 lg:px-20 lg:py-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">
                  Certification curriculum
                </p>

                <h2 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground">
                  Course Modules
                </h2>

                {/* Says the page is editable, because the pencils alone did
                    not: they are small, they sit beside the text rather than
                    on it, and an admin who has not noticed one goes looking
                    for a form instead. */}
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Everything on this page is edited where it is shown: the
                  pencil beside any name renames it, and each level of the
                  curriculum adds and removes its own items. There is no
                  separate edit form to open.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* One slot, two states.
                    While a build is running this REPLACES "Add with AI" rather
                    than sitting beside it: adding more to a certification that
                    is already generating queues a second run against the same
                    curriculum, and the thing an admin actually wants at that
                    moment is to see what the current one is doing. Offering
                    both invites the wrong one. */}
                {isGenerating ? (
                    <Button
                        type="button"
                        className="h-11 rounded-xl px-5 font-medium shadow-sm"
                        onClick={() => setIsWatchingGeneration(true)}
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      View progress
                    </Button>
                ) : (
                    /* Adds to the curriculum rather than rebuilding it: another
                       domain, another module, further lessons and the questions
                       and assessments that go with them.

                       Worded "Add with AI" rather than "Generate", because the
                       generate control on the certification list REPLACES a
                       curriculum. Two buttons a page apart both saying
                       generate, one of which deletes everything, is a trap. */
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl px-5 font-medium shadow-sm"
                        onClick={() => setIsGenerateMoreOpen(true)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Add with AI
                    </Button>
                )}

                {/* The two workspaces this certification owns, side by side.
                    Both are full pages of their own; neither is a tab. */}
                <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl px-5 font-medium shadow-sm"
                    onClick={() =>
                        navigate(
                            `/admin/certification/${certification.certificationId}/assessments`
                        )
                    }
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Assessments
                </Button>

                {/* One button, not two: the bank opens with the builder in
                    it. */}
                <Button
                    type="button"
                    className="h-11 rounded-xl px-5 font-medium shadow-sm"
                    onClick={() =>
                        navigate(
                            `/admin/certification/${certification.certificationId}/question-bank`
                        )
                    }
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  Question Bank
                </Button>

              </div>
            </div>

            {/* The curriculum, in place. It is what this page is about -- a
                link to it from a page whose whole subject is it was a step
                that led nowhere new. */}
            <section className="mb-10">
              <h3 className="mb-5 font-heading text-xl font-bold tracking-tight text-foreground">
                Curriculum
              </h3>

              {majorCategories.length === 0 && generationError ? (
                  /* The rejected case, told properly. An empty curriculum has
                     two very different causes -- nobody has built it yet, or a
                     generation was refused -- and only one of them is fixed by
                     adding a category. The auditor's own sentence is quoted in
                     full rather than summarised, because it names the specific
                     mismatch it found between the documents and the topic. */
                  <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 shadow-sm sm:p-10">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                      <Layers3 className="h-7 w-7" />
                    </div>

                    <h4 className="mt-5 font-heading text-lg font-bold text-foreground">
                      Generation was rejected
                    </h4>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Nothing was built, so this certification is empty. The
                      generator gave this reason:
                    </p>

                    <p className="mt-4 rounded-xl border border-destructive/25 bg-background p-4 text-sm leading-6 text-foreground">
                      {generationError}
                    </p>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Upload documents that match the name and description above,
                      then generate again — or delete this certification and start
                      over. You can also build the curriculum by hand.
                    </p>
                  </div>
              ) : majorCategories.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Layers3 className="h-7 w-7" />
                    </div>

                    <h4 className="mt-5 font-heading text-lg font-bold text-foreground">
                      No major categories yet
                    </h4>

                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Add a major category to start building this certification
                      curriculum.
                    </p>

                    {/* The empty state said "add a major category" and gave no
                        way to add one, which is a dead end wearing an
                        instruction. */}
                    <div className="mt-6 flex justify-center">
                      <InlineAdd
                          label="Major category"
                          validate={(value) =>
                              validateStructureName(value, "Major category title")
                          }
                          onAdd={addMajor}
                          className="w-full max-w-sm"
                      />
                    </div>
                  </div>
              ) : (
                  <div className="space-y-10">
                    {majorCategories.map((majorCategory, majorIndex) => (
                        <MajorCategorySection
                            key={majorCategory.majorCategoryId ?? majorIndex}
                            certification={certification}
                            majorCategory={majorCategory}
                            majorIndex={majorIndex}
                            actions={curriculumActions}
                        />
                    ))}

                    <InlineAdd
                        label="Major category"
                        validate={(value) =>
                            validateStructureName(value, "Major category title")
                        }
                        onAdd={addMajor}
                        className="w-full"
                    />
                  </div>
              )}
            </section>


            <div className="space-y-8">
              <CertificationPublishingChecklist
                  certificationId={certification?.certificationId}
                  isPublished={certification?.status === "PUBLISHED"}
                  onCreateAssessment={handleCreateAssessment}
                  /* Based on the certification actually on screen, not on the
                     override alone.

                     The override is null whenever this page was reached
                     without router state -- a refresh, a bookmark, the back
                     arrow off the assessments or question bank page -- and
                     spreading null left `{ status: "PUBLISHED" }`: no id, no
                     title, no majorCategory. That stub then beat the fetched
                     copy in the resolution below it, so publishing blanked the
                     curriculum it had just published. */
                  onPublished={() =>
                      setCertification((current) => ({
                        ...(current ?? certification),
                        status: "PUBLISHED",
                      }))
                  }
              />
            </div>
          </div>
        </main>

        <GenerateMoreDialog
            open={isGenerateMoreOpen}
            onOpenChange={setIsGenerateMoreOpen}
            certification={certification}
        />

        {/* The same monitor the certification list opens, mounted here so a
            build can be watched from the page it is building. Same component,
            not a second implementation, so the two cannot drift. */}
        <Dialog open={isWatchingGeneration} onOpenChange={setIsWatchingGeneration}>
          <DialogContent className="flex max-h-[calc(100dvh-4rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
            <DialogHeader className="px-4 pt-4 pb-3 sm:px-6">
              <DialogTitle>Generating {certification.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Live progress for this certification's generation.
              </DialogDescription>
            </DialogHeader>

            {isWatchingGeneration ? (
                <InlineGenerationMonitor
                    certificationId={certification.certificationId ?? certification.id}
                    onClose={() => setIsWatchingGeneration(false)}
                    onFinished={() => {
                      setIsWatchingGeneration(false)
                      /* The curriculum on the page behind this just changed --
                         new majors, lessons and assessments have landed. */
                      queryClient.invalidateQueries({ queryKey: ["admin-certifications"] })
                      queryClient.invalidateQueries({ queryKey: ["workflow-runs", "active"] })
                    }}
                />
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Named, counted, and specific about what else goes with it. A
            confirmation that says "are you sure?" and nothing else is a
            keystroke, not a decision -- and deleting a major category takes
            every module, lesson, quiz and question beneath it. */}
        <AlertDialog
            open={Boolean(pendingDelete)}
            onOpenChange={(open) => {
              if (!open && !isDeleting) setPendingDelete(null)
            }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete “{pendingDelete?.name}”?
              </AlertDialogTitle>

              <AlertDialogDescription>
                {pendingDelete?.detail
                    ? `This also deletes the ${pendingDelete.detail} under it, along with their quizzes and questions. `
                    : "This also deletes its quiz and questions. "}
                It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Keep it</AlertDialogCancel>

              <AlertDialogAction
                  disabled={isDeleting}
                  onClick={(event) => {
                    // The dialog closes itself on action; this one has to stay
                    // open until the request comes back, because the server can
                    // still refuse -- a node with graded learner records under
                    // it is not deletable, and that message belongs here.
                    event.preventDefault()
                    void confirmDelete()
                  }}
                  className="bg-destructive text-white hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
  )
}

function MajorCategorySection({
                                certification,
                                majorCategory,
                                majorIndex,
                                actions,
                              }) {
  const middleCategories = majorCategory.middleCategory ?? []
  const lessonCount = middleCategories.reduce(
      (total, middle) => total + (middle.lessons?.length ?? 0),
      0
  )

  return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Only the title is editable -- "Major Category 3" is this
              category's position in the list, not a name someone chose. */}
          <InlineEditable
              value={majorCategory.title}
              label="Major category title"
              validate={(value) => validateStructureName(value, "Major category title")}
              onSave={(title) => actions.renameMajor(majorIndex, title)}
              renderValue={(title) => (
                  <p className="font-heading text-lg font-bold text-foreground">
                    <span className="text-primary">
                      Major Category {majorIndex + 1}:
                    </span>{" "}
                    {title}
                  </p>
              )}
          />

          {majorCategory.priority && (
              <Badge
                  variant="secondary"
                  className="bg-primary/10 text-[10px] font-bold tracking-wider text-primary uppercase hover:bg-primary/10"
              >
                {majorCategory.priority}
              </Badge>
          )}

          <DeleteNodeButton
              disabled={majorCategory.majorCategoryId == null}
              label={`Delete major category ${majorCategory.title}`}
              onClick={() =>
                  actions.requestDelete({
                    kind: "major",
                    id: majorCategory.majorCategoryId,
                    name: majorCategory.title,
                    detail: describeSubtree(middleCategories.length, lessonCount),
                  })
              }
          />
        </div>

        {middleCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              No middle categories under this major category.
            </div>
        ) : (
            <div className="space-y-3">
              {middleCategories.map((middleCategory, middleIndex) => (
                  <MiddleCategoryCard
                      key={middleCategory.middleCategoryId ?? middleIndex}
                      certification={certification}
                      majorCategory={majorCategory}
                      middleCategory={middleCategory}
                      majorIndex={majorIndex}
                      middleIndex={middleIndex}
                      actions={actions}
                  />
              ))}
            </div>
        )}

        <InlineAdd
            label="Module"
            validate={(value) => validateStructureName(value, "Module title")}
            onAdd={(title) => actions.addMiddle(majorCategory.majorCategoryId, title)}
        />
      </section>
  )
}

/**
 * The one destructive control on this page, so it looks like one.
 *
 * Quiet until hovered -- the same reasoning as the edit pencil, except the
 * hover state is red rather than neutral, because the two sit inches apart and
 * the cost of confusing them is not symmetric.
 */
function DeleteNodeButton({ onClick, label, disabled = false, className = "" }) {
  return (
      <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-50 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-25 ${className}`}
      >
        <Trash2 className="size-3.5" />
      </button>
  )
}

/** "2 modules and 5 lessons", or "" when the node is a leaf. */
function describeSubtree(middleCount, lessonCount) {
  const parts = []
  if (middleCount > 0) {
    parts.push(`${middleCount} ${middleCount === 1 ? "module" : "modules"}`)
  }
  if (lessonCount > 0) {
    parts.push(`${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}`)
  }
  return parts.join(" and ")
}

function MiddleCategoryCard({
                              certification,
                              majorCategory,
                              middleCategory,
                              majorIndex,
                              middleIndex,
                              actions,
                            }) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const lessons = middleCategory.lessons ?? []

  function handleCreateLesson(event, lesson) {
    event.stopPropagation()
    const lessonName = getLessonTitle(lesson)

    navigate(`/admin/lessons/${encodeURIComponent(lessonName)}/create`, {
      state: {
        lessonId: lesson.lessonId,
        lessonName,
        certification,
        majorCategory,
        middleCategory,
      },
    })
  }

  return (
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        {/* The whole header used to be one button, which is why the title
            could not be edited in place: a pencil inside a button is a button
            inside a button, which the browser will not nest and a screen
            reader cannot announce. The toggle is now the chevron and the line
            beside it; the title sits outside it and owns its own edit. */}
        <div className="flex items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0">
            <InlineEditable
                value={middleCategory.title}
                label="Module title"
                validate={(value) => validateStructureName(value, "Module title")}
                onSave={(title) =>
                    actions.renameMiddle(majorIndex, middleIndex, title)
                }
                renderValue={(title) => (
                    <h3 className="font-heading text-base font-bold text-foreground">
                      {title}
                    </h3>
                )}
            />

            <p className="mt-1 text-xs text-muted-foreground">
              Middle Category · {lessons.length}{" "}
              {lessons.length === 1 ? "lesson" : "lessons"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <DeleteNodeButton
                disabled={middleCategory.middleCategoryId == null}
                label={`Delete module ${middleCategory.title}`}
                onClick={() =>
                    actions.requestDelete({
                      kind: "middle",
                      id: middleCategory.middleCategoryId,
                      name: middleCategory.title,
                      detail: describeSubtree(0, lessons.length),
                    })
                }
            />

            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Hide" : "Show"} lessons in ${middleCategory.title}`}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    isOpen
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
            >
              {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
              ) : (
                  <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {isOpen && (
            <div className="border-t border-border bg-muted/20 px-5 py-4">
              {lessons.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
                    No lessons have been added yet.
                  </div>
              ) : (
                  <div className="space-y-2">
                    {lessons.map((lesson, lessonIndex) => (
                        <div
                            key={lesson.lessonId ?? lessonIndex}
                            className="group flex items-center justify-between gap-4 rounded-xl border border-transparent bg-background px-4 py-3 transition hover:border-border hover:bg-muted/40"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-muted-foreground">
                      {lessonIndex + 1}
                    </span>

                            <div className="min-w-0">
                              <InlineEditable
                                  value={getLessonTitle(lesson)}
                                  label="Lesson name"
                                  validate={(value) =>
                                      validateStructureName(value, "Lesson name")
                                  }
                                  onSave={(name) =>
                                      actions.renameLesson(
                                          majorIndex,
                                          middleIndex,
                                          lessonIndex,
                                          name
                                      )
                                  }
                                  renderValue={(name) => (
                                      <p className="text-sm font-semibold text-foreground">
                                        {name}
                                      </p>
                                  )}
                              />

                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Lesson {lessonIndex + 1}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <DeleteNodeButton
                                disabled={lesson.lessonId == null}
                                label={`Delete lesson ${getLessonTitle(lesson)}`}
                                onClick={() =>
                                    actions.requestDelete({
                                      kind: "lesson",
                                      id: lesson.lessonId,
                                      name: getLessonTitle(lesson),
                                      detail: "",
                                    })
                                }
                            />

                            <button
                                type="button"
                                onClick={(event) => handleCreateLesson(event, lesson)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                title="Create lesson content"
                                aria-label={`Create lesson content for ${getLessonTitle(lesson)}`}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>
              )}

              <InlineAdd
                  label="Lesson"
                  className="mt-3"
                  validate={(value) => validateStructureName(value, "Lesson name")}
                  onAdd={(name) =>
                      actions.addLesson(middleCategory.middleCategoryId, name)
                  }
              />
            </div>
        )}
      </article>
  )
}
