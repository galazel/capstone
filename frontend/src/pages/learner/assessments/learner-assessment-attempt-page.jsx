import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudOffIcon,
  ClockIcon,
  FlagIcon,
  ListIcon,
  Loader2Icon,
  SkipForwardIcon,
} from "@/components/icons"
import { toast } from "sonner"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ASSESSMENT_XP } from "@/lib/xp.js"
import { announceXpAward } from "@/components/learner/xp-award-modal.jsx"
import DiagramArea from "@/components/challenges/diagram-area.jsx"
import CodeMirrorProgrammingWorkspace from "@/components/assessments/attempt/code-mirror-programming-workspace.jsx"
import DiagramQuestionLayout from "@/components/assessments/attempt/diagram-question-layout.jsx"
import ProgrammingQuestionLayout from "@/components/assessments/attempt/programming-question-layout.jsx"
import QuestionNavigator from "@/components/assessments/attempt/question-navigator.jsx"
import SubQuestionTabs from "@/components/assessments/attempt/sub-question-tabs.jsx"
import { getFileViewUrl } from "@/services/fileService.js"
import {
  getCurrentLearner,
  getCurrentLearnerIdentity,
} from "@/services/learnerService.js"
import {
  autosaveAttemptAnswers,
  getAssessmentTypeLabel,
  setAttemptCurrentItem,
  setAttemptFlag,
  setAttemptSkip,
  startAssessmentAttempt,
  submitAssessmentAttempt,
} from "@/services/assessmentService.js"

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

// Serializes one local answer into the backend AttemptAnswerDraftDto shape.
function toDraftDto(attemptQuestionId, answer) {
  const subAnswers = answer.subAnswers ?? {}
  const hasSubs = Object.values(subAnswers).some((text) => text?.trim())
  return {
    attemptQuestionId,
    learnerAnswer: hasSubs
        ? JSON.stringify(subAnswers)
        : (answer.learnerAnswer ?? null),
    selectedChoiceId: answer.selectedChoiceId ?? null,
    submittedCode: answer.submittedCode ?? null,
    programmingLanguage: answer.programmingLanguage ?? null,
    diagramSubmissionData: answer.diagramSubmissionData ?? null,
  }
}

function isMultipleChoice(question) {
  const type = String(question?.questionType ?? "").toUpperCase()
  return type === "MULTIPLE_CHOICE" || type === "MCQ"
}

// Type badges use the design system accents, matching the landing hero:
// Macaw for code, Beetle for diagram, Bee for open-ended written work.
const QUESTION_TYPE_STYLES = {
  MULTIPLE_CHOICE: {
    label: "Multiple Choice",
    className: "border-rb-macaw bg-rb-macaw-wash text-rb-macaw-lip",
  },
  SHORT_ANSWER: {
    label: "Short Answer",
    className: "border-rb-macaw bg-rb-macaw-wash text-rb-macaw-lip",
  },
  DESCRIPTIVE: {
    label: "Descriptive",
    className: "border-rb-bee bg-rb-bee-wash text-rb-bee-ink",
  },
  CRITICAL_THINKING: {
    label: "Critical Thinking",
    className: "border-rb-fox bg-rb-fox-wash text-rb-fox-lip",
  },
  PROGRAMMING: {
    label: "Programming",
    className: "border-rb-macaw bg-rb-macaw-wash text-rb-macaw-lip",
  },
  DIAGRAM: {
    label: "Diagram",
    className: "border-rb-beetle bg-rb-beetle-wash text-rb-beetle-lip",
  },
  DEFAULT: {
    label: "Question",
    className: "border-rb-swan bg-rb-polar text-rb-wolf",
  },
}

function getQuestionTypeMeta(question) {
  const questionType = String(question?.questionType ?? "").toUpperCase()
  const criticalThinkingType = String(
      question?.criticalThinkingType ?? ""
  ).toUpperCase()

  if (questionType === "MCQ") {
    return QUESTION_TYPE_STYLES.MULTIPLE_CHOICE
  }

  if (questionType === "CRITICAL_THINKING") {
    if (criticalThinkingType === "PROGRAMMING") {
      return QUESTION_TYPE_STYLES.PROGRAMMING
    }

    if (criticalThinkingType === "DIAGRAM") {
      return QUESTION_TYPE_STYLES.DIAGRAM
    }

    return QUESTION_TYPE_STYLES.CRITICAL_THINKING
  }

  return QUESTION_TYPE_STYLES[questionType] ?? QUESTION_TYPE_STYLES.DEFAULT
}

