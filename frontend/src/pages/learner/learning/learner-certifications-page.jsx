import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { Award, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LearnerEmptyState } from "@/components/learner/learner-ui.jsx"
import { getFileViewUrl } from "@/services/fileService.js"
import { getCertificationFallbackImage, getCuratedCertificationCover } from "@/lib/certification-cover-images.js"

const INITIAL_VISIBLE_COUNT = 8
const LOAD_MORE_COUNT = 8

const CATEGORY_STYLES = [
  "bg-blue-100 text-blue-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-yellow-100 text-yellow-800",
]

function getCertificationId(certification) {
  return certification?.certificationId ?? certification?.id
}

function getCertificationTitle(certification) {
  return certification?.title ?? "Untitled Certification"
}

function getCertificationCategory(certification) {
  return certification?.industry ?? certification?.category ?? "Technology"
}

function getCertificationDescription(certification) {
  return (
      certification?.description ??
      "Prepare confidently with structured lessons, quizzes, mock exams, and progress tracking."
  )
}

function getCertificationImageUrl(certification) {
  const curatedCover = getCuratedCertificationCover(getCertificationTitle(certification))
  if (curatedCover) return curatedCover

  const fallbackImage = getCertificationFallbackImage(getCertificationTitle(certification))
  if (!certification?.imageKey) {
    return fallbackImage
  }

  try {
    return getFileViewUrl(certification.imageKey) || fallbackImage
  } catch {
    return fallbackImage
  }
}

function CertificationImageFallback() {
  return (
      <div className="absolute inset-0 overflow-hidden bg-zinc-900">
        <div className="absolute left-8 top-9 h-px w-[62%] rotate-[8deg] bg-white/25" />
        <div className="absolute left-14 top-[34%] h-px w-[45%] -rotate-[9deg] bg-white/15" />
        <div className="absolute left-6 top-[54%] h-px w-[72%] rotate-[5deg] bg-white/10" />
        <div className="absolute left-16 top-[72%] h-px w-[52%] -rotate-[7deg] bg-white/20" />
        <div className="absolute left-10 top-[86%] h-px w-[65%] rotate-[4deg] bg-white/10" />

        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-black/60" />
      </div>
  )
}

function CertificationCover({ certification, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false)

  const imageUrl = getCertificationImageUrl(certification)
  const canShowImage = Boolean(imageUrl) && !imageFailed

  return (
      <button
          type="button"
          onClick={onOpen}
          aria-label={`View ${getCertificationTitle(certification)}`}
          className="group relative block h-48 w-full shrink-0 overflow-hidden border-b border-border bg-zinc-900 text-left sm:h-52"
      >
        {canShowImage ? (
            <>
              <img
                  src={imageUrl}
                  alt={getCertificationTitle(certification)}
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            </>
        ) : (
            <CertificationImageFallback />
        )}

        <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition group-hover:bg-white group-hover:text-zinc-900">
        <ExternalLink className="h-4 w-4" />
      </span>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-sm font-medium text-white/90">
            Certification Review
          </p>
        </div>
      </button>
  )
}

