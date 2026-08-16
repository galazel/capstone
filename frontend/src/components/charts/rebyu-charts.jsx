import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/**
 * Shared portal chart kit.
 *
 * One categorical order, fixed and never cycled: azure → teal → orange →
 * violet. Both mode palettes were run through the colour-vision validator
 * rather than eyeballed — light passes every check except contrast-vs-surface
 * (which is why every chart here ships a labelled legend carrying the number,
 * the required relief), and dark passes clean inside its own lightness band.
 * A fifth category is never a new hue: it folds into "Other" in neutral ink.
 *
 * One y-axis per chart, always. Two measures of different scale get two charts.
 */

const LIGHT = {
  series: ["#1B6EF3", "#00B8D4", "#FF9600", "#CE82FF"],
  other: "#AFAFAF",
  // Deliberately outside `series`: these are statuses, not categories, so
  // `seriesColor` must never hand them out. `danger` is the cardinal the
  // design system already uses for a wrong answer (`--color-rb-cardinal`), so
  // "you are in trouble here" reads the same in a chart as anywhere else.
  // `success` is the one green the system commits to (`--color-rb-feather`
  // under `.rb-a11y`); the default brand palette is blue-led and carries no
  // other green, so inventing a brighter one would have been a new hue.
  danger: "#FF4B4B",
  success: "#3F8F02",
  // Text-safe counterparts, for a mastery figure printed *as type* rather than
  // drawn as a bar. They are not interchangeable: `#FF9600` is a fine bar fill
  // and only ~1.9:1 against a tile wash, which fails even the 3:1 large-text
  // floor — so the band most learners sit in would have been the one nobody
  // could read. Verified against every wash a mastery-toned tile can take
  // (cardinal #FFECEC, fox #FFF1E0, leaf #EDF7E3).
  statusInk: { weak: "#C62828", developing: "#8A4F00", strong: "#33660A" },
  ink: { primary: "#4B4B4B", secondary: "#777777", muted: "#AFAFAF" },
  grid: "#E5E5E5",
  surface: "#FFFFFF",
  track: "#F1F1F1",
}

const DARK = {
  series: ["#3B82F6", "#00A896", "#D4761B", "#A96BE0"],
  other: "#6B6B6B",
  danger: "#D62C2C",
  success: "#5CA82F",
  // Against the dark washes (cardinal #3A1618, fox #3A2A12, leaf #1E2E14) the
  // same reasoning runs the other way: type has to be lighter than the fill.
  statusInk: { weak: "#FF8A8A", developing: "#FFB35C", strong: "#8ED14F" },
  ink: { primary: "#E8E8E8", secondary: "#A8A8A8", muted: "#7A7A7A" },
  grid: "#3A3A3A",
  surface: "#242424",
  track: "#333333",
}

/** Follows the theme provider, which writes `dark` onto the root element. */
export function useChartTheme() {
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  )

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains("dark"))
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark ? DARK : LIGHT
}

/** Assign by position in the caller's series list — never by rank or value. */
export function seriesColor(theme, index) {
  return index < theme.series.length ? theme.series[index] : theme.other
}

/**
 * Where a mastery score sits on the weak → developing → strong scale.
 *
 * Exported as numbers rather than inlined so the bar, any future badge, and
 * the copy that explains them cannot drift apart. Both bounds are exclusive:
 * 25 is developing, 50 is strong.
 */
export const MASTERY_BANDS = { weak: 25, developing: 50 }

/**
 * Mastery as a status, not a category.
 *
 * The categorical rule above — colour by position, never by value — is exactly
 * right for a series and exactly wrong here: a mastery bar has one meaning per
 * band, and a learner reads red as "this one is in trouble", not as "this one
 * is the third topic". So this is a separate, deliberately small scale.
 *
 * Red → orange → green is the requested scale and it is also the hardest trio
 * for the commonest colour-vision deficiencies, where red and green converge.
 * That makes the band a supporting signal only, never the message: every
 * caller draws the percentage beside the bar, which is the same relief the
 * categorical palette leans on its legend for. Bar *length* carries it too,
 * which a legend cannot.
 */
