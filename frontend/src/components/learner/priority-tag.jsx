import { AlertCircle, TrendingUp, Zap, BookOpen, CheckCircle, Clock } from "@/components/icons"

// Priority tags remapped onto the design system palette. Labels, icons and
// descriptions are unchanged — only the colours move onto the Rebyu ramp
// (Cardinal -> Fox -> Bee -> Macaw -> Feather) so priority reads as one scale.
export const PRIORITY_CONFIG = {
  CRITICAL_PRIORITY: {
    label: '🔴 Critical',
    // Descriptions say what the tag measures, not just what to do about it.
    // "Strong" beside "Critical" in a list headed "priority" read as *strong
    // priority* -- the most urgent thing on the page -- when it means the
    // opposite: the lesson BKT is most confident you know.
    mastery: 'Lowest mastery',
    bgColor: 'bg-rb-cardinal-wash',
    textColor: 'text-rb-cardinal-lip',
    icon: AlertCircle,
    description: 'Focus here first',
  },
  HIGH_PRIORITY: {
    label: '🟠 High Priority',
    mastery: 'Low mastery',
    bgColor: 'bg-rb-fox-wash',
    textColor: 'text-rb-fox-lip',
    icon: Zap,
    description: 'Important to review',
  },
  MEDIUM_PRIORITY: {
    label: '🟡 Medium',
    mastery: 'Middling mastery',
    bgColor: 'bg-rb-bee-wash',
    textColor: 'text-rb-bee-ink',
    icon: BookOpen,
    description: 'Good to practice',
  },
  LOW_PRIORITY: {
    label: '🔵 Low',
    mastery: 'Good mastery',
    bgColor: 'bg-rb-macaw-wash',
    textColor: 'text-rb-macaw-lip',
    icon: TrendingUp,
    description: 'Optional review',
  },
  STRONG: {
    label: '✅ Mastered',
    mastery: 'Highest mastery',
    bgColor: 'bg-rb-feather-wash',
    textColor: 'text-rb-feather-ink',
    icon: CheckCircle,
    description: 'Nothing to review here',
  },
  ON_TRACK: {
    label: '⭐ On Track',
    bgColor: 'bg-rb-polar',
    textColor: 'text-rb-wolf',
    icon: Clock,
    description: 'Making good progress',
  },
  NOT_ENOUGH_DATA: {
    label: '❓ Insufficient Data',
    bgColor: 'bg-rb-polar',
    textColor: 'text-rb-hare',
    icon: Clock,
    description: 'Take more assessments',
  },
  NEEDS_REASSESSMENT: {
    label: '🔄 Reassess',
    bgColor: 'bg-rb-beetle-wash',
    textColor: 'text-rb-beetle-lip',
    icon: Clock,
    description: 'Assessment expired',
  },
}

