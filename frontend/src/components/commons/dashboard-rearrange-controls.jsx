import { Check, GripHorizontal } from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * The control cluster that puts a board into arrange mode.
 *
 * Read left to right, the two ways out of the mode sit before the one way to
 * keep it: put everything back, abandon this session's changes, accept them.
 * The confirm is last because it is where the hand ends up, and because a
 * destructive-ish control should never be the one under the finger that just
 * finished dragging.
 *
 * Icon only, and a mode rather than a permanent affordance: drag handles on
 * every tile all the time are clutter on the many visits where the page is only
 * being read. The label is on the button for screen readers and as a tooltip
 * for everyone else -- an unlabelled icon is a guess otherwise.
 */
export function DashboardRearrangeControls({
  rearranging,
  onStart,
  onFinish,
  onCancel,
  onReset,
}) {
  return (
    <>
      {rearranging ? (
        <>
          <Button variant="ghost" onClick={onReset}>
            Reset layout
          </Button>

          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </>
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={rearranging ? "default" : "outline"}
            size="icon"
            aria-pressed={rearranging}
            aria-label={rearranging ? "Keep this arrangement" : "Rearrange tiles"}
            onClick={rearranging ? onFinish : onStart}
          >
            {rearranging ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <GripHorizontal className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>

        <TooltipContent side="bottom">
          {rearranging ? "Keep this arrangement" : "Rearrange tiles"}
        </TooltipContent>
      </Tooltip>
    </>
  )
}