/**
 * Which band a score falls in: "weak", "developing", "strong", or null when
 * there is no score at all.
 *
 * The one place the thresholds are applied. Everything that varies by band —
 * fill, ink, tile tone, the confidence tier on a row — reads this rather than
 * re-testing the numbers, so a bar and the label beside it cannot end up
 * disagreeing about which band the same score is in.
 */
export function masteryBand(value) {
  // `null` is checked before the cast, not after: `Number(null)` is 0, which
  // is finite, so an absent mastery would otherwise land in the weakest band —
  // the loudest "you are failing this" the scale has, for a topic nobody
  // scored.
  if (value == null) {
    return null
  }
  const score = Number(value)
  if (!Number.isFinite(score)) {
    return null
  }
  if (score < MASTERY_BANDS.weak) {
    return "weak"
  }
  if (score < MASTERY_BANDS.developing) {
    return "developing"
  }
  return "strong"
}

export function masteryColor(theme, value) {
  switch (masteryBand(value)) {
    case "weak":
      return theme.danger
    case "developing":
      return seriesColor(theme, 2)
    case "strong":
      return theme.success
    default:
      return theme.ink.muted
  }
}

/**
 * The same three bands, shaded for type instead of for fill.
 *
 * Use this wherever the score is *written* — a headline figure, a badge — and
 * `masteryColor` wherever it is drawn. Reusing the fill colours on text is the
 * mistake this exists to prevent: they are chosen to read as areas against a
 * neutral track, and the orange band in particular does not clear the 3:1
 * large-text floor on a tinted tile.
 */
export function masteryInk(theme, value) {
  const band = masteryBand(value)
  return band ? theme.statusInk[band] : theme.ink.secondary
}

/**
 * Where a readiness score sits on the needs-review → exam-ready scale.
 *
 * These four are the backend's own bands, not a second opinion invented for the
 * UI: `readiness_service._level` in the Python service cuts at exactly 85 / 70 /
 * 50 and names them `needs_review`, `developing`, `nearly_ready`, `exam_ready`.
 * It computes the level on every call and the Java analytics service then reads
 * only `readiness_score` off the response and drops it, so the frontend has the
 * number without the word and has to re-derive it here.
 *
 * That is a duplicated threshold and it can drift -- if the service's cuts move,
 * these must move with them. The fix is for `computeReadiness` to carry
 * `readiness_level` through to the DTO, after which this reads the field
 * instead of the number.
 *
 * Separate from `MASTERY_BANDS` on purpose. Mastery asks "do you know this
 * topic" over one lesson; readiness asks "could you pass the exam" over a whole
 * certification, and 60% means very different things in the two sentences.
 */
export const READINESS_BANDS = { developing: 50, nearlyReady: 70, examReady: 85 }

const READINESS_META = {
  needs_review: { label: "needs review", hint: "Plenty still to cover before exam day." },
  developing: { label: "developing", hint: "The foundations are forming. Keep going." },
  nearly_ready: { label: "nearly ready", hint: "Close. Tighten your weakest topics." },
  exam_ready: { label: "exam ready", hint: "You are scoring at exam standard." },
}

export function readinessBand(value) {
  if (value == null) {
    return null
  }
  const score = Number(value)
  if (!Number.isFinite(score)) {
    return null
  }
  if (score >= READINESS_BANDS.examReady) {
    return "exam_ready"
  }
  if (score >= READINESS_BANDS.nearlyReady) {
    return "nearly_ready"
  }
  if (score >= READINESS_BANDS.developing) {
    return "developing"
  }
  return "needs_review"
}

/** The band as words: a short status and the sentence that explains it. */
export function readinessMeta(value) {
  return READINESS_META[readinessBand(value)] ?? null
}

/** For the gauge arc. Follows `masteryColor`'s reasoning: status, not series. */
export function readinessColor(theme, value) {
  switch (readinessBand(value)) {
    case "needs_review":
      return theme.danger
    case "developing":
      return seriesColor(theme, 2)
    case "nearly_ready":
      return seriesColor(theme, 0)
    case "exam_ready":
      return theme.success
    default:
      return theme.ink.muted
  }
}

