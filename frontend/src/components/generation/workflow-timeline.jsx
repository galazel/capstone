import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { TaskStatusIcon, formatDuration, stageLabel, taskStatusLabel } from "./task-status"

/**
 * The run as a list of tasks, in the order they happened.
 *
 * This is the part that replaces a loading spinner: a twenty-lesson
 * certification takes many minutes, and the difference between "something is
 * happening" and "writing lesson 7 of 20, the last one took 34s" is the whole
 * point of streaming node events.
 */
export function WorkflowTimeline({ tasks, currentTaskId, className }) {
  const endRef = useRef(null)
  const pinnedToBottom = useRef(true)

  // Follow the tail while the reviewer is at the bottom, but stop fighting them
  // the moment they scroll up to read something — a timeline that yanks itself
  // back down mid-read is worse than no autoscroll.
  useEffect(() => {
    if (pinnedToBottom.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [tasks.length])

  const onScroll = (event) => {
    const el = event.currentTarget
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  if (!tasks.length) {
    return (
      <p className={cn("py-10 text-center text-sm text-muted-foreground", className)}>
        Waiting for the first task to start…
      </p>
    )
  }

  return (
    <ScrollArea className={cn("h-full", className)} onScrollCapture={onScroll}>
      <ol className="space-y-1 pr-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={cn(
              "flex items-start gap-3 rounded-md px-2 py-2 text-sm",
              task.id === currentTaskId && "bg-muted",
            )}
          >
            <span className="mt-0.5">
              <TaskStatusIcon status={task.status} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{stageLabel(task.stage)}</span>
                {task.itemNumber ? (
                  <span className="text-xs text-muted-foreground">#{task.itemNumber}</span>
                ) : null}
                {task.durationMs != null ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDuration(task.durationMs)}
                  </span>
                ) : null}
                {task.retryCount > 0 ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    retried {task.retryCount}×
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {taskStatusLabel(task.status)}
                {task.action ? ` — ${task.action.replace(/_/g, " ")}` : ""}
              </span>
              {task.error ? (
                <span className="mt-1 block break-words rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {task.error}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <div ref={endRef} />
    </ScrollArea>
  )
}
