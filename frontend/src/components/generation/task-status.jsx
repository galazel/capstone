import {
  AlertTriangle,
  Ban,
  Check,
  CircleDashed,
  Loader2,
  RotateCw,
  SkipForward,
  UserCheck,
} from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * The eight task states a generation run can be in, and how each one looks.
 *
 * Kept in one table because the timeline, the activity panel, and the run list
 * all render the same vocabulary — three separate colour/label choices would
 * drift, and "Waiting for review" meaning something different in two panels is
 * exactly the confusion this workspace is meant to remove.
 */
export const TASK_STATUS = {
  PENDING: { label: "Pending", icon: CircleDashed, className: "text-muted-foreground" },
  RUNNING: { label: "Running", icon: Loader2, className: "text-blue-600 dark:text-blue-400", spin: true },
  COMPLETED: { label: "Completed", icon: Check, className: "text-emerald-600 dark:text-emerald-400" },
  WAITING_FOR_REVIEW: { label: "Waiting for review", icon: UserCheck, className: "text-amber-600 dark:text-amber-400" },
  RETRYING: { label: "Retrying", icon: RotateCw, className: "text-amber-600 dark:text-amber-400", spin: true },
  FAILED: { label: "Failed", icon: AlertTriangle, className: "text-destructive" },
  SKIPPED: { label: "Skipped", icon: SkipForward, className: "text-muted-foreground" },
  CANCELLED: { label: "Cancelled", icon: Ban, className: "text-muted-foreground" },
}

export function TaskStatusIcon({ status, className }) {
  const config = TASK_STATUS[status] ?? TASK_STATUS.PENDING
  const Icon = config.icon
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0", config.className, config.spin && "animate-spin", className)}
    />
  )
}

export function taskStatusLabel(status) {
  return (TASK_STATUS[status] ?? TASK_STATUS.PENDING).label
}

/**
 * Turns a graph node name into something a human reads. The node names are
 * implementation detail ("lesson_quiz_generate"); the reviewer should see
 * "Lesson quiz".
 */
const STAGE_LABELS = {
  validate_documents: "Validating documents",
  capture_document_visuals: "Capturing diagrams and images",
  ingest_documents: "Reading and indexing documents",
  plan_curriculum: "Planning curriculum",
  CURRICULUM: "Curriculum review",
  major_generate: "Major category assessment",
  major_validate: "Checking major assessment",
  MAJOR: "Major category",
  middle_generate: "Middle category assessment",
  middle_validate: "Checking middle assessment",
  MIDDLE: "Middle category",
  lesson_content: "Writing lesson content",
  lesson_quiz_generate: "Building lesson quiz",
  lesson_validate: "Checking lesson",
  LESSON: "Lesson",
  generate_diagnostic_exam: "Diagnostic exam",
  generate_mock_exam: "Mock exam",
  generate_question_bank: "Question bank",
  DIAGNOSTIC_EXAM: "Diagnostic exam review",
  MOCK_EXAM: "Mock exam review",
  QUESTION_BANK: "Question bank review",
  resolve_scope: "Resolving scope",
  generate_batch: "Generating question batch",
  validate_batch: "Checking question batch",
  QUESTION_BATCH: "Question batch review",
}

export function stageLabel(stage) {
  if (!stage) return "Workflow"
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

export function formatDuration(ms) {
  if (ms == null) return null
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}
