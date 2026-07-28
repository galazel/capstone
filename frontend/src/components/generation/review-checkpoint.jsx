import { useState } from "react"
import { ChevronDown, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ArtifactViewer } from "./artifact-viewer"
import { ReviewActions } from "./review-panel"
import { ValidationReport } from "./validation-report"
import { VersionHistory } from "./version-history"
import { stageLabel } from "./task-status"

/**
 * The review pause, announced inline at the tail of the transcript.
 *
 * Modelled on a terminal permission prompt: the run has stopped exactly here, so
 * the notice appears exactly here — one line saying what is waiting and a button
 * to open it. The artifact itself needs room to be read properly, which a lane
 * in a scrolling feed cannot give it, so reading and deciding happen in a modal
 * sized for the job.
 *
 * The amber left edge is the only strong colour in the transcript. It is what
 * makes "the run is waiting on you" visible from a glance at the scrollbar.
 */
export function ReviewCheckpoint({
  review,
  versions,
  submitting,
  onSubmit,
  onRestore,
  className,
}) {
  const [open, setOpen] = useState(false)

  if (!review) return null

  const {
    stage,
    item_label: label,
    item_index: index,
    item_total: total,
    payload,
    validation_report: report,
  } = review

  const position = total ? `${(index ?? 0) + 1} of ${total}` : null

  // Every decision moves the run on, so none of them leave anything to look at.
  // A dialog left open over the next item's transcript would show a stale
  // artifact with live buttons.
  const submit = (decision) => {
    setOpen(false)
    onSubmit?.(decision)
  }

  return (
    <>
      <section
        className={cn(
          "flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border border-l-2 border-border border-l-amber-500 bg-amber-500/[0.06] px-3.5 py-3",
          className,
        )}
      >
        <UserCheck className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />

        <span className="text-sm font-semibold text-foreground">Waiting for your review</span>

        <Badge variant="outline">{stageLabel(stage)}</Badge>

        {label ? (
          <span className="min-w-0 truncate text-sm text-muted-foreground">{label}</span>
        ) : null}

        {position ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{position}</span>
        ) : null}

        <Button size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          Review this item
        </Button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* `sm:max-w-none` is load-bearing: DialogContent ships with
            `sm:max-w-lg`, and an unprefixed `max-w-none` does not override it —
            tailwind-merge treats the two breakpoints as separate utilities. */}
        <DialogContent className="flex h-[88vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[92vw] sm:max-w-none lg:w-[84vw] xl:w-[72rem]">
          <DialogHeader className="gap-1.5 border-b border-border px-6 py-4 pr-14 text-left">
            <DialogTitle className="flex flex-wrap items-center gap-2.5 text-lg">
              {stageLabel(stage)}
              {position ? (
                <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
                  item {position}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {label
                ? label
                : "Read what was generated, then approve it or send it back for another pass."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="space-y-5">
              {report ? <ValidationReport report={report} /> : null}

              <ArtifactViewer payload={payload} />

              <VersionDisclosure
                versions={versions}
                restoring={submitting}
                onRestore={(version) => {
                  setOpen(false)
                  onRestore?.(version)
                }}
              />
            </div>
          </div>

          {/* The decision stays pinned below the content: an admin who has just
              read to the bottom of a twenty-question batch should not have to
              scroll back up to act on it. */}
          <div className="border-t border-border bg-background px-6 py-4">
            <ReviewActions
              payload={payload}
              total={total}
              submitting={submitting}
              onSubmit={submit}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function VersionDisclosure({ versions, restoring, onRestore }) {
  const [open, setOpen] = useState(false)
  const count = versions?.length ?? 0

  if (count < 2) return null

  return (
    <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
        {count} versions of this item
      </button>

      {open ? (
        <div className="pt-3">
          <VersionHistory versions={versions} restoring={restoring} onRestore={onRestore} />
        </div>
      ) : null}
    </div>
  )
}
