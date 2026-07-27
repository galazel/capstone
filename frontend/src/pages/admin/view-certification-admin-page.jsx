import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers3,
  Pencil,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getFileViewUrl } from "@/services/fileService.js"
import CertificationFormDrawer from "@/components/certifications/certification-form-drawer"
import AssessmentsTab from "@/components/assessments/admin/assessments-tab.jsx"
import CertificationPublishingChecklist from "@/components/assessments/admin/certification-publishing-checklist.jsx"
import { useQueryClient } from "@tanstack/react-query"

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
  const pageRef = useRef(null)
  const queryClient = useQueryClient()
  const [certification, setCertification] = useState(() =>
      getCertification(location)
  )

  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("curriculum")
  const [createAssessmentRequest, setCreateAssessmentRequest] = useState(null)

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

  useEffect(() => {
    setCertification(getCertification(location))
  }, [location.key])

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
    setActiveTab("assessments")
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

  const coverImageUrl = certification.imageKey
      ? getFileViewUrl(certification.imageKey)
      : null

  return (
      <section
          ref={pageRef}
          className="min-h-full overflow-y-auto bg-muted/30 font-sans"
      >
        <header className="relative isolate overflow-hidden border-b border-border bg-muted px-6 py-12 sm:px-10 lg:px-20 lg:py-16">
          {coverImageUrl && (
              <img
                  src={coverImageUrl}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover blur-sm brightness-[0.6]"
              />
          )}

          <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-background/10"
          />

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

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                <TabsTrigger value="assessments">Assessments</TabsTrigger>
              </TabsList>

              <TabsContent value="curriculum">
                {majorCategories.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Layers3 className="h-7 w-7" />
                      </div>

                      <h3 className="mt-5 font-heading text-lg font-bold text-foreground">
                        No major categories yet
                      </h3>

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
              </TabsContent>

              <TabsContent value="assessments">
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
                      onCreateRequestHandled={() =>
                          setCreateAssessmentRequest(null)
                      }
                  />
                </div>
              </TabsContent>
            </Tabs>
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
