import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheckIcon,
  PencilIcon,
  Search,
  Trash2Icon,
  EyeIcon,
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
import { Separator } from "@/components/ui/separator"
import {
  deleteExam,
  getAssessmentTypeLabel,
  getExamQuestions,
  getExamTypes,
  getExams,
} from "@/services/assessmentService.js"
import { getQuestions } from "@/services/questionService.js"
import AssessmentDialog from "./assessment-dialog.jsx"
import AssessmentPreviewDialog from "./assessment-preview-dialog.jsx"

// Matches the question bank's page size, so the two libraries page alike.
const PAGE_SIZE = 10

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

/**
 * The reads this tab is assembled from, declared once.
 *
 * <p>They live out here because the certification page warms them the moment
 * it opens, and a prefetch only lands in the cache the tab reads if the key and
 * the fetcher match it exactly. Written twice they would eventually differ by a
 * character, the prefetch would silently fill a cache nothing reads, and the
 * tab would go back to loading -- with nothing to show that it had.
 */
/* Kept, not re-fetched on sight.

   Two of these are whole-table reads -- every exam question and every question
   on the platform -- and they were on the client's defaults: stale immediately,
   dropped from the cache five minutes after the last component using them
   unmounted. So leaving the certification and coming back re-ran all four, and
   any detour longer than five minutes came back to skeleton rows, on data that
   changes when an admin edits an assessment and not otherwise.

   Fifteen minutes fresh, an hour before collection. Everything that writes
   here already invalidates these keys by hand (see the mutations below), so a
   change an admin makes still shows immediately -- what this stops is the
   re-fetching that no change prompted. */
const ASSESSMENT_CACHE = {
  staleTime: 15 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
}

/**
 * This certification's exams, filtered by the server rather than fetched whole
 * and filtered here.
 *
 * <p>The id is coerced to a number because the key must be byte-identical
 * between the page's prefetch (which has the id as a string, off the URL) and
 * the tab's read (which has it as a number, off the certification) -- keyed on
 * the raw value those are two different queries, and the tab would load from
 * scratch next to a warmed cache it never looks at.
 *
 * <p>Still under the "exams" key prefix, so every existing
 * {@code invalidateQueries(["exams"])} in the app still reaches it.
 */
function examsQueryFor(certificationId) {
  const id = certificationId == null ? null : Number(certificationId)
  return {
    queryKey: ["exams", id],
    queryFn: () => getExams(undefined, id),
    ...ASSESSMENT_CACHE,
  }
}

/* The two whole-platform reads. Only the edit and preview dialogs need them --
   the table is drawn entirely from the two reads above -- so they are kept out
   of the table's loading gate below and merely warmed in the background. */
const DETAIL_QUERIES = {
  examQuestions: {
    queryKey: ["exam-questions"],
    queryFn: getExamQuestions,
    ...ASSESSMENT_CACHE,
  },
  questions: { queryKey: ["questions"], queryFn: () => getQuestions(), ...ASSESSMENT_CACHE },
}

const EXAM_TYPES_QUERY = {
  queryKey: ["exam-types"],
  queryFn: getExamTypes,
  ...ASSESSMENT_CACHE,
}

/**
 * Warms the tab's cache ahead of the click that opens it.
 *
 * <p>Not awaited: this is work done on the chance the tab is opened, so it must
 * never hold up the page that starts it. If a fetch fails the tab simply loads
 * the way it used to -- {@code prefetchQuery} swallows the error rather than
 * caching one, so a warm-up failure cannot turn into an error state on a tab
 * the user has not even opened.
 */
export function prefetchAssessmentData(queryClient, certificationId) {
  if (certificationId != null) {
    void queryClient.prefetchQuery(examsQueryFor(certificationId))
  }
  void queryClient.prefetchQuery(EXAM_TYPES_QUERY)
  Object.values(DETAIL_QUERIES).forEach((query) => {
    void queryClient.prefetchQuery(query)
  })
}

