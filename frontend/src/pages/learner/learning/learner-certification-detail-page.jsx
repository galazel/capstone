import { useMemo } from "react"
import { useNavigate, useOutletContext, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Languages,
  Layers3,
  LockKeyhole,
  Target,
  PlayCircle,
} from "lucide-react"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"

import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

import { LearnerEmptyState } from "@/components/learner/learner-ui.jsx"
import { LearnerAnnouncements } from "@/components/learner/learner-announcements.jsx"
import { PriorityTag } from "@/components/learner/priority-tag.jsx"

import { getFileViewUrl } from "@/services/fileService.js"
import { getCertificationFallbackImage, getCuratedCertificationCover } from "@/lib/certification-cover-images.js"
import { getCertificationModules } from "@/services/learnerService.js"
import { getCertificationPriorities } from "@/services/learnerAnalyticsService.js"

import {
  confirmPurchase,
  getExamTypes,
  getExams,
  getLearnerEnrollments,
  purchaseCertification,
} from "@/services/assessmentService.js"

function getCertificationImageUrl(certification) {
  const curatedCover = getCuratedCertificationCover(certification?.title)
  if (curatedCover) return curatedCover

  const fallbackImage = getCertificationFallbackImage(certification?.title)
  if (!certification?.imageKey) {
    return fallbackImage
  }

  try {
    return getFileViewUrl(certification.imageKey) || fallbackImage
  } catch {
    return fallbackImage
  }
}

function getLessonDurationMinutes(lesson) {
  const possibleValues = [
    lesson?.durationMinutes,
    lesson?.estimatedMinutes,
    lesson?.minutes,
    lesson?.duration,
  ]

  for (const value of possibleValues) {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue
    }
  }

  return 0
}

function formatDuration(minutes) {
  const safeMinutes = Number(minutes ?? 0)

  if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) {
    return "Self-paced"
  }

  const hours = Math.floor(safeMinutes / 60)
  const remainingMinutes = safeMinutes % 60

  if (hours <= 0) {
    return `${remainingMinutes} min`
  }

  if (remainingMinutes === 0) {
    return `${hours} hr`
  }

  return `${hours} hr ${remainingMinutes} min`
}

function ProductMetaItem({ icon: Icon, children }) {
  return (
      <div className="flex min-w-0 items-center gap-3 text-sm text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 font-medium break-words [overflow-wrap:anywhere]">
        {children}
      </span>
      </div>
  )
}

function ProductFeature({ children }) {
  return (
      <div className="flex min-w-0 items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <p className="min-w-0 break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
          {children}
        </p>
      </div>
  )
}

