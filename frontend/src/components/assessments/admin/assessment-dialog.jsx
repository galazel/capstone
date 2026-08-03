import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@/components/icons"
import { toast } from "sonner"

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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createExam,
  ensureExamType,
  updateExam,
} from "@/services/assessmentService.js"
import AssessmentQuestionPickerDialog from "./assessment-question-picker-dialog.jsx"

const ASSESSMENT_CREATE_TYPES = [
  {
    value: "DIAGNOSTIC",
    label: "Diagnostic Exam",
    examTypeText: "DIAGNOSTIC",
    scope: "CERTIFICATION",
    targetLabel: "Certification",
  },
  {
    value: "LESSON_QUIZ",
    label: "Lesson Quiz",
    examTypeText: "LESSON_QUIZ",
    scope: "LESSON",
    targetLabel: "Lesson",
  },
  {
    value: "MIDDLE_EXAM",
    label: "Middle Exam",
    examTypeText: "MIDDLE_EXAM",
    scope: "MIDDLE_CATEGORY",
    targetLabel: "Middle Category",
  },
  {
    value: "MAJOR_EXAM",
    label: "Major Exam",
    examTypeText: "MAJOR_EXAM",
    scope: "MAJOR_CATEGORY",
    targetLabel: "Major Category",
  },
  {
    value: "MOCK_EXAM",
    label: "Mock Exam",
    examTypeText: "MOCK_EXAM",
    scope: "CERTIFICATION",
    targetLabel: "Certification",
  },
]
function getCreateTypeConfig(value) {
  return (
      ASSESSMENT_CREATE_TYPES.find((item) => item.value === value) ??
      ASSESSMENT_CREATE_TYPES[0]
  )
}

function normalizeCreateType(value, fallback = "MOCK_EXAM") {
  const text = String(value ?? "").trim().toUpperCase()

  if (text === "DIAGNOSTIC" || text === "DIAGNOSTIC_EXAM") {
    return "DIAGNOSTIC"
  }

  if (text === "QUIZ" || text === "LESSON_QUIZ") {
    return "LESSON_QUIZ"
  }

  if (
      text === "MODULE_EXAM" ||
      text === "MIDDLE_EXAM" ||
      text === "MIDDLE_CATEGORY_QUIZ"
  ) {
    return "MIDDLE_EXAM"
  }

  if (
      text === "MAJOR_EXAM" ||
      text === "MAJOR_CATEGORY_QUIZ" ||
      text === "MAJOR_CATEGORY_EXAM"
  ) {
    return "MAJOR_EXAM"
  }

  if (text === "MOCK_EXAM" || text === "MOCK") return "MOCK_EXAM"

  return fallback
}

const DEFAULT_POINTS = 1

function isValidPoints(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0
}

function getLessonTitle(lesson) {
  return lesson?.name ?? lesson?.title ?? "Untitled lesson"
}

function getMajorId(majorCategory) {
  return majorCategory?.majorCategoryId ?? majorCategory?.id
}

function getMiddleId(middleCategory) {
  return middleCategory?.middleCategoryId ?? middleCategory?.id
}

function getLessonId(lesson) {
  return lesson?.lessonId ?? lesson?.id
}

function buildAssessmentTargets(certification) {
  const majorCategories = certification?.majorCategory ?? []

  const majors = []
  const middles = []
  const lessons = []

  majorCategories.forEach((majorCategory) => {
    const majorId = getMajorId(majorCategory)

    if (majorId != null) {
      majors.push({
        id: String(majorId),
        title: majorCategory.title ?? "Untitled major category",
        majorCategory,
      })
    }

    ;(majorCategory.middleCategory ?? []).forEach((middleCategory) => {
      const middleId = getMiddleId(middleCategory)

      if (middleId != null) {
        middles.push({
          id: String(middleId),
          title: middleCategory.title ?? "Untitled middle category",
          subtitle: majorCategory.title ?? "Major category",
          middleCategory,
          majorCategory,
        })
      }

      ;(middleCategory.lessons ?? []).forEach((lesson) => {
        const lessonId = getLessonId(lesson)

        if (lessonId != null) {
          lessons.push({
            id: String(lessonId),
            title: getLessonTitle(lesson),
            subtitle: `${middleCategory.title ?? "Middle category"} · ${
                majorCategory.title ?? "Major category"
            }`,
            lesson,
            middleCategory,
            majorCategory,
          })
        }
      })
    })
  })

  return {
    majors,
    middles,
    lessons,
  }
}

