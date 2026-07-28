import { FlagIcon, LayersIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { deriveItemStatus, ITEM_STATUS } from "./item-status.js"

// One item in the navigator. Shows number, points, status (icon + border +
// text), a flag overlay, and — for parent items — the sub-question count and
// completion. Never relies on color alone.
export default function ItemNavigatorCard({ item, index, isCurrent, onJump }) {
  const status = isCurrent ? ITEM_STATUS.current : deriveItemStatus(item)
  const StatusIcon = status.icon
  const hasSubs = (item.subQuestionCount ?? 0) > 0

  const srLabel = [
    `Item ${index + 1}`,
    item.points != null ? `${Number(item.points)} points` : null,
    status.label,
    item.flagged ? "flagged" : null,
    hasSubs
      ? `${item.subAnsweredCount ?? 0} of ${item.subQuestionCount} sub-questions answered`
      : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <button
      type="button"
      onClick={() => onJump(index)}
      aria-current={isCurrent ? "true" : undefined}
      aria-label={srLabel}
      className={cn(
        "relative flex min-h-16 flex-col justify-between rounded-xl border-2 p-2 text-left font-bold outline-none transition",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw",
        "active:translate-y-[2px]",
        status.card
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-semibold leading-none">{index + 1}</span>
        <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
      </div>

      <div className="flex items-end justify-between gap-1">
        {item.points != null ? (
          <span className="text-[10px] font-medium leading-none tabular-nums opacity-80">
            {Number(item.points)} pt
          </span>
        ) : (
          <span />
        )}
        {hasSubs ? (
          <span className="flex items-center gap-0.5 text-[10px] font-medium leading-none tabular-nums opacity-80">
            <LayersIcon className="size-3" aria-hidden="true" />
            {item.subAnsweredCount ?? 0}/{item.subQuestionCount}
          </span>
        ) : null}
      </div>

      {item.flagged ? (
        <FlagIcon
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 size-4 fill-rb-bee text-rb-bee-lip"
        />
      ) : null}
    </button>
  )
}
