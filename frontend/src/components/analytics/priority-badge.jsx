import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  CircleHelpIcon,
  MinusCircleIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
} from "@/components/icons"

import { cn } from "@/lib/utils"
import { PRIORITY_META } from "@/services/learnerAnalyticsService.js"

// Text label is always rendered, so meaning never relies on color alone.
const TONE_CLASSES = {
  critical:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  high:
    "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
  medium:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  low:
    "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  reassess:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  muted:
    "border-border bg-muted text-muted-foreground",
  ontrack:
    "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300",
  strong:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
}

const TONE_ICONS = {
  critical: AlertOctagonIcon,
  high: AlertTriangleIcon,
  medium: AlertTriangleIcon,
  low: MinusCircleIcon,
  reassess: RotateCcwIcon,
  muted: CircleHelpIcon,
  ontrack: TrendingUpIcon,
  strong: ShieldCheckIcon,
}

/**
 * Compact, accessible priority chip. Shows an icon + text label and exposes the
 * reason and score via the title tooltip. Never encodes meaning with color only.
 */
export default function PriorityBadge({ tag, score, reason, className }) {
  const meta = PRIORITY_META[tag] ?? { label: tag ?? "Unknown", tone: "muted" }
  const Icon = TONE_ICONS[meta.tone] ?? CircleHelpIcon
  const tooltip = [
    meta.label,
    score != null ? `Score ${Number(score).toFixed(0)}/100` : null,
    reason || null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[meta.tone] ?? TONE_CLASSES.muted,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  )
}
