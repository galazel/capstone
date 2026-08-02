import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ClipboardListIcon, ClockIcon, TargetIcon } from "@/components/icons"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getAssessmentTypeLabel,
  getExamQuestions,
  getExamTypes,
  getExams,
  getLearnerAttempts,
} from "@/services/assessmentService.js"

const TYPE_COPY = {
  DIAGNOSTIC: {
    title: "Start your diagnostic assessment",
    description:
      "Identify your strengths and high-priority topics before beginning your study plan.",
    action: "Start Diagnostic",
  },
  QUIZ: {
    title: "Lesson quiz",
    description: "Check your understanding of what you have studied so far.",
    action: "Start Quiz",
  },
  MODULE_EXAM: {
    title: "Module exam",
    description: "Test yourself on a full module of this certification.",
    action: "Start Module Exam",
  },
  MOCK_EXAM: {
    title: "Mock Exam Available",
    description:
      "Simulate the full certification exam and assess your readiness.",
    action: "Start Mock Exam",
  },
}

// Contextual assessment entry points for a certification. Renders nothing
// when the certification has no assessments — no fake cards.
export default function CertificationAssessmentsSection({
  certificationId,
  learnerId,
  enrolled,
}) {
  const navigate = useNavigate()
  const [startTarget, setStartTarget] = useState(null)

  const examsQuery = useQuery({ queryKey: ["exams"], queryFn: () => getExams() })
  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: getExamTypes,
  })
  const examQuestionsQuery = useQuery({
    queryKey: ["exam-questions"],
    queryFn: getExamQuestions,
  })
  const attemptsQuery = useQuery({
    queryKey: ["learner-attempts", learnerId],
    queryFn: () => getLearnerAttempts(learnerId),
    enabled: learnerId != null,
    retry: 1,
  })

  const rows = useMemo(() => {
    const exams = (Array.isArray(examsQuery.data) ? examsQuery.data : []).filter(
      (exam) =>
        String(exam.certificationId) === String(certificationId) &&
        exam.status === "PUBLISHED"
    )
    const typeById = new Map(
      (Array.isArray(examTypesQuery.data) ? examTypesQuery.data : []).map(
        (type) => [type.examTypeId, type.examTypeText]
      )
    )
    const examQuestions = Array.isArray(examQuestionsQuery.data)
      ? examQuestionsQuery.data
      : []
    const allAttempts = Array.isArray(attemptsQuery.data) ? attemptsQuery.data : []

    return exams.map((exam) => {
      const typeText = typeById.get(exam.examTypeId)
      const questionCount = examQuestions.filter(
        (link) => link.examId === exam.examId
      ).length
      const attempts = allAttempts
        .filter(
          (attempt) =>
            attempt.assessmentId === exam.examId &&
            attempt.status === "SUBMITTED"
        )
        .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0))
      return { exam, typeText, questionCount, attempts }
    })
  }, [
    examsQuery.data,
    examTypesQuery.data,
    examQuestionsQuery.data,
    attemptsQuery.data,
    certificationId,
    learnerId,
  ])

  if (examsQuery.isLoading || rows.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-zinc-950">Assessments</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Diagnostics, quizzes, and exams available for this certification.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.map(({ exam, typeText, questionCount, attempts }) => {
          const copy = TYPE_COPY[typeText] ?? {
            title: exam.title,
            description: "Assessment for this certification.",
            action: "Start Assessment",
          }
          const lastAttempt = attempts[0] ?? null
          return (
            <article
              key={exam.examId}
              className="flex flex-col rounded-xl border border-zinc-200 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {typeText === "DIAGNOSTIC" ? (
                      <TargetIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <ClipboardListIcon className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">
                      {exam.title}
                    </p>
                    <Badge variant="secondary" className="mt-0.5 text-[10px]">
                      {getAssessmentTypeLabel(typeText)}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {copy.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>{questionCount} question(s)</span>
                {exam.durationMinutes ? (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3" aria-hidden="true" />
                    {exam.durationMinutes} min
                  </span>
                ) : null}
                {exam.passingScore != null ? (
                  <span>
                    Passing {Number(exam.passingScore).toFixed(0)}%
                  </span>
                ) : null}
                {attempts.length > 0 ? (
                  <span>{attempts.length} attempt(s)</span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {enrolled ? (
                  <Button
                    size="sm"
                    onClick={() => setStartTarget({ exam, typeText, copy })}
                    disabled={questionCount === 0}
                  >
                    {attempts.length > 0
                      ? "Retake"
                      : copy.action}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    Enroll to take this assessment
                  </Button>
                )}
                {lastAttempt && learnerId != null ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/learner/results/${lastAttempt.assessmentAttemptId}`}
                    >
                      Review Result
                    </Link>
                  </Button>
                ) : null}
                {attempts.length > 1 ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/learner/assessments/${exam.examId}/history`}>
                      View All Attempts
                    </Link>
                  </Button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      <AlertDialog
        open={startTarget != null}
        onOpenChange={(open) => {
          if (!open) setStartTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {startTarget?.copy.title ?? "Start assessment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {startTarget?.exam.durationMinutes
                ? `You will have ${startTarget.exam.durationMinutes} minutes once you begin. `
                : ""}
              Your answers are submitted at the end of the attempt. Make sure
              you are ready before starting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                navigate(`/learner/assessments/${startTarget.exam.examId}`)
              }
            >
              {startTarget?.copy.action ?? "Start Assessment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
