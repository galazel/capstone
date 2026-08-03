/**
 * The arena card, generalised.
 *
 * The challenge carousel's card is the shape the product liked: a saturated
 * gradient cap with two translucent bubbles behind a circular icon medallion,
 * sitting on a body in the matching pastel wash. This module is that card with
 * its content knocked out, so any page can use it without re-inventing the
 * gradient or guessing which wash goes with which accent.
 *
 * A tone is a matched set — gradient cap, body wash, and the ink that stays
 * legible on that wash. Pick a tone per entity, never per rank or value, so the
 * same thing keeps the same colour across pages.
 */

export const BUBBLE_TONES = {
  macaw: {
    accent: "linear-gradient(135deg, #1B6EF3, #1CB0F6)",
    surface: "bg-rb-macaw-wash dark:bg-[#12283d]",
    ink: "text-rb-macaw-lip",
    chip: "bg-rb-macaw-wash text-rb-macaw-lip",
  },
  beetle: {
    accent: "linear-gradient(135deg, #B061E6, #CE82FF)",
    surface: "bg-rb-beetle-wash dark:bg-[#2a1f3a]",
    ink: "text-rb-beetle-lip",
    chip: "bg-rb-beetle-wash text-rb-beetle-lip",
  },
  fox: {
    accent: "linear-gradient(135deg, #E08600, #FF9600)",
    surface: "bg-rb-fox-wash dark:bg-[#3a2a12]",
    ink: "text-rb-fox-lip",
    chip: "bg-rb-fox-wash text-rb-fox-lip",
  },
  bee: {
    accent: "linear-gradient(135deg, #0092A8, #00B8D4)",
    surface: "bg-rb-bee-wash dark:bg-[#12333a]",
    ink: "text-rb-bee-lip",
    chip: "bg-rb-bee-wash text-rb-bee-lip",
  },
  feather: {
    accent: "linear-gradient(135deg, #1553C4, #1B6EF3)",
    surface: "bg-rb-feather-wash dark:bg-[#152744]",
    ink: "text-rb-feather-lip",
    chip: "bg-rb-feather-wash text-rb-feather-lip",
  },
  cardinal: {
    accent: "linear-gradient(135deg, #E03D3D, #FF4B4B)",
    surface: "bg-rb-cardinal-wash dark:bg-[#3a1c1c]",
    ink: "text-rb-cardinal-lip",
    chip: "bg-rb-cardinal-wash text-rb-cardinal-lip",
  },
}

/** Rotates tones for lists that have no meaningful colour of their own. */
export function toneForIndex(index) {
  const order = ["macaw", "beetle", "fox", "bee", "feather"]
  return order[index % order.length]
}

/**
 * @param tone      key of BUBBLE_TONES
 * @param icon      lucide-style component rendered in the medallion
 * @param eyebrow   small uppercase line above the title
 * @param title     the card's name
 * @param chips     [{ label, side }] — "left" chips sit on the wash, "right" on the dark scrim
 * @param capHeight tailwind height class for the gradient cap
 * @param as        wrapper element — "article" (default), "button", or a Link via `asChild`-style usage
 */
export function BubbleCard({
  tone = "macaw",
  icon: Icon,
  eyebrow,
  title,
  chips = [],
  capHeight = "h-32",
  active = false,
  compact = false,
  className = "",
  children,
  footer,
  as: Wrapper = "article",
  ...props
}) {
  const palette = BUBBLE_TONES[tone] ?? BUBBLE_TONES.macaw
  const leftChips = chips.filter((chip) => chip.side !== "right")
  const rightChips = chips.filter((chip) => chip.side === "right")

  return (
    <Wrapper
      className={`group/bubble flex flex-col overflow-hidden rounded-rb-card border-2 text-left transition-colors ${
        palette.surface
      } ${
        active ? "border-rb-macaw" : "border-border hover:border-rb-macaw/60"
      } ${className}`}
      {...props}
    >
      {/* The cap. Bubbles are two oversized circles bled off opposite corners —
          they read as depth without an image to load. */}
      <div
        className={`relative flex ${capHeight} shrink-0 items-center justify-center overflow-hidden`}
        style={{ background: palette.accent }}
      >
        {(leftChips.length > 0 || rightChips.length > 0) && (
          <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-2">
            <span className="flex flex-wrap gap-1.5">
              {leftChips.map((chip) => (
                <span
                  key={chip.label}
                  className="rounded-rb-pill bg-white/90 px-2.5 py-1 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-rb-eel backdrop-blur-sm"
                >
                  {chip.label}
                </span>
              ))}
            </span>
            <span className="flex flex-wrap justify-end gap-1.5">
              {rightChips.map((chip) => (
                <span
                  key={chip.label}
                  className="rounded-rb-pill bg-black/35 px-2.5 py-1 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm"
                >
                  {chip.label}
                </span>
              ))}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 -left-7 size-32 rounded-full bg-white/10" />

        {Icon ? (
          <span
            className={`grid ${
              compact ? "size-14" : "size-20"
            } place-items-center rounded-full bg-white/20 text-white transition-transform duration-300 group-hover/bubble:scale-105`}
          >
            <Icon className={compact ? "size-7" : "size-10"} strokeWidth={1.7} aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col ${compact ? "p-4" : "p-5"}`}>
        {eyebrow ? (
          <p
            className={`font-rb-display text-[10px] font-extrabold uppercase tracking-[0.16em] ${palette.ink}`}
          >
            {eyebrow}
          </p>
        ) : null}

        {title ? (
          <h3
            className={`mt-1 font-rb-display font-extrabold text-foreground ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            {title}
          </h3>
        ) : null}

        <div className="min-w-0 flex-1">{children}</div>

        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </Wrapper>
  )
}
