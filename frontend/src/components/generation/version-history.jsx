import { useMemo, useState } from "react"
import { RotateCcw } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Every version of the artifact under review, with a side-by-side diff and a way
 * back to any of them.
 *
 * Versions are append-only: restoring r1 after r5 records a *new* r6 carrying
 * r1's content rather than deleting r2–r5. So this list stays an accurate record
 * of what was tried — "we went back to the first draft" is itself information
 * worth keeping.
 *
 * Sized by its content, not by its container. It used to stretch to `h-full`,
 * which only worked as a tab panel; inside the review card it collapsed flat.
 */

const SOURCE_LABELS = {
  AI_GENERATED: { label: "AI generated", variant: "outline" },
  AI_IMPROVED: { label: "AI improved", variant: "outline" },
  MANUAL_EDIT: { label: "Edited by hand", variant: "secondary" },
  RESTORED: { label: "Restored", variant: "secondary" },
}

export function VersionHistory({ versions, onRestore, restoring, disabled, className }) {
  const [leftRev, setLeftRev] = useState(null)
  const [rightRev, setRightRev] = useState(null)

  const sorted = useMemo(
    () => [...(versions ?? [])].sort((a, b) => a.revision - b.revision),
    [versions],
  )

  if (!sorted.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No versions recorded yet.</p>
    )
  }

  const left = sorted.find((version) => version.revision === leftRev)
  const right = sorted.find((version) => version.revision === rightRev)
  const comparing = left && right && left.revision !== right.revision

  const toggleCompare = (revision) => {
    // Two clicks select a pair; a third starts over. Simpler than checkboxes and
    // matches how people actually compare — pick one, pick the other.
    if (leftRev === revision) return setLeftRev(null)
    if (rightRev === revision) return setRightRev(null)
    if (leftRev == null) return setLeftRev(revision)
    if (rightRev == null) return setRightRev(revision)
    setLeftRev(revision)
    setRightRev(null)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-muted-foreground">Select two revisions to compare them.</p>

      <ul className="space-y-1.5">
        {sorted.map((version) => {
          const source =
            SOURCE_LABELS[version.source] ?? { label: version.source, variant: "outline" }
          const selected = version.revision === leftRev || version.revision === rightRev
          const isLatest = version.revision === sorted[sorted.length - 1].revision

          return (
            <li key={version.revision} className="space-y-1">
              <div
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-md border border-border px-2.5 py-1.5",
                  selected && "border-primary bg-muted",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => toggleCompare(version.revision)}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    r{version.revision}
                  </span>
                  <Badge variant={source.variant}>{source.label}</Badge>
                  {isLatest ? (
                    <span className="text-xs text-muted-foreground">current</span>
                  ) : null}
                </button>

                {!isLatest ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled || restoring}
                    title={`Restore revision ${version.revision} as a new version`}
                    onClick={() => onRestore?.(version)}
                  >
                    <RotateCcw className="mr-1.5 size-3" />
                    Restore
                  </Button>
                ) : null}
              </div>

              {version.instructions ? (
                <p className="px-2.5 text-xs leading-5 italic text-muted-foreground">
                  “{version.instructions}”
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      {comparing ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Comparing r{left.revision} with r{right.revision}
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <VersionPane title={`r${left.revision}`} artifact={left.artifact} />
            <VersionPane title={`r${right.revision}`} artifact={right.artifact} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function VersionPane({ title, artifact }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="border-b border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-muted-foreground">
        {title}
      </div>
      <pre className="max-h-64 overflow-auto p-2.5 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
        {JSON.stringify(artifact, null, 2)}
      </pre>
    </div>
  )
}