function QuestionTypeBadge({ question }) {
  const typeMeta = getQuestionTypeMeta(question)

  return (
      <Badge
          variant="outline"
          className={cn(
              "h-6 shrink-0 rounded-md px-2 text-[11px] font-semibold",
              typeMeta.className
          )}
      >
        {typeMeta.label}
      </Badge>
  )
}

function QuestionMetaRow({ question, index, itemLabel = "Question" }) {
  return (
      <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-muted-foreground">
        {itemLabel} {index + 1}
      </span>

        {question.points != null ? (
            <Badge variant="secondary">{Number(question.points)} pt(s)</Badge>
        ) : null}

        <QuestionTypeBadge question={question} />
      </div>
  )
}

function isAnswered(question, answer) {
  if (!answer) return false
  if (isMultipleChoice(question)) {
    return answer.selectedChoiceId != null
  }
  if (question.questionType === "CRITICAL_THINKING") {
    return (
        Boolean(answer.submittedCode?.trim()) ||
        Boolean(answer.diagramSubmissionData?.trim()) ||
        Object.values(answer.subAnswers ?? {}).some((text) => text?.trim())
    )
  }
  return Boolean(answer.learnerAnswer?.trim())
}

function SaveStatusIndicator({ status }) {
  if (status === "saving") {
    return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
        Saving…
      </span>
    )
  }
  if (status === "saved") {
    return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CheckIcon className="size-3" aria-hidden="true" />
        Saved
      </span>
    )
  }
  if (status === "error") {
    return (
        <span className="flex items-center gap-1 text-xs text-destructive">
        <CloudOffIcon className="size-3" aria-hidden="true" />
        Unable to save draft
      </span>
    )
  }
  return null
}

function NormalQuestionPanel({ question, index, answer, onAnswer }) {
  return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <QuestionMetaRow
            question={question}
            index={index}
            itemLabel="Question"
        />

        <p className="text-base leading-7">{question.question}</p>

        {question.questionImageKey ? (
            <img
                src={getFileViewUrl(question.questionImageKey)}
                alt="Question reference"
                className="max-h-80 w-auto rounded-xl border"
            />
        ) : null}

        {isMultipleChoice(question) ? (
            <RadioGroup
                value={
                  answer?.selectedChoiceId != null
                      ? String(answer.selectedChoiceId)
                      : ""
                }
                onValueChange={(value) =>
                    onAnswer({ selectedChoiceId: Number(value) })
                }
                className="gap-2"
            >
              {(question.choices ?? []).map((choice, choiceIndex) => (
                  <label
                      key={choice.choiceId ?? choiceIndex}
                      className={cn(
                          // Large tactile target with a solid lip, matching the
                          // answer options on the landing hero. Selection changes
                          // colour only, so the box never resizes under the tap.
                          "flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition",
                          "active:translate-y-[3px] active:shadow-none",
                          answer?.selectedChoiceId === choice.choiceId
                              ? "border-rb-macaw bg-rb-macaw-wash shadow-[0_3px_0_var(--color-rb-macaw)]"
                              : "border-rb-swan bg-rb-snow shadow-[0_3px_0_var(--color-rb-swan)] hover:bg-rb-polar"
                      )}
                  >
                    <RadioGroupItem
                        value={String(choice.choiceId)}
                        className="mt-0.5"
                        aria-label={`Choice ${String.fromCharCode(65 + choiceIndex)}`}
                    />
                    <div className="min-w-0">
                <span className="text-sm leading-6">
                  <span className="mr-1.5 font-semibold">
                    {String.fromCharCode(65 + choiceIndex)}.
                  </span>
                  {choice.choiceText}
                </span>
                      {choice.imageKey ? (
                          <img
                              src={getFileViewUrl(choice.imageKey)}
                              alt=""
                              className="mt-2 max-h-40 w-auto rounded-lg border"
                          />
                      ) : null}
                    </div>
                  </label>
              ))}
            </RadioGroup>
        ) : question.questionType === "SHORT_ANSWER" ? (
            <div className="space-y-2">
              <Label htmlFor="short-answer">Your answer</Label>
              <Input
                  id="short-answer"
                  value={answer?.learnerAnswer ?? ""}
                  onChange={(event) =>
                      onAnswer({ learnerAnswer: event.target.value })
                  }
                  placeholder="Type your answer"
              />
            </div>
        ) : (
            <div className="space-y-2">
              <Label htmlFor="descriptive-answer">Your answer</Label>
              <Textarea
                  id="descriptive-answer"
                  value={answer?.learnerAnswer ?? ""}
                  onChange={(event) =>
                      onAnswer({ learnerAnswer: event.target.value })
                  }
                  placeholder="Write your answer..."
                  className="min-h-48"
              />
              <p className="text-right text-xs text-muted-foreground">
                {(answer?.learnerAnswer ?? "").length} characters
              </p>
            </div>
        )}
      </div>
  )
}

