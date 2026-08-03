import { ClipboardCheckIcon, HourglassIcon } from "@/components/icons"

import { Badge } from "@/components/ui/badge"

const STATUS_LABEL = {
  PENDING: "Pending",
  SCORED: "Scored",
  MANUAL: "Manual review",
}

// Backend-driven rubric for a diagram/descriptive item. Awarded points show
// only when the backend fills them in (after evaluation); otherwise each line
// shows its max points and a pending state. Never renders reference answers.
export default function RubricPanel({ rubric, notice }) {
  const list = Array.isArray(rubric) ? rubric : []
  const totalMax = list.reduce(
    (sum, item) => sum + (item.maxPoints != null ? Number(item.maxPoints) : 0),
    0
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <ClipboardCheckIcon className="size-4" aria-hidden="true" />
          Rubric
        </h4>
        {totalMax > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalMax} pts total
          </span>
        ) : null}
      </div>

      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-5 text-muted-foreground">
          <HourglassIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No rubric is configured for this item.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((criterion, index) => {
            const scored = criterion.awardedPoints != null
            return (
              <li key={index} className="rounded-lg border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{criterion.name}</span>
                  <Badge variant={scored ? "default" : "outline"}>
                    {scored
                      ? `${Number(criterion.awardedPoints)} / ${Number(criterion.maxPoints)}`
                      : `${Number(criterion.maxPoints)} pts`}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {criterion.feedback ??
                    STATUS_LABEL[criterion.status] ??
                    "Pending"}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