export function PriorityTag({ tag, size = 'md', showDescription = false }) {
  if (!tag) return null

  const config = PRIORITY_CONFIG[tag]
  if (!config) return null

  const Icon = config.icon
  const sizeClass = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }[size] || 'px-3 py-1.5 text-sm'

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${config.bgColor} ${config.textColor} ${sizeClass} w-fit`}
      >
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
      {showDescription && (
        <p className="text-xs text-muted-foreground">{config.description}</p>
      )}
    </div>
  )
}

// Solid fills for the seal badge -- CSS custom properties from the rebyu-ds
// theme (see styles/rebyu-ds.css @theme) rather than Tailwind class names,
// since an inline SVG `fill` attribute can't take a `fill-rb-*` utility class.
const SEAL_CONFIG = {
  // The BKT priority tags.
  CRITICAL_PRIORITY: { fill: "var(--color-rb-cardinal)", short: "critical" },
  HIGH_PRIORITY: { fill: "var(--color-rb-fox)", short: "high" },
  MEDIUM_PRIORITY: { fill: "var(--color-rb-bee)", short: "medium" },
  LOW_PRIORITY: { fill: "var(--color-rb-macaw)", short: "low" },
  STRONG: { fill: "var(--color-rb-feather)", short: "mastered" },
  ON_TRACK: { fill: "var(--color-rb-macaw)", short: "on track" },
  NOT_ENOUGH_DATA: { fill: "var(--color-rb-hare)", short: "no data" },
  NEEDS_REASSESSMENT: { fill: "var(--color-rb-beetle)", short: "reassess" },

  /* The tags the progress-analytics recommender mints itself, which are not
     BKT priority tags and were missing here. `PrioritySeal` renders nothing for
     a tag it does not know, so the *most urgent* rows on the recommended tile —
     the ones the backend labels HIGHEST_PRIORITY — were the only ones arriving
     with no seal, while the tamer HIGH/MEDIUM rows below them got one. */
  HIGHEST_PRIORITY: { fill: "var(--color-rb-cardinal)", short: "highest" },
  REPEATED_MISTAKE: { fill: "var(--color-rb-fox)", short: "missed" },
  UNASSESSED: { fill: "var(--color-rb-hare)", short: "new" },
}

/**
 * A lesson's priority as a bookmark ribbon.
 *
 * The pill (`PriorityTag`) states the priority in words, which is right where
 * there is a line to spare; in a list of lessons there is not, and a stack of
 * coloured pills reads as chatter rather than as an order to study in. A
 * bookmark is the mark you leave on a page you have to come back to, so a row
 * carrying one is a row asking for attention -- and the colour says how badly,
 * on the same Cardinal -> Fox -> Bee -> Macaw -> Feather ramp the pills use.
 *
 * Colour is the whole message, so it is never the only one: the label goes to
 * screen readers through `role="img"` + `aria-label`, and to everyone else
 * through the native tooltip, which also carries the mastery behind the tag
 * when it is known.
 *
 * Fills come from SEAL_CONFIG rather than a second table -- the two marks
 * showing different colours for the same tag is exactly the sort of drift a
 * shared module exists to prevent.
 */
export function PriorityBookmark({ tag, masteryProbability, size = 16 }) {
  if (!tag) return null

  const config = SEAL_CONFIG[tag]
  if (!config) return null

  const mastery =
    typeof masteryProbability === "number" && Number.isFinite(masteryProbability)
      ? ` — ${Math.round(masteryProbability * 100)}% mastered`
      : ""

  /* "mastered priority" is not a thing. The bottom two tags describe a state
     rather than a call to review, so they are read as one, and only the urgency
     tags take the word. */
  const label = ["mastered", "on track", "no data"].includes(config.short)
    ? config.short
    : `${config.short} priority`

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size * 1.25}
      className="shrink-0"
      role="img"
      aria-label={`${label}${mastery}`}
    >
      <title>{`${label}${mastery}`}</title>
      {/* A ribbon with a notched foot: full width to the shoulders, then in to
          the notch and back out, so it reads as a bookmark at 16px rather than
          as a rounded rectangle. */}
      <path
        d="M5 2h14a1 1 0 0 1 1 1v19l-8-5.2L4 22V3a1 1 0 0 1 1-1z"
        fill={config.fill}
      />
    </svg>
  )
}

/**
 * The priority as one more chip in a meta row.
 *
 * `PriorityTag` is a pill of its own design -- emoji, its own padding, its own
 * radius -- which is fine where it stands alone, and wrong beside a row of
 * `rb-chip`s: the lesson header had four chips with line icons and then one
 * pill with a coloured circle emoji in it, at a different height. This is the
 * same badge in the row's own clothes: chip geometry, the tag's wash and ink,
 * and the bookmark mark instead of the emoji so the two places a learner meets
 * a priority use one glyph.
 */
export function PriorityChip({ tag, masteryProbability }) {
  if (!tag) return null

  const config = PRIORITY_CONFIG[tag]
  const seal = SEAL_CONFIG[tag]
  if (!config || !seal) return null

  // The emoji is decoration on a label that already has a colour and a mark.
  const words = config.label.replace(/^[^\p{L}]+/u, "")

  return (
    <span
      className={`rb-chip ${config.bgColor} ${config.textColor}`}
      title={config.mastery ? `${words} — ${config.mastery}` : words}
    >
      <PriorityBookmark tag={tag} masteryProbability={masteryProbability} size={11} />
      {words}
    </span>
  )
}

/** A 20-point zigzag ring, computed once at module load. */
const SEAL_OUTLINE = (() => {
  const spikes = 20
  const outerR = 48
  const innerR = 41
  const cx = 50
  const cy = 50
  const points = []

  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI * i) / spikes
    const x = cx + r * Math.sin(angle)
    const y = cy - r * Math.cos(angle)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }

  return points.join(" ")
})()

/**
 * The seal/stamp badge -- a jagged-edge rosette with the priority stamped
 * across a band through its middle, echoing a certificate seal. Reserved for
 * spots where a priority is the headline of the row (recommended topics);
 * `PriorityTag` stays the everyday inline pill everywhere else.
 */
export function PrioritySeal({ tag, size = 56 }) {
  if (!tag) return null

  const config = SEAL_CONFIG[tag]
  if (!config) return null

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label={`${config.short} priority`}
    >
      <polygon points={SEAL_OUTLINE} fill={config.fill} />
      <rect x="0" y="42" width="100" height="16" fill="white" />
      <text
        x="50"
        y="53.5"
        textAnchor="middle"
        fontSize={config.short.length > 7 ? "10" : "13"}
        fontWeight="800"
        letterSpacing="0.5"
        fill={config.fill}
        style={{ textTransform: "uppercase", fontFamily: "inherit" }}
      >
        {config.short}
      </text>
    </svg>
  )
}

export function PriorityBadge({ tag, masteryPercentage }) {
  if (!tag) return null

  const config = PRIORITY_CONFIG[tag]
  if (!config) return null

  return (
    <div className={`rounded-md ${config.bgColor} ${config.textColor} px-2 py-1.5`}>
      <p className="text-xs font-semibold">{config.label}</p>
      {masteryPercentage !== undefined && (
        <p className="text-xs opacity-75">
          {Math.round(masteryPercentage * 100)}% mastered
        </p>
      )}
    </div>
  )
}
