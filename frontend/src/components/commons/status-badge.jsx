import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Shared weak → mastered scale, on the same rb-* accent tokens Bento/mastery
 * tiles use elsewhere — so a "weak" pill on the mistakes bank reads as the
 * same severity as a "weak" tile on the progress dashboard.
 */
export const MASTERY_TONE = {
  weak: {
    label: "Weak",
    classes: "border-rb-cardinal/30 bg-rb-cardinal-wash text-rb-cardinal-lip dark:bg-[#3a1414]",
  },
  developing: {
    label: "Developing",
    classes: "border-rb-fox/30 bg-rb-fox-wash text-rb-fox-lip dark:bg-[#3a2a12]",
  },
  good: {
    label: "Good",
    classes: "border-rb-feather/30 bg-rb-feather-wash text-rb-feather-ink dark:bg-[#152744]",
  },
  mastered: {
    label: "Mastered",
    classes: "border-rb-bee/30 bg-rb-bee-wash text-rb-bee-ink dark:bg-[#12333a]",
  },
}

export function MasteryBadge({ status, className, ...props }) {
  const normalized = String(status ?? "weak").toLowerCase()
  const tone = MASTERY_TONE[normalized] ?? MASTERY_TONE.weak

  return (
    <Badge variant="outline" className={cn(tone.classes, className)} {...props}>
      {tone.label}
    </Badge>
  )
}