export default function LearnerCertificationDetailPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { certificationId } = useParams()

  const outletContext = useOutletContext()
  const data = outletContext?.data ?? {}

  const learnerId = data.learnerId ?? null
  const certifications = data.certifications ?? []
  const enrolledCertifications = data.enrolledCertifications ?? []
  const completedLessonItems = data.completedLessons ?? []
  const learnerLessons = data.lessons ?? []

  const enrollmentsQuery = useQuery({
    queryKey: ["learner-enrollments", learnerId],
    queryFn: () => getLearnerEnrollments(learnerId),
    enabled: learnerId != null,
    retry: 1,
  })

  const enrollment = useMemo(() => {
    const enrollmentList = Array.isArray(enrollmentsQuery.data)
        ? enrollmentsQuery.data
        : []

    return (
        enrollmentList.find(
            (item) =>
                String(item.certificationId) === String(certificationId) &&
                item.status === "ACTIVE"
        ) ?? null
    )
  }, [enrollmentsQuery.data, certificationId])

  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: () => getExams(),
  })

  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: getExamTypes,
  })

  // BKT priority hierarchy (major -> middle -> lesson), used to tag each
  // module/category in the curriculum outline below with its urgency.
  const prioritiesQuery = useQuery({
    queryKey: ["certification-priorities", certificationId, learnerId],
    queryFn: () => getCertificationPriorities(learnerId, certificationId),
    enabled: Boolean(learnerId && certificationId),
  })

  const majorPriorityById = useMemo(() => {
    const majors = prioritiesQuery.data?.major_categories ?? []
    return new Map(majors.map((major) => [String(major.major_category_id), major]))
  }, [prioritiesQuery.data])

  const middlePriorityById = useMemo(() => {
    const majors = prioritiesQuery.data?.major_categories ?? []
    const middles = majors.flatMap((major) => major.middle_categories ?? [])
    return new Map(middles.map((middle) => [String(middle.middle_category_id), middle]))
  }, [prioritiesQuery.data])

  const publishedDiagnostic = useMemo(() => {
    const typeById = new Map(
        (Array.isArray(examTypesQuery.data) ? examTypesQuery.data : []).map(
            (type) => [type.examTypeId, type.examTypeText]
        )
    )

    return (
        (Array.isArray(examsQuery.data) ? examsQuery.data : []).find(
            (exam) =>
                String(exam.certificationId) === String(certificationId) &&
                exam.status === "PUBLISHED" &&
                typeById.get(exam.examTypeId) === "DIAGNOSTIC"
        ) ?? null
    )
  }, [certificationId, examsQuery.data, examTypesQuery.data])

  // Enrollment is free: any payment transaction the backend still creates is
  // confirmed automatically so the learner is enrolled in a single click.
  const enrollMutation = useMutation({
    mutationFn: async () => {
      const transaction = await purchaseCertification(
          certificationId,
          learnerId,
          crypto.randomUUID()
      )

      if (transaction?.requiresPayment && transaction?.transactionId) {
        await confirmPurchase(
            transaction.transactionId,
            learnerId,
            `AUTO-${transaction.transactionReference ?? transaction.transactionId}`
        )
      }

      return transaction
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["learner-enrollments"],
      })
      queryClient.invalidateQueries({
        queryKey: ["learner-portal-data"],
      })

      toast.success(
          "You are now enrolled. This certification was added to My Learning."
      )
      navigate("/learner/learning")
    },

    onError: (error) => {
      toast.error(
          error?.response?.data?.message ??
          "The enrollment could not be completed. Please try again."
      )
    },
  })

  const certification =
      certifications.find(
          (item) => String(item.certificationId) === String(certificationId)
      ) ??
      enrolledCertifications.find(
          (item) => String(item.certificationId) === String(certificationId)
      )

  if (!certification) {
    return (
        <LearnerEmptyState
            icon={BookOpen}
            title="Certification not found"
            description="The requested certification is not available from the backend."
            action={
              <Button onClick={() => navigate("/learner/certifications")}>
                Go to Certifications
              </Button>
            }
        />
    )
  }

  const enrolled =
      enrollment != null ||
      enrolledCertifications.some(
          (item) => String(item.certificationId) === String(certificationId)
      )

  const diagnosticRequired =
      enrolled &&
      publishedDiagnostic != null &&
      !enrollment?.diagnosticCompletedAt

  const modules = getCertificationModules(certification) ?? []

  const lessons = learnerLessons.filter(
      (lesson) => String(lesson.certificationId) === String(certificationId)
  )

  const allLessons = modules.flatMap((major) =>
      (major.middleCategory ?? []).flatMap((middle) => middle.lessons ?? [])
  )

  function isLessonCompleted(lesson) {
    return (
        Boolean(lesson.completed) ||
        completedLessonItems.some(
            (item) => String(item.lessonId) === String(lesson.lessonId)
        )
    )
  }

  const completedLessonCount = lessons.filter(isLessonCompleted).length

  const progress =
      lessons.length > 0
          ? Math.round((completedLessonCount / lessons.length) * 100)
          : 0

  const imageUrl = getCertificationImageUrl(certification)

  const moduleCount = modules.reduce(
      (total, major) => total + (major.middleCategory?.length ?? 0),
      0
  )
  const lessonCount = allLessons.length

  const totalMinutes = allLessons.reduce(
      (total, lesson) => total + getLessonDurationMinutes(lesson),
      0
  )

  const primaryButtonLabel = enrolled
      ? diagnosticRequired
          ? "Start Diagnostic"
          : "Continue Learning"
      : learnerId == null
          ? "Sign In to Enroll"
          : enrollMutation.isPending
              ? "Enrolling..."
              : "Rebyu Certificate"

  function handlePrimaryAction() {
    if (enrolled) {
      if (diagnosticRequired && publishedDiagnostic) {
        navigate(`/learner/assessments/${publishedDiagnostic.examId}`)
        return
      }

      navigate(`/learner/learning/${certificationId}`)
      return
    }

    if (learnerId == null) {
      toast.info("Sign in to enroll in this certification.")
      navigate("/login")
      return
    }

    enrollMutation.mutate()
  }

  return (
      <div className="w-full min-w-0 pb-16">
        <div className="mx-auto w-full max-w-[1280px]">

          {/* Breadcrumb / Back Navigation */}
          <div className="py-6">
            <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-muted-foreground hover:text-primary"
                onClick={() => navigate("/learner/certifications")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Certifications
            </Button>
          </div>

          {/* Guidebook header: a solid Feather banner rather than a blurred
              cover photo. The title has to survive at any length, and text over
              an arbitrary uploaded image never reliably does. */}
          <header className="relative isolate overflow-hidden rounded-3xl bg-rb-feather px-6 py-10 shadow-[0_6px_0_var(--color-rb-feather-lip)] sm:px-10 lg:py-14">
            {/* oversized wordmark as texture, clipped by the banner */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-8 -right-4 select-none font-rb-display text-[7rem] font-black lowercase leading-none tracking-tight text-white/15"
            >
              {certification.title?.slice(0, 8)}
            </span>

            <div className="relative z-10">
              <Badge
                  variant="secondary"
                  className="mb-5 border-0 bg-white/25 px-3 py-1 text-xs font-bold text-white hover:bg-white/25"
              >
                {certification.industry || "Certification Program"}
              </Badge>

              <h1 className="max-w-3xl break-words font-rb-display text-3xl font-extrabold lowercase tracking-tight text-white sm:text-4xl lg:text-5xl [overflow-wrap:anywhere]">
                {certification.title}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
                {certification.description ||
                    "A comprehensive certification review designed to build your expertise, prepare you for the examination, and accelerate your career."}
              </p>

              <div className="mt-8 flex flex-wrap gap-2.5 text-sm">
                <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 font-bold text-white">
                  <Layers3 className="h-4 w-4" />
                  <span>
                    {modules.length} major{" "}
                    {modules.length === 1 ? "category" : "categories"}
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 font-bold text-white">
                  <BookOpen className="h-4 w-4" />
                  <span>
                    {moduleCount} modules · {lessonCount} lessons
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 font-bold text-white">
                  <Clock3 className="h-4 w-4" />
                  <span>{formatDuration(totalMinutes)}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="mt-10 grid min-w-0 items-start gap-10 lg:grid-cols-[minmax(0,1.8fr)_minmax(380px,1fr)]">

            {/* LEFT COLUMN - About & Curriculum */}
            <div className="flex min-w-0 flex-col space-y-10">

              {/* What You'll Learn (Features) */}
              <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
                <h2 className="mb-6 text-xl font-bold">What you'll learn</h2>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <ProductFeature>
                    A structured diagnostic assessment to pinpoint your learning gaps immediately.
                  </ProductFeature>
                  <ProductFeature>
                    Step-by-step organized lessons grouped by highly relevant modules.
                  </ProductFeature>
                  <ProductFeature>
                    Self-paced study materials letting you review complex course materials on your schedule.
                  </ProductFeature>
                  <ProductFeature>
                    Comprehensive progress tracking tailored to your personal learner dashboard.
                  </ProductFeature>
                </div>
              </div>

              {/* Announcements from the learner's organization group, if any.
                  Renders nothing when they aren't in one. */}
              <LearnerAnnouncements certificationId={certificationId} />

              {/* Course Curriculum grouped by major category */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Course Content</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {modules.length} major {modules.length === 1 ? "category" : "categories"} •{" "}
                    {moduleCount} modules • {lessonCount} lessons •{" "}
                    {formatDuration(totalMinutes)} total length
                  </p>
                </div>

                {modules.length === 0 ? (
                    <LearnerEmptyState
                        icon={BookOpen}
                        title="No curriculum available"
                        description="This certification does not have modules or lessons yet."
                    />
                ) : (
                    <div className="space-y-8">
                      {modules.map((major, majorIndex) => {
                        const middleCategories = major.middleCategory ?? []
                        const majorPriority = majorPriorityById.get(
                            String(major.majorCategoryId)
                        )

                        return (
                            <section
                                key={major.majorCategoryId ?? majorIndex}
                                className="space-y-3"
                            >
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="font-heading text-lg font-bold text-foreground">
                                  <span className="text-primary">
                                    Major Category {majorIndex + 1}:
                                  </span>{" "}
                                  {major.title ?? "Untitled"}
                                </h3>
                                {majorPriority?.priority_tag && (
                                    <PriorityTag tag={majorPriority.priority_tag} size="sm" />
                                )}
                              </div>

                              {middleCategories.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                                    No modules under this major category yet.
                                  </div>
                              ) : (
                                  <Accordion
                                      type="multiple"
                                      className="space-y-3"
                                  >
                                    {middleCategories.map((middle, middleIndex) => {
                                      const middleLessons = middle.lessons ?? []
                                      const middleMinutes = middleLessons.reduce(
                                          (total, lesson) =>
                                              total + getLessonDurationMinutes(lesson),
                                          0
                                      )

                                      const itemValue = String(
                                          middle.middleCategoryId ??
                                          `${majorIndex}-${middleIndex}`
                                      )
                                      const middlePriority = middlePriorityById.get(
                                          String(middle.middleCategoryId)
                                      )

                                      return (
                                          <AccordionItem
                                              key={itemValue}
                                              value={itemValue}
                                              className="overflow-hidden rounded-2xl border-2 border-rb-swan bg-rb-snow px-2"
                                          >
                                            <AccordionTrigger className="rounded-xl px-4 py-5 transition-colors hover:bg-rb-polar hover:no-underline">
                                              <div className="flex flex-col items-start text-left">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="font-rb-display text-base font-extrabold text-rb-eel">
                                                    {middle.title ?? "Untitled Module"}
                                                  </span>
                                                  {middlePriority?.priority_tag && (
                                                      <PriorityTag
                                                          tag={middlePriority.priority_tag}
                                                          size="sm"
                                                      />
                                                  )}
                                                </div>
                                                <span className="mt-1 text-sm font-normal text-muted-foreground">
                                                  {middleLessons.length}{" "}
                                                  {middleLessons.length === 1
                                                      ? "lesson"
                                                      : "lessons"}{" "}
                                                  • {formatDuration(middleMinutes)}
                                                </span>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-4 pt-2">
                                              {middleLessons.length === 0 ? (
                                                  <p className="px-4 py-2 text-sm text-muted-foreground">
                                                    No lessons have been added yet.
                                                  </p>
                                              ) : (
                                                  <div className="space-y-1">
                                                    {middleLessons.map((lesson) => {
                                                      const completed =
                                                          isLessonCompleted(lesson)

                                                      return (
                                                          <div
                                                              key={lesson.lessonId}
                                                              className="flex items-center justify-between gap-4 rounded-md px-4 py-3 hover:bg-muted/50"
                                                          >
                                                            <div className="flex min-w-0 items-start gap-3">
                                                              <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                                              <div className="flex min-w-0 flex-col">
                                                                <span className="truncate text-sm font-medium text-foreground">
                                                                  {lesson.name}
                                                                </span>
                                                                {completed && (
                                                                    <span className="text-xs font-medium text-green-600">
                                                                      Completed
                                                                    </span>
                                                                )}
                                                              </div>
                                                            </div>
                                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                              {getLessonDurationMinutes(lesson) > 0
                                                                  ? formatDuration(
                                                                      getLessonDurationMinutes(lesson)
                                                                  )
                                                                  : "Self-paced"}
                                                            </span>
                                                          </div>
                                                      )
                                                    })}
                                                  </div>
                                              )}
                                            </AccordionContent>
                                          </AccordionItem>
                                      )
                                    })}
                                  </Accordion>
                              )}
                            </section>
                        )
                      })}
                    </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - Sticky Enrollment Box */}
            <aside className="min-w-0 self-start lg:sticky lg:top-6 lg:h-fit">
              <Card className="overflow-hidden border shadow-lg">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Enrollment Status
                    </span>
                    <span className="text-4xl font-extrabold tracking-tight text-foreground">
                      {enrolled ? "Enrolled" : "Free"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-6">

                  {enrolled && (
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm font-medium">
                          <span>Your Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {completedLessonCount} of {lessons.length} lessons completed
                        </p>
                      </div>
                  )}

                  <div className="space-y-3">
                    <Button
                        type="button"
                        size="lg"
                        className="h-14 w-full text-base font-bold"
                        onClick={handlePrimaryAction}
                        disabled={enrollMutation.isPending}
                    >
                      {primaryButtonLabel}
                    </Button>
                    {!enrolled && (
                        <p className="text-center text-xs text-muted-foreground">
                          Enrolling adds this certification to My Learning.
                        </p>
                    )}
                  </div>

                  {diagnosticRequired && (
                      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                        <Target className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800 dark:text-amber-300">Diagnostic Required</AlertTitle>
                        <AlertDescription className="text-amber-700 dark:text-amber-400">
                          Complete the diagnostic assessment to unlock your personalized learning path.
                        </AlertDescription>
                      </Alert>
                  )}

                  {publishedDiagnostic && !enrolled && (
                      <Alert>
                        <LockKeyhole className="h-4 w-4" />
                        <AlertTitle>Diagnostic Assessment</AlertTitle>
                        <AlertDescription>
                          A mandatory diagnostic test is required post-enrollment.
                        </AlertDescription>
                      </Alert>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground">This course includes:</h4>
                    <ProductMetaItem icon={Clock3}>
                      {formatDuration(totalMinutes)} of learning content
                    </ProductMetaItem>
                    <ProductMetaItem icon={Layers3}>
                      {moduleCount} distinct learning modules
                    </ProductMetaItem>
                    <ProductMetaItem icon={BookOpen}>
                      {lessonCount} comprehensive lessons
                    </ProductMetaItem>
                    <ProductMetaItem icon={Languages}>
                      English language support
                    </ProductMetaItem>
                  </div>
                </CardContent>
              </Card>

              {/* Auxiliary Info Card */}
              <Card className="mt-6 border shadow-sm">
                <CardContent className="space-y-4 p-6">
                  <h4 className="font-semibold text-foreground">Course Requirements</h4>
                  <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                    <li>No prior experience required.</li>
                    <li>A stable internet connection.</li>
                    <li>Willingness to learn and complete the diagnostic.</li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </main>
        </div>
      </div>
  )
}
