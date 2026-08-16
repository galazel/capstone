import { useMemo } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BookOpen,
  Check,
  Clock3,
  GraduationCap,
  Languages,
  Layers3,
  LockKeyhole,
  Target,
  PlayCircle,
} from "@/components/icons"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import { Button } from "@/components/ui/button"

import { BentoHeading } from "@/components/commons/bento.jsx"
import { BackButton, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"

import { BUBBLE_TONES } from "@/components/commons/bubble-card.jsx"
import { LearnerEmptyState, toneForCertification } from "@/components/learner/learner-ui.jsx"
import { LearnerAnnouncements } from "@/components/learner/learner-announcements.jsx"
import { announceRewards, snapshotRewards } from "@/components/learner/xp-award-modal.jsx"

import { getCertificationModules } from "@/services/learnerService.js"
import { hasSatDiagnostic } from "./curriculum-model.js"

import {
  confirmPurchase,
  getExamTypes,
  getExams,
  getLearnerEnrollments,
  purchaseCertification,
} from "@/services/assessmentService.js"

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
      <div className="flex min-w-0 items-center gap-3 text-sm text-rb-eel">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rb-polar text-rb-wolf">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 break-words font-bold [overflow-wrap:anywhere]">
        {children}
      </span>
      </div>
  )
}

/* A tick and a line, on the card's own ground. These used to be four bordered
   tiles inside a bordered card -- a box in a box in a box, which is what made
   the page read as a grid of containers rather than as a page. The round check
   medallion carries them; they do not need a frame of their own. */
