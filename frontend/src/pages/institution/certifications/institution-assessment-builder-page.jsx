import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeftIcon, ListChecks, Loader2 } from "@/components/icons"
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
  InstitutionErrorState,
  InstitutionLoadingSkeleton,
} from "@/components/institution/institution-ui.jsx"
import {
  QUESTION_TYPES,
  QuestionTypeButton,
  cloneQuestionData,
  createLocalId,
  saveAuthoredQuestion,
  validateQuestionData,
} from "@/components/questions/question-editors.jsx"
import { getAllCertifications } from "@/services/certificationService.js"
import { getInstitutionGroupById } from "@/services/institutionService.js"
import {
  getQuestions,
  saveChoices,
  saveDiagramQuestion,
  saveProgrammingQuestion,
  saveQuestion,
  saveTextQuestion,
} from "@/services/questionService.js"
import {
  INSTITUTION_ASSESSMENT_TYPES,
  createExam,
  ensureExamType,
  getDiagramQuestionConfig,
  getExamById,
  getExamQuestions,
  getExamTypes,
  getProgrammingQuestionConfig,
  getTextQuestionConfig,
  updateExam,
} from "@/services/assessmentService.js"

const QUESTION_API = { saveQuestion, saveChoices, saveTextQuestion, saveProgrammingQuestion, saveDiagramQuestion }

// What each exam type actually targets in the curriculum tree. Regardless of
// scope, authored questions still need a specific lesson (Question.lesson is
// mandatory) -- only what gets stored on the EXAM itself (lessonId vs
// middleCategoryId vs nothing) changes.
const EXAM_TYPE_SCOPES = {
  QUIZ: "LESSON",
  MODULE_EXAM: "MIDDLE_CATEGORY",
  MOCK_EXAM: "CERTIFICATION",
  PRACTICE_TEST: "LESSON",
  ASSIGNMENT: "LESSON",
}

function backendMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function isValidPoints(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0
}

/**
 * The curriculum as a Major Category -> Middle Category (module) -> Lesson
 * tree, split into the group's own content and the official curriculum -- a
 * group may build assessments over either. Ownership is decided at the major
 * category level and inherited by everything under it. The assessment and
 * its questions stay the group's own either way (ownerGroupId); nothing is
 * written back into the official curriculum.
 */
function buildCurriculumTree(certification, groupId) {
  const own = []
  const official = []
  for (const major of certification?.majorCategory ?? []) {
    const bucket = major.ownerGroupId === groupId ? own : official
    bucket.push({
      majorCategoryId: major.majorCategoryId,
      title: major.title,
      middleCategories: (major.middleCategory ?? []).map((middle) => ({
        middleCategoryId: middle.middleCategoryId,
        title: middle.title,
        lessons: (middle.lessons ?? []).map((lesson) => ({
          lessonId: lesson.lessonId,
          name: lesson.name ?? lesson.title ?? "Untitled lesson",
        })),
      })),
    })
  }
  return { own, official }
}

/**
 * Rebuilds one editor-shaped { typeId, data } from its backend QuestionDto --
 * the reverse of saveAuthoredQuestion. MCQ choices come embedded on the
 * question itself; every other type needs its own config fetch, and
 * CRITICAL_THINKING is ambiguous on the DTO alone (Programming and Diagram
 * both use that questionType), so it's resolved by trying the programming
 * config first and falling back to the diagram config.
 */
