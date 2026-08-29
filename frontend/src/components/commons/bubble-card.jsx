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
 *
 * `solid` is the tone at a weight that carries text and small shapes: a filled
 * button label, a progress fill against its track. The cap's own colours are
 * chosen to look good under white icon art at 80px and are far too light for
 * either — white on macaw is 2.4:1, and a cyan bar on a #F1F1F1 track is
 * 2.1:1. Each `solid` is the darkest point in its own hue that still clears
 * 4.5:1 both ways against white, so it works as a face under white text and as
 * text on the card.
 */

export const BUBBLE_TONES = {
  macaw: {
    accent: "linear-gradient(135deg, #1B6EF3, #1CB0F6)",
    surface: "bg-rb-macaw-wash dark:bg-[#12283d]",
    flat: "#1CB0F6",
    ink: "text-rb-macaw-lip",
    chip: "bg-rb-macaw-wash text-rb-macaw-lip",
    solid: "#147DAF",
  },
  beetle: {
    accent: "linear-gradient(135deg, #B061E6, #CE82FF)",
    surface: "bg-rb-beetle-wash dark:bg-[#2a1f3a]",
    flat: "#CE82FF",
    ink: "text-rb-beetle-lip",
    chip: "bg-rb-beetle-wash text-rb-beetle-lip",
    solid: "#965FBA",
  },
  fox: {
    accent: "linear-gradient(135deg, #E08600, #FF9600)",
    surface: "bg-rb-fox-wash dark:bg-[#3a2a12]",
    flat: "#FF9600",
    ink: "text-rb-fox-lip",
    chip: "bg-rb-fox-wash text-rb-fox-lip",
    solid: "#8A4F00",
  },
  bee: {
    accent: "linear-gradient(135deg, #0092A8, #00B8D4)",
    surface: "bg-rb-bee-wash dark:bg-[#12333a]",
    flat: "#00B8D4",
    ink: "text-rb-bee-lip",
    chip: "bg-rb-bee-wash text-rb-bee-lip",
    solid: "#008194",
  },
  feather: {
    accent: "linear-gradient(135deg, #1553C4, #1B6EF3)",
    surface: "bg-rb-feather-wash dark:bg-[#152744]",
    flat: "#1B6EF3",
    ink: "text-rb-feather-lip",
    chip: "bg-rb-feather-wash text-rb-feather-lip",
    solid: "#1B6EF3",
  },
  cardinal: {
    accent: "linear-gradient(135deg, #E03D3D, #FF4B4B)",
    surface: "bg-rb-cardinal-wash dark:bg-[#3a1c1c]",
    flat: "#FF4B4B",
    ink: "text-rb-cardinal-lip",
    chip: "bg-rb-cardinal-wash text-rb-cardinal-lip",
    solid: "#C62828",
  },
}

/* `flat` is the tone as one colour rather than two: the gradient's lighter
   stop, which is the hue the brand actually names. A cap set to `flat` is the
   same face the certification covers wear (`rb-feather` is exactly feather's
   flat), so a page can sit its cards next to those without the gradient's dark
   stop reading as a different, heavier blue. */

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
 * @param cap       "gradient" (default) or "flat" -- one colour, matching the
 *                  certification covers
 * @param body      "wash" (default) paints the body in the tone's pastel; "card"
 *                  leaves it on the plain card surface, so the tone is carried
 *                  by the cap alone — the shape the certification cards use.
 */
export function BubbleCard({
  tone = "macaw",
  icon: Icon,
  eyebrow,
  title,
  chips = [],
  capHeight = "h-32",
  cap = "gradient",
  body = "wash",
  active = false,
  compact = false,
  className = "",
  children,
  footer,
  as: Wrapper = "article",
  ...props
}) {
  const palette = BUBBLE_TONES[tone] ?? BUBBLE_TONES.macaw
  const surface = body === "card" ? "bg-card" : palette.surface
  const capFace = cap === "flat" ? palette.flat : palette.accent
  const leftChips = chips.filter((chip) => chip.side !== "right")
  const rightChips = chips.filter((chip) => chip.side === "right")

  return (
    <Wrapper
      /* The tone, published to the subtree so hover and focus can reach it.
         Those states cannot be inline styles, and all three were hardcoded to
         the app's blue — so a violet card flashed blue on hover, and its button
         drew a blue halo on focus.

         Two of these are variable *overrides* rather than new properties, and
         that is the point. A `focus-visible:ring-[…]` class does not fix the
         halo: it lands in the same `--tw-ring-color` slot as the base
         `ring-ring/35`, which is emitted later in the sheet and wins on order.
         `--rb-focus` is worse still — the design system focuses every button
         through `:root [data-slot=button]:focus-visible`, which no utility
         class can outrank. Redefining what those rules resolve to sidesteps the
         cascade entirely, and covers every control in the card at once rather
         than each one having to remember. */
      style={{
        "--bubble-tone": palette.solid,
        "--ring": palette.solid,
        "--rb-focus": palette.solid,
      }}
      className={`group/bubble flex flex-col overflow-hidden rounded-rb-card border-2 text-left transition-colors ${
        surface
      } ${
        active
          ? "border-[color:var(--bubble-tone)]"
          : "border-border hover:border-[color:var(--bubble-tone)]"
      } ${className}`}
      {...props}
    >
      {/* The cap. Bubbles are two oversized circles bled off opposite corners —
          they read as depth without an image to load. */}
      <div
        className={`relative flex ${capHeight} shrink-0 items-center justify-center overflow-hidden`}
        style={{ background: capFace }}
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
