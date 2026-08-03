import { CheckCircle2, Loader2, Sparkles } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * Progress for the hand-off between clicking Generate and landing in the
 * generation workspace.
 *
 * Driven by real state, not a timer. The version this replaces advanced its
 * steps every 4 seconds regardless of what the backend was doing, so it would
 * claim "Queuing the curriculum build" whether or not that had happened — and
 * on a slow upload it sat on the last step looking finished while the request
 * was still in flight.
 *
 * Only three things actually happen here, and all three are observable:
 *
 *   1. bytes upload            -> real percentage from axios
 *   2. the server ingests them -> upload done, response not back yet
 *   3. the build is queued     -> response returned, navigating away
 *
 * Generation itself is deliberately not represented: it runs for minutes in the
 * background and has its own live timeline in the workspace. Showing it here
 * would duplicate that, and worse, would go stale the moment this modal closes.
 */
export function GenerationHandoffProgress({ phase, uploadPercent, fileCount }) {
  if (phase === "idle") return null

  const steps = [
    {
      key: "upload",
      label:
        uploadPercent > 0 && uploadPercent < 100
          ? `Uploading ${fileCount} ${fileCount === 1 ? "document" : "documents"} — ${uploadPercent}%`
          : `Uploading ${fileCount} ${fileCount === 1 ? "document" : "documents"}`,
      done: phase !== "uploading",
      active: phase === "uploading",
    },
    {
      key: "processing",
      label: "Storing and indexing your source material",
      done: phase === "queued",
      active: phase === "processing",
    },
    {
      key: "queued",
      label: "Queuing the curriculum build",
      done: false,
      active: phase === "queued",
    },
  ]

  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">Starting AI generation</span>
      </div>

      {/* A determinate bar while bytes are moving; indeterminate afterwards,
          because server-side ingestion reports no percentage and a bar that
          keeps creeping would be inventing information. */}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {phase === "uploading" ? (
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${uploadPercent}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        )}
      </div>

      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-xs">
            {step.done ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : step.active ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
            ) : (
              <span className="size-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
            )}
            <span
              className={cn(
                step.active && "font-medium text-foreground",
                !step.active && !step.done && "text-muted-foreground",
                step.done && "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        Generation itself runs in the background — you'll be taken to its live
        timeline, and you can leave that page and come back at any time.
      </p>
    </div>
  )
}