async function reconstructQuestionData(question, allQuestions) {
  const difficulty = question.difficultyLevel ?? "average"
  const questionText = question.questionText ?? ""
  const imageKey = question.imageKey ?? null

  if (question.questionType === "MCQ") {
    const choices = (question.choices ?? []).map((choice) => ({
      choiceText: choice.choiceText ?? "",
      image: null,
      imageKey: choice.imageKey ?? null,
      explanation: choice.explanation ?? "",
      isCorrect: Boolean(choice.correct),
    }))
    const correctChoiceIndex = choices.findIndex((choice) => choice.isCorrect)
    return {
      typeId: "MCQ",
      data: {
        questionType: "MCQ",
        question: questionText,
        image: null,
        imageKey,
        choices,
        correctChoiceIndex: correctChoiceIndex === -1 ? null : correctChoiceIndex,
        difficulty,
      },
    }
  }

  if (question.questionType === "SHORT_ANSWER") {
    const config = await getTextQuestionConfig(question.questionId).catch(() => null)
    return {
      typeId: "SHORT_ANSWER",
      data: {
        questionType: "SHORT_ANSWER",
        question: questionText,
        image: null,
        imageKey,
        correctAnswer: config?.correctAnswer ?? "",
        checkingMethod: config?.checkingMethod ?? "EXACT_MATCH",
        difficulty,
      },
    }
  }

  if (question.questionType === "DESCRIPTIVE") {
    const config = await getTextQuestionConfig(question.questionId).catch(() => null)
    return {
      typeId: "DESCRIPTIVE",
      data: {
        questionType: "DESCRIPTIVE",
        question: questionText,
        image: null,
        imageKey,
        rubricBasedAnswer: config?.correctAnswer ?? "",
        checkingMethod: config?.checkingMethod ?? "AI_SEMANTIC",
        difficulty,
      },
    }
  }

  if (question.questionType === "CRITICAL_THINKING") {
    const subQuestions = allQuestions
      .filter((candidate) => candidate.parentQuestionId === question.questionId)
      .sort((a, b) => (a.questionId ?? 0) - (b.questionId ?? 0))

    const subQuestionData = []
    for (const sub of subQuestions) {
      const subConfig = await getTextQuestionConfig(sub.questionId).catch(() => null)
      subQuestionData.push({
        question: sub.questionText ?? "",
        correctAnswer: subConfig?.correctAnswer ?? "",
      })
    }

    const programmingConfig = await getProgrammingQuestionConfig(question.questionId).catch(() => null)
    if (programmingConfig) {
      return {
        typeId: "PROGRAMMING",
        data: {
          questionType: "CRITICAL_THINKING",
          criticalThinkingType: "PROGRAMMING",
          question: questionText,
          image: null,
          imageKey,
          starterCode: programmingConfig.starterCode ?? "",
          testCases: (programmingConfig.testCases ?? []).map((testCase) => ({
            inputData: testCase.inputData ?? "",
            expectedOutput: testCase.expectedOutput ?? "",
          })),
          subQuestions: subQuestionData,
          difficulty,
        },
      }
    }

    const diagramConfig = await getDiagramQuestionConfig(question.questionId).catch(() => null)
    if (diagramConfig) {
      let nodes = []
      let edges = []
      try {
        const parsed = JSON.parse(diagramConfig.referenceDiagramJson ?? "{}")
        nodes = parsed.nodes ?? []
        edges = parsed.edges ?? []
      } catch {
        // Reference diagram JSON couldn't be parsed -- fall back to an empty
        // node/edge set rather than failing the whole hydration.
      }
      return {
        typeId: "DIAGRAM",
        data: {
          questionType: "CRITICAL_THINKING",
          criticalThinkingType: "DIAGRAM",
          question: questionText,
          image: null,
          imageKey,
          diagramType: diagramConfig.diagramType ?? "ERD",
          instructions: diagramConfig.instructions ?? "",
          referenceDiagramXml: diagramConfig.referenceDiagramXml ?? "",
          referenceDiagramNodes: nodes,
          referenceDiagramEdges: edges,
          subQuestions: subQuestionData,
          difficulty,
        },
      }
    }
  }

  return null
}

/**
 * Dedicated page (not a modal) for an Institution group to build its own
 * assessment: details on the left, the authored questions in the centre, and
 * the question-type palette on the right -- the same three-column shape as
 * the admin question builder. The question editors themselves (MCQ, Short
 * Answer, Descriptive, Programming, Diagram -- with images, correct-answer
 * marking, test cases, sub-questions, and the diagram editor) are the exact
 * same components the admin Question Bank uses, reused via
 * components/questions/question-editors.jsx, with a points configuration
 * panel layered on top. Questions are written here and owned by the group;
 * the shared question bank is never read from or written to.
 *
 * Picking where the assessment lives is a Category -> Module -> Lesson
 * cascade: each level's options are scoped to whatever was picked above it
 * (e.g. choosing a module only offers the lessons inside that module),
 * regardless of exam type.
 */
