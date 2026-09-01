import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight } from "@/components/icons"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { buildTranscript } from "@/hooks/workflow-timeline-model"
import { TaskStatusIcon, formatDuration, stageLabel, taskStatusLabel } from "./task-status"

/**
 * A generation run as one scrolling transcript.
 *
 * This replaced a Timeline / Review / Versions / Activity tab strip. Tabs were
 * wrong for the same reason they would be wrong in a terminal: the run is a
 * sequence, and the review pause is a moment *in* that sequence, not a separate
 * place. With tabs, the pause happened somewhere the reviewer was not looking —
 * the timeline just stopped moving, and the only hint was a dot on a tab. The
 * artifact and its decision now arrive inline at the tail of the feed, in the
 * position where the run is actually waiting.
 *
 * Steps nest under the unit of work they belong to (see `buildTranscript`), and
 * finished groups collapse to a single line, so the live work stays near the
 * bottom instead of being pushed off by eighty rows of completed history.
 */
export function GenerationTranscript({
  tasks,
  currentTaskId,
  /** Rendered at the tail of the feed — the pending review, if there is one. */
  children,
  emptyMessage = "Waiting for the first step to start…",
  className,
}) {
  const groups = useMemo(() => buildTranscript(tasks), [tasks])
  const endRef = useRef(null)
  const pinnedToBottom = useRef(true)
  const hasTail = Boolean(children)

  // Follow the tail while the reviewer is at the bottom, but stop the moment
  // they scroll up to read something — a feed that yanks itself back down
  // mid-read is worse than no autoscroll at all.
  //
  // `hasTail` rather than `children`: a JSX element is a new object every
  // render, which would make this fire on every render instead of when the feed
  // actually grew.
  useEffect(() => {
    if (pinnedToBottom.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [groups.length, currentTaskId, hasTail])

  const onScroll = (event) => {
    const element = event.currentTarget
    pinnedToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64
  }

  const hasContent = groups.length > 0 || hasTail

  return (
    <ScrollArea className={cn("h-full", className)} onScrollCapture={onScroll}>
      <div className="space-y-1 px-1 py-2">
        {groups.map((group, index) => (
          <TranscriptGroup
            key={group.id}
            group={group}
            currentTaskId={currentTaskId}
            // The tail group is where the run is now, so it stays open. Earlier
            // groups collapse: their steps are history the reviewer can ask for.
            defaultOpen={index === groups.length - 1}
          />
        ))}

        {children ? <div className="pt-3">{children}</div> : null}

        {!hasContent ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : null}

        <div ref={endRef} className="h-px" />
      </div>
    </ScrollArea>
  )
}

function TranscriptGroup({ group, currentTaskId, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  // A group that starts collapsed and then goes live opens itself; the reviewer
  // closing it again is respected, because this only fires on the transition.
  const wasDefaultOpen = useRef(defaultOpen)
  useEffect(() => {
    if (defaultOpen && !wasDefaultOpen.current) setOpen(true)
    wasDefaultOpen.current = defaultOpen
  }, [defaultOpen])

  const isLive = group.status === "RUNNING" || group.status === "WAITING_FOR_REVIEW"
  const stepCount = group.steps.length

  return (
    <section className={cn("rounded-lg", isLive && "bg-muted/40")}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />

        <TaskStatusIcon status={group.status} />

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {group.label}
          {/* "3 of 20" once the curriculum is known, "#3" before then: the
              total is what says whether the run is nearly done, and a bare
              "#3" was the number that read as least informative in the feed. */}
          {group.itemNumber ? (
            <span className="ml-1.5 font-mono text-xs font-normal tabular-nums text-muted-foreground">
              {group.itemTotal ? `${group.itemNumber} of ${group.itemTotal}` : `#${group.itemNumber}`}
            </span>
          ) : null}
        </span>

        {!open && stepCount > 1 ? (
          <span className="shrink-0 text-xs text-muted-foreground">{stepCount} steps</span>
        ) : null}

        {/* Falls back to the status so a collapsed group with nothing timed yet
            still says something — a blank right edge read as a broken row. */}
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {group.durationMs != null
            ? formatDuration(group.durationMs)
            : taskStatusLabel(group.status).toLowerCase()}
        </span>
      </button>

      {open ? (
        <ol className="ml-[1.4rem] space-y-px border-l border-border/70 pb-1.5 pl-3">
          {group.steps.map((step) => (
            <TranscriptStep key={step.id} step={step} isCurrent={step.id === currentTaskId} />
          ))}
        </ol>
      ) : null}
    </section>
  )
}

function TranscriptStep({ step, isCurrent }) {
  const failed = step.status === "FAILED"

  return (
    <li className="py-1">
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 select-none font-mono text-xs leading-5",
            isCurrent ? "text-primary" : "text-muted-foreground/60",
          )}
        >
          {isCurrent ? "▸" : "·"}
        </span>

        <span
          className={cn(
            "min-w-0 flex-1 text-[13px] leading-5",
            isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
            failed && "text-destructive",
          )}
        >
          {stageLabel(step.stage)}
          {step.action ? (
            <span className="text-muted-foreground"> — {step.action.replace(/_/g, " ")}</span>
          ) : null}
          {step.retryCount > 0 ? (
            <span className="ml-1.5 text-amber-600 dark:text-amber-400">
              retried {step.retryCount}×
            </span>
          ) : null}
        </span>

        <span className="shrink-0 font-mono text-[11px] leading-5 tabular-nums text-muted-foreground">
          {step.durationMs != null ? formatDuration(step.durationMs) : taskStatusLabel(step.status)}
        </span>
      </div>

      {step.error ? (
        <p className="mt-1 ml-4 rounded-md bg-destructive/10 px-2 py-1 font-mono text-[11px] leading-relaxed break-words text-destructive">
          {step.error}
        </p>
      ) : null}
    </li>
  )
}

/**
 * The line at the bottom of the transcript, in the spirit of a terminal's status
 * line: what is happening right now, how long it has been happening, and the
 * controls for it. Sticky so it stays readable while the feed scrolls, because
 * "is this still running?" is the question asked most often and it should never
 * require scrolling to answer.
 */
export function GenerationStatusBar({
  status,
  stage,
  startedAt,
  live,
  connected,
  terminal,
  /** `runProgress()` output. Omit to draw the bar-less status line. */
  progress,
  /** `{ number, total }` for the item being generated, when inside a loop. */
  item,
  actions,
  className,
}) {
  const elapsed = useElapsedMs(startedAt, live)

  return (
    <div className={cn("border-t border-border bg-background/95 px-3 py-2.5", className)}>
      {progress ? <RunProgressBar {...progress} className="mb-2" /> : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TaskStatusIcon status={status} />

        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium text-foreground">{stage}</span>
          {item?.number ? (
            <span className="ml-1.5 font-mono text-xs tabular-nums text-muted-foreground">
              {item.total ? `${item.number} of ${item.total}` : `#${item.number}`}
            </span>
          ) : null}
          {live && elapsed != null ? (
            <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
              {formatDuration(elapsed)}
            </span>
          ) : null}
          {!terminal && connected === false ? (
            <span className="ml-2 text-xs text-muted-foreground">reconnecting…</span>
          ) : null}
        </span>

        {progress?.percent != null ? (
          <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-foreground">
            {progress.percent}%
          </span>
        ) : null}

        {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
      </div>
    </div>
  )
}

/**
 * How far through the run is, as a bar.
 *
 * Indeterminate until the curriculum is planned: until then the run genuinely
 * has no denominator (see `runProgress`), and a bar guessing at one would be
 * inventing a number the reviewer has no way to check. A sweeping bar says
 * "working, length unknown" instead.
 *
 * The percentage is repeated as text beside it, because a bar alone is only
 * readable to within about a quarter and "is this a third done or nearly
 * finished" is the entire question being asked.
 */
function RunProgressBar({ percent, done, total, className }) {
  const indeterminate = percent == null

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : percent}
      aria-valuetext={
        indeterminate
          ? "Planning the curriculum — remaining work not known yet"
          : `${percent}%, step ${done} of ${total}`
      }
      className={cn("h-1 w-full overflow-hidden rounded-full bg-border", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary",
          indeterminate
            ? "w-1/3 animate-progress-sweep"
            : "transition-[width] duration-700 ease-out",
        )}
        style={indeterminate ? undefined : { width: `${percent}%` }}
      />
    </div>
  )
}

/** Milliseconds since `startedAt`, ticking while `active`. */
function useElapsedMs(startedAt, active) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active || !startedAt) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active, startedAt])

  if (!startedAt) return null
  const started = new Date(startedAt).getTime()
  if (Number.isNaN(started)) return null
  return Math.max(0, now - started)
}
