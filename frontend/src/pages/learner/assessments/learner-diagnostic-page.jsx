import { useMemo } from "react"
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom"
import {
    ArrowRight,
    BookOpen,
    Clock3,
    FileQuestion,
    LockKeyhole,
    ShieldCheck,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import { LearnerEmptyState } from "@/components/learner/learner-ui.jsx"
import { BackButton, RebyuCard, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"

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
        <RebyuCard className="h-full">
            <span className="rb-numeric grid size-9 place-items-center rounded-rb-tile bg-rb-macaw-wash text-sm text-rb-macaw-lip">
                {number}
            </span>
            <p className="rb-display rb-display-sm mt-3">{title}</p>
            <p className="rb-caption mt-1.5">{description}</p>
        </RebyuCard>
    )
}

/** One fact about the paper: items, time, whether it is required. */
function DiagnosticFact({ icon: Icon, label, value }) {
    return (
        <div className="rounded-rb-tile border-2 border-rb-swan bg-rb-polar px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rb-wolf">
                <Icon className="size-3.5 text-rb-macaw-lip" aria-hidden="true" />
                {label}
            </p>
            <p className="mt-1 text-sm font-bold text-rb-eel">{value}</p>
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
        <main className="rebyu-ds min-h-[calc(100dvh-8rem)] rounded-rb-card border-2 border-rb-swan bg-rb-snow px-5 py-8 sm:px-8 sm:py-10 xl:px-12">
            <article className="mx-auto w-full max-w-5xl">
                <BackButton
                    size="sm"
                    label="Back to My Learning"
                    onClick={() => navigate("/learner/learning")}
                />

                {/* The gate, said once. It used to be said three times -- a hero,
                    a dashed "lesson content is locked" panel, and a closing card
                    that repeated the hero -- around two blocks of copy written
                    to the developer rather than the learner ("this wide section
                    can later be replaced with the diagnostic exam content"),
                    which shipped to learners as if it were guidance. */}
                <section className="mt-6 overflow-hidden rounded-rb-card border-2 border-rb-macaw/40 bg-rb-macaw-wash p-6 sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                        <span className="grid size-14 shrink-0 place-items-center rounded-rb-card bg-rb-macaw text-white">
                            <LockKeyhole className="size-7" aria-hidden="true" />
                        </span>

                        <div className="min-w-0 flex-1">
                            <p className="rb-eyebrow">diagnostic required</p>
                            <h1 className="rb-display rb-display-md mt-2 max-w-3xl">
                                take the diagnostic before you start the lessons.
                            </h1>
                            <p className="rb-body mt-3 max-w-2xl text-sm">
                                The lesson content stays locked until you submit it. It is
                                not scored against you — it maps what you already know so
                                your study plan starts in the right place.
                            </p>
                        </div>
                    </div>
                </section>

                <RebyuCard raised className="mt-6 p-6 sm:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <p className="rb-eyebrow">
                                {getCertificationTitle(certification)}
                            </p>
                            <h2 className="rb-display rb-display-md mt-2">
                                {diagnosticAssessment
                                    ? getAssessmentTitle(diagnosticAssessment)
                                    : "Diagnostic Exam"}
                            </h2>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:w-[480px]">
                            <DiagnosticFact
                                icon={FileQuestion}
                                label="Items"
                                value={questionCount ? `${questionCount} items` : "Not shown"}
                            />
                            <DiagnosticFact
                                icon={Clock3}
                                label="Time"
                                value={getDurationText(diagnosticAssessment)}
                            />
                            <DiagnosticFact
                                icon={ShieldCheck}
                                label="Access"
                                value="Required"
                            />
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 lg:grid-cols-3">
                        <DiagnosticStep
                            number="1"
                            title="take the diagnostic"
                            description="Answer from what you already know. Guessing helps nobody here."
                        />
                        <DiagnosticStep
                            number="2"
                            title="submit your answers"
                            description="REBYU records the attempt and works out where you are strongest."
                        />
                        <DiagnosticStep
                            number="3"
                            title="unlock the lessons"
                            description="The learning path opens, ordered by what you most need."
                        />
                    </div>

                    <div className="mt-8 flex flex-col gap-4 border-t-2 border-rb-swan pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <p className="rb-caption max-w-md">
                            {diagnosticAssessment
                                ? "You can only sit this once, so give it the time it needs."
                                : "Nothing to sit yet."}
                        </p>

                        <TactileButton
                            type="button"
                            disabled={!diagnosticAssessment || !takePath}
                            onClick={startDiagnostic}
                        >
                            {diagnosticAssessment
                                ? "take diagnostic exam"
                                : "no diagnostic exam yet"}
                            <ArrowRight className="size-5" aria-hidden="true" />
                        </TactileButton>
                    </div>

                    {!diagnosticAssessment ? (
                        <p className="mt-4 rounded-rb-tile border-2 border-rb-fox/45 bg-rb-fox-wash px-4 py-3 text-sm leading-6 text-rb-fox-lip">
                            The diagnostic exam is not found for this certification yet.
                            Create a Diagnostic assessment in the admin Assessments tab
                            first.
                        </p>
                    ) : null}
                </RebyuCard>
            </article>
        </main>
    )
}