export default function InstitutionAssessmentBuilderPage() {
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

  // Category (major) -> Module (middle) -> Lesson cascade.
  const [scopeMajorId, setScopeMajorId] = useState("")
  const [scopeMiddleId, setScopeMiddleId] = useState("")
  const [scopeLessonId, setScopeLessonId] = useState("")

  // Authored questions: { key, typeId, data } -- data shapes match QUESTION_TYPES.
  const [questions, setQuestions] = useState([])
  const [pointsMode, setPointsMode] = useState("SAME")
  const [samePoints, setSamePoints] = useState("1")
  const [pointsById, setPointsById] = useState({})

  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [questionsHydrated, setQuestionsHydrated] = useState(false)

  const groupQuery = useQuery({
    queryKey: ["institution-group", id],
    queryFn: () => getInstitutionGroupById(id),
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

  // Existing question content for an edit -- getExamQuestions() returns the
  // join rows for every exam (filtered down to this one below), and
  // getQuestions(id) returns this group's full question bank (with MCQ
  // choices embedded) to reconstruct editor-shaped data from.
  const examQuestionsQuery = useQuery({
    queryKey: ["exam-questions"],
    queryFn: getExamQuestions,
    enabled: isEdit,
  })
  const groupQuestionsQuery = useQuery({
    queryKey: ["questions", "group", id, "editor"],
    queryFn: () => getQuestions(id),
    enabled: isEdit && Number.isFinite(id),
  })
  const questionContentQuery = useQuery({
    queryKey: ["exam-question-content", editingExamId],
    queryFn: async () => {
      const rows = examQuestionsQuery.data
        .filter((row) => row.examId === editingExamId)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      const questionById = new Map(
        groupQuestionsQuery.data.map((question) => [question.questionId, question])
      )

      const reconstructed = []
      for (const row of rows) {
        const question = questionById.get(row.questionId)
        if (!question) continue
        const item = await reconstructQuestionData(question, groupQuestionsQuery.data)
        if (!item) continue
        reconstructed.push({
          key: createLocalId(),
          typeId: item.typeId,
          data: item.data,
          points: row.points != null ? String(row.points) : "1",
          existingQuestionId: question.questionId,
        })
      }
      return reconstructed
    },
    enabled: isEdit && Array.isArray(examQuestionsQuery.data) && Array.isArray(groupQuestionsQuery.data),
  })

  const group = groupQuery.data
  const certification = (certificationsQuery.data ?? []).find(
    (item) =>
      item.certificationId === group?.certificationId ||
      item.certificationId === group?.orgCert?.certificationId
  )

  const { own: ownMajors, official: officialMajors } = useMemo(
    () => buildCurriculumTree(certification, id),
    [certification, id]
  )
  const allMajors = useMemo(() => [...ownMajors, ...officialMajors], [ownMajors, officialMajors])

  const majorById = useMemo(
    () => new Map(allMajors.map((major) => [String(major.majorCategoryId), major])),
    [allMajors]
  )
  const middleIndex = useMemo(() => {
    const map = new Map()
    for (const major of allMajors) {
      for (const middle of major.middleCategories) {
        map.set(String(middle.middleCategoryId), { middle, majorId: String(major.majorCategoryId) })
      }
    }
    return map
  }, [allMajors])
  const lessonIndex = useMemo(() => {
    const map = new Map()
    for (const major of allMajors) {
      for (const middle of major.middleCategories) {
        for (const lesson of middle.lessons) {
          map.set(String(lesson.lessonId), {
            lesson,
            middleId: String(middle.middleCategoryId),
            majorId: String(major.majorCategoryId),
          })
        }
      }
    }
    return map
  }, [allMajors])

  const middleOptions = scopeMajorId ? majorById.get(scopeMajorId)?.middleCategories ?? [] : []
  const lessonOptions = scopeMiddleId ? middleIndex.get(scopeMiddleId)?.middle.lessons ?? [] : []

  const handleMajorChange = (value) => {
    setScopeMajorId(value)
    setScopeMiddleId("")
    setScopeLessonId("")
  }
  const handleMiddleChange = (value) => {
    setScopeMiddleId(value)
    setScopeLessonId("")
  }

  const scope = EXAM_TYPE_SCOPES[examTypeText] ?? "LESSON"

  // Prefill the details when editing.
  if (isEdit && !hydrated && examQuery.data && Array.isArray(examTypesQuery.data) && certification) {
    const exam = examQuery.data
    const examType = examTypesQuery.data.find((t) => t.examTypeId === exam.examTypeId)
    setTitle(exam.title ?? "")
    setExamTypeText(examType?.examTypeText ?? examTypeText)
    setDurationMinutes(exam.durationMinutes != null ? String(exam.durationMinutes) : "")
    setPassingScore(exam.passingScore != null ? String(exam.passingScore) : "70")

    if (exam.lessonId != null) {
      const chain = lessonIndex.get(String(exam.lessonId))
      setScopeLessonId(String(exam.lessonId))
      setScopeMiddleId(chain?.middleId ?? "")
      setScopeMajorId(chain?.majorId ?? "")
    } else if (exam.middleCategoryId != null) {
      const chain = middleIndex.get(String(exam.middleCategoryId))
      setScopeMiddleId(String(exam.middleCategoryId))
      setScopeMajorId(chain?.majorId ?? "")
    } else if (exam.majorCategoryId != null) {
      setScopeMajorId(String(exam.majorCategoryId))
    }
    setHydrated(true)
  }

  // Prefill the questions themselves once their content has been
  // reconstructed from the backend -- MCQ choices, short-answer/descriptive
  // answers, programming test cases, diagram configs, and sub-questions.
  if (isEdit && !questionsHydrated && questionContentQuery.data) {
    setQuestions(
      questionContentQuery.data.map(({ key, typeId, data, existingQuestionId }) => ({
        key,
        typeId,
        data,
        existingQuestionId,
      }))
    )
    setPointsById(
      Object.fromEntries(questionContentQuery.data.map((question) => [question.key, question.points]))
    )
    setQuestionsHydrated(true)
  }
  // If the existing content couldn't be fetched, don't spin forever -- fall
  // back to an empty question list so the rest of the page still renders.
  if (
    isEdit &&
    !questionsHydrated &&
    (examQuestionsQuery.isError || groupQuestionsQuery.isError || questionContentQuery.isError)
  ) {
    setQuestionsHydrated(true)
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
    if (!scopeMajorId) return "Choose a category."
    if (!scopeMiddleId) return "Choose a module."
    if (!scopeLessonId) return "Choose a lesson to attach your questions to."
    if (questions.length === 0) return "Add at least one question."

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

      // Questions carried over from an existing assessment (reconstructed on
      // load, see reconstructQuestionData) already have a backend questionId
      // -- reuse it instead of re-authoring it, or every save would create a
      // duplicate. Only genuinely new questions added this session are saved
      // via saveAuthoredQuestion, the same per-type calls the admin builder
      // uses. Every new question attaches to the chosen lesson regardless of
      // the exam's own scope, since a question always needs one.
      const finalQuestions = []
      for (const [index, question] of questions.entries()) {
        const points = Number(pointsById[question.key]) || 1
        if (question.existingQuestionId) {
          finalQuestions.push({
            questionId: question.existingQuestionId,
            points,
            displayOrder: index + 1,
          })
          continue
        }
        const saved = await saveAuthoredQuestion(
          question,
          {
            lessonId: Number(scopeLessonId),
            certificationId: certification.certificationId,
            totalPoints: points,
            ownerGroupId: id,
          },
          QUESTION_API
        )
        finalQuestions.push({ questionId: saved.questionId, points, displayOrder: index + 1 })
      }

      const payload = {
        certificationId: certification.certificationId,
        examTypeId: examType.examTypeId,
        title: title.trim(),
        isGenerated: false,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        passingScore: passingScore ? Number(passingScore) : null,
        releaseAnswersAfterSubmit: true,
        targetScope: scope,
        lessonId: scope === "LESSON" ? Number(scopeLessonId) : null,
        middleCategoryId: scope === "MIDDLE_CATEGORY" ? Number(scopeMiddleId) : null,
        majorCategoryId: scope === "MAJOR_CATEGORY" ? Number(scopeMajorId) : null,
        totalQuestions: finalQuestions.length,
        questions: finalQuestions,
      }

      return isEdit
        ? updateExam(editingExamId, { ...payload, examId: editingExamId })
        : createExam(payload, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] })
      queryClient.invalidateQueries({ queryKey: ["exam-questions"] })
      toast.success(isEdit ? "Assessment updated." : "Assessment created.")
      navigate(`/institution/groups/${id}?tab=assessments`)
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
    (isEdit && (examQuery.isLoading || examTypesQuery.isLoading || !questionsHydrated))
  ) {
    return <InstitutionLoadingSkeleton />
  }
  if (groupQuery.isError) {
    return <InstitutionErrorState title="Unable to load this group" onRetry={groupQuery.refetch} />
  }

  const scopeHint =
    scope === "MIDDLE_CATEGORY"
      ? "This assessment targets the whole module. The lesson below is only used to attach your questions."
      : scope === "CERTIFICATION"
        ? "This assessment covers the whole certification. The lesson below is only used to attach your questions."
        : "This assessment and its questions attach to the lesson you pick."

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/institution/groups/${id}?tab=assessments`)}
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

      {isEdit ? (
        <p className="flex items-start gap-1.5 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs leading-5 text-amber-700 dark:text-amber-400">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          You can add, remove, reorder, and repoint existing questions here. To change an existing
          question&apos;s own text or answers, remove it and add a replacement.
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
                {INSTITUTION_ASSESSMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {allMajors.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No categories available yet — add your own in the{" "}
              <Link
                to={`/institution/groups/${id}?tab=content`}
                className="font-medium text-primary hover:underline"
              >
                Content tab
              </Link>
              .
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="a-major">Category</Label>
                <Select value={scopeMajorId} onValueChange={handleMajorChange}>
                  <SelectTrigger id="a-major">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {ownMajors.length ? (
                      <SelectGroup>
                        <SelectLabel>Your categories</SelectLabel>
                        {ownMajors.map((major) => (
                          <SelectItem key={major.majorCategoryId} value={String(major.majorCategoryId)}>
                            {major.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                    {officialMajors.length ? (
                      <SelectGroup>
                        <SelectLabel>Curriculum categories</SelectLabel>
                        {officialMajors.map((major) => (
                          <SelectItem key={major.majorCategoryId} value={String(major.majorCategoryId)}>
                            {major.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="a-middle">Module</Label>
                <Select
                  value={scopeMiddleId}
                  onValueChange={handleMiddleChange}
                  disabled={!scopeMajorId || middleOptions.length === 0}
                >
                  <SelectTrigger id="a-middle">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {middleOptions.map((middle) => (
                      <SelectItem key={middle.middleCategoryId} value={String(middle.middleCategoryId)}>
                        {middle.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scopeMajorId && middleOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">This category has no modules yet.</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="a-lesson">Lesson</Label>
                <Select
                  value={scopeLessonId}
                  onValueChange={setScopeLessonId}
                  disabled={!scopeMiddleId || lessonOptions.length === 0}
                >
                  <SelectTrigger id="a-lesson">
                    <SelectValue placeholder="Select a lesson" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {lessonOptions.map((lesson) => (
                      <SelectItem key={lesson.lessonId} value={String(lesson.lessonId)}>
                        {lesson.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scopeMiddleId && lessonOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">This module has no lessons yet.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{scopeHint}</p>
                )}
              </div>
            </>
          )}

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
