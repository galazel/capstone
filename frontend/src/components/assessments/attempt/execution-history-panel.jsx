import { HistoryIcon, Loader2Icon } from "@/components/icons"

import { Badge } from "@/components/ui/badge"

const STATUS_VARIANT = {
  UNAVAILABLE: "outline",
  QUEUED: "secondary",
  RUNNING: "secondary",
  COMPLETED: "default",
  ERROR: "destructive",
}

function formatWhen(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

// Right-panel "Executions" tab: recent Run/Check history for this item.
export default function ExecutionHistoryPanel({ executions, loading }) {
  const list = Array.isArray(executions) ? executions : []

  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        Loading executions…
      </p>
    )
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <HistoryIcon className="size-5" aria-hidden="true" />
        <p>No runs yet. Use Run or Check to test your code.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {list.map((execution) => (
        <li
          key={execution.executionId}
          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              {execution.mode}
              {execution.language ? (
                <span className="text-xs font-normal text-muted-foreground">
                  · {execution.language}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatWhen(execution.createdAt)}
              {execution.totalTests != null
                ? ` · ${execution.passedTests ?? 0}/${execution.totalTests} tests`
                : ""}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[execution.status] ?? "secondary"}>
            {execution.status}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