function WorkspaceQuestionPanel({ question, index, answer, onAnswer }) {
  const format = question.criticalThinkingType ?? "TEXT"

  // Seed starter code once, unless the learner already typed something.
  useEffect(() => {
    if (
        format === "PROGRAMMING" &&
        question.starterCode &&
        answer?.submittedCode == null
    ) {
      onAnswer({ submittedCode: question.starterCode })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, question.starterCode])

  const problemPanel = (
      <div className="space-y-4">
        <QuestionMetaRow
            question={question}
            index={index}
            itemLabel="Item"
        />
        <p className="whitespace-pre-wrap text-sm leading-7">
          {question.question}
        </p>
        {question.instructions ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {question.instructions}
            </p>
        ) : null}
        {question.diagramType ? (
            <Badge variant="outline">{question.diagramType}</Badge>
        ) : null}
        {question.questionImageKey ? (
            <img
                src={getFileViewUrl(question.questionImageKey)}
                alt="Problem reference"
                className="w-full rounded-xl border"
            />
        ) : null}
      </div>
  )

  const subQuestionTabs =
      (question.subQuestions ?? []).length > 0 ? (
          <SubQuestionTabs
              subQuestions={question.subQuestions.map((sub) => ({
                questionId: sub.subQuestionId,
                questionText: sub.questionText,
              }))}
              answers={answer?.subAnswers ?? {}}
              onAnswerChange={(subQuestionId, text) =>
                  onAnswer({
                    subAnswers: { ...(answer?.subAnswers ?? {}), [subQuestionId]: text },
                  })
              }
          />
      ) : null

  const workspace =
      format === "PROGRAMMING" ? (
          <CodeMirrorProgrammingWorkspace
              value={answer?.submittedCode ?? question.starterCode ?? ""}
              language={answer?.programmingLanguage ?? "Java"}
              starterCode={question.starterCode ?? ""}
              onChange={(code) => onAnswer({ submittedCode: code })}
              onLanguageChange={(language) =>
                  onAnswer({ programmingLanguage: language })
              }
          />
      ) : format === "DIAGRAM" ? (
          <div className="h-full min-h-[420px] overflow-hidden rounded-2xl border-2 border-rb-swan">
            <DiagramArea
                initialXml={answer?.diagramSubmissionData}
                onChange={(diagramXml) =>
                    onAnswer({ diagramSubmissionData: diagramXml })
                }
            />
          </div>
      ) : (
          subQuestionTabs ?? (
              <div className="space-y-2">
                <Label htmlFor="workspace-answer">Your answer</Label>
                <Textarea
                    id="workspace-answer"
                    value={answer?.learnerAnswer ?? ""}
                    onChange={(event) =>
                        onAnswer({ learnerAnswer: event.target.value })
                    }
                    className="min-h-64"
                />
              </div>
          )
      )

  return (
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[320px_1fr]">
        <ScrollArea className="max-h-full rounded-2xl border-2 border-rb-swan bg-rb-snow p-4">
          {problemPanel}
        </ScrollArea>
        <div className="flex min-h-0 flex-col gap-3">
          {format !== "TEXT" && subQuestionTabs ? (
              <div className="rounded-2xl border-2 border-rb-swan bg-rb-snow p-3">{subQuestionTabs}</div>
          ) : null}
          <div className="min-h-0 flex-1">{workspace}</div>
        </div>
      </div>
  )
}

