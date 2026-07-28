import { FLAG_META, ITEM_STATUS } from "./item-status.js"

// Compact legend so item states are understandable without relying on color.
export default function ItemStatusLegend() {
  const entries = [
    ITEM_STATUS.current,
    ITEM_STATUS.answered,
    ITEM_STATUS.unanswered,
    ITEM_STATUS.skipped,
    { key: "flagged", label: FLAG_META.label, icon: FLAG_META.icon },
  ]

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-semibold text-rb-wolf">
      {entries.map((entry) => {
        const Icon = entry.icon
        return (
          <li key={entry.key} className="flex items-center gap-1.5">
            <Icon className={`size-3.5 shrink-0 ${entry.dot ?? "text-rb-bee"}`} aria-hidden="true" />
            <span>{entry.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