function ProductFeature({ tone, children }) {
  return (
      <div className="flex min-w-0 items-start gap-3">
        <span
            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white"
            style={{ background: tone.solid }}
        >
          <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
        <p className="min-w-0 break-words text-sm font-semibold leading-6 text-rb-eel [overflow-wrap:anywhere]">
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

  /* No BKT here. This page describes the certification -- what is in it and
     what it asks of you -- and nothing about how the reader is doing at it.
     Priority tags, mastery and progress are readings of a learner, they change
     under the same content from one day to the next, and they already have two
     homes (the analytics board and My Learning). Carrying them here also meant
     this page could not be shown to somebody who is not enrolled without
     showing them an empty version of somebody else's dashboard. */

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

    // Enrolling can unlock "Knowledge Seeker" server-side, so this flow diffs
    // the portal payload too -- snapshot before, announce after.
    onMutate: () => snapshotRewards(queryClient),
    onSuccess: async (_result, _variables, before) => {
      queryClient.invalidateQueries({
        queryKey: ["learner-enrollments"],
      })

      toast.success(
          "You are now enrolled. This certification was added to My Learning."
      )
      // `silentXp`: enrolling pays no XP, and the "nothing was credited" toast
      // would contradict the success toast just shown. This also refetches the
      // portal payload, which is what the invalidate here used to do.
      await announceRewards({
        queryClient,
        before,
        title: "Enrolled",
        silentXp: true,
      })
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

  /* Two pieces of evidence, and the flag is only one of them.
     `diagnosticCompletedAt` is stamped on whichever enrollment row was active
     when the diagnostic was submitted, so anything that produces a different
     active row afterwards -- re-enrolling, an organization re-issuing a seat, a
     self-enrollment added beside a sponsored one -- leaves a learner who has
     demonstrably sat it being told to sit it again. Their own submitted result
     is the fact; the flag is a cache of it, and `hasSatDiagnostic` is the same
     check the curriculum page gates on. */
  const diagnosticDone =
      Boolean(enrollment?.diagnosticCompletedAt) ||
      hasSatDiagnostic({
        diagnostic: publishedDiagnostic,
        examResults: data.examResults ?? [],
        certificationId,
      })

  const diagnosticRequired =
      enrolled && publishedDiagnostic != null && !diagnosticDone

  /* The same tone the catalog card used for this certification, so opening a
     card lands on a page in that card's colour instead of on a page that looks
     the same for every certification. */
  const toneKey = toneForCertification(certification)
  const tone = BUBBLE_TONES[toneKey] ?? BUBBLE_TONES.macaw

  const modules = getCertificationModules(certification) ?? []

  const allLessons = modules.flatMap((major) =>
      (major.middleCategory ?? []).flatMap((middle) => middle.lessons ?? [])
  )

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
      /* One white ground and one coloured header. `rb-polar` was the ground
         while the page was made of `rb-snow` cards -- it existed to be the
         grey the cards sat on. With the cards gone it would leave every
         section, medallion and hover state washing into the page, so the page
         takes the surface colour and the greys go back to marking things on
         it. */
      <div className="rebyu-ds min-h-[calc(100dvh-4rem)] w-full min-w-0 bg-rb-snow pb-20">
        {/* The layout hands this route the full window (see
            `isCertificationDetailPage` in learner-layout), so the gutters and
            the cap are set here and nowhere else. 1600, matching the curriculum
            page: wide enough to fill a large screen, short of the point where
            the description in the left column runs past a readable measure.
            `min-h` on the wrapper so the ground colour reaches the bottom of
            the window on a short certification instead of stopping under the
            last tile. */}
        <div className="mx-auto w-full max-w-[1600px] px-5 lg:px-8">

          {/* The portal's back control, not a text link: the same tactile
              round arrow the curriculum page and every arena open with. */}
          <div className="flex items-center gap-3 py-6">
            <BackButton asChild label="Back to certifications">
              <Link to="/learner/certifications" />
            </BackButton>
            <span className="font-rb-display text-sm font-extrabold lowercase text-rb-wolf">
              back to certifications
            </span>
          </div>

          {/* The title block, drawn as the catalog card's cap rather than as a
              fourth bordered tile: the gradient, the two bled bubbles and the
              icon medallion are the card the learner pressed to get here,
              opened out to the width of the page. */}
          <header
              className="relative overflow-hidden rounded-rb-card p-6 text-white sm:p-8"
              style={{ background: tone.accent }}
          >
            <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-28 -left-12 size-64 rounded-full bg-white/10" />

            <div className="relative flex flex-wrap items-start gap-5">
              <span className="hidden size-16 shrink-0 place-items-center rounded-full bg-white/20 sm:grid">
                <GraduationCap className="size-8" strokeWidth={1.7} aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="rb-eyebrow text-white/80">
                    {certification.industry || "certification program"}
                  </p>

                  <span className="shrink-0 rounded-rb-pill bg-white/90 px-3.5 py-1.5 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-rb-eel">
                    {enrolled ? "Enrolled" : "Free to study"}
                  </span>
                </div>

                {/* `text-white` explicitly, not inherited: the design system
                    sets a colour on `h1` itself, which beats the white the
                    header passes down and left the title near-black on the
                    gradient. */}
                <h1 className="mt-2 max-w-3xl break-words font-rb-display text-3xl font-extrabold text-white sm:text-4xl [overflow-wrap:anywhere]">
                  {certification.title}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85">
                  {certification.description ||
                      "A comprehensive certification review designed to build your expertise, prepare you for the examination, and accelerate your career."}
                </p>

                {/* Not `rb-chip`: that chip is drawn for a light ground and
                    turns into three grey slabs on the gradient. */}
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-extrabold text-white/90">
                  <span className="inline-flex items-center gap-2">
                    <Layers3 className="size-4" aria-hidden="true" />
                    {modules.length} major {modules.length === 1 ? "category" : "categories"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <BookOpen className="size-4" aria-hidden="true" />
                    {moduleCount} modules · {lessonCount} lessons
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="size-4" aria-hidden="true" />
                    {formatDuration(totalMinutes)}
                  </span>
                </div>

                {/* The action, beside what it acts on. It used to sit in a
                    sidebar card three headings down the page, under a "Free"
                    price that a free product does not need quoting. `snow`,
                    because a coloured button on a coloured gradient has no
                    edge to stand on. */}
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <TactileButton
                      type="button"
                      variant="snow"
                      size="lg"
                      onClick={handlePrimaryAction}
                      disabled={enrollMutation.isPending}
                  >
                    {primaryButtonLabel}
                  </TactileButton>

                  {(diagnosticRequired || (publishedDiagnostic && !enrolled)) && (
                      <span className="inline-flex min-w-0 items-center gap-2 text-xs font-bold text-white/85">
                        {diagnosticRequired ? (
                            <Target className="size-4 shrink-0" aria-hidden="true" />
                        ) : (
                            <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        {diagnosticRequired
                            ? "Complete the diagnostic to unlock your learning path."
                            : "A short placement test runs once you enrol."}
                      </span>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Plain sections on one ground, not a grid of cards. Each is a
              lowercase heading, a hint line and its content -- the heading and
              the space around it separate them, which is all the separation a
              page with four sections needs. */}
          <main className="mt-10 grid min-w-0 items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">

            {/* LEFT COLUMN - About & Curriculum */}
            <div className="flex min-w-0 flex-col gap-10">

              {/* What You'll Learn (Features) */}
              <section>
                <BentoHeading
                    title="what you'll learn"
                    hint="What this certification review gives you."
                />
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <ProductFeature tone={tone}>
                    A structured diagnostic assessment to pinpoint your learning gaps immediately.
                  </ProductFeature>
                  <ProductFeature tone={tone}>
                    Step-by-step organized lessons grouped by highly relevant modules.
                  </ProductFeature>
                  <ProductFeature tone={tone}>
                    Self-paced study materials letting you review complex course materials on your schedule.
                  </ProductFeature>
                  <ProductFeature tone={tone}>
                    Comprehensive progress tracking tailored to your personal learner dashboard.
                  </ProductFeature>
                </div>
              </section>

              {/* Announcements from the learner's organization group, if any.
                  Renders nothing when they aren't in one. */}
              <LearnerAnnouncements certificationId={certificationId} />

              {/* Course Curriculum grouped by major category */}
              <section>
                <div>
                  <h2 className="font-rb-display text-sm font-extrabold lowercase text-rb-eel">
                    course content
                  </h2>
                  <p className="mt-1 text-xs text-rb-wolf">
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
                    <div className="mt-5 space-y-6">
                      {modules.map((major, majorIndex) => {
                        const middleCategories = major.middleCategory ?? []
                        return (
                            <section
                                key={major.majorCategoryId ?? majorIndex}
                                className="space-y-3"
                            >
                              {/* The number as a key rather than as a prefix in
                                  the sentence: "Major Category 3:" spent four
                                  words of the heading saying what a numbered
                                  chip says at a glance. */}
                              <div className="flex flex-wrap items-center gap-3">
                                <span
                                    className="grid size-9 shrink-0 place-items-center rounded-full font-rb-display text-sm font-extrabold text-white"
                                    style={{ background: tone.solid }}
                                >
                                  {majorIndex + 1}
                                </span>
                                <h3 className="min-w-0 font-rb-display text-lg font-extrabold text-rb-eel">
                                  {major.title ?? "Untitled"}
                                </h3>
                              </div>

                              {middleCategories.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                                    No modules under this major category yet.
                                  </div>
                              ) : (
                                  /* One list with hairlines between the
                                     modules, not one bordered box per module.
                                     Nine outlined boxes stacked inside an
                                     outlined card was the page's boxiest
                                     stretch, and the border said nothing the
                                     row spacing did not. */
                                  <Accordion
                                      type="multiple"
                                      className="border-y border-rb-swan"
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
                                      return (
                                          <AccordionItem
                                              key={itemValue}
                                              value={itemValue}
                                              className="border-rb-swan"
                                          >
                                            <AccordionTrigger className="rounded-rb-tile px-3 py-4 transition-colors hover:bg-rb-polar hover:no-underline">
                                              <div className="flex flex-col items-start text-left">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="font-rb-display text-base font-extrabold text-rb-eel">
                                                    {middle.title ?? "Untitled Module"}
                                                  </span>
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
                                                      return (
                                                          <div
                                                              key={lesson.lessonId}
                                                              className="flex items-center justify-between gap-4 rounded-rb-tile px-4 py-3 hover:bg-rb-polar"
                                                          >
                                                            <div className="flex min-w-0 items-start gap-3">
                                                              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rb-swan text-rb-wolf">
                                                                <PlayCircle className="size-4" aria-hidden="true" />
                                                              </span>
                                                              <div className="flex min-w-0 flex-col">
                                                                <span className="truncate text-sm font-bold text-rb-eel">
                                                                  {lesson.name}
                                                                </span>
                                                              </div>
                                                            </div>
                                                            <span className="shrink-0 text-xs font-bold text-rb-wolf">
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
              </section>
            </div>

            {/* RIGHT COLUMN - what the certification ships with.
                No enrollment card: the price line said "Free" about a free
                product, the status repeated the header's chip, and the button
                is now beside the title it belongs to. */}
            <aside className="flex min-w-0 flex-col gap-8 self-start lg:sticky lg:top-6 lg:h-fit">
              <section>
                <BentoHeading title="this course includes" />

                <div className="space-y-3">
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

                <div className="mt-6 border-t border-rb-swan pt-5">
                  <BentoHeading title="requirements" />

                  <ul className="space-y-2 text-sm font-semibold text-rb-wolf">
                    <li>No prior experience required.</li>
                    <li>A stable internet connection.</li>
                    <li>Willingness to learn and complete the diagnostic.</li>
                  </ul>
                </div>
              </section>
            </aside>
          </main>
        </div>
      </div>
  )
}
