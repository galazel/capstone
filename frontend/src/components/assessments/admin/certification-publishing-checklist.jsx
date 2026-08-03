import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PlusCircleIcon,
  RocketIcon,
  WrenchIcon,
  XCircleIcon,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getCertificationPublishingRequirements,
  publishCertification,
} from "@/services/certificationService.js"

const TYPE_LABELS = {
  DIAGNOSTIC: "Diagnostic Exam",
  DIAGNOSTIC_EXAM: "Diagnostic Exam",
  MOCK_EXAM: "Mock Exam",
  MAJOR_EXAM: "Major Exam",
  MAJOR_CATEGORY_QUIZ: "Major Exam",
  MIDDLE_EXAM: "Middle Exam",
  MIDDLE_CATEGORY_QUIZ: "Middle Exam",
  MODULE_EXAM: "Middle Exam",
  LESSON_QUIZ: "Lesson Quiz",
  QUIZ: "Lesson Quiz",
  LESSON_CONTENT: "Lesson Content",
}

const REASON_LABELS = {
  ASSESSMENT_NOT_CREATED: "Not created yet",
  LESSON_CONTENT_MISSING: "No lesson content yet",
  ASSESSMENT_HAS_NO_QUESTIONS: "No questions added",
  QUESTION_POINTS_REQUIRED: "Some questions have no points",
  ASSESSMENT_TOTAL_POINTS_INVALID: "Total points must be greater than zero",
  PASSING_SCORE_EXCEEDS_TOTAL_POINTS: "Passing score is invalid",
  MOCK_EXAM_ALREADY_EXISTS: "Duplicate mock exam",
}

function normalizeRequirementType(value) {
  const type = String(value ?? "").trim().toUpperCase()

  if (type === "DIAGNOSTIC" || type === "DIAGNOSTIC_EXAM") {
    return "DIAGNOSTIC"
  }

  if (type === "QUIZ" || type === "LESSON_QUIZ") {
    return "LESSON_QUIZ"
  }

  if (
      type === "MODULE_EXAM" ||
      type === "MIDDLE_EXAM" ||
      type === "MIDDLE_CATEGORY_QUIZ"
  ) {
    return "MIDDLE_EXAM"
  }

  if (
      type === "MAJOR_EXAM" ||
      type === "MAJOR_CATEGORY_QUIZ" ||
      type === "MAJOR_CATEGORY_EXAM"
  ) {
    return "MAJOR_EXAM"
  }

  if (type === "MOCK" || type === "MOCK_EXAM") {
    return "MOCK_EXAM"
  }

  return type
}

function buildCreateRequest(item) {
  const type = normalizeRequirementType(item.type)
  const scopeId = item.scopeId ?? item.targetId ?? null

  return {
    mode: "create",
    type,
    lessonId:
        item.lessonId ?? (type === "LESSON_QUIZ" ? scopeId : null),
    middleCategoryId:
        item.middleCategoryId ?? (type === "MIDDLE_EXAM" ? scopeId : null),
    majorCategoryId:
        item.majorCategoryId ?? (type === "MAJOR_EXAM" ? scopeId : null),
    title:
        item.assessmentTitle ??
        item.examTitle ??
        item.title ??
        "",
    lockPreset: true,
  }
}

