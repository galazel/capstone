import { Loader2Icon } from "@/components/icons"

import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"
import FeatureLockState from "./feature-lock-state.jsx"

// ---------------------------------------------------------------------------
// TEMPORARY UI PREVIEW BYPASS — set back to false before shipping.
//
// Renders premium surfaces unlocked so the new designs can be reviewed without
// a Pro entitlement. This is presentation only: every protected endpoint is
// still enforced server-side, so flipping this cannot leak paid data — it just
// shows the UI. Revert by setting this to false; nothing else changes.
// ---------------------------------------------------------------------------
const PREVIEW_UNLOCK_ALL_PRO_FEATURES = true

// Wrap premium UI so protected content never renders (or flashes) unless the
// backend confirms the learner has the feature. Backend controllers still
// enforce independently — this is a UX layer, not the security boundary.
export default function LearnerPremiumGuard({
  feature,
  certificationId,
  title,
  description,
  compact = false,
  children,
}) {
  const entitlements = useLearnerEntitlements(certificationId)

  if (PREVIEW_UNLOCK_ALL_PRO_FEATURES) {
    return typeof children === "function" ? children(entitlements) : children
  }

  if (entitlements.isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (!entitlements.hasFeature(feature)) {
    return (
      <div className={`relative isolate ${compact ? "min-h-72" : "min-h-[calc(100vh-8rem)]"}`}>
        <div
          className="pointer-events-none select-none blur-sm"
          aria-hidden="true"
          inert=""
        >
          {typeof children === "function" ? children(entitlements) : children}
        </div>

        <div
          className="absolute inset-0 z-50 flex items-start justify-center bg-background/20 px-4"
          aria-modal="true"
          role="dialog"
          aria-label="Pro Feature"
        >
          <div className={compact ? "w-full" : "sticky top-1/2 w-full -translate-y-1/2"}>
            <FeatureLockState
              title={title}
              description={description}
            />
          </div>
        </div>
      </div>
    )
  }

  return typeof children === "function" ? children(entitlements) : children
}
