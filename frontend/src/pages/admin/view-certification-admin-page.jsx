import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers3,
  ListChecks,
  Pencil,
} from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { getAllCertifications } from "@/services/certificationService.js"
import { Button } from "@/components/ui/button"
import CertificationFormDrawer from "@/components/certifications/certification-form-drawer"
import AssessmentsTab, {
  prefetchAssessmentData,
} from "@/components/assessments/admin/assessments-tab.jsx"
import CertificationPublishingChecklist from "@/components/assessments/admin/certification-publishing-checklist.jsx"
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
     router state on arrival, and the edits made here. It wins when present;
     the fetched copy is what the URL alone can reach. */
  const fetchedCertification = certifications.find(
      (item) =>
          String(item.certificationId ?? item.id) === String(routeCertificationId)
  )

  const certification = certificationOverride ?? fetchedCertification ?? null

  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [createAssessmentRequest, setCreateAssessmentRequest] = useState(null)

  /* The assessments tab's reads, started as soon as the certification opens
     rather than when the tab is clicked.

     The tab's content is unmounted while another tab is showing, so its queries
     could not begin until the click -- which is why opening it always meant
     watching four requests resolve behind skeleton rows. Nothing here depends
     on them, so warming them costs the page nothing and gives the tab its data
     already in hand. */
  useEffect(() => {
    prefetchAssessmentData(queryClient)
  }, [queryClient])

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

  async function handleCertificationSaved(updatedCertification) {
    setCertification((currentCertification) => ({
      ...currentCertification,
      ...updatedCertification,

      majorCategory:
          updatedCertification.majorCategory ??
          currentCertification?.majorCategory ??
          [],
    }))
    await queryClient.invalidateQueries({
      queryKey: ["admin-certifications"],
    })
  }

  function handleCreateAssessment(request) {
    setCreateAssessmentRequest({
      ...request,
      requestId: `${Date.now()}-${Math.random()}`,
    })
  }

  if (!certification && isLoadingCertifications) {
    return (
        <section className="flex min-h-full items-center justify-center bg-muted/40 p-6">
          <p className="text-sm text-muted-foreground">Loading certification...</p>
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
  const generationError = generationErrorOf(generationRuns.get(certificationKey))

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
            <Badge
                variant="secondary"
                className="mb-5 border border-black/10 bg-white/85 px-3 py-1 text-xs font-semibold text-black shadow-sm backdrop-blur-sm hover:bg-white/85"
            >
              {certification.industry || "General"}
            </Badge>

            <h1 className="max-w-3xl font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {certification.title}
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/85 sm:text-base">
              {certification.description || "No description available."}
            </p>

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

                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Manage the major categories, modules, lessons, and assessment
                  structure under this certification.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
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

                <CertificationFormDrawer
                    mode="edit"
                    certification={certification}
                    open={isEditDrawerOpen}
                    onOpenChange={setIsEditDrawerOpen}
                    onSaved={handleCertificationSaved}
                    trigger={
                      <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-xl px-5 font-medium shadow-sm"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Certification
                      </Button>
                    }
                />
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
                  </div>
              ) : (
                  <div className="space-y-10">
                    {majorCategories.map((majorCategory, majorIndex) => (
                        <MajorCategorySection
                            key={majorCategory.majorCategoryId ?? majorIndex}
                            certification={certification}
                            majorCategory={majorCategory}
                            majorIndex={majorIndex}
                        />
                    ))}
                  </div>
              )}
            </section>


            <div className="space-y-8">
              <CertificationPublishingChecklist
                  certificationId={certification?.certificationId}
                  isPublished={certification?.status === "PUBLISHED"}
                  onCreateAssessment={handleCreateAssessment}
                  onPublished={() =>
                      setCertification((current) => ({
                        ...current,
                        status: "PUBLISHED",
                      }))
                  }
              />

              <AssessmentsTab
                  certification={certification}
                  createRequest={createAssessmentRequest}
                  onCreateRequestHandled={() => setCreateAssessmentRequest(null)}
              />
            </div>
          </div>
        </main>
      </section>
  )
}

function MajorCategorySection({ certification, majorCategory, majorIndex }) {
  const middleCategories = majorCategory.middleCategory ?? []

  return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-lg font-bold text-foreground">
            <span className="text-primary">Major Category {majorIndex + 1}:</span>{" "}
            {majorCategory.title}
          </p>

          {majorCategory.priority && (
              <Badge
                  variant="secondary"
                  className="bg-primary/10 text-[10px] font-bold tracking-wider text-primary uppercase hover:bg-primary/10"
              >
                {majorCategory.priority}
              </Badge>
          )}
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
                  />
              ))}
            </div>
        )}
      </section>
  )
}

function MiddleCategoryCard({ certification, majorCategory, middleCategory }) {
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
              Middle Category · {lessons.length}{" "}
              {lessons.length === 1 ? "lesson" : "lessons"}
            </p>
          </div>

          <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  isOpen
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
              }`}
          >
          {isOpen ? (
              <ChevronDown className="h-4 w-4" />
          ) : (
              <ChevronRight className="h-4 w-4" />
          )}
        </span>
        </button>

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
                              <p className="truncate text-sm font-semibold text-foreground">
                                {getLessonTitle(lesson)}
                              </p>

                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Lesson {lessonIndex + 1}
                              </p>
                            </div>
                          </div>

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
                    ))}
                  </div>
              )}
            </div>
        )}
      </article>
  )
}