export default function CertificationPublishingChecklist({
                                                           certificationId,
                                                           isPublished = false,
                                                           onPublished,
                                                           onCreateAssessment,
                                                         }) {
  const queryClient = useQueryClient()

  const requirementsQuery = useQuery({
    queryKey: ["certification-publishing-requirements", certificationId],
    queryFn: () => getCertificationPublishingRequirements(certificationId),
    enabled: certificationId != null && !isPublished,
    retry: 1,
  })

  const publishMutation = useMutation({
    mutationFn: () => publishCertification(certificationId),
    onSuccess: () => {
      toast.success("Certification published. All assessments are now live.")
      queryClient.invalidateQueries({
        queryKey: ["certification-publishing-requirements", certificationId],
      })
      queryClient.invalidateQueries({ queryKey: ["exams"] })
      onPublished?.()
    },
    onError: (error) => {
      toast.error(
          error?.response?.data?.message ??
          "This certification cannot be published yet. Resolve the listed requirements first."
      )
    },
  })

  if (isPublished) {
    return (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2Icon className="size-5 text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium">Certification published</p>
              <p className="text-sm text-muted-foreground">
                The curriculum and all assessments are live for learners.
              </p>
            </div>
          </CardContent>
        </Card>
    )
  }

  const data = requirementsQuery.data
  const missing = data?.missingRequirements ?? []
  const invalid = data?.invalidRequirements ?? []
  const publishable = Boolean(data?.publishable)
  const issueCount = missing.length + invalid.length

  return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Publishing requirements</CardTitle>
              <CardDescription>
                Create or fix each required assessment here before publishing the
                certification.
              </CardDescription>
            </div>

            {requirementsQuery.isLoading ? null : publishable ? (
                <Badge className="gap-1">
                  <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                  Ready to publish
                </Badge>
            ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
                  {issueCount} item{issueCount === 1 ? "" : "s"} to resolve
                </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {requirementsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-2/3" />
              </div>
          ) : requirementsQuery.isError ? (
              <p className="text-sm text-destructive">
                Could not load publishing requirements.
              </p>
          ) : publishable ? (
              <p className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-sm text-primary">
                <CheckCircle2Icon className="size-4" aria-hidden="true" />
                All requirements satisfied. You can publish this certification.
              </p>
          ) : (
              <ul className="space-y-2">
                {missing.map((item) => {
                  const createRequest = buildCreateRequest(item)
                  const normalizedType = normalizeRequirementType(item.type)
                  const typeLabel =
                      TYPE_LABELS[item.type] ??
                      TYPE_LABELS[normalizedType] ??
                      "Assessment"

                  return (
                      <li
                          key={`missing-${item.type}-${item.scopeId ?? item.title}`}
                          className="flex flex-col gap-3 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <XCircleIcon
                              className="mt-0.5 size-4 shrink-0 text-destructive"
                              aria-hidden="true"
                          />

                          <div className="min-w-0">
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {typeLabel} ·{" "}
                              {REASON_LABELS[item.reason] ?? item.reason}
                            </p>
                          </div>
                        </div>

                        {item.type === "LESSON_CONTENT" ? (
                            <span className="shrink-0 text-xs text-muted-foreground sm:self-center">
                              Add content in the lesson editor
                            </span>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                className="shrink-0 sm:self-center"
                                onClick={() => onCreateAssessment?.(createRequest)}
                            >
                              <PlusCircleIcon aria-hidden="true" />
                              Create {typeLabel}
                            </Button>
                        )}
                      </li>
                  )
                })}

                {invalid.map((item) => (
                    <li
                        key={`invalid-${item.examId}-${item.reason}`}
                        className="flex flex-col gap-3 rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <AlertTriangleIcon
                            className="mt-0.5 size-4 shrink-0 text-amber-600"
                            aria-hidden="true"
                        />

                        <div className="min-w-0">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {REASON_LABELS[item.reason] ?? item.reason}
                            {item.affectedQuestionIds?.length
                                ? ` · ${item.affectedQuestionIds.length} question(s)`
                                : ""}
                          </p>
                        </div>
                      </div>

                      {item.examId != null ? (
                          <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 sm:self-center"
                              onClick={() =>
                                  onCreateAssessment?.({
                                    mode: "edit",
                                    examId: item.examId,
                                  })
                              }
                          >
                            <WrenchIcon aria-hidden="true" />
                            Fix Assessment
                          </Button>
                      ) : null}
                    </li>
                ))}
              </ul>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                  className="w-full sm:w-auto"
                  disabled={!publishable || publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                ) : (
                    <RocketIcon aria-hidden="true" />
                )}
                Publish Certification
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish certification?</AlertDialogTitle>
                <AlertDialogDescription>
                  Publishing makes the curriculum and every included assessment
                  available to learners. All assessments are published
                  automatically in this single step.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={publishMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault()
                      publishMutation.mutate()
                    }}
                    disabled={publishMutation.isPending}
                >
                  Publish Certification
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
  )
}
