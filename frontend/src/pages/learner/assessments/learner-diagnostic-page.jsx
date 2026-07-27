import { useMemo } from "react"
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom"
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    ClipboardCheck,
    Clock3,
    FileQuestion,
    LockKeyhole,
    ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    LearnerEmptyState,
    ProgressBar,
} from "@/components/learner/learner-ui.jsx"

function getCertificationId(certification) {
    return String(
        certification?.certificationId ??
        certification?.id ??
        certification?.certification?.certificationId ??
        ""
    )
}

function getCertificationTitle(certification) {
    return certification?.title ?? certification?.name ?? "Certification Review"
}

function getLessonId(lesson) {
    return String(lesson?.lessonId ?? lesson?.id ?? "")
}

function collectArrays(...sources) {
    return sources.flatMap((source) => (Array.isArray(source) ? source : []))
}

function getAssessmentId(assessment) {
    return String(
        assessment?.assessmentId ??
        assessment?.examId ??
        assessment?.id ??
        ""
    )
}

function getAssessmentTitle(assessment) {
    return (
        assessment?.title ??
        assessment?.name ??
        assessment?.examName ??
        assessment?.assessmentTitle ??
        "Diagnostic Exam"
    )
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
    const titleText = String(getAssessmentTitle(assessment)).toLowerCase()

    return typeText.includes("diagnostic") || titleText.includes("diagnostic")
}

function getDiagnosticAssessment(certification, data, fallbackAssessment) {
    if (fallbackAssessment) {
        return fallbackAssessment
    }

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

function getQuestionCount(assessment) {
    return (
        assessment?.totalQuestions ??
        assessment?.questionCount ??
        assessment?.totalItems ??
        assessment?.total ??
        assessment?.questions?.length ??
        null
    )
}

function getDurationText(assessment) {
    const duration =
        assessment?.durationMinutes ??
        assessment?.duration ??
        assessment?.timeLimitMinutes ??
        assessment?.timeLimit

    if (!duration) {
        return "No time limit shown"
    }

    return `${duration} minutes`
}

function DiagnosticStep({ number, title, description }) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {number}
                </div>

                <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
                </div>
            </div>
        </div>
    )
}

export default function LearnerDiagnosticGatePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { certificationId } = useParams()
    const { data } = useOutletContext()

    const enrolledCertifications = data?.enrolledCertifications ?? []
    const allLessons = data?.lessons ?? []

    const certification =
        location.state?.certification ??
        enrolledCertifications.find(
            (item) => getCertificationId(item) === String(certificationId)
        ) ??
        null

    const lessons = useMemo(() => {
        const stateLessons = location.state?.lessons

        if (Array.isArray(stateLessons) && stateLessons.length > 0) {
            return stateLessons
        }

        return allLessons.filter(
            (lesson) => String(lesson.certificationId) === String(certificationId)
        )
    }, [allLessons, certificationId, location.state?.lessons])

    const diagnosticAssessment = getDiagnosticAssessment(
        certification,
        data,
        location.state?.diagnosticAssessment
    )

    const nextLesson =
        location.state?.nextLesson ??
        lessons.find((lesson) => !lesson.completed) ??
        lessons[0]

    const questionCount = getQuestionCount(diagnosticAssessment)
    const diagnosticId = getAssessmentId(diagnosticAssessment)
    const takePath = diagnosticId ? `/learner/assessments/${diagnosticId}` : ""

    function startDiagnostic() {
        if (!diagnosticAssessment || !takePath) {
            return
        }

        navigate(takePath, {
            state: {
                certification,
                diagnosticAssessment,
                nextLesson,
                returnToLessonId: getLessonId(nextLesson),
            },
        })
    }

    if (!certification) {
        return (
            <LearnerEmptyState
                icon={BookOpen}
                title="Certification not found"
                description="Go back to My Learning and select a certification again."
                action={
                    <Button onClick={() => navigate("/learner/learning")}>
                        Back to My Learning
                    </Button>
                }
            />
        )
    }

    return (
        <main className="min-h-[calc(100dvh-8rem)] rounded-xl border border-zinc-200 bg-white px-5 py-10 shadow-sm sm:px-8 sm:py-12 xl:px-14">
            <article className="mx-auto w-full max-w-6xl">
                <Button
                    type="button"
                    variant="ghost"
                    className="mb-6 -ml-3 gap-2 text-zinc-500 hover:text-zinc-950"
                    onClick={() => navigate("/learner/learning")}
                >
                    <ArrowLeft className="size-4" />
                    Back to My Learning
                </Button>

                <section className="overflow-hidden rounded-3xl border border-primary/20 bg-primary/5">
                    <div className="relative p-6 sm:p-8 lg:p-10">
                        <div className="absolute right-0 top-0 hidden h-40 w-40 translate-x-12 -translate-y-12 rounded-full bg-primary/10 blur-2xl sm:block" />

                        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
                            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                                <LockKeyhole className="size-7" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                                    Diagnostic required
                                </p>

                                <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
                                    Before you study the lessons, take the diagnostic exam.
                                </h1>

                                <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-600">
                                    The lesson content is locked for now. Complete the diagnostic first to unlock the learning path.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                                {getCertificationTitle(certification)}
                            </p>

                            <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
                                {diagnosticAssessment
                                    ? getAssessmentTitle(diagnosticAssessment)
                                    : "Diagnostic Exam"}
                            </h2>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    <FileQuestion className="size-4 text-primary" />
                                    Items
                                </div>
                                <p className="mt-2 text-sm font-semibold text-zinc-950">
                                    {questionCount ? `${questionCount} items` : "Not shown"}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    <Clock3 className="size-4 text-primary" />
                                    Time
                                </div>
                                <p className="mt-2 text-sm font-semibold text-zinc-950">
                                    {getDurationText(diagnosticAssessment)}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    <ShieldCheck className="size-4 text-primary" />
                                    Access
                                </div>
                                <p className="mt-2 text-sm font-semibold text-zinc-950">
                                    Required
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 w-full rounded-3xl border border-dashed border-red-200 bg-red-50/60 p-6 shadow-sm sm:p-8">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-red-500 shadow-sm ring-1 ring-red-100">
                                <LockKeyhole className="size-6" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-base font-semibold text-red-950">
                                    Lesson content is locked
                                </p>

                                <p className="mt-2 max-w-4xl text-sm leading-7 text-red-800/80">
                                    You can open the lessons after submitting the diagnostic exam. This area is full-width so you can later replace it with the actual locked lesson preview or exam-related content.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 w-full rounded-3xl border border-zinc-200 bg-zinc-50/70 p-6 sm:p-8">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                                    <ClipboardCheck className="size-4 text-primary" />
                                    Diagnostic content area
                                </div>

                                <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">
                                    This wide section can later be replaced with the diagnostic exam content.
                                </p>
                            </div>

                            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-500">
                Locked for now
              </span>
                        </div>

                        <div className="mt-6 grid gap-4 lg:grid-cols-3">
                            <DiagnosticStep
                                number="1"
                                title="Take the diagnostic"
                                description="Answer the questions based on what you currently know."
                            />

                            <DiagnosticStep
                                number="2"
                                title="Submit your answers"
                                description="REBYU will record your diagnostic attempt."
                            />

                            <DiagnosticStep
                                number="3"
                                title="Unlock learning"
                                description="After submission, the study content can open."
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-4 border-t border-zinc-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-500">
                                Progress unlocked after diagnostic
                            </p>

                            <div className="mt-2 w-full sm:w-80">
                                <ProgressBar value={0} />
                            </div>
                        </div>

                        <Button
                            type="button"
                            size="lg"
                            disabled={!diagnosticAssessment || !takePath}
                            onClick={startDiagnostic}
                            className="gap-2"
                        >
                            {diagnosticAssessment
                                ? "Take Diagnostic Exam"
                                : "No Diagnostic Exam Yet"}
                            <ArrowRight className="size-4" />
                        </Button>
                    </div>

                    {!diagnosticAssessment ? (
                        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                            The diagnostic exam is not found for this certification yet. Create a Diagnostic assessment in the admin Assessments tab first.
                        </p>
                    ) : null}
                </section>

                <section className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />

                        <div>
                            <h2 className="font-semibold text-zinc-950">
                                Ready to unlock your study path
                            </h2>

                            <p className="mt-2 text-sm leading-7 text-zinc-600">
                                Once you finish the diagnostic, the learning content can become available for this certification review.
                            </p>
                        </div>
                    </div>
                </section>
            </article>
        </main>
    )
}
