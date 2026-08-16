import { useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Award,
  BookOpen,
  ClipboardCheck,
  CheckCircle2,
  CirclePlay,
  Grid2X2,
  List,
  LockKeyhole,
  Search,
  Trophy,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  certificationProgressPercent,
  findCertificationProgress,
} from "@/lib/certification-progress.js"
import { useStudyPlanGate } from "@/components/learner/use-study-plan-gate.jsx"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BUBBLE_TONES, BubbleCard } from "@/components/commons/bubble-card.jsx"
import { achievementBadge } from "@/lib/achievements.js"
import {
  LearnerEmptyState,
  ProgressBar,
  toneForCertification,
} from "@/components/learner/learner-ui.jsx"

function getCertificationTitle(certification) {
  return certification?.title ?? "Untitled Certification"
}

function getCertificationDescription(certification) {
  return (
      certification?.description ??
      "Continue learning and prepare for your certification assessment."
  )
}

function getAchievementTitle(achievement) {
  return (
      achievement?.title ??
      achievement?.achievementTitle ??
      achievement?.name ??
      "Achievement"
  )
}

function getAchievementDescription(achievement) {
  return (
      achievement?.description ??
      achievement?.achievementDescription ??
      achievement?.earnedAt ??
      "Keep learning to unlock more achievements."
  )
}

function getCourseStatus(progress, completedLessons) {
  if (progress >= 100) {
    return "COMPLETED"
  }

  if (completedLessons > 0) {
    return "IN PROGRESS"
  }

  return "READY TO START"
}

function getCertificationId(certification) {
  return String(
      certification?.certificationId ??
      certification?.id ??
      certification?.certification?.certificationId ??
      ""
  )
}

function collectArrays(...sources) {
  return sources.flatMap((source) => (Array.isArray(source) ? source : []))
}

function getAssessmentTypeText(assessment) {
  return String(
      assessment?.assessmentType ??
      assessment?.assessmentTypeText ??
      assessment?.assessmentTypeName ??
      assessment?.examType ??
      assessment?.examTypeText ??
      assessment?.type ??
      assessment?.typeText ??
      assessment?.category ??
      ""
  ).toLowerCase()
}

function assessmentBelongsToCertification(assessment, certificationId) {
  if (!certificationId) {
    return true
  }

  const assessmentCertificationId = String(
      assessment?.certificationId ??
      assessment?.certification?.certificationId ??
      assessment?.courseId ??
      ""
  )

  return !assessmentCertificationId || assessmentCertificationId === certificationId
}

function isDiagnosticAssessment(assessment) {
  const typeText = getAssessmentTypeText(assessment)
  const titleText = String(
      assessment?.title ??
      assessment?.name ??
      assessment?.examName ??
      assessment?.assessmentTitle ??
      ""
  ).toLowerCase()

  return typeText.includes("diagnostic") || titleText.includes("diagnostic")
}

function getDiagnosticAssessment(certification, data) {
  const certificationId = getCertificationId(certification)

  const assessments = collectArrays(
      certification?.assessments,
      certification?.exams,
      certification?.diagnosticExams,
      data?.assessments,
      data?.exams,
      data?.diagnosticExams,
      data?.learnerAssessments,
      data?.availableAssessments
  )

  return (
      assessments.find(
          (assessment) =>
              assessmentBelongsToCertification(assessment, certificationId) &&
              isDiagnosticAssessment(assessment)
      ) ?? null
  )
}

/** Exported: the certifications page runs the same check before opening
 *  a certification, and two copies of this would drift. */
