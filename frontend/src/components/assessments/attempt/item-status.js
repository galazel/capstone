import {
  CheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  FlagIcon,
  SkipForwardIcon,
} from "lucide-react"

// Single source of truth for item states so the navigator cards, the legend,
// and screen-reader labels never drift. States are conveyed with icon + border
// + text, never color alone.
// Colours mirror the navigator shown on the landing hero so the marketing
// promise and the real exam surface read as the same product: Macaw = answered,
// Bee = flagged, Eel outline = where you are, Swan = untouched.
export const ITEM_STATUS = {
  current: {
    key: "current",
    label: "Current",
    icon: CircleDotIcon,
    card: "border-rb-eel bg-rb-snow text-rb-eel shadow-[0_3px_0_var(--color-rb-swan)]",
    dot: "text-rb-eel",
  },
  answered: {
    key: "answered",
    label: "Answered",
    icon: CheckIcon,
    card: "border-rb-macaw bg-rb-macaw text-rb-snow",
    dot: "text-rb-macaw",
  },
  partial: {
    key: "partial",
    label: "Partially answered",
    icon: CircleDotIcon,
    card: "border-rb-fox bg-rb-fox-wash text-rb-fox-lip",
    dot: "text-rb-fox",
  },
  skipped: {
    key: "skipped",
    label: "Skipped",
    icon: SkipForwardIcon,
    card: "border-dashed border-rb-hare bg-rb-polar text-rb-wolf",
    dot: "text-rb-hare",
  },
  unanswered: {
    key: "unanswered",
    label: "Not answered",
    icon: CircleDashedIcon,
    card: "border-rb-swan bg-rb-polar text-rb-hare",
    dot: "text-rb-hare",
  },
}

export const FLAG_META = { label: "Flagged", icon: FlagIcon }

// Derives the base status of an item (current/flagged are overlays applied
// on top of this by the card component).
export function deriveItemStatus(item) {
  const hasSubs = (item.subQuestionCount ?? 0) > 0
  if (item.answered && hasSubs && item.subAnsweredCount < item.subQuestionCount) {
    return ITEM_STATUS.partial
  }
  if (item.answered) return ITEM_STATUS.answered
  if (item.skipped) return ITEM_STATUS.skipped
  return ITEM_STATUS.unanswered
}
