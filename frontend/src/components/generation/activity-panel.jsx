import { useMemo, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { stageLabel } from "./task-status"

/**
 * One feed for everything that happened: node transitions, validation results,
 * review decisions, warnings, and errors.
 *
 * Unified rather than split into "logs" and "errors" tabs, because the useful
 * question during a long run is "what happened, in order" — a failure three
 * stages ago only makes sense next to what ran before it.
 */

const EVENT_LABELS = {
  "workflow.started": () => "Run started",
  "workflow.resumed": () => "Run resumed",
  "workflow.completed": () => "Run completed",
  "workflow.failed": (e) => `Run failed — ${e.payload?.error ?? "unknown error"}`,
  "workflow.cancelled": () => "Run cancelled by a reviewer",
  "node.started": (e) => `${stageLabel(e.stage)} started`,
  "node.completed": (e) =>
    e.task_status === "FAILED"
      ? `${stageLabel(e.stage)} failed — ${e.payload?.error ?? "unknown error"}`
      : `${stageLabel(e.stage)} finished`,
  "validation.completed": (e) => `${stageLabel(e.stage)} checked`,
  "review.waiting": (e) => `Waiting for review — ${stageLabel(e.stage)}`,
  "review.submitted": (e) => `Review submitted — ${(e.payload?.action ?? "approve").replace(/_/g, " ")}`,
  "version.recorded": (e) =>
    `Version r${e.payload?.revision} recorded (${(e.payload?.source ?? "").toLowerCase().replace(/_/g, " ")})`,
}

const SEVERITY = {
  "workflow.failed": "error",
  "workflow.cancelled": "muted",
}

function severityOf(event) {
  if (event.task_status === "FAILED") return "error"
  if (event.task_status === "RETRYING") return "warning"
  return SEVERITY[event.event_type] ?? "normal"
}

function describe(event) {
  const fn = EVENT_LABELS[event.event_type]
  return fn ? fn(event) : `${event.event_type}${event.stage ? ` — ${stageLabel(event.stage)}` : ""}`
}

function formatTime(iso) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return ""
  }
}

export function ActivityPanel({ events, className }) {
  const [problemsOnly, setProblemsOnly] = useState(false)

  const rows = useMemo(() => {
    const described = (events ?? []).map((event) => ({
      ...event,
      text: describe(event),
      severity: severityOf(event),
    }))
    return problemsOnly
      ? described.filter((row) => row.severity === "error" || row.severity === "warning")
      : described
  }, [events, problemsOnly])

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Activity</span>
        <Button
          size="sm"
          variant={problemsOnly ? "secondary" : "ghost"}
          onClick={() => setProblemsOnly((value) => !value)}
        >
          Problems only
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-1 pr-3">
          {rows.map((row) => (
            <li key={row.seq} className="flex gap-2 text-xs">
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatTime(row.created_at)}</span>
              <span
                className={cn(
                  "min-w-0 break-words",
                  row.severity === "error" && "text-destructive",
                  row.severity === "warning" && "text-amber-600 dark:text-amber-400",
                  row.severity === "muted" && "text-muted-foreground",
                )}
              >
                {row.text}
                {row.duration_ms != null ? (
                  <span className="ml-1 text-muted-foreground">({row.duration_ms}ms)</span>
                ) : null}
              </span>
            </li>
          ))}
          {!rows.length ? (
            <li className="py-6 text-center text-xs text-muted-foreground">
              {problemsOnly ? "No problems reported." : "No activity yet."}
            </li>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  )
}
