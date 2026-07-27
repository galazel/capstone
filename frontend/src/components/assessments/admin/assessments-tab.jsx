import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  PencilIcon,
  Search,
  Trash2Icon,
  EyeIcon,
} from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  deleteExam,
  deleteExamQuestion,
  getAssessmentTypeLabel,
  getExamQuestions,
  getExamTypes,
  getExams,
} from "@/services/assessmentService.js"
import { getQuestions } from "@/services/questionService.js"
import AssessmentDialog from "./assessment-dialog.jsx"
import AssessmentPreviewDialog from "./assessment-preview-dialog.jsx"

const ASSESSMENT_FILTER_TYPES = [
  { value: "DIAGNOSTIC", label: "Diagnostic Exam" },
  { value: "LESSON_QUIZ", label: "Lesson Quiz" },
  { value: "MIDDLE_EXAM", label: "Middle Exam" },
  { value: "MAJOR_EXAM", label: "Major Exam" },
  { value: "MOCK_EXAM", label: "Mock Exam" },
]

function normalizeAssessmentType(value) {
  const type = String(value ?? "").trim().toUpperCase()

  if (type === "DIAGNOSTIC_EXAM") return "DIAGNOSTIC"
  if (type === "QUIZ") return "LESSON_QUIZ"
  if (type === "MODULE_EXAM" || type === "MIDDLE_CATEGORY_QUIZ") {
    return "MIDDLE_EXAM"
  }
  if (type === "MAJOR_CATEGORY_QUIZ" || type === "MAJOR_CATEGORY_EXAM") {
    return "MAJOR_EXAM"
  }
  if (type === "MOCK") return "MOCK_EXAM"

  return type
}

export function useAssessmentData(certificationId) {
  const examsQuery = useQuery({ queryKey: ["exams"], queryFn: () => getExams() })
  const examTypesQuery = useQuery({
    queryKey: ["exam-types"],
    queryFn: getExamTypes,
  })
  const examQuestionsQuery = useQuery({
    queryKey: ["exam-questions"],
    queryFn: getExamQuestions,
  })
  const questionsQuery = useQuery({
    queryKey: ["questions"],
    queryFn: () => getQuestions(),
  })

  return useMemo(() => {
    const exams = (Array.isArray(examsQuery.data) ? examsQuery.data : []).filter(
        (exam) => exam.certificationId === certificationId
    )
    const examTypeByIdText = new Map(
        (Array.isArray(examTypesQuery.data) ? examTypesQuery.data : []).map(
            (type) => [type.examTypeId, type.examTypeText]
        )
    )
    const examQuestions = Array.isArray(examQuestionsQuery.data)
        ? examQuestionsQuery.data
        : []
    const persistedExamQuestions = exams.flatMap((exam) =>
        Array.isArray(exam.questionIds)
            ? exam.questionIds.map((questionId, index) => ({
              examQuestionId: `${exam.examId}-${questionId}`,
              examId: exam.examId,
              questionId,
              displayOrder: index + 1,
            }))
            : []
    )
    const existingExamQuestionKeys = new Set(
        examQuestions.map(
            (examQuestion) => `${examQuestion.examId}-${examQuestion.questionId}`
        )
    )
    const displayedExamQuestions = [
      ...examQuestions,
      ...persistedExamQuestions.filter(
          (examQuestion) =>
              !existingExamQuestionKeys.has(
                  `${examQuestion.examId}-${examQuestion.questionId}`
              )
      ),
    ]
    const questionById = new Map(
        (Array.isArray(questionsQuery.data) ? questionsQuery.data : []).map(
            (question) => [question.questionId, question]
        )
    )
    return {
      exams,
      examTypeByIdText,
      examQuestions: displayedExamQuestions,
      questionById,
      isLoading:
          examsQuery.isLoading ||
          examTypesQuery.isLoading ||
          examQuestionsQuery.isLoading ||
          questionsQuery.isLoading,
      isError: examsQuery.isError,
      refetch: () => {
        examsQuery.refetch()
        examTypesQuery.refetch()
        examQuestionsQuery.refetch()
        questionsQuery.refetch()
      },
    }
  }, [
    certificationId,
    examsQuery.data,
    examsQuery.isLoading,
    examsQuery.isError,
    examTypesQuery.data,
    examTypesQuery.isLoading,
    examQuestionsQuery.data,
    examQuestionsQuery.isLoading,
    questionsQuery.data,
    questionsQuery.isLoading,
  ])
}