function CertificationCard({
                             certification,
                             index,
                             lessons,
                             enrolled,
                             onOpen,
                             onAction,
                           }) {
  const certificationId = getCertificationId(certification)

  const relatedLessons = lessons.filter(
      (lesson) =>
          String(lesson.certificationId) === String(certificationId)
  )

  const completedLessons = relatedLessons.filter(
      (lesson) => lesson.completed
  ).length

  const progress =
      relatedLessons.length > 0
          ? Math.round((completedLessons / relatedLessons.length) * 100)
          : 0

  const category = getCertificationCategory(certification)
  const categoryStyle =
      CATEGORY_STYLES[index % CATEGORY_STYLES.length]

  return (
      <article className="group flex min-h-[435px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/45 hover:shadow-xl">
        <CertificationCover
            certification={certification}
            onOpen={onOpen}
        />

        <div className="flex min-h-0 flex-1 flex-col p-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
          <span
              title={category}
              className={`max-w-[72%] truncate rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle}`}
          >
            {category}
          </span>

            {enrolled && (
                <span className="shrink-0 text-xs font-semibold text-emerald-600">
              Enrolled
            </span>
            )}
          </div>

          <button
              type="button"
              onClick={onOpen}
              className="mt-4 text-left"
          >
            <h2 className="line-clamp-2 text-lg font-semibold leading-6 text-foreground transition group-hover:text-primary">
              {getCertificationTitle(certification)}
            </h2>
          </button>

          <p className="mt-2 line-clamp-3 min-h-[60px] break-words text-sm leading-5 text-muted-foreground">
            {getCertificationDescription(certification)}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Free to study
          </span>

            {enrolled && relatedLessons.length > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
              {completedLessons}/{relatedLessons.length} lessons
            </span>
            )}
          </div>

          {enrolled && relatedLessons.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Course progress</span>

                  <span className="font-semibold text-foreground">
                {progress}%
              </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
          )}

          <button
              type="button"
              onClick={onAction}
              className="mt-auto h-11 w-full rounded bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.99]"
          >
            {enrolled ? "Continue Learning" : "View Certification"}
          </button>
        </div>
      </article>
  )
}

function CategoryFilter({
                          categories,
                          selectedCategories,
                          onToggleCategory,
                          onClear,
                        }) {
  return (
      <aside className="border-b border-border pb-6 xl:min-h-[430px] xl:border-b-0 xl:border-r xl:pr-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Filters
          </h2>

          <button
              type="button"
              onClick={onClear}
              disabled={selectedCategories.size === 0}
              className="text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold text-foreground">
            Categories
          </p>

          <div className="mt-4 space-y-3">
            {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories available.
                </p>
            ) : (
                categories.map((category) => {
                  const checked = selectedCategories.has(category)

                  return (
                      <label
                          key={category}
                          className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-muted-foreground"
                      >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleCategory(category)}
                            className="mt-1 h-4 w-4 rounded border-border accent-primary"
                        />

                        <span>{category}</span>
                      </label>
                  )
                })
            )}
          </div>
        </div>
      </aside>
  )
}

