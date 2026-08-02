import { useEffect, useMemo, useState } from "react"
import { useOutletContext, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileQuestionIcon, Loader2, Plus, Trash2 } from "@/components/icons"
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
} from "@/components/enterprise/enterprise-ui.jsx"
import { useAuth } from "@/context/auth-context.jsx"
import { useEnterpriseData } from "@/hooks/use-enterprise-data.js"
import { getAllCertifications } from "@/services/certificationService.js"
import {
  deleteQuestion,
  getQuestionsByLesson,
  saveQuestion,
  updateQuestion,
} from "@/services/questionService.js"

const QUESTION_TYPES = [
  { value: "MCQ", label: "Multiple Choice" },
  { value: "SHORT_ANSWER", label: "Short Answer" },
  { value: "DESCRIPTIVE", label: "Descriptive" },
  { value: "CRITICAL_THINKING", label: "Critical Thinking" },
]

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "average", label: "Average" },
  { value: "hard", label: "Hard" },
]

function backendMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function emptyChoice() {
  return { choiceText: "", correct: false, explanation: "" }
}

function QuestionFormDialog({ open, onOpenChange, lessonId, editingQuestion, groupId }) {
  const queryClient = useQueryClient()
  const isEditing = editingQuestion != null

  const [questionType, setQuestionType] = useState("MCQ")
  const [difficultyLevel, setDifficultyLevel] = useState("average")
  const [questionText, setQuestionText] = useState("")
  const [totalPoints, setTotalPoints] = useState("1")
  const [choices, setChoices] = useState([emptyChoice(), emptyChoice()])
  const [error, setError] = useState("")

  const reset = () => {
    setQuestionType("MCQ")
    setDifficultyLevel("average")
    setQuestionText("")
    setTotalPoints("1")
    setChoices([emptyChoice(), emptyChoice()])
    setError("")
  }

  // Load the question being edited once, when the dialog opens for it.
  useMemo(() => {
    if (editingQuestion && open) {
      setQuestionType(editingQuestion.questionType ?? "MCQ")
      setDifficultyLevel(editingQuestion.difficultyLevel ?? "average")
      setQuestionText(editingQuestion.questionText ?? "")
      setTotalPoints(String(editingQuestion.totalPoints ?? "1"))
      setChoices(
        editingQuestion.choices?.length
          ? editingQuestion.choices.map((c) => ({
              choiceText: c.choiceText ?? "",
              correct: Boolean(c.correct),
              explanation: c.explanation ?? "",
            }))
          : [emptyChoice(), emptyChoice()]
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingQuestion, open])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        questionType,
        difficultyLevel,
        questionText: questionText.trim(),
        lessonId,
        totalPoints: Number(totalPoints) || 1,
        choices: questionType === "MCQ" ? choices.filter((c) => c.choiceText.trim()) : [],
      }
      return isEditing
        ? updateQuestion(editingQuestion.questionId, payload)
        // Authored for this group when opened in a group context, so it stays
        // private to them rather than joining the official question bank.
        : saveQuestion(payload, groupId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-questions", lessonId, groupId ?? null] })
      toast.success(isEditing ? "Question updated." : "Question added.")
      reset()
      onOpenChange(false)
    },
    onError: (err) => {
      const message = backendMessage(err, "Unable to save this question.")
      setError(message)
      toast.error(message)
    },
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!questionText.trim()) {
      setError("Enter the question text.")
      return
    }
    if (questionType === "MCQ") {
      const filled = choices.filter((c) => c.choiceText.trim())
      if (filled.length < 2) {
        setError("Add at least two answer choices.")
        return
      }
      if (!filled.some((c) => c.correct)) {
        setError("Mark at least one choice as correct.")
        return
      }
    }
    saveMutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit question" : "Add question"}</DialogTitle>
          <DialogDescription>
            This question is added to your organization's copy of the question bank for
            this lesson.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Question type</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficultyLevel} onValueChange={setDifficultyLevel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="question-text">Question</Label>
            <Textarea
              id="question-text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              placeholder="What does..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="question-points">Points</Label>
            <Input
              id="question-points"
              type="number"
              min="0.5"
              step="0.5"
              className="w-28"
              value={totalPoints}
              onChange={(e) => setTotalPoints(e.target.value)}
            />
          </div>

          {questionType === "MCQ" ? (
            <div className="space-y-2">
              <Label>Answer choices</Label>
              {choices.map((choice, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Checkbox
                    checked={choice.correct}
                    onCheckedChange={(checked) =>
                      setChoices((current) =>
                        current.map((c, i) =>
                          i === index ? { ...c, correct: Boolean(checked) } : c
                        )
                      )
                    }
                    className="mt-2.5"
                    aria-label="Correct answer"
                  />
                  <Input
                    value={choice.choiceText}
                    onChange={(e) =>
                      setChoices((current) =>
                        current.map((c, i) =>
                          i === index ? { ...c, choiceText: e.target.value } : c
                        )
                      )
                    }
                    placeholder={`Choice ${index + 1}`}
                  />
                  {choices.length > 2 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setChoices((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              ))}
              {choices.length < 6 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setChoices((current) => [...current, emptyChoice()])}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add choice
                </Button>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Add question"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The question bank itself, without the page chrome.
 *
 * `certificationId` locks the panel to one certification and hides the
 * certification picker -- that is how the certification detail page embeds it,
 * so authors never have to re-select the certification they are already in.
 * Left null (the standalone page) the picker is shown as before.
 */
export function EnterpriseQuestionBankPanel({
  certificationId = null,
  initialCertificationId = "",
  initialLessonId = "",
  autoOpenAdd = false,
  groupId,
}) {
  const { enterprise } = useOutletContext()
  const { user } = useAuth()
  const enterpriseId = enterprise?.enterpriseId
  const data = useEnterpriseData(enterpriseId)

  const lockedCertId = certificationId ? String(certificationId) : ""
  const isLockedToCertification = Boolean(lockedCertId)
  const startingCertId =
    lockedCertId || (initialCertificationId ? String(initialCertificationId) : "")

  const [selectedCertId, setSelectedCertId] = useState(startingCertId)
  const [selectedLessonId, setSelectedLessonId] = useState(
    initialLessonId ? String(initialLessonId) : ""
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const queryClient = useQueryClient()

  // Handed a certification (and lesson) by the caller -- and, for the one-click
  // "Add question" affordance next to a lesson, the form ready to go.
  useEffect(() => {
    if (startingCertId) {
      setSelectedCertId(startingCertId)
    }
    if (initialLessonId) {
      setSelectedLessonId(String(initialLessonId))
    }
    if (autoOpenAdd && initialLessonId) {
      setEditingQuestion(null)
      setFormOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingCertId, initialLessonId, autoOpenAdd])

  const certificationsQuery = useQuery({
    queryKey: ["certifications-full"],
    queryFn: () => getAllCertifications(),
    staleTime: 5 * 60 * 1000,
  })

  // Only certifications this organization has actually purchased access to --
  // matches the backend's enforcement in QuestionService.
  const accessibleCertifications = useMemo(() => {
    const certById = new Map(
      (certificationsQuery.data ?? []).map((c) => [c.certificationId, c])
    )
    return data.orgCerts
      .map((orgCert) => certById.get(orgCert.certificationId))
      .filter(Boolean)
  }, [certificationsQuery.data, data.orgCerts])

  const lessonOptions = useMemo(() => {
    const cert = accessibleCertifications.find(
      (c) => String(c.certificationId) === selectedCertId
    )
    if (!cert) return []
    const options = []
    for (const major of cert.majorCategory ?? []) {
      for (const middle of major.middleCategory ?? []) {
        for (const lesson of middle.lessons ?? []) {
          options.push({
            lessonId: lesson.lessonId,
            label: `${major.title} / ${middle.title} / ${lesson.name}`,
          })
        }
      }
    }
    return options
  }, [accessibleCertifications, selectedCertId])

  const questionsQuery = useQuery({
    queryKey: ["enterprise-questions", selectedLessonId, groupId ?? null],
    queryFn: () => getQuestionsByLesson(selectedLessonId, groupId),
    enabled: !!selectedLessonId,
  })

  const questions = Array.isArray(questionsQuery.data) ? questionsQuery.data : []

  const deleteMutation = useMutation({
    mutationFn: (questionId) => deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["enterprise-questions", selectedLessonId, groupId ?? null],
      })
      toast.success("Question deleted.")
      setDeleteTarget(null)
    },
    onError: (err) => {
      toast.error(backendMessage(err, "Unable to delete this question."))
      setDeleteTarget(null)
    },
  })

  return (
    <div className="space-y-6">
      <div
        className={`grid gap-3 ${isLockedToCertification ? "" : "sm:grid-cols-2"}`}
      >
        {isLockedToCertification ? null : (
          <div className="space-y-1.5">
            <Label>Certification</Label>
            <Select
              value={selectedCertId}
              onValueChange={(value) => {
                setSelectedCertId(value)
                setSelectedLessonId("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a certification" />
              </SelectTrigger>
              <SelectContent>
                {accessibleCertifications.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No certification access yet
                  </SelectItem>
                ) : (
                  accessibleCertifications.map((cert) => (
                    <SelectItem key={cert.certificationId} value={String(cert.certificationId)}>
                      {cert.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Lesson</Label>
          <Select
            value={selectedLessonId}
            onValueChange={setSelectedLessonId}
            disabled={!selectedCertId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a lesson" />
            </SelectTrigger>
            <SelectContent>
              {lessonOptions.length === 0 ? (
                <SelectItem value="none" disabled>
                  No lessons available
                </SelectItem>
              ) : (
                lessonOptions.map((lesson) => (
                  <SelectItem key={lesson.lessonId} value={String(lesson.lessonId)}>
                    {lesson.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedLessonId ? (
        <EnterpriseEmptyState
          icon={FileQuestionIcon}
          title={
            isLockedToCertification ? "Select a lesson" : "Select a certification and lesson"
          }
          description="Questions are added within a specific lesson."
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingQuestion(null)
                setFormOpen(true)
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add question
            </Button>
          </div>

          {questionsQuery.isLoading ? (
            <EnterpriseLoadingSkeleton rows={3} />
          ) : questions.length === 0 ? (
            <EnterpriseEmptyState
              icon={FileQuestionIcon}
              title="No questions yet"
              description="Add the first question for this lesson."
            />
          ) : (
            <div className="space-y-3">
              {questions.map((question) => {
                const isMine = question.createdByUserId === user?.userId
                return (
                  <Card key={question.questionId}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium">{question.questionText}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline">
                            {QUESTION_TYPES.find((t) => t.value === question.questionType)
                              ?.label ?? question.questionType}
                          </Badge>
                          <Badge variant="outline">
                            {DIFFICULTIES.find((d) => d.value === question.difficultyLevel)
                              ?.label ?? question.difficultyLevel}
                          </Badge>
                          <span>{question.totalPoints} pt(s)</span>
                          <span>
                            · {question.createdByEmail
                              ? `Added by ${question.createdByEmail}`
                              : "Platform question"}
                          </span>
                        </div>
                      </div>
                      {isMine ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingQuestion(question)
                              setFormOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(question)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : null}
                    </CardHeader>
                    {question.questionType === "MCQ" && question.choices?.length ? (
                      <CardContent className="pt-0">
                        <ul className="space-y-1 text-sm">
                          {question.choices.map((choice) => (
                            <li
                              key={choice.choiceId ?? choice.choiceText}
                              className={
                                choice.correct
                                  ? "font-medium text-emerald-700 dark:text-emerald-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {choice.correct ? "✓ " : "• "}
                              {choice.choiceText}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <QuestionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lessonId={Number(selectedLessonId) || null}
        editingQuestion={editingQuestion}
        groupId={groupId}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Questions already used in a published exam can't be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate(deleteTarget.questionId)
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete question"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function EnterpriseQuestionBankPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const enterpriseData = useEnterpriseData(enterprise?.enterpriseId)
  const [searchParams] = useSearchParams()

  const preselectedCertId = searchParams.get("certificationId")
  const preselectedLessonId = searchParams.get("lessonId")
  const shouldAutoOpenForm = searchParams.get("add") === "1"
  // Opened from a group workspace: questions authored here belong to that
  // group, and the list shows the group's own questions alongside official ones.
  const groupId = searchParams.get("groupId")
    ? Number(searchParams.get("groupId"))
    : undefined

  if (enterpriseLoading || (enterprise && enterpriseData.isLoading)) {
    return <EnterpriseLoadingSkeleton />
  }
  if (enterpriseError) {
    return <EnterpriseErrorState onRetry={refetchEnterprise} />
  }
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="The question bank appears here once your organization is registered."
      />
    )
  }

  return (
    <div className="space-y-6">
      <EnterprisePageHeader
        title="Question Bank"
        subtitle="Add questions to lessons within certifications your organization has access to. You can edit or delete only the questions you created."
      />

      <EnterpriseQuestionBankPanel
        initialCertificationId={preselectedCertId ?? ""}
        initialLessonId={preselectedLessonId ?? ""}
        autoOpenAdd={shouldAutoOpenForm}
        groupId={groupId}
      />
    </div>
  )
}
