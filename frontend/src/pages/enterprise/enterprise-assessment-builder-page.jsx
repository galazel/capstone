import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  FileText,
  ListChecks,
  Loader2,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
} from "@/components/enterprise/enterprise-ui.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import { getEnterpriseGroupById } from "@/services/enterpriseService.js"
import { saveQuestion } from "@/services/questionService.js"
import {
  ASSESSMENT_TYPES,
  createExam,
  ensureExamType,
  getExamById,
  updateExam,
} from "@/services/assessmentService.js"

// Question types an Enterprise group can author here. These map 1:1 to what
// the questions API accepts (MCQ carries choices; the rest are text-answered).
const QUESTION_TYPES = [
  { id: "MCQ", title: "Multiple Choice", description: "Choose from answer options", icon: ListChecks },
  { id: "SHORT_ANSWER", title: "Short Answer", description: "Brief text response", icon: PenLine },
  { id: "DESCRIPTIVE", title: "Descriptive", description: "Written explanation", icon: FileText },
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

function newQuestion(questionType) {
  return {
    key: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    questionType,
    difficultyLevel: "average",
    questionText: "",
    points: "1",
    choices:
      questionType === "MCQ"
        ? [emptyChoice(), emptyChoice(), emptyChoice(), emptyChoice()]
        : [],
  }
}

/**
 * Lessons an assessment can anchor to, split into the group's own content and
 * the official curriculum -- a group may build assessments over either. The
 * assessment and its questions stay the group's own either way (ownerGroupId);
 * nothing is written back into the official curriculum.
 */
function splitLessons(certification, groupId) {
  const own = []
  const official = []
  for (const major of certification?.majorCategory ?? []) {
    const bucket = major.ownerGroupId === groupId ? own : official
    for (const middle of major.middleCategory ?? []) {
      for (const lesson of middle.lessons ?? []) {
        bucket.push({
          lessonId: lesson.lessonId,
          name: lesson.name ?? lesson.title ?? "Untitled lesson",
          middleTitle: middle.title,
          majorTitle: major.title,
        })
      }
    }
  }
  return { own, official }
}

/**
 * Dedicated page (not a modal) for an Enterprise group to build its own
 * assessment: details on the left, the authored questions in the centre, and
 * the question-type palette on the right -- the same three-column shape as the
 * admin question builder. Questions are written here and owned by the group;
 * the shared question bank is never read from or written to.
 */
export default function EnterpriseAssessmentBuilderPage() {
  const { groupId, examId } = useParams()
  const id = Number(groupId)
  const editingExamId = examId ? Number(examId) : null
  const isEdit = Number.isFinite(editingExamId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const [title, setTitle] = useState("")
  const [examTypeText, setExamTypeText] = useState(
    searchParams.get("type") ?? "QUIZ"
  )
  const [durationMinutes, setDurationMinutes] = useState("")
  const [passingScore, setPassingScore] = useState("70")
  const [lessonId, setLessonId] = useState("")
  const [questions, setQuestions] = useState([])
  const [error, setError] = useState("")
  const [hydrated, setHydrated] = useState(false)

  const groupQuery = useQuery({
    queryKey: ["enterprise-group", id],
    queryFn: () => getEnterpriseGroupById(id),
    enabled: Number.isFinite(id),
  })

  const certificationsQuery = useQuery({
    queryKey: ["certifications", "group", id],
    queryFn: () => getAllCertifications(id),
    enabled: Number.isFinite(id),
    staleTime: 5 * 60_000,
  })

  const examQuery = useQuery({
    queryKey: ["exam", editingExamId, id],
    queryFn: () => getExamById(editingExamId, id),
    enabled: isEdit,
  })

  const group = groupQuery.data
  const certification = (certificationsQuery.data ?? []).find(
    (item) =>
      item.certificationId === group?.certificationId ||
      item.certificationId === group?.orgCert?.certificationId
  )
  const { own: ownLessons, official: officialLessons } = useMemo(
    () => splitLessons(certification, id),
    [certification, id]
  )
  const lessons = useMemo(
    () => [...ownLessons, ...officialLessons],
    [ownLessons, officialLessons]
  )

  // Prefill the details when editing. Questions are authored fresh here, so an
  // edit changes the assessment's settings, not its existing question set.
  if (isEdit && !hydrated && examQuery.data) {
    const exam = examQuery.data
    setTitle(exam.title ?? "")
    setDurationMinutes(exam.durationMinutes != null ? String(exam.durationMinutes) : "")
    setPassingScore(exam.passingScore != null ? String(exam.passingScore) : "70")
    setLessonId(exam.lessonId != null ? String(exam.lessonId) : "")
    setHydrated(true)
  }

  const totalPoints = questions.reduce(
    (sum, question) => sum + (Number(question.points) || 0),
    0
  )

  const addQuestion = (questionType) =>
    setQuestions((current) => [...current, newQuestion(questionType)])

  const patchQuestion = (key, patch) =>
    setQuestions((current) =>
      current.map((question) => (question.key === key ? { ...question, ...patch } : question))
    )

  const removeQuestion = (key) =>
    setQuestions((current) => current.filter((question) => question.key !== key))

  const patchChoice = (key, index, patch) =>
    setQuestions((current) =>
      current.map((question) =>
        question.key === key
          ? {
              ...question,
              choices: question.choices.map((choice, i) =>
                i === index ? { ...choice, ...patch } : choice
              ),
            }
          : question
      )
    )

  const setCorrectChoice = (key, index) =>
    setQuestions((current) =>
      current.map((question) =>
        question.key === key
          ? {
              ...question,
              choices: question.choices.map((choice, i) => ({
                ...choice,
                correct: i === index,
              })),
            }
          : question
      )
    )

  const validate = () => {
    if (!title.trim()) return "Give the assessment a name."
    if (!lessonId) return "Choose the lesson this assessment belongs to."
    if (questions.length === 0) return "Add at least one question."
    for (const [index, question] of questions.entries()) {
      if (!question.questionText.trim()) {
        return `Question ${index + 1} needs its text.`
      }
      if (!(Number(question.points) > 0)) {
        return `Question ${index + 1} needs points greater than zero.`
      }
      if (question.questionType === "MCQ") {
        const filled = question.choices.filter((choice) => choice.choiceText.trim())
        if (filled.length < 2) return `Question ${index + 1} needs at least two choices.`
        if (!filled.some((choice) => choice.correct)) {
          return `Question ${index + 1} needs a correct answer marked.`
        }
      }
    }
    return ""
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const examType = await ensureExamType(examTypeText)

      // 1. Author each question as this group's own (ownerGroupId).
      const created = []
      for (const question of questions) {
        const saved = await saveQuestion(
          {
            questionType: question.questionType,
            difficultyLevel: question.difficultyLevel,
            questionText: question.questionText.trim(),
            lessonId: Number(lessonId),
            totalPoints: Number(question.points) || 1,
            choices:
              question.questionType === "MCQ"
                ? question.choices
                    .filter((choice) => choice.choiceText.trim())
                    .map((choice) => ({
                      choiceText: choice.choiceText.trim(),
                      correct: Boolean(choice.correct),
                      explanation: choice.explanation?.trim() || null,
                    }))
                : [],
          },
          id
        )
        created.push({ saved, points: Number(question.points) || 1 })
      }

      // 2. Attach them to the assessment, in order, with their points.
      const payload = {
        certificationId: certification.certificationId,
        examTypeId: examType.examTypeId,
        title: title.trim(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        totalQuestions: created.length,
        passingScore: passingScore ? Number(passingScore) : null,
        releaseAnswersAfterSubmit: true,
        targetScope: "LESSON",
        lessonId: Number(lessonId),
        questions: created.map((entry, index) => ({
          questionId: entry.saved.questionId,
          points: entry.points,
          displayOrder: index + 1,
        })),
      }

      return isEdit
        ? updateExam(editingExamId, { ...payload, examId: editingExamId })
        : createExam(payload, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] })
      toast.success(isEdit ? "Assessment updated." : "Assessment created.")
      navigate(`/enterprise/groups/${id}?tab=assessments`)
    },
    onError: (err) => {
      const message = backendMessage(err, "Unable to save this assessment.")
      setError(message)
      toast.error(message)
    },
  })

  const handleSave = () => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError("")
    saveMutation.mutate()
  }

  if (groupQuery.isLoading || certificationsQuery.isLoading || (isEdit && examQuery.isLoading)) {
    return <EnterpriseLoadingSkeleton />
  }
  if (groupQuery.isError) {
    return <EnterpriseErrorState title="Unable to load this group" onRetry={groupQuery.refetch} />
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/enterprise/groups/${id}?tab=assessments`)}
          >
            <ArrowLeftIcon className="size-4" />
            Cancel
          </Button>
          <h1 className="truncate font-heading text-base font-bold text-foreground">
            {isEdit ? "Edit assessment" : "Create assessment"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {questions.length} question{questions.length === 1 ? "" : "s"} · {totalPoints} pt
            {totalPoints === 1 ? "" : "s"}
          </span>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create assessment"
            )}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 md:grid-cols-[280px_minmax(0,1fr)_260px]">
        {/* LEFT: assessment details */}
        <aside className="min-h-0 space-y-4 overflow-y-auto border-b border-border p-4 md:border-b-0 md:border-r">
          <p className="text-sm font-medium text-foreground">Assessment details</p>

          <div className="space-y-1.5">
            <Label htmlFor="a-title">Name</Label>
            <Input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 1 Quiz"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-type">Exam type</Label>
            <Select value={examTypeText} onValueChange={setExamTypeText}>
              <SelectTrigger id="a-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="a-lesson">Lesson</Label>
            <Select value={lessonId} onValueChange={setLessonId} disabled={lessons.length === 0}>
              <SelectTrigger id="a-lesson">
                <SelectValue placeholder="Select a lesson" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {ownLessons.length ? (
                  <SelectGroup>
                    <SelectLabel>Your lessons</SelectLabel>
                    {ownLessons.map((lesson) => (
                      <SelectItem key={lesson.lessonId} value={String(lesson.lessonId)}>
                        {lesson.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {officialLessons.length ? (
                  <SelectGroup>
                    <SelectLabel>Curriculum lessons</SelectLabel>
                    {officialLessons.map((lesson) => (
                      <SelectItem key={lesson.lessonId} value={String(lesson.lessonId)}>
                        {lesson.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
            {lessons.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No lessons available yet — add your own in the{" "}
                <Link
                  to={`/enterprise/groups/${id}?tab=content`}
                  className="font-medium text-primary hover:underline"
                >
                  Content tab
                </Link>
                .
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick one of your own lessons or a curriculum lesson. The assessment stays your
                group&apos;s own either way.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-duration">Duration (min)</Label>
              <Input
                id="a-duration"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-passing">Passing grade (%)</Label>
              <Input
                id="a-passing"
                type="number"
                min="0"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
              />
            </div>
          </div>
        </aside>

        {/* CENTER: authored questions */}
        <main className="min-h-0 overflow-y-auto bg-muted/20 p-4">
          {questions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ListChecks className="size-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">No questions yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Pick a question type on the right to add your first question.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={question.key}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {index + 1}
                    </span>
                    <Badge variant="secondary">
                      {QUESTION_TYPES.find((t) => t.id === question.questionType)?.title ??
                        question.questionType}
                    </Badge>
                    <div className="ml-auto flex items-center gap-2">
                      <Label htmlFor={`pts-${question.key}`} className="text-xs">
                        Points
                      </Label>
                      <Input
                        id={`pts-${question.key}`}
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={question.points}
                        onChange={(e) => patchQuestion(question.key, { points: e.target.value })}
                        className="h-8 w-20"
                      />
                      <Select
                        value={question.difficultyLevel}
                        onValueChange={(value) =>
                          patchQuestion(question.key, { difficultyLevel: value })
                        }
                      >
                        <SelectTrigger className="h-8 w-28">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete question ${index + 1}`}
                        onClick={() => removeQuestion(question.key)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    value={question.questionText}
                    onChange={(e) =>
                      patchQuestion(question.key, { questionText: e.target.value })
                    }
                    placeholder="Write the question..."
                    rows={2}
                    className="mt-3"
                  />

                  {question.questionType === "MCQ" ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Choices — tick the correct one
                      </p>
                      {question.choices.map((choice, choiceIndex) => (
                        <div key={choiceIndex} className="flex items-center gap-2">
                          <Checkbox
                            checked={Boolean(choice.correct)}
                            onCheckedChange={() => setCorrectChoice(question.key, choiceIndex)}
                            aria-label={`Mark choice ${choiceIndex + 1} correct`}
                          />
                          <Input
                            value={choice.choiceText}
                            onChange={(e) =>
                              patchChoice(question.key, choiceIndex, {
                                choiceText: e.target.value,
                              })
                            }
                            placeholder={`Choice ${choiceIndex + 1}`}
                          />
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          patchQuestion(question.key, {
                            choices: [...question.choices, emptyChoice()],
                          })
                        }
                      >
                        <Plus className="size-3.5" />
                        Add choice
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* RIGHT: question type palette */}
        <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-border p-4 md:border-l md:border-t-0">
          <div>
            <p className="text-sm font-medium text-foreground">Add Question</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a type to add it to this assessment.
            </p>
          </div>
          <div className="space-y-2">
            {QUESTION_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => addQuestion(type.id)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {type.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {type.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}
