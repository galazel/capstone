import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeftIcon, ListChecks, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
import {
  QUESTION_TYPES,
  QuestionTypeButton,
  cloneQuestionData,
  createLocalId,
  saveAuthoredQuestion,
  validateQuestionData,
} from "@/components/questions/question-editors.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import { getEnterpriseGroupById } from "@/services/enterpriseService.js"
import {
  saveChoices,
  saveDiagramQuestion,
  saveProgrammingQuestion,
  saveQuestion,
  saveTextQuestion,
} from "@/services/questionService.js"
import {
  ENTERPRISE_ASSESSMENT_TYPES,
  createExam,
  ensureExamType,
  getExamById,
  getExamTypes,
  updateExam,
} from "@/services/assessmentService.js"

const QUESTION_API = { saveQuestion, saveChoices, saveTextQuestion, saveProgrammingQuestion, saveDiagramQuestion }

function backendMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function isValidPoints(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0
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
 * the question-type palette on the right -- the same three-column shape as
 * the admin question builder. The question editors themselves (MCQ, Short
 * Answer, Descriptive, Programming, Diagram -- with images, correct-answer
 * marking, test cases, sub-questions, and the diagram editor) are the exact
 * same components the admin Question Bank uses, reused via
 * components/questions/question-editors.jsx, with a points configuration
 * panel layered on top. Questions are written here and owned by the group;
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
  const [examTypeText, setExamTypeText] = useState(searchParams.get("type") ?? "QUIZ")
  const [durationMinutes, setDurationMinutes] = useState("")
  const [passingScore, setPassingScore] = useState("70")
  const [lessonId, setLessonId] = useState("")

  // Authored questions: { key, typeId, data } -- data shapes match QUESTION_TYPES.
  const [questions, setQuestions] = useState([])
  const [pointsMode, setPointsMode] = useState("SAME")
  const [samePoints, setSamePoints] = useState("1")
  const [pointsById, setPointsById] = useState({})

  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
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

  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: getExamTypes,
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
  const lessons = useMemo(() => [...ownLessons, ...officialLessons], [ownLessons, officialLessons])

  // Prefill the details when editing. Existing questions aren't re-editable
  // here (see the notice near Save) -- any new questions authored this
  // session are additions on top of the assessment's current settings.
  if (isEdit && !hydrated && examQuery.data && Array.isArray(examTypesQuery.data)) {
    const exam = examQuery.data
    const examType = examTypesQuery.data.find((t) => t.examTypeId === exam.examTypeId)
    setTitle(exam.title ?? "")
    setExamTypeText(examType?.examTypeText ?? examTypeText)
    setDurationMinutes(exam.durationMinutes != null ? String(exam.durationMinutes) : "")
    setPassingScore(exam.passingScore != null ? String(exam.passingScore) : "70")
    setLessonId(exam.lessonId != null ? String(exam.lessonId) : "")
    setHydrated(true)
  }

  const totalPoints = questions.reduce(
    (sum, question) => sum + (Number(pointsById[question.key]) || 0),
    0
  )

  const addQuestion = (questionType) => {
    const key = createLocalId()
    setQuestions((current) => [
      ...current,
      { key, typeId: questionType.id, data: cloneQuestionData(questionType.data) },
    ])
    setPointsById((current) => ({
      ...current,
      [key]: pointsMode === "SAME" ? samePoints : "1",
    }))
  }

  const removeQuestion = (key) => {
    setQuestions((current) => current.filter((question) => question.key !== key))
    setPointsById((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const updateQuestionData = (key, updater) =>
    setQuestions((current) =>
      current.map((question) =>
        question.key === key
          ? { ...question, data: typeof updater === "function" ? updater(question.data) : updater }
          : question
      )
    )

  const setOnePoint = (key, value) =>
    setPointsById((current) => ({ ...current, [key]: value }))

  const applySamePoints = (value) =>
    setPointsById(() => Object.fromEntries(questions.map((question) => [question.key, value])))

  const handlePointsModeChange = (nextMode) => {
    if (nextMode === pointsMode) return
    setPointsMode(nextMode)
    if (nextMode === "SAME" && isValidPoints(samePoints)) {
      applySamePoints(Number(samePoints))
    }
  }

  const perQuestionErrors = useMemo(() => {
    if (!submitted) return {}
    return Object.fromEntries(
      questions.map((question) => [question.key, validateQuestionData(question.typeId, question.data)])
    )
  }, [submitted, questions])

  const validate = () => {
    if (!title.trim()) return "Give the assessment a name."
    if (!lessonId) return "Choose the lesson this assessment belongs to."
    if (!isEdit && questions.length === 0) return "Add at least one question."

    for (const [index, question] of questions.entries()) {
      const errors = validateQuestionData(question.typeId, question.data)
      if (Object.keys(errors).length > 0) {
        return `Question ${index + 1} has missing or invalid fields.`
      }
      if (!isValidPoints(pointsById[question.key])) {
        return `Question ${index + 1} needs points greater than zero.`
      }
    }
    return ""
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const examType = await ensureExamType(examTypeText)

      // Author each new question as this group's own (ownerGroupId), reusing
      // the exact same per-type save calls the admin builder uses.
      const created = []
      for (const question of questions) {
        const saved = await saveAuthoredQuestion(
          question,
          {
            lessonId: Number(lessonId),
            certificationId: certification.certificationId,
            totalPoints: Number(pointsById[question.key]) || 1,
            ownerGroupId: id,
          },
          QUESTION_API
        )
        created.push({ questionId: saved.questionId, points: Number(pointsById[question.key]) || 1 })
      }

      const payload = {
        certificationId: certification.certificationId,
        examTypeId: examType.examTypeId,
        title: title.trim(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        passingScore: passingScore ? Number(passingScore) : null,
        releaseAnswersAfterSubmit: true,
        targetScope: "LESSON",
        lessonId: Number(lessonId),
      }

      if (created.length > 0) {
        // New questions this session become (or add to) the exam's question
        // set. On create this is the whole set; on edit with no prior
        // questions preserved server-side view, this replaces it (see the
        // notice near Save).
        payload.totalQuestions = created.length
        payload.questions = created.map((entry, index) => ({
          questionId: entry.questionId,
          points: entry.points,
          displayOrder: index + 1,
        }))
      } else if (isEdit) {
        // Settings-only edit -- omit questions/questionIds entirely so the
        // backend leaves the existing question set untouched, and echo back
        // the exam's real count so it isn't reset.
        payload.totalQuestions = examQuery.data?.totalQuestions ?? 0
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
    setSubmitted(true)
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError("")
    saveMutation.mutate()
  }

  if (
    groupQuery.isLoading ||
    certificationsQuery.isLoading ||
    (isEdit && (examQuery.isLoading || examTypesQuery.isLoading))
  ) {
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
        <p
          className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {isEdit && questions.length > 0 ? (
        <p className="flex items-start gap-1.5 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs leading-5 text-amber-700 dark:text-amber-400">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          Saving will replace this assessment&apos;s entire question set with the ones you&apos;ve
          added here.
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
                {ENTERPRISE_ASSESSMENT_TYPES.map((type) => (
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

          {/* Points configuration -- same SAME/INDIVIDUAL pattern as the
              admin assessment builder's question-points panel. */}
          <div className="rounded-xl border p-3">
            <h4 className="text-sm font-semibold">Question points</h4>
            <RadioGroup value={pointsMode} onValueChange={handlePointsModeChange} className="mt-3 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="SAME" />
                Same points for all questions
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="INDIVIDUAL" />
                Configure points for each question
              </label>
            </RadioGroup>

            {pointsMode === "SAME" ? (
              <div className="mt-3 flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="a-same-points" className="text-xs">
                    Points per question
                  </Label>
                  <Input
                    id="a-same-points"
                    type="number"
                    min="0.01"
                    step="0.5"
                    value={samePoints}
                    onChange={(e) => {
                      const next = e.target.value
                      setSamePoints(next)
                      if (isValidPoints(next)) applySamePoints(Number(next))
                    }}
                    className="h-9 w-24"
                    aria-invalid={!isValidPoints(samePoints)}
                  />
                </div>
                {!isValidPoints(samePoints) ? (
                  <p className="pb-1 text-xs text-destructive">Points must be greater than zero.</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Set each question&apos;s points in its card in the centre column.
              </p>
            )}
          </div>
        </aside>

        {/* CENTER: authored questions, using the exact admin question editors */}
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
              {questions.map((question, index) => {
                const questionType = QUESTION_TYPES.find((t) => t.id === question.typeId)
                const Editor = questionType?.component
                if (!Editor) return null

                const pointsInput = (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Label htmlFor={`pts-${question.key}`} className="text-xs text-muted-foreground">
                      Points
                    </Label>
                    <Input
                      id={`pts-${question.key}`}
                      type="number"
                      min="0.01"
                      step="0.5"
                      readOnly={pointsMode === "SAME"}
                      disabled={pointsMode === "SAME"}
                      value={pointsById[question.key] ?? ""}
                      onChange={(e) => setOnePoint(question.key, e.target.value)}
                      className="h-8 w-20"
                      aria-label={`Points for question ${index + 1}`}
                    />
                  </div>
                )

                return (
                  <Editor
                    key={question.key}
                    questionKey={question.key}
                    questionNumber={index + 1}
                    onRemove={() => removeQuestion(question.key)}
                    data={question.data}
                    onDataChange={(updater) => updateQuestionData(question.key, updater)}
                    errors={perQuestionErrors[question.key] ?? {}}
                    headerExtra={pointsInput}
                  />
                )
              })}
            </div>
          )}
        </main>

        {/* RIGHT: question type palette -- the same five types as admin */}
        <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-border p-4 md:border-l md:border-t-0">
          <div>
            <p className="text-sm font-medium text-foreground">Add Question</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a type to add it to this assessment.
            </p>
          </div>
          <div className="space-y-2">
            {QUESTION_TYPES.map((questionType) => (
              <QuestionTypeButton key={questionType.id} questionType={questionType} onAdd={addQuestion} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