export default function LearnerCertificationsPage() {
  const navigate = useNavigate()
  const outletContext = useOutletContext()

  const data = outletContext?.data ?? {}
  const searchValue = String(outletContext?.searchValue ?? "")

  const certifications = data.certifications ?? []
  const enrolledCertifications = data.enrolledCertifications ?? []
  const lessons = data.lessons ?? []

  const [selectedCategories, setSelectedCategories] = useState(new Set())
  const [sortBy, setSortBy] = useState("popular")
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT)

  const allCertifications = useMemo(() => {
    const combinedCertifications = [
      ...certifications,
      ...enrolledCertifications,
    ]

    const uniqueCertifications = new Map()

    combinedCertifications.forEach((certification) => {
      const certificationId = getCertificationId(certification)

      if (certificationId !== null && certificationId !== undefined) {
        uniqueCertifications.set(
            String(certificationId),
            certification
        )
      }
    })

    return Array.from(uniqueCertifications.values())
  }, [certifications, enrolledCertifications])

  const enrolledCertificationIds = useMemo(() => {
    return new Set(
        enrolledCertifications.map((certification) =>
            String(getCertificationId(certification))
        )
    )
  }, [enrolledCertifications])

  const categories = useMemo(() => {
    return [
      ...new Set(
          allCertifications
              .map((certification) =>
                  getCertificationCategory(certification)
              )
              .filter(Boolean)
      ),
    ].sort((first, second) => first.localeCompare(second))
  }, [allCertifications])

  const filteredCertifications = useMemo(() => {
    const query = searchValue.toLowerCase().trim()

    const matchingCertifications = allCertifications.filter(
        (certification) => {
          const category = getCertificationCategory(certification)

          const matchesCategory =
              selectedCategories.size === 0 ||
              selectedCategories.has(category)

          const matchesSearch =
              !query ||
              getCertificationTitle(certification)
                  .toLowerCase()
                  .includes(query) ||
              getCertificationDescription(certification)
                  .toLowerCase()
                  .includes(query) ||
              category.toLowerCase().includes(query)

          return matchesCategory && matchesSearch
        }
    )

    return [...matchingCertifications].sort((first, second) => {
      if (sortBy === "title-asc") {
        return getCertificationTitle(first).localeCompare(
            getCertificationTitle(second)
        )
      }

      if (sortBy === "title-desc") {
        return getCertificationTitle(second).localeCompare(
            getCertificationTitle(first)
        )
      }

      return 0
    })
  }, [
    allCertifications,
    searchValue,
    selectedCategories,
    sortBy,
  ])

  const visibleCertifications = filteredCertifications.slice(
      0,
      visibleCount
  )

  const hasMoreCertifications =
      visibleCertifications.length < filteredCertifications.length

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT)
  }, [selectedCategories, sortBy, searchValue])

  function toggleCategory(category) {
    setSelectedCategories((currentCategories) => {
      const updatedCategories = new Set(currentCategories)

      if (updatedCategories.has(category)) {
        updatedCategories.delete(category)
      } else {
        updatedCategories.add(category)
      }

      return updatedCategories
    })
  }

  function clearCategories() {
    setSelectedCategories(new Set())
  }

  function openCertification(certification) {
    navigate(
        `/learner/certifications/${getCertificationId(certification)}`
    )
  }

  function handleCertificationAction(certification, enrolled) {
    const certificationId = getCertificationId(certification)

    if (enrolled) {
      navigate(`/learner/learning/${certificationId}`)
      return
    }

    navigate(`/learner/certifications/${certificationId}`)
  }

  return (
      <div className="w-full min-w-0 space-y-7 pb-10">
        <div className="grid gap-6 xl:grid-cols-[180px_minmax(0,1fr)]">
          <CategoryFilter
              categories={categories}
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
              onClear={clearCategories}
          />

          <main className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                {filteredCertifications.length}
              </span>{" "}
                certification
                {filteredCertifications.length === 1 ? "" : "s"}
              </p>

              <div className="flex items-center">
              <span className="mr-2 whitespace-nowrap text-sm text-muted-foreground">
                Sort by
              </span>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue aria-label="Sort certifications" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="title-asc">Name: A–Z</SelectItem>
                    <SelectItem value="title-desc">Name: Z–A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {visibleCertifications.length === 0 ? (
                <LearnerEmptyState
                    icon={Award}
                    title="No certifications found"
                    description="Try clearing your selected categories or using a different search term."
                    action={
                      selectedCategories.size > 0 ? (
                          <Button onClick={clearCategories}>
                            Clear Filters
                          </Button>
                      ) : null
                    }
                />
            ) : (
                <>
                  <section className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleCertifications.map((certification, index) => {
                      const certificationId = getCertificationId(certification)

                      const enrolled = enrolledCertificationIds.has(
                          String(certificationId)
                      )

                      return (
                          <CertificationCard
                              key={certificationId}
                              certification={certification}
                              index={index}
                              lessons={lessons}
                              enrolled={enrolled}
                              onOpen={() => openCertification(certification)}
                              onAction={() =>
                                  handleCertificationAction(
                                      certification,
                                      enrolled
                                  )
                              }
                          />
                      )
                    })}
                  </section>

                  {hasMoreCertifications && (
                      <div className="mt-10 flex justify-center">
                        <button
                            type="button"
                            onClick={() =>
                                setVisibleCount(
                                    (currentCount) =>
                                        currentCount + LOAD_MORE_COUNT
                                )
                            }
                            className="h-11 min-w-64 rounded-lg border border-border bg-card px-6 text-sm font-semibold text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          Load more certifications
                        </button>
                      </div>
                  )}
                </>
            )}
          </main>
        </div>
      </div>
  )
}