export function isDiagnosticCompleted(certification, data) {
  const certificationId = getCertificationId(certification)

  if (
      certification?.diagnosticCompleted ||
      certification?.hasCompletedDiagnostic ||
      certification?.diagnosticTaken
  ) {
    return true
  }

  const completedEnrollment = collectArrays(data?.enrollments).some(
      (enrollment) =>
          String(enrollment?.certificationId ?? "") === certificationId &&
          Boolean(
              enrollment?.diagnosticCompletedAt ??
              enrollment?.diagnosticAttemptId ??
              enrollment?.diagnosticCompleted
          )
  )
  if (completedEnrollment) {
    return true
  }

  const results = collectArrays(
      certification?.assessmentResults,
      certification?.examResults,
      certification?.diagnosticResults,
      data?.assessmentResults,
      data?.examResults,
      data?.diagnosticResults,
      data?.learnerExamResults
  )

  return results.some((result) => {
    const resultCertificationId = String(
        result?.certificationId ??
        result?.certification?.certificationId ??
        result?.courseId ??
        ""
    )

    const matchesCertification =
        !certificationId || !resultCertificationId || resultCertificationId === certificationId

    const typeText = getAssessmentTypeText(result)
    const titleText = String(
        result?.title ??
        result?.name ??
        result?.examName ??
        result?.assessmentTitle ??
        ""
    ).toLowerCase()

    const diagnostic =
        typeText.includes("diagnostic") || titleText.includes("diagnostic")

    const completed = Boolean(
        result?.completed ??
        result?.submitted ??
        result?.submittedAt ??
        result?.dateTaken ??
        result?.finishedAt ??
        result?.score !== undefined
    )

    return matchesCertification && diagnostic && completed
  })
}

/* The same bubble card the admin challenges arenas use — gradient cap,
   bubbles, icon medallion, wash body — so an enrolled course reads as the
   same card design as the browse-certifications page and admin's own
   challenge cards. */
function CourseCard({ course, onOpen }) {
  const {
    certification,
    progress,
    totalLessons,
    completedLessons,
    nextLesson,
    diagnosticCompleted,
    diagnosticAssessment,
  } = course

  const status = getCourseStatus(progress, completedLessons)
  const needsDiagnostic = !diagnosticCompleted
  const completed = progress >= 100
  const tone = toneForCertification(certification)
  // Same tone the cap uses, so the button and the bar belong to this card.
  const palette = BUBBLE_TONES[tone] ?? BUBBLE_TONES.macaw

  return (
      <BubbleCard
          tone={tone}
          icon={needsDiagnostic ? LockKeyhole : completed ? Award : CirclePlay}
          eyebrow="REBYU Certification Review"
          title={
            <button
                type="button"
                onClick={onOpen}
                className="rounded-sm text-left hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--bubble-tone)]"
            >
              {getCertificationTitle(certification)}
            </button>
          }
          chips={[
            { label: needsDiagnostic ? "Diagnostic required" : status },
          ]}
          footer={
            <div className="w-full space-y-2">
              <Button
                  className="w-full rounded-full text-white hover:opacity-90"
                  style={{ background: palette.solid }}
                  onClick={onOpen}
              >
                {needsDiagnostic ? (
                    <ClipboardCheck className="mr-2 size-3.5" />
                ) : null}
                {needsDiagnostic ? "Start" : completed ? "Review" : "Continue"}
              </Button>
            </div>
          }
      >
        <p className="mt-2 line-clamp-2 min-h-[42px] text-sm leading-5 text-muted-foreground">
          {getCertificationDescription(certification)}
        </p>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedLessons} of {totalLessons} lessons
            </span>

            <span className="font-medium text-foreground">
              {progress}%
            </span>
          </div>

          <ProgressBar value={progress} color={palette.solid} />
        </div>

        <p className="mt-4 truncate border-t border-border pt-3 text-xs text-muted-foreground">
          {needsDiagnostic
              ? diagnosticAssessment
                  ? "Take the diagnostic before learning"
                  : "Diagnostic exam is not configured yet"
              : nextLesson
                  ? `Next: ${nextLesson.name ?? nextLesson.title}`
                  : completed
                      ? "Course completed"
                      : "Start learning"}
        </p>
      </BubbleCard>
  )
}

