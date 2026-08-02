import { SparklesIcon } from "@/components/icons"

import { cn } from "@/lib/utils"

// Small "Pro" marker for premium features.
export default function ProBadge({ className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary",
        className
      )}
    >
      <SparklesIcon className="size-3" aria-hidden="true" />
      Pro
    </span>
  )
}
