/**
 * Bento layout primitives.
 *
 * A bento is a mosaic, not a grid of equal boxes: tile size is what says which
 * number matters. The grid runs on a six-column track with a fixed base row, so
 * a tile can claim 1–6 columns and 1–4 rows and still land on the same rhythm.
 *
 * ONE RULE when composing a grid: work in *bands* whose columns add up to six,
 * and write the tiles in reading order within each band. Auto-placement cannot
 * invent a tile to plug a hole, so a band that adds up to five leaves a ragged
 * gap that drags every band below it out of alignment. A band may be
 * 2+4, 4+2, 2+2+2, 3+3, 6, or a wide tile beside a stack (4 + [1+1] + 2) —
 * vary them, that alternation is what makes the mosaic read as designed.
 *
 * Colour is the other half of it. A `tone` fills the whole tile with that
 * accent's wash and prints its ink on top — the same tone set the arena cards
 * use, so a filled tile and a bubble card are recognisably the same family.
 */

const TILE_TONES = {
  plain: "border-border bg-card text-foreground",
  macaw: "border-rb-macaw/30 bg-rb-macaw-wash text-rb-eel dark:bg-[#12283d] dark:text-rb-snow",
  beetle: "border-rb-beetle/30 bg-rb-beetle-wash text-rb-eel dark:bg-[#2a1f3a] dark:text-rb-snow",
  fox: "border-rb-fox/30 bg-rb-fox-wash text-rb-eel dark:bg-[#3a2a12] dark:text-rb-snow",
  bee: "border-rb-bee/30 bg-rb-bee-wash text-rb-eel dark:bg-[#12333a] dark:text-rb-snow",
  feather:
    "border-rb-feather/30 bg-rb-feather-wash text-rb-eel dark:bg-[#152744] dark:text-rb-snow",
  ink: "border-rb-eel bg-rb-eel text-rb-snow",
}

const TONE_INK = {
  plain: "text-muted-foreground",
  macaw: "text-rb-macaw-lip",
  beetle: "text-rb-beetle-lip",
  fox: "text-rb-fox-lip",
  bee: "text-rb-bee-lip",
  feather: "text-rb-feather-lip",
  ink: "text-rb-hare",
}

/* Spans are looked up rather than interpolated — Tailwind only emits classes it
   can see written out in full. */
const COL_SPAN = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
}

const ROW_SPAN = {
  1: "lg:row-span-1",
  2: "lg:row-span-2",
  3: "lg:row-span-3",
  4: "lg:row-span-4",
  5: "lg:row-span-5",
}

export function BentoGrid({ className = "", children }) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[176px] lg:grid-flow-row-dense lg:grid-cols-6 lg:gap-5 ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * @param tone  key of TILE_TONES — "plain" is the ordinary card surface
 * @param col   columns to claim at lg and up (1–6)
 * @param row   rows to claim at lg and up (1–5)
 */
export function BentoTile({
  tone = "plain",
  col = 2,
  row = 1,
  className = "",
  children,
  ...props
}) {
  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-rb-card border-2 p-5 transition-shadow hover:shadow-[0_2px_0_0_rgba(0,0,0,0.06)] sm:p-6 ${
        TILE_TONES[tone] ?? TILE_TONES.plain
      } ${COL_SPAN[col]} ${ROW_SPAN[row]} ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}

/** The headline shape: a label, one big number, and an optional footnote. */
export function BentoStat({ tone = "plain", col = 2, row = 1, icon: Icon, label, value, hint, children }) {
  const valueSize = hint
    ? "text-4xl sm:text-5xl"
    : col === 1
      ? "text-5xl"
      : "text-5xl sm:text-6xl"

  return (
    <BentoTile tone={tone} col={col} row={row}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-bold ${TONE_INK[tone] ?? TONE_INK.plain}`}>{label}</p>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/60 text-rb-eel dark:bg-white/10 dark:text-rb-snow">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {/* The number is the point of the tile, so it is sized to fill whatever
          width the tile has. A one-column tile is only about 120px of content
          wide, so it stops one step short of the full display size — far enough
          up that it still reads as the same emphasis as its wider neighbours.

          A tile carrying a hint steps down one more. The base row is a fixed
          176px and the tile clips what does not fit, so at the full display
          size a hint that wraps to a second line — which it does at any
          narrower-than-ideal column — was pushed out of the bottom of the
          card and simply disappeared. */}
      <p
        className={`mt-auto font-rb-display font-extrabold leading-[0.9] tracking-tight tabular-nums ${valueSize}`}
      >
        {value}
      </p>

      {/* The hint is clamped to one line on purpose. The row is fixed height
          and the tile clips, so a hint long enough to wrap would lose its
          second line silently — an ellipsis at least says there was more. */}
      {hint ? (
        <p
          className={`mt-1 line-clamp-1 text-xs font-semibold leading-snug ${
            TONE_INK[tone] ?? TONE_INK.plain
          }`}
        >
          {hint}
        </p>
      ) : null}

      {children}
    </BentoTile>
  )
}

/** Section heading used inside a plain tile that holds a list or a chart. */
export function BentoHeading({ title, hint, action, chip }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-rb-display text-sm font-extrabold lowercase">{title}</h2>
          {chip ?? null}
        </div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action ?? null}
    </div>
  )
}