function AchievementItem({ achievement }) {
  const badge = achievementBadge(achievement)

  return (
      <div className="flex gap-3 border-b border-border py-4 last:border-b-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
          {badge ? (
              <img src={badge} alt="" className="size-full rounded-md object-contain p-0.5" />
          ) : (
              <Award className="size-5 text-primary" />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {getAchievementTitle(achievement)}
          </p>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {getAchievementDescription(achievement)}
          </p>
        </div>
      </div>
  )
}

export default function LearnerLearningPage() {
  const navigate = useNavigate()
  const { data, searchValue } = useOutletContext()

  const enrolledCertifications = data?.enrolledCertifications ?? []
  const allLessons = data?.lessons ?? []

  // "Latest Achievements" -- earned only, newest first. The locked ones are
  // shown on the account page's badge wall, where the whole catalog belongs.
  const achievements = (Array.isArray(data?.achievements) ? data.achievements : [])
      .filter((achievement) => achievement.earned)
      .sort((a, b) => new Date(b.earnedAt ?? 0) - new Date(a.earnedAt ?? 0))

  const [localSearch, setLocalSearch] = useState("")
  const [selectedIndustry, setSelectedIndustry] = useState("ALL")
  const [selectedStatus, setSelectedStatus] = useState("ALL")
  const [viewMode, setViewMode] = useState("GRID")

  const queryClient = useQueryClient()
  // The whole plan gate — lookup, dialog, save. Shared with the certifications
  // page so both entry points into a curriculum behave the same.
  const { openCertification, studyPlanDialog } = useStudyPlanGate()

  const query = (localSearch || searchValue || "").trim().toLowerCase()

  const industries = useMemo(() => {
    return [
      ...new Set(
          enrolledCertifications
              .map((certification) => certification.industry)
              .filter(Boolean)
      ),
    ]
  }, [enrolledCertifications])

  const courses = useMemo(() => {
    return enrolledCertifications.map((certification) => {
      const lessons = allLessons.filter(
          (lesson) =>
              String(lesson.certificationId) ===
              String(certification.certificationId)
      )

      /* Progress comes from the server's count, not from this list of lessons.
         Dividing completed lessons by total lessons here reported a
         certification as 100% done while every quiz and exam on it was still
         unsat -- the same certification the analytics board, which counts
         assessments too, was reporting at 20%. The server row also counts what
         the browser cannot see: which exams are published, official, and
         actually part of this curriculum.

         The lesson list is still used for the counts under the bar and for
         picking the next lesson, so a certification the portal did not return a
         row for (not an active enrollment) falls back to lessons alone rather
         than showing a bar that says nothing. */
      const progressRow = findCertificationProgress(
          data?.certificationProgress,
          certification.certificationId,
      )

      const completedLessons = progressRow?.completedLessons ?? lessons.filter((lesson) => lesson.completed).length
      const totalLessons = progressRow?.totalLessons ?? lessons.length

      const progress = certificationProgressPercent({
        completedLessons,
        totalLessons,
        passedAssessments: progressRow?.passedAssessments ?? 0,
        totalAssessments: progressRow?.totalAssessments ?? 0,
      })

      const nextLesson =
          lessons.find((lesson) => !lesson.completed) ?? lessons[0] ?? null

      const diagnosticAssessment = getDiagnosticAssessment(certification, data)
      const diagnosticCompleted = isDiagnosticCompleted(certification, data)

      return {
        certification,
        lessons,
        completedLessons,
        totalLessons,
        progress,
        nextLesson,
        diagnosticAssessment,
        diagnosticCompleted,
        status: diagnosticCompleted
            ? getCourseStatus(progress, completedLessons)
            : "DIAGNOSTIC REQUIRED",
      }
    })
  }, [allLessons, enrolledCertifications, data])

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const certification = course.certification

      const matchesSearch =
          !query ||
          getCertificationTitle(certification).toLowerCase().includes(query) ||
          getCertificationDescription(certification).toLowerCase().includes(query) ||
          certification.industry?.toLowerCase().includes(query)

      const matchesIndustry =
          selectedIndustry === "ALL" ||
          certification.industry === selectedIndustry

      const matchesStatus =
          selectedStatus === "ALL" || course.status === selectedStatus

      return matchesSearch && matchesIndustry && matchesStatus
    })
  }, [courses, query, selectedIndustry, selectedStatus])

  return (
      <div className="space-y-6">
        {enrolledCertifications.length === 0 ? (
            <LearnerEmptyState
                icon={BookOpen}
                title="No enrolled certifications yet"
                description="Browse the Certifications page and enroll in a certification review to start learning."
                action={
                  <Button onClick={() => navigate("/learner/certifications")}>
                    Browse Certifications
                  </Button>
                }
            />
        ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <main className="min-w-0">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    Enrolled Certifications
                  </h2>
                </div>

                <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full lg:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        value={localSearch}
                        onChange={(event) => setLocalSearch(event.target.value)}
                        placeholder="Search courses, training"
                        className="pl-10"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                      <SelectTrigger className="min-w-[170px]"><SelectValue placeholder="All industries" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Industries</SelectItem>
                        {industries.map((industry) => <SelectItem key={industry} value={industry}>{industry}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="min-w-[185px]"><SelectValue placeholder="All types" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Types</SelectItem>
                        <SelectItem value="DIAGNOSTIC REQUIRED">Diagnostic Required</SelectItem>
                        <SelectItem value="IN PROGRESS">In Progress</SelectItem>
                        <SelectItem value="READY TO START">Ready to Start</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex overflow-hidden border border-input">
                      <button
                          type="button"
                          onClick={() => setViewMode("GRID")}
                          className={`flex size-10 items-center justify-center transition ${
                              viewMode === "GRID"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                          aria-label="Grid view"
                      >
                        <Grid2X2 className="size-4" />
                      </button>

                      <button
                          type="button"
                          onClick={() => setViewMode("LIST")}
                          className={`flex size-10 items-center justify-center border-l border-input transition ${
                              viewMode === "LIST"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                          aria-label="List view"
                      >
                        <List className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {filteredCourses.length === 0 ? (
                    <div className="border border-dashed border-border py-14 text-center">
                      <Search className="mx-auto size-7 text-muted-foreground" />

                      <p className="mt-3 text-sm font-medium text-foreground">
                        No certifications found
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Try another keyword or change your filters.
                      </p>

                      <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => {
                            setLocalSearch("")
                            setSelectedIndustry("ALL")
                            setSelectedStatus("ALL")
                          }}
                      >
                        Clear Filters
                      </Button>
                    </div>
                ) : (
                    <div
                        className={
                          viewMode === "GRID"
                              /* Three from xl, four from 2xl. This column already
                                 gives 280px to the achievements rail beside it, so
                                 holding two-up until 1536px left each card near
                                 600px wide under a 128px cap -- the same stretched
                                 banner the certifications grid had, worse. These
                                 breakpoints land both pages on a similar card
                                 width, which matters because it is the same card. */
                              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                              : "grid gap-4"
                        }
                    >
                      {filteredCourses.map((course) => (
                          <CourseCard
                              key={course.certification.certificationId}
                              course={course}
                              onOpen={() =>
                                  openCertification(course.certification, {
                                    diagnosticCompleted: course.diagnosticCompleted,
                                  })
                              }
                          />
                      ))}
                    </div>
                )}
              </main>

              <aside className="border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    Latest Achievements
                  </h2>

                  <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => navigate("/learner/account")}
                  >
                    Show all
                  </Button>
                </div>

                {achievements.length > 0 ? (
                    <div className="mt-3">
                      {achievements.slice(0, 5).map((achievement, index) => (
                          <AchievementItem
                              key={
                                  achievement.code ??
                                  achievement.achievementId ??
                                  `${getAchievementTitle(achievement)}-${index}`
                              }
                              achievement={achievement}
                          />
                      ))}
                    </div>
                ) : (
                    <div className="mt-4 border border-dashed border-border p-4 text-center">
                      <Trophy className="mx-auto size-6 text-muted-foreground" />

                      <p className="mt-2 text-sm font-medium text-foreground">
                        No achievements yet
                      </p>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Complete lessons, quizzes, and exams to earn achievements.
                      </p>
                    </div>
                )}

                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary" />

                    <p className="text-sm font-semibold text-foreground">
                      Keep your progress moving
                    </p>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Continue your unfinished lessons to unlock quizzes, exams, and
                    readiness insights.
                  </p>
                </div>
              </aside>
            </div>
        )}

        {/* The study-plan generator, rendered by the shared gate hook. */}
        {studyPlanDialog}
      </div>
  )
}