export function useAssessmentData(certificationId) {
  const examsQuery = useQuery(examsQueryFor(certificationId))
  const examTypesQuery = useQuery(EXAM_TYPES_QUERY)
  const examQuestionsQuery = useQuery(DETAIL_QUERIES.examQuestions)
  const questionsQuery = useQuery(DETAIL_QUERIES.questions)

  return useMemo(() => {
    // The server already scoped this to the certification; the filter stays as
    // a guard for a cache entry written by some other caller under this key.
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
      /* Only what the table itself is drawn from.

         It used to also wait on the two whole-platform reads -- every exam
         question and every question in the bank -- which is why an admin sat
         on skeleton rows long after the handful of assessments on this page
         had arrived. Nothing in the table depends on them: the per-row
         question count comes off the exam's own questionIds. They gate only
         the dialogs that actually read them, via isDetailLoading. */
      isLoading: examsQuery.isLoading || examTypesQuery.isLoading,
      isDetailLoading: examQuestionsQuery.isLoading || questionsQuery.isLoading,
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

/**
 * The assessments workspace. It fills the height it is given and scrolls only
 * its own rows, so it must be laid out inside a flex column that has a bounded
 * height -- see the page that mounts it.
 */
export default function AssessmentsTab({
                                         certification,
                                         createRequest,
                                         onCreateRequestHandled,
                                       }) {
  const queryClient = useQueryClient()
  const data = useAssessmentData(certification.certificationId)

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [page, setPage] = useState(1)
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
    /* One request. This used to fire a DELETE per exam_questions row first,
       because the join rows were thought to block the exam delete on the FK --
       but ExamService.delete already clears them itself, in the same
       transaction, before deleting the exam. The per-row calls were doing that
       work twice over the network, and they needed the whole-platform
       exam-questions read loaded to know what to delete. */
    mutationFn: (exam) => deleteExam(exam.examId),
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
            // Off the exam's own questionIds, so the count is right as soon as
            // the exam list lands -- no waiting on the exam-questions read.
            questionCount: Array.isArray(exam.questionIds)
                ? exam.questionIds.length
                : 0,
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

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  const paginatedRows = useMemo(
      () => rows.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE),
      [rows, page]
  )

  /* Filtering down to fewer pages than you are standing on leaves you looking
     at an empty table with rows above it. Clamping to the last page that still
     exists is what the question bank does, and for the same reason. */
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  const existingQuestionsFor = (exam) =>
      data.examQuestions.filter(
          (examQuestion) => examQuestion.examId === exam.examId
      )

  return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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

        {/* One bordered surface for the list, and the only thing here that
            scrolls. The filters stay put above it and the rows move under a
            header that stays with them -- the same shell the question bank
            uses, so the two libraries behave alike. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-background">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-2">
            <h3 className="text-sm font-semibold text-foreground">
              Assessment library
            </h3>

            <Badge
                variant="secondary"
                className="w-fit rounded-md px-2 py-0.5 text-xs"
            >
              {data.isLoading ? "Loading" : `${rows.length} total`}
            </Badge>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <Table className="min-w-[880px] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/35">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-72">Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Passing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* Every non-row state inside the table rather than instead of
                    it: the columns stay on screen while the rows are loading,
                    missing or filtered away, so the surface does not resize
                    under the cursor each time the list changes. */}
                {data.isLoading || data.isError || paginatedRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="h-[390px]">
                        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <ClipboardCheckIcon className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <h3 className="mt-4 font-heading text-base font-bold text-foreground">
                            {data.isError
                                ? "Assessments could not be loaded"
                                : data.isLoading
                                    ? "Loading assessments"
                                    : data.exams.length === 0
                                        ? "No assessments yet"
                                        : "No assessments found"}
                          </h3>

                          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                            {data.isError
                                ? "Check the API connection and try again."
                                : data.isLoading
                                    ? "Fetching this certification's assessments."
                                    : data.exams.length === 0
                                        ? "Create the required diagnostic, lesson quizzes, middle exams, major exams, and mock exam from the Publishing requirements section on the certification page."
                                        : "Try adjusting your search or type filter."}
                          </p>

                          {data.isError ? (
                              <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-4"
                                  onClick={data.refetch}
                              >
                                Try again
                              </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                ) : (
                    paginatedRows.map(({ exam, typeText, questionCount }) => (
                        <TableRow key={exam.examId}>
                          {/* Titled, so a name too long for the column can
                              still be read -- it truncates with no other way
                              to see the rest. Same treatment the question
                              bank gives its question text. */}
                          <TableCell className="max-w-[360px]">
                            <p
                                className="truncate font-medium text-foreground"
                                title={exam.title}
                            >
                              {exam.title}
                            </p>
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
                    ))
                )}
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div className="flex shrink-0 flex-col gap-2 bg-muted/20 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              {rows.length} assessment{rows.length === 1 ? "" : "s"} for{" "}
              {certification?.title ?? "this certification"}
            </p>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="First page"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>

              <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button type="button" variant="outline" size="sm" disabled>
                {page} / {pageCount}
              </Button>

              <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next page"
                  disabled={page >= pageCount}
                  onClick={() =>
                      setPage((current) => Math.min(pageCount, current + 1))
                  }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Last page"
                  disabled={page >= pageCount}
                  onClick={() => setPage(pageCount)}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

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