export default function AssessmentsTab({
                                         certification,
                                         createRequest,
                                         onCreateRequestHandled,
                                       }) {
  const queryClient = useQueryClient()
  const data = useAssessmentData(certification.certificationId)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [createPreset, setCreatePreset] = useState({
    type: "MOCK_EXAM",
    lessonId: null,
    middleCategoryId: null,
    majorCategoryId: null,
    title: "",
    lockPreset: false,
  })
  const handledCreateRequestRef = useRef(null)
  const [editTarget, setEditTarget] = useState(null)
  const [previewTarget, setPreviewTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Publishing-requirement buttons open the exact assessment or existing
  // invalid assessment that needs attention.
  useEffect(() => {
    if (!createRequest || data.isLoading) return

    const requestKey =
        createRequest.requestId ??
        `${createRequest.mode ?? "create"}-${createRequest.examId ?? ""}-${
            createRequest.type ?? ""
        }-${createRequest.lessonId ?? ""}-${
            createRequest.middleCategoryId ?? ""
        }-${createRequest.majorCategoryId ?? ""}`

    if (handledCreateRequestRef.current === requestKey) return
    handledCreateRequestRef.current = requestKey

    if (createRequest.mode === "edit") {
      const existingExam = data.exams.find(
          (exam) => String(exam.examId) === String(createRequest.examId)
      )

      if (existingExam) {
        setEditTarget(existingExam)
      } else {
        toast.error("The assessment could not be found. Refresh and try again.")
      }
    } else {
      setCreatePreset({
        type: createRequest.type ?? "MOCK_EXAM",
        lessonId: createRequest.lessonId ?? null,
        middleCategoryId: createRequest.middleCategoryId ?? null,
        majorCategoryId: createRequest.majorCategoryId ?? null,
        title: createRequest.title ?? "",
        lockPreset: createRequest.lockPreset ?? true,
      })
      setCreateOpen(true)
    }

    onCreateRequestHandled?.()
  }, [createRequest, data.exams, data.isLoading, onCreateRequestHandled])

  const deleteMutation = useMutation({
    mutationFn: async (exam) => {
      const related = data.examQuestions.filter(
          (examQuestion) => examQuestion.examId === exam.examId
      )
      await Promise.all(
          related.map((examQuestion) =>
              deleteExamQuestion(examQuestion.examQuestionId)
          )
      )
      await deleteExam(exam.examId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] })
      queryClient.invalidateQueries({ queryKey: ["exam-questions"] })
      queryClient.invalidateQueries({
        queryKey: [
          "certification-publishing-requirements",
          certification.certificationId,
        ],
      })
      toast.success("Assessment deleted.")
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error("Unable to delete the assessment. Please try again.")
    },
  })

  const rows = useMemo(() => {
    return data.exams
        .map((exam) => {
          const typeText = data.examTypeByIdText.get(exam.examTypeId)

          return {
            exam,
            typeText,
            normalizedType: normalizeAssessmentType(typeText),
            questionCount: data.examQuestions.filter(
                (examQuestion) => examQuestion.examId === exam.examId
            ).length,
          }
        })
        .filter((row) => {
          if (typeFilter !== "all" && row.normalizedType !== typeFilter) {
            return false
          }
          if (
              search.trim() &&
              !row.exam.title.toLowerCase().includes(search.trim().toLowerCase())
          ) {
            return false
          }
          return true
        })
  }, [data, search, typeFilter])

  const existingQuestionsFor = (exam) =>
      data.examQuestions.filter(
          (examQuestion) => examQuestion.examId === exam.examId
      )

  return (
      <div className="space-y-5">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Assessments
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage the assessments created from the Publishing requirements
            section. Missing assessments are created from their corresponding
            requirement button.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full max-w-xs">
            <span className="sr-only">Search assessments</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assessments"
                className="pl-9"
            />
          </label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]" aria-label="Type filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ASSESSMENT_FILTER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
        ) : data.isError ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Unable to load assessments.
              </p>
              <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={data.refetch}
              >
                Try again
              </Button>
            </div>
        ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-medium">
                {data.exams.length === 0
                    ? "No assessments yet"
                    : "No assessments match your filters"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {data.exams.length === 0
                    ? "Create the required diagnostic, lesson quizzes, middle exams, major exams, and mock exam from the Publishing requirements section."
                    : "Try adjusting your search or type filter."}
              </p>
            </div>
        ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Questions</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Passing</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ exam, typeText, questionCount }) => (
                      <TableRow key={exam.examId}>
                        <TableCell className="max-w-[280px] truncate font-medium">
                          {exam.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getAssessmentTypeLabel(typeText)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                              variant={
                                exam.status === "PUBLISHED"
                                    ? "default"
                                    : exam.status === "ARCHIVED"
                                        ? "outline"
                                        : "secondary"
                              }
                              className="capitalize"
                          >
                            {(exam.status ?? "DRAFT").toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {questionCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {exam.durationMinutes ? `${exam.durationMinutes}m` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {exam.passingScore != null
                              ? `${Number(exam.passingScore).toFixed(0)}%`
                              : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Preview ${exam.title}`}
                                onClick={() => setPreviewTarget(exam)}
                            >
                              <EyeIcon />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${exam.title}`}
                                onClick={() => setEditTarget(exam)}
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${exam.title}`}
                                onClick={() => setDeleteTarget(exam)}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        )}

        <AssessmentDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            mode="create"
            certification={certification}
            initialType={createPreset.type}
            initialLessonId={createPreset.lessonId}
            initialMiddleCategoryId={createPreset.middleCategoryId}
            initialMajorCategoryId={createPreset.majorCategoryId}
            initialTitle={createPreset.title}
            lockPreset={createPreset.lockPreset}
        />

        <AssessmentDialog
            open={editTarget != null}
            onOpenChange={(open) => {
              if (!open) setEditTarget(null)
            }}
            mode="edit"
            certification={certification}
            exam={editTarget}
            examTypeByIdText={data.examTypeByIdText}
            existingExamQuestions={
              editTarget ? existingQuestionsFor(editTarget) : []
            }
            questionById={data.questionById}
        />

        <AssessmentPreviewDialog
            open={previewTarget != null}
            onOpenChange={(open) => {
              if (!open) setPreviewTarget(null)
            }}
            exam={previewTarget}
            examTypeByIdText={data.examTypeByIdText}
            examQuestions={data.examQuestions}
            questionById={data.questionById}
        />

        <AlertDialog
            open={deleteTarget != null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null)
            }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.title}" and its question list will be permanently
                removed. Learner results already recorded are not affected. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault()
                    deleteMutation.mutate(deleteTarget)
                  }}
                  disabled={deleteMutation.isPending}
                  className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Assessment"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  )
}