/**
 * The same four bands, shaded for type.
 *
 * `statusInk` only has three entries, keyed to the mastery scale, so the two
 * blue-and-green bands borrow from it rather than adding a fourth: nearly-ready
 * takes the series azure (which is chosen to carry type) and exam-ready the
 * strong ink.
 */
export function readinessInk(theme, value) {
  switch (readinessBand(value)) {
    case "needs_review":
      return theme.statusInk.weak
    case "developing":
      return theme.statusInk.developing
    case "nearly_ready":
      return seriesColor(theme, 0)
    case "exam_ready":
      return theme.statusInk.strong
    default:
      return theme.ink.secondary
  }
}

/* ------------------------------------------------------------------- shell */

export function ChartPanel({
  title,
  subtitle,
  sample = false,
  action,
  footnote,
  className = "",
  children,
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-rb-card border-2 border-border bg-card p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-rb-display text-sm font-extrabold lowercase text-foreground">
              {title}
            </h3>
            {sample ? <SampleChip /> : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action ?? null}
      </div>

      <div className="mt-4 min-w-0 flex-1">{children}</div>

      {footnote ? (
        <p className="mt-3 border-t-2 border-border pt-3 text-xs text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </section>
  )
}

/** Sample data must never be mistaken for a real reading. */
export function SampleChip({ label = "sample data" }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-rb-fox-wash px-2 py-0.5 font-rb-display text-[0.625rem] font-extrabold lowercase tracking-wide text-rb-fox-lip">
      {label}
    </span>
  )
}

/**
 * The value key. Brand hues sit under 3:1 against the surface, so identity
 * never rests on colour alone — swatch, name, and the number it turns on, the
 * number in text ink rather than the series colour.
 */
export function ChartLegend({ items, note }) {
  return (
    <div className="mt-4">
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-xs">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ background: item.color }}
              aria-hidden="true"
            />
            <span className="font-semibold text-muted-foreground">{item.name}</span>
            <span className="font-bold tabular-nums text-foreground">{item.value}</span>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}

function TooltipCard({ active, payload, label, suffix = "", prefix = "" }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border-2 border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      {label ? <div className="text-xs font-bold text-muted-foreground">{label}</div> : null}
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: entry.color ?? entry.payload?.fill }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-bold tabular-nums">
              {prefix}
              {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
              {suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ChartEmpty({ message = "No data to plot yet." }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-rb-tile border-2 border-dashed border-border px-4 text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

function axisProps(theme) {
  return {
    stroke: theme.grid,
    tick: { fill: theme.ink.secondary, fontSize: 11, fontWeight: 600 },
    tickLine: false,
  }
}

/* -------------------------------------------------------------------- line */

/**
 * Change over time. `series` is [{ key, name }] — colour comes from position,
 * so filtering the list out from under it never repaints the survivors.
 *
 * @param showLegend  set false when the caller already names each series
 *   beside the chart. This draws two legends when left on -- recharts' own
 *   above the axis and the kit's footer below it -- which is fine when the
 *   chart stands alone and is pure duplication when it does not.
 */
export function TrendLineChart({
  data,
  xKey,
  series,
  height = 260,
  unit = "",
  domain = [0, 100],
  ticks,
  legendNote,
  showLegend = true,
}) {
  const theme = useChartTheme()
  if (!data?.length) return <ChartEmpty />

  const last = data[data.length - 1]

  return (
    <figure className="w-full min-w-0">
      <div style={{ height }} className="w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={theme.grid} strokeWidth={1} vertical={false} />
            <XAxis dataKey={xKey} {...axisProps(theme)} />
            <YAxis domain={domain} ticks={ticks} unit={unit} {...axisProps(theme)} />
            <Tooltip
              content={<TooltipCard suffix={unit} />}
              cursor={{ stroke: theme.grid, strokeWidth: 1 }}
            />
            {showLegend && series.length > 1 ? (
              <Legend
                wrapperStyle={{ fontSize: 12, fontWeight: 700, color: theme.ink.secondary }}
                iconType="plainline"
              />
            ) : null}

            {series.map((entry, index) => {
              const color = seriesColor(theme, index)
              return (
                <Line
                  key={entry.key}
                  type="monotone"
                  dataKey={entry.key}
                  name={entry.name}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: color, stroke: theme.surface, strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: theme.surface, strokeWidth: 2 }}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showLegend ? (
        <ChartLegend
          items={series.map((entry, index) => ({
            name: entry.name,
            value: `${last?.[entry.key] ?? "—"}${unit}`,
            color: seriesColor(theme, index),
          }))}
          note={legendNote ?? "Latest value in the period"}
        />
      ) : null}
    </figure>
  )
}

/* -------------------------------------------------------------------- area */

/** Volume over time. Stacked segments keep a 2px surface gap between fills. */
export function TrendAreaChart({
  data,
  xKey,
  series,
  height = 240,
  unit = "",
  stacked = true,
  legendNote,
}) {
  const theme = useChartTheme()
  if (!data?.length) return <ChartEmpty />

  const last = data[data.length - 1]

  return (
    <figure className="w-full min-w-0">
      <div style={{ height }} className="w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <defs>
              {series.map((entry, index) => (
                <linearGradient
                  key={entry.key}
                  id={`rb-area-${entry.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={seriesColor(theme, index)} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={seriesColor(theme, index)} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid stroke={theme.grid} strokeWidth={1} vertical={false} />
            <XAxis dataKey={xKey} {...axisProps(theme)} />
            <YAxis unit={unit} {...axisProps(theme)} />
            <Tooltip
              content={<TooltipCard suffix={unit} />}
              cursor={{ stroke: theme.grid, strokeWidth: 1 }}
            />
            {series.length > 1 ? (
              <Legend
                wrapperStyle={{ fontSize: 12, fontWeight: 700, color: theme.ink.secondary }}
                iconType="plainline"
              />
            ) : null}

            {series.map((entry, index) => (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.name}
                stackId={stacked ? "stack" : undefined}
                stroke={seriesColor(theme, index)}
                strokeWidth={2}
                fill={`url(#rb-area-${entry.key})`}
                activeDot={{ r: 5, stroke: theme.surface, strokeWidth: 2 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend
        items={series.map((entry, index) => ({
          name: entry.name,
          value: `${(last?.[entry.key] ?? 0).toLocaleString()}${unit}`,
          color: seriesColor(theme, index),
        }))}
        note={legendNote ?? "Most recent period"}
      />
    </figure>
  )
}

/* --------------------------------------------------------------------- bar */

/**
 * Magnitude across categories. Two states, not a value ramp: at-or-above the
 * target vs below it — ordering carries priority, colour only says which side
 * of the line a bar landed on.
 */
export function BarBreakdownChart({
  data,
  categoryKey,
  valueKey,
  height = 280,
  unit = "",
  target,
  horizontal = true,
  categoryWidth = 108,
}) {
  const theme = useChartTheme()
  if (!data?.length) return <ChartEmpty />

  const [above, below] = [seriesColor(theme, 0), seriesColor(theme, 2)]
  const colorFor = (row) =>
    target == null ? seriesColor(theme, 0) : row[valueKey] >= target ? above : below

  return (
    <figure className="w-full min-w-0">
      <div style={{ height }} className="w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 16, right: 20, bottom: 0, left: horizontal ? 4 : -20 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              stroke={theme.grid}
              strokeWidth={1}
              horizontal={!horizontal}
              vertical={horizontal}
            />

            {horizontal ? (
              <>
                <XAxis type="number" unit={unit} {...axisProps(theme)} />
                <YAxis
                  type="category"
                  dataKey={categoryKey}
                  width={categoryWidth}
                  {...axisProps(theme)}
                />
              </>
            ) : (
              <>
                <XAxis dataKey={categoryKey} {...axisProps(theme)} />
                <YAxis unit={unit} {...axisProps(theme)} />
              </>
            )}

            <Tooltip content={<TooltipCard suffix={unit} />} cursor={{ fill: "rgba(127,127,127,0.08)" }} />

            {target != null ? (
              <ReferenceLine
                {...(horizontal ? { x: target } : { y: target })}
                stroke={theme.ink.muted}
                strokeWidth={1}
                label={{
                  value: `target ${target}${unit}`,
                  position: "top",
                  fill: theme.ink.secondary,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            ) : null}

            <Bar
              dataKey={valueKey}
              name={valueKey}
              barSize={18}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            >
              {data.map((row) => (
                <Cell key={row[categoryKey]} fill={colorFor(row)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend
        items={data.map((row) => ({
          name: row[categoryKey],
          value: `${row[valueKey].toLocaleString()}${unit}`,
          color: colorFor(row),
        }))}
        note={
          target != null
            ? `Azure is at or above the ${target}${unit} target; orange is below it.`
            : undefined
        }
      />
    </figure>
  )
}

/* ------------------------------------------------------------------- donut */

/** Parts of a whole — at most four named slices, the tail folded into Other. */
export function DonutChart({
  data,
  nameKey = "name",
  valueKey = "value",
  height = 240,
  centerLabel,
  centerValue,
  unit = "",
}) {
  const theme = useChartTheme()
  if (!data?.length) return <ChartEmpty />

  const total = data.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0)
  const colorFor = (row, index) =>
    row.isOther ? theme.other : seriesColor(theme, index)

  return (
    <figure className="w-full min-w-0">
      <div className="relative min-w-0 overflow-hidden" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<TooltipCard suffix={unit} />} />
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke={theme.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((row, index) => (
                <Cell key={row[nameKey]} fill={colorFor(row, index)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {centerValue != null ? (
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <div className="font-rb-display text-2xl font-extrabold tabular-nums text-foreground">
              {centerValue}
            </div>
            {centerLabel ? (
              <div className="mt-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
                {centerLabel}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <ChartLegend
        items={data.map((row, index) => ({
          name: row[nameKey],
          value: total
            ? `${Math.round((Number(row[valueKey]) / total) * 100)}%`
            : `${row[valueKey]}`,
          color: colorFor(row, index),
        }))}
        note={`${total.toLocaleString()} total`}
      />
    </figure>
  )
}

/* ------------------------------------------------------------------- gauge */

/** A single headline that happens to have a ceiling — one number, one arc. */
/**
 * @param color  arc fill. Defaults to the first series hue; pass a status
 *               colour (`readinessColor`, `masteryColor`) when the value means
 *               something on a scale rather than being one series among several.
 * @param valueInk  colour for the big number, when it should follow the arc.
 */
export function RadialGauge({
  value,
  label,
  height = 200,
  unit = "%",
  max = 100,
  color,
  valueInk,
}) {
  const theme = useChartTheme()
  const bounded = Math.max(0, Math.min(max, Number(value) || 0))

  return (
    <figure className="w-full min-w-0">
      <div className="relative min-w-0 overflow-hidden" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={[{ name: label, value: bounded }]}
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, max]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: theme.track }}
              dataKey="value"
              cornerRadius={8}
              fill={color ?? seriesColor(theme, 0)}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <div
            className="font-rb-display text-3xl font-extrabold tabular-nums text-foreground"
            style={valueInk ? { color: valueInk } : undefined}
          >
            {Math.round(bounded)}
            {unit}
          </div>
          {label ? (
            <div className="mt-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
              {label}
            </div>
          ) : null}
        </div>
      </div>
    </figure>
  )
}

/* ------------------------------------------------------------ compact mark */

/** Inline trend for a stat tile. Decorative — the tile carries the number. */
export function Sparkline({ data, dataKey = "value", height = 44 }) {
  const theme = useChartTheme()
  if (!data?.length) return null

  return (
    <div style={{ height }} className="w-full min-w-0 overflow-hidden" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={seriesColor(theme, 0)}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
