import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InstitutionErrorState,
  InstitutionLoadingSkeleton,
} from "@/components/institution/institution-ui.jsx"
import { LessonContent } from "@/components/certifications/lesson-content-renderer.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import { getLessonComponent } from "@/services/lessonService.js"

function lessonTitle(lesson) {
  return lesson?.name ?? lesson?.title ?? "Untitled lesson"
}

/** Flattens the certification tree into an ordered list of lessons. */
function flattenLessons(certification) {
  const out = []
  for (const major of certification?.majorCategory ?? []) {
    for (const middle of major.middleCategory ?? []) {
      for (const lesson of middle.lessons ?? []) {
        out.push({ ...lesson, middleTitle: middle.title, majorTitle: major.title })
      }
    }
  }
  return out
}

/**
 * Read-only certification content viewer for Institution Members, modelled on
 * the Cisco Networking Academy reader: a left "Course Outline" sidebar
 * (search + collapsible modules + lessons) and the selected lesson's content
 * on the right. Deliberately NO progress bar / completion state -- a member
 * reviews the material, they don't "complete" it.
 */
export default function InstitutionCertificationViewerPage() {
  const { certificationId } = useParams()
  const certId = Number(certificationId)
  const [searchParams] = useSearchParams()
  // Optional group context: when present, the member's own group content is
  // mixed in too (server-authorized), otherwise just the official curriculum.
  const groupId = searchParams.get("groupId") ? Number(searchParams.get("groupId")) : undefined

  const [outlineQuery, setOutlineQuery] = useState("")
  const [collapsedMajors, setCollapsedMajors] = useState(() => new Set())
  const [activeLessonId, setActiveLessonId] = useState(() =>
    searchParams.get("lessonId") ? Number(searchParams.get("lessonId")) : null
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const certificationsQuery = useQuery({
    queryKey: ["certifications", "group", groupId ?? null],
    queryFn: () => getAllCertifications(groupId),
    staleTime: 5 * 60_000,
  })

  const certification = (certificationsQuery.data ?? []).find(
    (item) => item.certificationId === certId
  )

  const allLessons = useMemo(() => flattenLessons(certification), [certification])

  // Default to the first lesson once the tree loads.
  const activeLesson =
    allLessons.find((lesson) => lesson.lessonId === activeLessonId) ?? allLessons[0] ?? null

  const lessonQuery = useQuery({
    queryKey: ["lesson-component", activeLesson?.lessonId],
    queryFn: () => getLessonComponent(activeLesson.lessonId),
    enabled: Number.isFinite(activeLesson?.lessonId),
  })

  const toggleMajor = (id) =>
    setCollapsedMajors((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (certificationsQuery.isLoading) {
    return <InstitutionLoadingSkeleton />
  }
  if (certificationsQuery.isError) {
    return (
      <InstitutionErrorState
        title="Unable to load this certification"
        onRetry={certificationsQuery.refetch}
      />
    )
  }

  const query = outlineQuery.trim().toLowerCase()
  const majors = certification?.majorCategory ?? []

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle outline"
        >
          {sidebarOpen ? <X className="size-5" /> : <BookOpen className="size-5" />}
        </Button>
        <Link
          to={groupId ? `/institution/groups/${groupId}` : "/institution/certifications"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Link>
        <h1 className="truncate font-heading text-base font-bold text-foreground">
          {certification?.title ?? "Certification"}
        </h1>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: course outline */}
        {sidebarOpen ? (
          <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-border bg-muted/20">
            <div className="border-b border-border p-3">
              <p className="px-1 pb-2 text-sm font-semibold text-foreground">Course Outline</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={outlineQuery}
                  onChange={(e) => setOutlineQuery(e.target.value)}
                  placeholder="Search course outline"
                  className="pl-9"
                />
              </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto p-2">
              {majors.map((major, majorIndex) => {
                const middles = major.middleCategory ?? []
                const majorLessons = middles.flatMap((m) => m.lessons ?? [])
                const majorOpen = !collapsedMajors.has(major.majorCategoryId)

                // When searching, only show majors that contain a match.
                const matchingLessons = majorLessons.filter((lesson) =>
                  lessonTitle(lesson).toLowerCase().includes(query)
                )
                if (query && matchingLessons.length === 0) {
                  return null
                }

                return (
                  <div key={major.majorCategoryId ?? majorIndex} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleMajor(major.majorCategoryId)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      {majorOpen || query ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        Module {majorIndex + 1}: {major.title}
                      </span>
                    </button>

                    {majorOpen || query ? (
                      <div className="ml-3 border-l border-border pl-2">
                        {middles.map((middle) => {
                          const lessons = (middle.lessons ?? []).filter(
                            (lesson) => !query || lessonTitle(lesson).toLowerCase().includes(query)
                          )
                          if (lessons.length === 0) {
                            return null
                          }
                          return (
                            <div key={middle.middleCategoryId} className="py-1">
                              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                                {middle.title}
                              </p>
                              {lessons.map((lesson) => {
                                const isActive = activeLesson?.lessonId === lesson.lessonId
                                return (
                                  <button
                                    key={lesson.lessonId}
                                    type="button"
                                    onClick={() => setActiveLessonId(lesson.lessonId)}
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                                      isActive
                                        ? "bg-primary/10 font-medium text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                  >
                                    <BookOpen className="size-3.5 shrink-0" />
                                    <span className="min-w-0 flex-1 truncate">
                                      {lessonTitle(lesson)}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {majors.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No curriculum available yet.
                </p>
              ) : null}
            </nav>
          </aside>
        ) : null}

        {/* Right: lesson content */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {activeLesson ? (
              <>
                <p className="text-sm font-medium text-primary">{activeLesson.middleTitle}</p>
                <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">
                  {lessonTitle(activeLesson)}
                </h2>
                <div className="mt-6">
                  {lessonQuery.isLoading ? (
                    <InstitutionLoadingSkeleton rows={4} />
                  ) : lessonQuery.isError ? (
                    <InstitutionErrorState
                      title="Unable to load this lesson"
                      onRetry={lessonQuery.refetch}
                    />
                  ) : (
                    <LessonContent structure={lessonQuery.data?.lessonComponentStructure} />
                  )}
                  {!lessonQuery.isLoading &&
                  !lessonQuery.isError &&
                  !lessonQuery.data?.lessonComponentStructure ? (
                    <p className="text-sm text-muted-foreground">
                      This lesson has no content yet.
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-24 text-center">
                <BookOpen className="size-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">Select a lesson</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a lesson from the outline to start reading.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
