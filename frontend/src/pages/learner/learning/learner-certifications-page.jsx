import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { Award, GraduationCap } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BUBBLE_TONES, BubbleCard } from "@/components/commons/bubble-card.jsx"
import { LearnerEmptyState, toneForCertification } from "@/components/learner/learner-ui.jsx"

const INITIAL_VISIBLE_COUNT = 8
const LOAD_MORE_COUNT = 8

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

/* The same bubble card the admin challenges arenas use — gradient cap,
   bubbles, icon medallion, wash body — so a certification reads as one card
   design wherever it shows up across the learner portal. */
/* No progress on these cards. This is the catalog -- what exists, what it is
   about, and whether you are in it -- and progress is a question about your
   own study, which My Learning is the page for. Carrying a percentage here
   also meant a second surface to keep in step with the analytics board every
   time the definition of "done" moved. */
function CertificationCard({
                             certification,
                             enrolled,
                             onOpen,
                             onAction,
                           }) {
  const category = getCertificationCategory(certification)
  const tone = toneForCertification(certification)
  // Same tone the cap uses, so the button belongs to this card.
  const palette = BUBBLE_TONES[tone] ?? BUBBLE_TONES.macaw

  return (
      <BubbleCard
          tone={tone}
          cap="flat"
          body="card"
          icon={GraduationCap}
          eyebrow={category}
          title={
            <button
                type="button"
                onClick={onOpen}
                className="rounded-sm text-left hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--bubble-tone)]"
            >
              {getCertificationTitle(certification)}
            </button>
          }
          chips={[{ label: enrolled ? "Enrolled" : "Free to study" }]}
          footer={
            <Button
                className="w-full rounded-full text-white hover:opacity-90"
                style={{ background: palette.solid }}
                onClick={onAction}
            >
              View details
            </Button>
          }
      >
        <p className="mt-2 line-clamp-3 min-h-[60px] break-words text-sm leading-6 text-muted-foreground">
          {getCertificationDescription(certification)}
        </p>
      </BubbleCard>
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

  /* One destination for every card, enrolled or not: this certification's
     page. The catalog answers "what is this and do I want it"; carrying on
     with something you are already enrolled in is My Learning's job, and the
     button that used to do it from here jumped an enrolled learner straight
     into the curriculum -- past the details the card had just offered to show
     them, and through a study-plan dialog they had not asked for. */
  function handleCertificationAction(certification) {
    navigate(`/learner/certifications/${getCertificationId(certification)}`)
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
                  {/* A fourth column past 1536px. Three across a wide desktop gave each
                      card ~530px under a fixed 128px cap, which reads as a stretched
                      banner rather than a card -- the arena card is designed around a
                      roughly square cap. Capping the width by adding a column keeps the
                      proportion instead of letting the card grow to fill the row. */}
                  <section className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {visibleCertifications.map((certification, index) => {
                      const certificationId = getCertificationId(certification)

                      const enrolled = enrolledCertificationIds.has(
                          String(certificationId)
                      )

                      return (
                          <CertificationCard
                              key={certificationId}
                              certification={certification}
                              enrolled={enrolled}
                              onOpen={() => openCertification(certification)}
                              onAction={() => handleCertificationAction(certification)}
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

        {/* The study-plan generator, rendered by the shared gate hook. */}
      </div>
  )
}
