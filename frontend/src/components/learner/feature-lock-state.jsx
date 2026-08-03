import { Link } from "react-router-dom"
import { LockIcon } from "@/components/icons"

import { Button } from "@/components/ui/button"
// Reusable lock card shown above a blurred premium-content preview.
export default function FeatureLockState({
  title = "Pro Feature",
  description = "This feature requires a Pro subscription. Upgrade to unlock it.",
  compact = false,
}) {
  if (compact) {
    return (
      <div className="flex flex-col gap-4 border-y border-border bg-accent/35 px-4 py-5 sm:flex-row sm:items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <LockIcon className="size-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/learner/subscription">Upgrade to Pro</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border bg-card/95 p-8 text-center shadow-2xl">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <LockIcon className="size-6 text-primary" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Button asChild className="w-full sm:w-auto">
        <Link to="/learner/subscription">Upgrade to Pro</Link>
      </Button>
    </div>
  )
}
