import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "@/components/icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getQuestions } from "@/services/questionService.js"
import { getExamQuestions } from "@/services/assessmentService.js"

const QUESTION_TYPE_LABELS = {
  MCQ: "Multiple Choice",
  MULTIPLE_CHOICE: "Multiple Choice",
  DESCRIPTIVE: "Descriptive",
  SHORT_ANSWER: "Short Answer",
  CRITICAL_THINKING: "Critical Thinking",
  PROGRAMMING: "Programming",
  DIAGRAM: "Diagram",
}

// Builds lessonId -> { lesson, middleCategory, majorCategory } lookup from the
// certification tree so questions can be scoped and filtered per certification.
export function buildLessonIndex(certification) {
  const index = new Map()

  ;(certification?.majorCategory ?? []).forEach((majorCategory) => {
    ;(majorCategory.middleCategory ?? []).forEach((middleCategory) => {
      ;(middleCategory.lessons ?? []).forEach((lesson) => {
        index.set(lesson.lessonId, {
          lesson,
          middleCategory,
          majorCategory,
        })
      })
    })
  })

  return index
}

export default function AssessmentQuestionPickerDialog({
                                                         open,
                                                         onOpenChange,
                                                         certification,
                                                         alreadySelectedIds = new Set(),
                                                         onAddQuestions,
                                                         currentExamId = null,
                                                         initialLessonId = null,
                                                         initialMiddleCategoryId = null,
                                                         initialMajorCategoryId = null,
                                                         // When set, this group's own questions are
                                                         // offered alongside the official ones.
                                                         ownerGroupId = null,
                                                       }) {
  const [search, setSearch] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [middleFilter, setMiddleFilter] = useState(
      initialMiddleCategoryId ? String(initialMiddleCategoryId) : "all"
  )
  const [picked, setPicked] = useState(() => new Set())

  useEffect(() => {
    if (!open) return

    setSearch("")
    setDifficultyFilter("all")
    setTypeFilter("all")
    setMiddleFilter(
        initialMiddleCategoryId ? String(initialMiddleCategoryId) : "all"
    )
    setPicked(new Set())
  }, [open, initialMiddleCategoryId])

  const questionsQuery = useQuery({
    queryKey: ["questions", ownerGroupId ?? null],
    queryFn: () => getQuestions(ownerGroupId ?? undefined),
    enabled: open,
  })

  const examQuestionsQuery = useQuery({
    queryKey: ["exam-questions"],
    queryFn: () => getExamQuestions(),
    enabled: open,
  })

  const lessonIndex = useMemo(
      () => buildLessonIndex(certification),
      [certification]
  )

  const usedQuestionIds = useMemo(() => {
    const list = Array.isArray(examQuestionsQuery.data)
        ? examQuestionsQuery.data
        : []

    return new Set(
        list
            // When editing, this exam's own questions are managed locally via
            // the current selection — don't treat them as "used elsewhere".
            .filter(
                (examQuestion) =>
                    currentExamId == null ||
                    String(examQuestion.examId) !== String(currentExamId)
            )
            .map((examQuestion) => examQuestion.questionId)
            .filter((questionId) => questionId != null)
            .map((questionId) => String(questionId))
    )
  }, [examQuestionsQuery.data, currentExamId])

  const middleCategories = useMemo(() => {
    const seen = new Map()

    lessonIndex.forEach(({ middleCategory }) => {
      seen.set(middleCategory.middleCategoryId, middleCategory.title)
    })

    return [...seen.entries()]
  }, [lessonIndex])

  const rows = useMemo(() => {
    const list = Array.isArray(questionsQuery.data) ? questionsQuery.data : []

    return list
        .filter((question) => {
          // Scope to this certification and exclude sub-questions.
          const entry = lessonIndex.get(question.lessonId)

          if (!entry) return false

          if (question.parentQuestionId != null) return false

          // Hide questions already added in this current dialog.
          if (alreadySelectedIds.has(question.questionId)) return false

          // Hide questions already used by any saved assessment.
          if (usedQuestionIds.has(String(question.questionId))) return false

          if (
              initialLessonId &&
              String(entry.lesson.lessonId) !== String(initialLessonId)
          ) {
            return false
          }

          if (
              initialMiddleCategoryId &&
              String(entry.middleCategory.middleCategoryId) !==
              String(initialMiddleCategoryId)
          ) {
            return false
          }

          if (
              initialMajorCategoryId &&
              String(entry.majorCategory.majorCategoryId) !==
              String(initialMajorCategoryId)
          ) {
            return false
          }

          if (
              difficultyFilter !== "all" &&
              question.difficultyLevel !== difficultyFilter
          ) {
            return false
          }

          if (typeFilter !== "all" && question.questionType !== typeFilter) {
            return false
          }

          if (middleFilter !== "all") {
            if (String(entry.middleCategory.middleCategoryId) !== middleFilter) {
              return false
            }
          }

          if (search.trim()) {
            const term = search.trim().toLowerCase()

            if (!question.questionText?.toLowerCase().includes(term)) {
              return false
            }
          }

          return true
        })
        .map((question) => ({
          question,
          context: lessonIndex.get(question.lessonId),
        }))
        .filter((row) => Boolean(row.context))
  }, [
    questionsQuery.data,
    lessonIndex,
    alreadySelectedIds,
    usedQuestionIds,
    initialLessonId,
    initialMiddleCategoryId,
    initialMajorCategoryId,
    difficultyFilter,
    typeFilter,
    middleFilter,
    search,
  ])

  const visibleQuestionIds = useMemo(() => {
    return rows.map(({ question }) => question.questionId)
  }, [rows])

  const selectedVisibleCount = useMemo(() => {
    return visibleQuestionIds.filter((questionId) => picked.has(questionId))
        .length
  }, [visibleQuestionIds, picked])

  const allVisibleSelected =
      visibleQuestionIds.length > 0 &&
      selectedVisibleCount === visibleQuestionIds.length

  const someVisibleSelected =
      selectedVisibleCount > 0 && selectedVisibleCount < visibleQuestionIds.length

  const isLoading = questionsQuery.isLoading || examQuestionsQuery.isLoading
  const isError = questionsQuery.isError || examQuestionsQuery.isError

  const togglePicked = (questionId) => {
    setPicked((current) => {
      const next = new Set(current)

      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }

      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setPicked((current) => {
      const next = new Set(current)

      if (allVisibleSelected) {
        visibleQuestionIds.forEach((questionId) => {
          next.delete(questionId)
        })
      } else {
        visibleQuestionIds.forEach((questionId) => {
          next.add(questionId)
        })
      }

      return next
    })
  }

  const clearSelected = () => {
    setPicked(new Set())
  }

  const handleAdd = () => {
    const list = Array.isArray(questionsQuery.data) ? questionsQuery.data : []

    const selectedQuestions = list.filter((question) =>
        picked.has(question.questionId)
    )

    if (selectedQuestions.length === 0) {
      return
    }

    // Important:
    // Do not call onOpenChange(false) here.
    // The parent AssessmentDialog will receive the questions and close this picker safely.
    onAddQuestions(selectedQuestions)
  }

  const handleDialogOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setPicked(new Set())
    }

    onOpenChange(nextOpen)
  }

  return (
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-hidden rounded-2xl p-0 sm:h-[calc(100dvh-4rem)] sm:w-[80vw] sm:max-w-[80vw] lg:h-[min(680px,calc(100dvh-4rem))] lg:w-[60vw] lg:max-w-[60vw]">
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle className="text-xl font-semibold">
                Add Questions
              </DialogTitle>

              <DialogDescription className="text-sm text-muted-foreground">
                Select unused questions from the {certification?.title} question
                bank.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
              <label className="relative w-full max-w-56">
                <span className="sr-only">Search questions</span>

                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search questions"
                    className="pl-9"
                />
              </label>

              <Select value={middleFilter} onValueChange={setMiddleFilter}>
                <SelectTrigger className="w-[190px]" aria-label="Module filter">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>

                  {middleCategories.map(([id, title]) => (
                      <SelectItem key={id} value={String(id)}>
                        {title}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[170px]" aria-label="Type filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>

                  {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                  value={difficultyFilter}
                  onValueChange={setDifficultyFilter}
              >
                <SelectTrigger
                    className="w-[140px]"
                    aria-label="Difficulty filter"
                >
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="EASY">Easy</SelectItem>
                  <SelectItem value="AVERAGE">Average</SelectItem>
                  <SelectItem value="HARD">Hard</SelectItem>
                </SelectContent>
              </Select>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition hover:bg-muted/40">
                  <Checkbox
                      checked={
                        allVisibleSelected
                            ? true
                            : someVisibleSelected
                                ? "indeterminate"
                                : false
                      }
                      onCheckedChange={toggleSelectAllVisible}
                      disabled={rows.length === 0}
                      aria-label="Select all visible questions"
                  />

                  <span className="text-sm text-muted-foreground">
                  Select all visible
                </span>
                </label>

                {picked.size > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSelected}
                    >
                      Clear
                    </Button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {isLoading ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Loading available questions...
                  </p>
              ) : isError ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Unable to load questions. Close this dialog and try again.
                  </p>
              ) : rows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No unused questions match the current filters. Create more
                    questions in the Question Bank first.
                  </p>
              ) : (
                  <ul className="space-y-2">
                    {rows.map(({ question, context }) => (
                        <li key={question.questionId}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition hover:bg-muted/40 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                            <Checkbox
                                checked={picked.has(question.questionId)}
                                onCheckedChange={() =>
                                    togglePicked(question.questionId)
                                }
                                aria-label={`Select question ${question.questionId}`}
                                className="mt-1"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-medium">
                                {question.questionText}
                              </p>

                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="text-[10px]">
                                  {QUESTION_TYPE_LABELS[question.questionType] ??
                                      question.questionType}
                                </Badge>

                                <Badge variant="outline" className="text-[10px]">
                                  {question.difficultyLevel}
                                </Badge>

                                <span className="truncate text-xs text-muted-foreground">
                            {context.lesson.name ?? context.lesson.title} -{" "}
                                  {context.middleCategory.title}
                          </span>
                              </div>
                            </div>
                          </label>
                        </li>
                    ))}
                  </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
              <p className="text-sm text-muted-foreground">
                {picked.size} question(s) selected
                {rows.length > 0 && (
                    <span className="ml-1">
                  - {selectedVisibleCount} of {rows.length} visible selected
                </span>
                )}
              </p>

              <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                >
                  Cancel
                </Button>

                <Button
                    type="button"
                    onClick={handleAdd}
                    disabled={picked.size === 0}
                >
                  Add Selected Questions
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  )
}