function getTargetOptionsByScope(targets, scope) {
  if (scope === "LESSON") return targets.lessons
  if (scope === "MIDDLE_CATEGORY") return targets.middles
  if (scope === "MAJOR_CATEGORY") return targets.majors
  return []
}

function getDefaultTitle({ createTypeConfig, selectedTarget, certification }) {
  if (createTypeConfig.scope === "CERTIFICATION") {
    return `${certification?.title ?? "Certification"} ${createTypeConfig.label}`
  }

  return `${selectedTarget?.title ?? createTypeConfig.targetLabel} ${
      createTypeConfig.label
  }`
}

export default function AssessmentDialog({
                                           open,
                                           onOpenChange,
                                           mode = "create",
                                           certification,
                                           exam = null,
                                           examTypeByIdText = new Map(),
                                           existingExamQuestions = [],
                                           questionById = new Map(),
                                           initialType = "MOCK_EXAM",
                                           initialLessonId = null,
                                           initialMiddleCategoryId = null,
                                           initialMajorCategoryId = null,
                                           initialTitle = "",
                                           lockPreset = false,
                                           // When set, a newly created exam is owned by this
                                           // Enterprise group (member-authored) instead of being
                                           // official, platform-wide content. See ExamController.
                                           ownerGroupId = null,
                                         }) {
  const queryClient = useQueryClient()
  const isEdit = mode === "edit"

  const [title, setTitle] = useState("")
  const [createType, setCreateType] = useState(
      normalizeCreateType(initialType, "MOCK_EXAM")
  )
  const [targetId, setTargetId] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("")
  const [passingScore, setPassingScore] = useState("")
  const [releaseAnswersAfterSubmit, setReleaseAnswersAfterSubmit] = useState(true)
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [pointsById, setPointsById] = useState({})
  const [pointsMode, setPointsMode] = useState("SAME")
  const [samePoints, setSamePoints] = useState(DEFAULT_POINTS)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState("")

  const targets = useMemo(
      () => buildAssessmentTargets(certification),
      [certification]
  )

  const createTypeConfig = useMemo(
      () => getCreateTypeConfig(createType),
      [createType]
  )

  const targetOptions = useMemo(
      () => getTargetOptionsByScope(targets, createTypeConfig.scope),
      [targets, createTypeConfig.scope]
  )

  const selectedTarget = useMemo(() => {
    return targetOptions.find((item) => item.id === targetId) ?? null
  }, [targetOptions, targetId])

  const typeLabel = createTypeConfig.label

  useEffect(() => {
    if (!open) return

    if (isEdit && exam) {
      const fallbackType = normalizeCreateType(initialType, "MOCK_EXAM")
      const currentTypeText = examTypeByIdText.get(exam.examTypeId) ?? fallbackType
      const currentCreateType = normalizeCreateType(currentTypeText, fallbackType)

      setTitle(exam.title ?? "")
      setCreateType(currentCreateType)
      setTargetId(
          exam.lessonId != null
              ? String(exam.lessonId)
              : exam.middleCategoryId != null
                  ? String(exam.middleCategoryId)
                  : exam.majorCategoryId != null
                      ? String(exam.majorCategoryId)
                      : ""
      )
      setDurationMinutes(
          exam.durationMinutes != null ? String(exam.durationMinutes) : ""
      )
      setPassingScore(
          exam.passingScore != null ? String(exam.passingScore) : ""
      )
      setReleaseAnswersAfterSubmit(
          exam.releaseAnswersAfterSubmit == null
              ? true
              : Boolean(exam.releaseAnswersAfterSubmit)
      )

      const orderedExamQuestions = [...existingExamQuestions].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      )
      const ordered = orderedExamQuestions
          .map((examQuestion) => questionById.get(examQuestion.questionId))
          .filter(Boolean)

      // Load only this assessment's saved points/order — never the question bank.
      const nextPoints = {}
      orderedExamQuestions.forEach((examQuestion) => {
        if (questionById.get(examQuestion.questionId)) {
          nextPoints[examQuestion.questionId] =
              examQuestion.points != null
                  ? Number(examQuestion.points)
                  : DEFAULT_POINTS
        }
      })

      const distinct = new Set(
          Object.values(nextPoints).filter((value) => isValidPoints(value))
      )

      setSelectedQuestions(ordered)
      setPointsById(nextPoints)
      setPointsMode(distinct.size > 1 ? "INDIVIDUAL" : "SAME")
      setSamePoints(distinct.size === 1 ? [...distinct][0] : DEFAULT_POINTS)
    } else {
      const nextType = normalizeCreateType(initialType, "MOCK_EXAM")
      const nextConfig = getCreateTypeConfig(nextType)
      const nextTargetId =
          nextConfig.scope === "LESSON" && initialLessonId != null
              ? String(initialLessonId)
              : nextConfig.scope === "MIDDLE_CATEGORY" &&
              initialMiddleCategoryId != null
                  ? String(initialMiddleCategoryId)
                  : nextConfig.scope === "MAJOR_CATEGORY" &&
                  initialMajorCategoryId != null
                      ? String(initialMajorCategoryId)
                      : ""
      const nextTargetOptions = getTargetOptionsByScope(
          targets,
          nextConfig.scope
      )
      const nextTarget =
          nextTargetOptions.find((item) => item.id === nextTargetId) ?? null
      const presetTitle = String(initialTitle ?? "").trim()

      setCreateType(nextType)
      setTargetId(nextTargetId)
      setTitle(
          presetTitle ||
          getDefaultTitle({
            createTypeConfig: nextConfig,
            selectedTarget: nextTarget,
            certification,
          })
      )
      setDurationMinutes("")
      setPassingScore("")
      setReleaseAnswersAfterSubmit(true)
      setSelectedQuestions([])
      setPointsById({})
      setPointsMode("SAME")
      setSamePoints(DEFAULT_POINTS)
    }

    setError("")
    setPickerOpen(false)

    // Keep dependencies limited to dialog lifecycle.
    // This prevents selected questions from resetting while the picker is closing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam?.examId, mode])

  const alreadySelectedIds = useMemo(
      () => new Set(selectedQuestions.map((question) => question.questionId)),
      [selectedQuestions]
  )

  const totalScore = useMemo(
      () =>
          selectedQuestions.reduce((sum, question) => {
            const value = Number(pointsById[question.questionId])
            return sum + (isValidPoints(value) ? value : 0)
          }, 0),
      [selectedQuestions, pointsById]
  )

  const unconfiguredCount = useMemo(
      () =>
          selectedQuestions.filter(
              (question) => !isValidPoints(pointsById[question.questionId])
          ).length,
      [selectedQuestions, pointsById]
  )

  const requiredToPass = passingScore
      ? Math.ceil((totalScore * Number(passingScore)) / 100)
      : null

  const setOnePoint = (questionId, value) => {
    setPointsById((current) => ({ ...current, [questionId]: value }))
  }

  const applySamePoints = (value) => {
    setPointsById(() => {
      const next = {}
      selectedQuestions.forEach((question) => {
        next[question.questionId] = value
      })
      return next
    })
  }

  const handlePointsModeChange = (nextMode) => {
    if (nextMode === pointsMode) return

    setPointsMode(nextMode)

    // Switching to "same for all" normalizes every question to one value.
    if (nextMode === "SAME") {
      const value = isValidPoints(samePoints) ? Number(samePoints) : DEFAULT_POINTS
      applySamePoints(value)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const examType = await ensureExamType(createTypeConfig.examTypeText)

      const questionIds = selectedQuestions.map(
          (question) => question.questionId
      )

      // The admin's selection — with its per-question points and order — is the
      // single source of truth persisted for this assessment.
      const questions = selectedQuestions.map((question, index) => ({
        questionId: question.questionId,
        points: Number(pointsById[question.questionId]),
        displayOrder: index + 1,
      }))

      const payload = {
        certificationId: certification.certificationId,
        examTypeId: examType.examTypeId,
        title: title.trim(),
        isGenerated: exam?.isGenerated ?? false,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        totalQuestions: questionIds.length,
        passingScore: passingScore ? Number(passingScore) : null,
        releaseAnswersAfterSubmit,
        questions,
        questionIds,

        targetScope: createTypeConfig.scope,
        assessmentScope: createTypeConfig.scope,
        lessonId:
            createTypeConfig.scope === "LESSON" && targetId
                ? Number(targetId)
                : null,
        middleCategoryId:
            createTypeConfig.scope === "MIDDLE_CATEGORY" && targetId
                ? Number(targetId)
                : null,
        majorCategoryId:
            createTypeConfig.scope === "MAJOR_CATEGORY" && targetId
                ? Number(targetId)
                : null,
      }

      const savedExam = isEdit
          ? await updateExam(exam.examId, {
            ...payload,
            examId: exam.examId,
          })
          : await createExam(payload, ownerGroupId)

      return {
        savedExam,
        questionIds,
        questions,
      }
    },

    onSuccess: async ({ savedExam, questionIds, questions }) => {
      queryClient.setQueryData(["exams"], (current) => {
        const list = Array.isArray(current) ? [...current] : []
        const next = list.filter((item) => item.examId !== savedExam.examId)

        next.unshift({
          ...savedExam,
          questionIds,
          totalQuestions: questionIds.length,
        })

        return next
      })

      queryClient.setQueryData(["exam-questions"], (current) => {
        const list = Array.isArray(current) ? [...current] : []

        const filtered = list.filter((item) => item.examId !== savedExam.examId)

        const restored = questions.map((question, index) => ({
          examQuestionId: `${savedExam.examId}-${question.questionId}`,
          examId: savedExam.examId,
          questionId: question.questionId,
          displayOrder: question.displayOrder ?? index + 1,
          points: question.points,
        }))

        return [...filtered, ...restored]
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["exams"] }),
        queryClient.invalidateQueries({ queryKey: ["exam-questions"] }),
        queryClient.invalidateQueries({ queryKey: ["exam-types"] }),
        queryClient.invalidateQueries({
          queryKey: [
            "certification-publishing-requirements",
            certification.certificationId,
          ],
        }),
      ])

      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ["exams"],
          type: "active",
        }),
        queryClient.refetchQueries({
          queryKey: ["exam-questions"],
          type: "active",
        }),
        queryClient.refetchQueries({
          queryKey: ["exam-types"],
          type: "active",
        }),
      ])

      toast.success(
          isEdit
              ? "Assessment updated successfully."
              : "Assessment created successfully."
      )

      onOpenChange(false)
    },

    onError: (error) => {
      const message =
          error?.response?.data?.message ??
          (isEdit
              ? "Unable to save changes. Please try again."
              : "Assessment could not be created.")

      setError(message)
      toast.error(message)
    },
  })

  const handleAssessmentDialogOpenChange = (nextOpen) => {
    if (!nextOpen && pickerOpen) {
      return
    }

    if (!nextOpen && saveMutation.isPending) {
      return
    }

    onOpenChange(nextOpen)
  }

  const handleCreateTypeChange = (nextType) => {
    const nextConfig = getCreateTypeConfig(nextType)

    setCreateType(nextType)
    setTargetId("")
    setSelectedQuestions([])
    setPointsById({})
    setError("")

    setTitle(
        getDefaultTitle({
          createTypeConfig: nextConfig,
          selectedTarget: null,
          certification,
        })
    )
  }

  const handleTargetChange = (nextTargetId) => {
    const nextTarget = targetOptions.find((item) => item.id === nextTargetId)

    setTargetId(nextTargetId)
    setSelectedQuestions([])
    setPointsById({})
    setError("")

    // The admin never has to type an assessment name. Changing the selected
    // lesson, middle category, or major category immediately regenerates it.
    if (!isEdit) {
      setTitle(
          getDefaultTitle({
            createTypeConfig,
            selectedTarget: nextTarget,
            certification,
          })
      )
    }
  }

  const handleAddQuestions = (questions) => {
    const newlyAddedIds = []

    setSelectedQuestions((current) => {
      const existingIds = new Set(
          current.map((question) => question.questionId)
      )

      const newQuestions = questions.filter(
          (question) => !existingIds.has(question.questionId)
      )

      newQuestions.forEach((question) => newlyAddedIds.push(question.questionId))

      return [...current, ...newQuestions]
    })

    // Give each newly added question a starting point value so the total and
    // validation stay consistent. "Same for all" uses the shared value.
    setPointsById((current) => {
      const next = { ...current }
      const startingValue =
          pointsMode === "SAME" && isValidPoints(samePoints)
              ? Number(samePoints)
              : DEFAULT_POINTS

      newlyAddedIds.forEach((questionId) => {
        if (next[questionId] == null) {
          next[questionId] = startingValue
        }
      })

      return next
    })

    setError("")
    setPickerOpen(false)
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Enter a title for this assessment.")
      return
    }

    if (createTypeConfig.scope !== "CERTIFICATION" && !targetId) {
      setError(`Select a ${createTypeConfig.targetLabel.toLowerCase()}.`)
      return
    }

    if (selectedQuestions.length === 0) {
      setError("Add at least one question.")
      return
    }

    if (unconfiguredCount > 0) {
      setError(
          `Set a point value greater than zero for all ${selectedQuestions.length} question(s).`
      )
      return
    }

    if (
        passingScore &&
        (Number(passingScore) < 0 || Number(passingScore) > 100)
    ) {
      setError("Passing score must be between 0 and 100.")
      return
    }

    setError("")
    saveMutation.mutate()
  }

  const moveQuestion = (index, delta) => {
    setSelectedQuestions((current) => {
      const next = [...current]
      const target = index + delta

      if (target < 0 || target >= next.length) {
        return current
      }

      ;[next[index], next[target]] = [next[target], next[index]]

      return next
    })
  }

  const removeQuestion = (questionId) => {
    setSelectedQuestions((current) =>
        current.filter((item) => item.questionId !== questionId)
    )
    setPointsById((current) => {
      const next = { ...current }
      delete next[questionId]
      return next
    })
  }

  const canOpenQuestionPicker =
      createTypeConfig.scope === "CERTIFICATION" || Boolean(targetId)

  return (
      <Dialog open={open} onOpenChange={handleAssessmentDialogOpenChange}>
        <DialogContent
            onInteractOutside={(event) => {
              if (pickerOpen || saveMutation.isPending) {
                event.preventDefault()
              }
            }}
            onEscapeKeyDown={(event) => {
              if (pickerOpen || saveMutation.isPending) {
                event.preventDefault()
              }
            }}
            className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-hidden rounded-2xl p-0 sm:h-[calc(100dvh-4rem)] sm:w-[80vw] sm:max-w-[80vw] md:w-[65vw] md:max-w-[65vw] lg:h-[min(700px,calc(100dvh-4rem))] lg:w-[55vw] lg:max-w-[55vw]"
        >
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle className="text-xl font-semibold">
                {isEdit ? "Edit Assessment" : `Create ${typeLabel}`}
              </DialogTitle>

              <DialogDescription className="text-sm text-muted-foreground">
                Certification: {certification?.title}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Assessment details
                  </h3>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="assessment-title">
                        Assessment Name
                        {!isEdit ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              (automatically generated)
                            </span>
                        ) : null}
                      </Label>

                      <Input
                          id="assessment-title"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="Assessment name"
                          readOnly={!isEdit}
                          className={!isEdit ? "bg-muted" : undefined}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Exam Type</Label>

                      <Select
                          value={createType}
                          onValueChange={handleCreateTypeChange}
                          disabled={isEdit || lockPreset}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select exam type" />
                        </SelectTrigger>

                        <SelectContent>
                          {ASSESSMENT_CREATE_TYPES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {createTypeConfig.scope !== "CERTIFICATION" ? (
                        <div className="space-y-2">
                          <Label>Select {createTypeConfig.targetLabel}</Label>

                          <Select
                              value={targetId}
                              onValueChange={handleTargetChange}
                              disabled={isEdit || lockPreset}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                  placeholder={`Choose ${createTypeConfig.targetLabel}`}
                              />
                            </SelectTrigger>

                            <SelectContent>
                              {targetOptions.length === 0 ? (
                                  <SelectItem value="none" disabled>
                                    No {createTypeConfig.targetLabel.toLowerCase()} available
                                  </SelectItem>
                              ) : (
                                  targetOptions.map((target) => (
                                      <SelectItem key={target.id} value={target.id}>
                                        {target.title}
                                        {target.subtitle ? ` — ${target.subtitle}` : ""}
                                      </SelectItem>
                                  ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="assessment-duration">
                        Duration (minutes)
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (optional)
                      </span>
                      </Label>

                      <Input
                          id="assessment-duration"
                          type="number"
                          min="1"
                          value={durationMinutes}
                          onChange={(event) =>
                              setDurationMinutes(event.target.value)
                          }
                          placeholder="60"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assessment-passing">
                        Passing score (%)
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (optional)
                      </span>
                      </Label>

                      <Input
                          id="assessment-passing"
                          type="number"
                          min="0"
                          max="100"
                          value={passingScore}
                          onChange={(event) => setPassingScore(event.target.value)}
                          placeholder="70"
                      />
                    </div>

                    <div className="flex items-start gap-2.5 md:col-span-2">
                      <Checkbox
                          id="assessment-release-answers"
                          checked={releaseAnswersAfterSubmit}
                          onCheckedChange={(checked) =>
                              setReleaseAnswersAfterSubmit(Boolean(checked))
                          }
                          className="mt-0.5"
                      />

                      <Label
                          htmlFor="assessment-release-answers"
                          className="cursor-pointer text-sm font-normal"
                      >
                        Release correct answers and explanations to learners
                        after they submit
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Turn off to hide the answer key in attempt review —
                          useful for assessments learners can retake.
                        </span>
                      </Label>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      Questions ({selectedQuestions.length} selected)
                      {selectedQuestions.length > 0 ? (
                          <span className="ml-2 font-normal">
                            · {totalScore} total point
                            {totalScore === 1 ? "" : "s"}
                          </span>
                      ) : null}
                    </h3>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!canOpenQuestionPicker) {
                            setError(
                                `Select a ${createTypeConfig.targetLabel.toLowerCase()} first.`
                            )
                            return
                          }

                          setPickerOpen(true)
                        }}
                    >
                      <Plus aria-hidden="true" />
                      Add Questions
                    </Button>
                  </div>

                  {selectedQuestions.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No questions selected yet. Use Add Questions to pick from
                        this certification&apos;s question bank.
                      </div>
                  ) : (
                      <>
                        {/* Points configuration for the selected questions. */}
                        <div className="rounded-xl border p-4">
                          <h4 className="text-sm font-semibold">
                            Question points
                          </h4>

                          <RadioGroup
                              value={pointsMode}
                              onValueChange={handlePointsModeChange}
                              className="mt-3 gap-2"
                          >
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
                                  <Label
                                      htmlFor="assessment-same-points"
                                      className="text-xs"
                                  >
                                    Points per question
                                  </Label>

                                  <Input
                                      id="assessment-same-points"
                                      type="number"
                                      min="0.01"
                                      step="0.5"
                                      value={samePoints}
                                      onChange={(event) => {
                                        const next = event.target.value
                                        setSamePoints(next)
                                        if (isValidPoints(next)) {
                                          applySamePoints(Number(next))
                                        }
                                      }}
                                      className="h-9 w-28"
                                      aria-invalid={!isValidPoints(samePoints)}
                                  />
                                </div>

                                {!isValidPoints(samePoints) ? (
                                    <p className="pb-1 text-xs text-destructive">
                                      Points must be greater than zero.
                                    </p>
                                ) : null}
                              </div>
                          ) : (
                              <p className="mt-3 text-xs text-muted-foreground">
                                Set a point value for each question below. The
                                total score updates automatically.
                              </p>
                          )}
                        </div>

                        <ul className="space-y-2">
                          {selectedQuestions.map((question, index) => {
                            const pointsValue = pointsById[question.questionId]
                            const invalidPoints = !isValidPoints(pointsValue)

                            return (
                                <li
                                    key={question.questionId}
                                    className="flex items-center gap-3 rounded-xl border p-3"
                                >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {index + 1}
                        </span>

                                  <div className="min-w-0 flex-1">
                                    <p className="line-clamp-1 text-sm font-medium">
                                      {question.questionText}
                                    </p>

                                    <div className="mt-1 flex items-center gap-1.5">
                                      <Badge variant="secondary" className="text-[10px]">
                                        {question.questionType}
                                      </Badge>

                                      <Badge variant="outline" className="text-[10px]">
                                        {question.difficultyLevel}
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1">
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.5"
                                        value={pointsValue ?? ""}
                                        onChange={(event) =>
                                            setOnePoint(
                                                question.questionId,
                                                event.target.value
                                            )
                                        }
                                        readOnly={pointsMode === "SAME"}
                                        disabled={pointsMode === "SAME"}
                                        className="h-8 w-20"
                                        aria-label={`Points for question ${index + 1}`}
                                        aria-invalid={invalidPoints}
                                    />

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Move question up"
                                        disabled={index === 0}
                                        onClick={() => moveQuestion(index, -1)}
                                    >
                                      <ArrowUp />
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Move question down"
                                        disabled={index === selectedQuestions.length - 1}
                                        onClick={() => moveQuestion(index, 1)}
                                    >
                                      <ArrowDown />
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Remove question"
                                        onClick={() => removeQuestion(question.questionId)}
                                    >
                                      <Trash2 />
                                    </Button>
                                  </div>
                                </li>
                            )
                          })}
                        </ul>

                        {unconfiguredCount > 0 ? (
                            <p className="text-xs text-destructive">
                              {unconfiguredCount} question(s) need a point value
                              greater than zero.
                            </p>
                        ) : null}
                      </>
                  )}
                </section>

                <section className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
                  <h3 className="font-semibold text-muted-foreground">Summary</h3>

                  <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Certification</dt>

                      <dd className="truncate font-medium">
                        {certification?.title}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Type</dt>

                      <dd className="font-medium">{typeLabel}</dd>
                    </div>

                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Scope</dt>

                      <dd className="truncate font-medium">
                        {createTypeConfig.scope === "CERTIFICATION"
                            ? "Overall certification"
                            : selectedTarget?.title ?? "Not selected"}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Questions</dt>

                      <dd className="font-medium">{selectedQuestions.length}</dd>
                    </div>

                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Total score</dt>

                      <dd className="font-medium tabular-nums">
                        {totalScore} point{totalScore === 1 ? "" : "s"}
                      </dd>
                    </div>

                    {requiredToPass != null ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">
                            Points to pass
                          </dt>

                          <dd className="font-medium tabular-nums">
                            {requiredToPass}
                          </dd>
                        </div>
                    ) : null}

                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Duration</dt>

                      <dd className="font-medium">
                        {durationMinutes ? `${durationMinutes} min` : "No limit"}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Passing score</dt>

                      <dd className="font-medium">
                        {passingScore ? `${passingScore}%` : "Not set"}
                      </dd>
                    </div>
                  </dl>
                </section>

                {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saveMutation.isPending}
              >
                Cancel
              </Button>

              <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saveMutation.isPending}
              >
                {saveMutation.isPending
                    ? "Saving..."
                    : isEdit
                        ? "Save Changes"
                        : `Create ${typeLabel}`}
              </Button>
            </div>
          </div>

          <AssessmentQuestionPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              certification={certification}
              alreadySelectedIds={alreadySelectedIds}
              currentExamId={exam?.examId ?? null}
              initialLessonId={createTypeConfig.scope === "LESSON" ? targetId : null}
              initialMiddleCategoryId={
                createTypeConfig.scope === "MIDDLE_CATEGORY" ? targetId : null
              }
              initialMajorCategoryId={
                createTypeConfig.scope === "MAJOR_CATEGORY" ? targetId : null
              }
              onAddQuestions={handleAddQuestions}
              ownerGroupId={ownerGroupId}
          />
        </DialogContent>
      </Dialog>
  )
}