export default function LearnerAssessmentAttemptPage() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const identity = getCurrentLearnerIdentity()
  const currentLearnerQuery = useQuery({
    queryKey: ["current-learner"],
    queryFn: getCurrentLearner,
    retry: 1,
    enabled: identity.learnerId == null,
  })
  const learnerId =
      identity.learnerId ?? currentLearnerQuery.data?.learnerId ?? null

  // Server-driven attempt state
  const [attempt, setAttempt] = useState(null)
  const [startError, setStartError] = useState(null)
  const startedRef = useRef(false)

  const [answers, setAnswers] = useState({})
  const answersRef = useRef(answers)
  answersRef.current = answers
  const dirtyRef = useRef(new Set())
  const [saveStatus, setSaveStatus] = useState("idle")

  const [flagged, setFlagged] = useState(() => new Set())
  const [skipped, setSkipped] = useState(() => new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const warnedRef = useRef({ ten: false, one: false })
  const autoSubmittedRef = useRef(false)

  // ---------------------------------------------------------------
  // Start / resume the attempt on the server
  // ---------------------------------------------------------------
  useEffect(() => {
    if (learnerId == null || startedRef.current) return
    startedRef.current = true
    const keyName = `rebyu-attempt-key-${examId}-${learnerId}`
    let idempotencyKey = sessionStorage.getItem(keyName)
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID()
      sessionStorage.setItem(keyName, idempotencyKey)
    }
    startAssessmentAttempt(examId, learnerId, idempotencyKey)
        .then((response) => {
          setAttempt(response)
          // Rehydrate saved draft answers when resuming.
          const rehydrated = {}
          Object.values(response.savedAnswers ?? {}).forEach((draft) => {
            let subAnswers
            if (draft.learnerAnswer?.startsWith("{")) {
              try {
                subAnswers = JSON.parse(draft.learnerAnswer)
              } catch {
                subAnswers = undefined
              }
            }
            rehydrated[draft.attemptQuestionId] = {
              learnerAnswer: subAnswers ? undefined : draft.learnerAnswer,
              selectedChoiceId: draft.selectedChoiceId,
              submittedCode: draft.submittedCode,
              programmingLanguage: draft.programmingLanguage,
              diagramSubmissionData: draft.diagramSubmissionData,
              subAnswers,
            }
          })
          setAnswers(rehydrated)
          // Restore per-item flag/skip state and the last-viewed item.
          setFlagged(new Set(response.flaggedAttemptQuestionIds ?? []))
          setSkipped(new Set(response.skippedAttemptQuestionIds ?? []))
          if (response.currentAttemptQuestionId != null) {
            const resumeIndex = (response.questions ?? []).findIndex(
                (question) =>
                    question.attemptQuestionId === response.currentAttemptQuestionId
            )
            if (resumeIndex >= 0) setCurrentIndex(resumeIndex)
          }
          if (response.resumed) {
            toast.info("Resumed your attempt in progress.")
          }
        })
        .catch((error) => {
          sessionStorage.removeItem(keyName)
          setStartError(
              error?.response?.data?.message ??
              "This assessment could not be started."
          )
        })
  }, [examId, learnerId])

  const questions = attempt?.questions ?? []

  // ---------------------------------------------------------------
  // Debounced autosave of dirty answers
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!attempt) return
    const interval = setInterval(() => {
      if (dirtyRef.current.size === 0) return
      const dirtyIds = [...dirtyRef.current]
      dirtyRef.current = new Set()
      const payload = dirtyIds
          .map((id) => {
            const answer = answersRef.current[id]
            return answer ? toDraftDto(Number(id), answer) : null
          })
          .filter(Boolean)
      if (payload.length === 0) return
      setSaveStatus("saving")
      autosaveAttemptAnswers(attempt.assessmentAttemptId, learnerId, payload)
          .then(() => setSaveStatus("saved"))
          .catch(() => {
            // Keep local answers; retry on the next tick.
            dirtyIds.forEach((id) => dirtyRef.current.add(id))
            setSaveStatus("error")
          })
    }, 1500)
    return () => clearInterval(interval)
  }, [attempt, learnerId])

  const setAnswer = useCallback((attemptQuestionId, patch) => {
    setAnswers((current) => ({
      ...current,
      [attemptQuestionId]: { ...(current[attemptQuestionId] ?? {}), ...patch },
    }))
    dirtyRef.current.add(attemptQuestionId)
  }, [])

  // ---------------------------------------------------------------
  // Timer from the server-issued expiry
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!attempt?.expiresAt) return
    const endAt = new Date(attempt.expiresAt).getTime()
    const tick = () => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
      setRemainingSeconds(left)
      if (left <= 600 && !warnedRef.current.ten) {
        warnedRef.current.ten = true
        toast.warning("10 minutes remaining.")
      }
      if (left <= 60 && !warnedRef.current.one) {
        warnedRef.current.one = true
        toast.warning("1 minute remaining.")
      }
      if (left === 0) setTimeUp(true)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [attempt?.expiresAt])

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  const answeredIds = useMemo(() => {
    const set = new Set()
    questions.forEach((question) => {
      if (isAnswered(question, answers[question.attemptQuestionId])) {
        set.add(question.attemptQuestionId)
      }
    })
    return set
  }, [questions, answers])

  // Rich per-item model for the navigator (points, sub-question completion,
  // answered/skipped/flagged), derived from persisted + local state.
  const navItems = useMemo(
      () =>
          questions.map((question) => {
            const answer = answers[question.attemptQuestionId]
            const subs = question.subQuestions ?? []
            const subAnswers = answer?.subAnswers ?? {}
            const subAnsweredCount = subs.filter((sub) =>
                subAnswers[sub.subQuestionId]?.trim()
            ).length
            return {
              attemptQuestionId: question.attemptQuestionId,
              points: question.points,
              questionType: question.questionType,
              subQuestionCount: subs.length,
              subAnsweredCount,
              answered: answeredIds.has(question.attemptQuestionId),
              skipped: skipped.has(question.attemptQuestionId),
              flagged: flagged.has(question.attemptQuestionId),
            }
          }),
      [questions, answers, answeredIds, skipped, flagged]
  )

  // Persist the last-viewed item (debounced) so a refresh resumes in place.
  useEffect(() => {
    if (!attempt || !questions[currentIndex]) return
    const attemptQuestionId = questions[currentIndex].attemptQuestionId
    const timeout = setTimeout(() => {
      setAttemptCurrentItem(
          attempt.assessmentAttemptId,
          attemptQuestionId,
          learnerId
      ).catch(() => {})
    }, 400)
    return () => clearTimeout(timeout)
  }, [attempt, currentIndex, questions, learnerId])

  const toggleFlag = useCallback(
      (attemptQuestionId) => {
        const willFlag = !flagged.has(attemptQuestionId)
        setFlagged((current) => {
          const next = new Set(current)
          if (willFlag) next.add(attemptQuestionId)
          else next.delete(attemptQuestionId)
          return next
        })
        if (attempt) {
          setAttemptFlag(
              attempt.assessmentAttemptId,
              attemptQuestionId,
              learnerId,
              willFlag
          ).catch(() => {})
        }
      },
      [attempt, learnerId, flagged]
  )

  const skipCurrent = useCallback(() => {
    const question = questions[currentIndex]
    if (!question) return
    setSkipped((current) => new Set(current).add(question.attemptQuestionId))
    if (attempt) {
      setAttemptSkip(
          attempt.assessmentAttemptId,
          question.attemptQuestionId,
          learnerId,
          true
      ).catch(() => {})
    }
    setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))
  }, [attempt, currentIndex, questions, learnerId])

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = questions
          .map((question) => {
            const answer = answers[question.attemptQuestionId]
            return answer
                ? toDraftDto(question.attemptQuestionId, answer)
                : null
          })
          .filter(Boolean)
      return submitAssessmentAttempt(
          attempt.assessmentAttemptId,
          learnerId,
          payload
      )
    },
    onSuccess: async (result) => {
      sessionStorage.removeItem(`rebyu-attempt-key-${examId}-${learnerId}`)
      // Submission may complete the certification's diagnostic gate. Remove
      // the pre-attempt portal snapshot so lessons are unlocked on return.
      // Also refetches the portal payload -- which both credits the header's XP
      // counter and unlocks lessons behind a diagnostic gate this attempt may
      // have just satisfied -- and reports what the award actually paid.
      await announceXpAward({
        queryClient,
        title: "Assessment submitted",
        fallback: "You had already earned the XP for this assessment.",
      })
      // Refresh the analytics view so mastery/scores reflect this attempt
      // without the learner needing to log out or clear cache.
      await queryClient.invalidateQueries({
        queryKey: ["learner-progress-analytics", String(result.certificationId)],
      })
      await queryClient.invalidateQueries({ queryKey: ["learner-streak"] })
      navigate(`/learner/results/${result.assessmentAttemptId}`, {
        replace: true,
      })
    },
    onError: (error) => {
      toast.error(
          error?.response?.data?.message ??
          "Unable to submit the assessment. Please try again."
      )
    },
  })

  // Server clock reached zero: lock editing and submit automatically once,
  // flushing whatever answers are held locally.
  useEffect(() => {
    if (timeUp && attempt && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      toast.warning("Time is up — submitting your attempt.")
      submitMutation.mutate()
    }
  }, [timeUp, attempt, submitMutation])

  // ---------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------
  if (startError) {
    return (
        <div className="flex min-h-dvh items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border bg-card p-8 text-center">
            <p className="font-medium">Assessment unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{startError}</p>
            <Button
                className="mt-4"
                variant="outline"
                onClick={() => navigate(-1)}
            >
              Go back
            </Button>
          </div>
        </div>
    )
  }

  if (!attempt) {
    return (
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const isWorkspace = currentQuestion?.questionType === "CRITICAL_THINKING"
  const isProgramming =
      isWorkspace && currentQuestion?.criticalThinkingType === "PROGRAMMING"
  const isDiagram =
      isWorkspace && currentQuestion?.criticalThinkingType === "DIAGRAM"
  const currentAnswer = currentQuestion
      ? answers[currentQuestion.attemptQuestionId]
      : null
  const editingLocked = timeUp || submitMutation.isPending

  const navigatorPanel = (
      <QuestionNavigator
          items={navItems}
          currentIndex={currentIndex}
          onJump={setCurrentIndex}
          onFinish={() => setFinishOpen(true)}
          finishDisabled={submitMutation.isPending}
      />
  )

  return (
      <div className="rebyu-ds flex h-dvh flex-col overflow-hidden bg-rb-polar">
        {/* Window chrome, matching the workspace shown on the landing hero. */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b-2 border-rb-swan bg-rb-snow px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setLeaveOpen(true)}
                aria-label="Exit attempt"
            >
              <ArrowLeftIcon aria-hidden="true" />
              <span className="hidden sm:inline">Exit</span>
            </Button>
            <div className="min-w-0">
              <p className="truncate font-rb-display text-base font-extrabold lowercase text-rb-eel">
                {attempt.assessmentTitle}
              </p>
              <p className="truncate text-xs font-semibold text-rb-wolf">
                Question {currentIndex + 1} of {questions.length} · Attempt{" "}
                {attempt.attemptNumber}
              </p>
            </div>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {getAssessmentTypeLabel(attempt.assessmentType)}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <SaveStatusIndicator status={saveStatus} />
            {/* The timer escalates Wolf -> Fox -> Cardinal and never pulses or
                shakes: this is the most stressful screen in the product, so the
                clock reports rather than nags. */}
            {remainingSeconds != null ? (
                <span
                    className={cn(
                        "flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold tabular-nums",
                        remainingSeconds <= 120
                            ? "border-rb-cardinal bg-rb-cardinal-wash text-rb-cardinal-lip"
                            : remainingSeconds <= 600
                                ? "border-rb-fox bg-rb-fox-wash text-rb-fox-lip"
                                : "border-rb-swan bg-rb-polar text-rb-eel"
                    )}
                    role="timer"
                    aria-label="Time remaining"
                >
              <ClockIcon className="size-4" aria-hidden="true" />
                  {formatClock(remainingSeconds)}
            </span>
            ) : null}

            <Sheet>
              <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open item navigation"
                >
                  <ListIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] overflow-hidden p-4">
                <SheetHeader className="p-0 pb-3">
                  <SheetTitle>Item Navigation</SheetTitle>
                </SheetHeader>
                {navigatorPanel}
              </SheetContent>
            </Sheet>

            <Button
                size="sm"
                className="hidden lg:inline-flex"
                onClick={() => setFinishOpen(true)}
                disabled={submitMutation.isPending}
            >
              Finish Attempt
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
          {isProgramming && currentQuestion ? (
              <div
                  className={cn(
                      "flex min-h-0 flex-1 flex-col overflow-hidden",
                      editingLocked && "pointer-events-none opacity-70"
                  )}
              >
                {/* No meta strip above the workspace. `ProgrammingQuestionLayout`
                    carries the item number, difficulty, points and type at the
                    head of its own problem column -- a second full-width header
                    restated column one and pushed the editor down. */}
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ProgrammingQuestionLayout
                      key={currentQuestion.attemptQuestionId}
                      question={currentQuestion}
                      index={currentIndex}
                      answer={currentAnswer}
                      onAnswer={(patch) =>
                          setAnswer(currentQuestion.attemptQuestionId, patch)
                      }
                      attemptId={attempt.assessmentAttemptId}
                      attemptQuestionId={currentQuestion.attemptQuestionId}
                      learnerId={learnerId}
                      navigator={navigatorPanel}
                      editingLocked={editingLocked}
                  />
                </div>
              </div>
          ) : isDiagram && currentQuestion ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Same as programming: the meta belongs at the head of the
                    problem column, not in a header above the canvas. */}
                <div className="min-h-0 flex-1 overflow-hidden">
                  <DiagramQuestionLayout
                      key={currentQuestion.attemptQuestionId}
                      question={currentQuestion}
                      index={currentIndex}
                      answer={currentAnswer}
                      onAnswer={(patch) =>
                          setAnswer(currentQuestion.attemptQuestionId, patch)
                      }
                      attemptId={attempt.assessmentAttemptId}
                      attemptQuestionId={currentQuestion.attemptQuestionId}
                      learnerId={learnerId}
                      navigator={navigatorPanel}
                      editingLocked={editingLocked}
                  />
                </div>
              </div>
          ) : (
              <>
                <main
                    className={cn(
                        "min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-background p-4 sm:p-6",
                        editingLocked && "pointer-events-none opacity-70"
                    )}
                    aria-live="polite"
                >
                  {currentQuestion ? (
                      isWorkspace ? (
                          <WorkspaceQuestionPanel
                              key={currentQuestion.attemptQuestionId}
                              question={currentQuestion}
                              index={currentIndex}
                              answer={currentAnswer}
                              onAnswer={(patch) =>
                                  setAnswer(currentQuestion.attemptQuestionId, patch)
                              }
                          />
                      ) : (
                          <NormalQuestionPanel
                              key={currentQuestion.attemptQuestionId}
                              question={currentQuestion}
                              index={currentIndex}
                              answer={currentAnswer}
                              onAnswer={(patch) =>
                                  setAnswer(currentQuestion.attemptQuestionId, patch)
                              }
                          />
                      )
                  ) : null}
                </main>

                <aside className="hidden min-h-0 w-64 shrink-0 overflow-hidden rounded-2xl border bg-background p-4 lg:block">
                  {navigatorPanel}
                </aside>
              </>
          )}
        </div>

        <footer className="flex h-16 shrink-0 items-center justify-between gap-2 border-t bg-background px-4">
          <Button
              variant="outline"
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              disabled={currentIndex === 0}
          >
            <ChevronLeftIcon aria-hidden="true" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            {currentQuestion ? (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFlag(currentQuestion.attemptQuestionId)}
                    disabled={editingLocked}
                    aria-pressed={flagged.has(currentQuestion.attemptQuestionId)}
                >
                  <FlagIcon
                      className={cn(
                          flagged.has(currentQuestion.attemptQuestionId) &&
                          "fill-amber-400 text-amber-500"
                      )}
                      aria-hidden="true"
                  />
                  {flagged.has(currentQuestion.attemptQuestionId)
                      ? "Flagged"
                      : "Flag for review"}
                </Button>
            ) : null}
            {currentQuestion &&
            !answeredIds.has(currentQuestion.attemptQuestionId) &&
            currentIndex < questions.length - 1 ? (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipCurrent}
                    disabled={editingLocked}
                >
                  <SkipForwardIcon aria-hidden="true" />
                  Skip
                </Button>
            ) : null}
            <span className="hidden text-sm text-muted-foreground sm:block">
            {currentIndex + 1} / {questions.length}
          </span>
          </div>

          {currentIndex === questions.length - 1 ? (
              <Button
                  onClick={() => setFinishOpen(true)}
                  disabled={submitMutation.isPending}
              >
                Finish Attempt
              </Button>
          ) : (
              <Button
                  variant="outline"
                  onClick={() =>
                      setCurrentIndex((index) =>
                          Math.min(questions.length - 1, index + 1)
                      )
                  }
              >
                Next
                <ChevronRightIcon aria-hidden="true" />
              </Button>
          )}
        </footer>

        <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave this attempt?</AlertDialogTitle>
              <AlertDialogDescription>
                You have answered {answeredIds.size} of {questions.length}{" "}
                question(s)
                {flagged.size > 0 ? `, with ${flagged.size} flagged` : ""}. Your
                saved drafts stay on the server — you can resume this attempt
                later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Taking Assessment</AlertDialogCancel>
              <AlertDialogAction onClick={() => navigate(-1)}>
                Leave Attempt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={finishOpen} onOpenChange={setFinishOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit assessment?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <dt className="text-muted-foreground">Total items</dt>
                    <dd className="text-right tabular-nums">
                      {questions.length}
                    </dd>
                    <dt className="text-muted-foreground">Answered</dt>
                    <dd className="text-right tabular-nums">
                      {answeredIds.size}
                    </dd>
                    <dt className="text-muted-foreground">Unanswered</dt>
                    <dd className="text-right tabular-nums">
                      {questions.length - answeredIds.size}
                    </dd>
                    <dt className="text-muted-foreground">Flagged</dt>
                    <dd className="text-right tabular-nums">{flagged.size}</dd>
                    {/* Outcome-based and topped up across retakes, so the
                        exact award depends on how this attempt scores -- the
                        toast after submission reports what was actually
                        credited. */}
                    <dt className="text-muted-foreground">XP on completion</dt>
                    <dd className="text-right tabular-nums">
                      {ASSESSMENT_XP.attempted}–{ASSESSMENT_XP.perfect} XP
                    </dd>
                    {remainingSeconds != null ? (
                        <>
                          <dt className="text-muted-foreground">Time remaining</dt>
                          <dd className="text-right tabular-nums">
                            {formatClock(remainingSeconds)}
                          </dd>
                        </>
                    ) : null}
                  </dl>
                  {questions.length - answeredIds.size > 0 ? (
                      <p className="text-destructive">
                        Unanswered items may receive no score.
                      </p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitMutation.isPending}>
                Review Answers
              </AlertDialogCancel>
              <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault()
                    submitMutation.mutate()
                  }}
                  disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Assessment"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={timeUp && !submitMutation.isPending}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Time is up</AlertDialogTitle>
              <AlertDialogDescription>
                The time limit for this assessment has been reached. Editing is
                locked — submit your answers now.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault()
                    submitMutation.mutate()
                  }}
              >
                Submit Assessment
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  )
}
