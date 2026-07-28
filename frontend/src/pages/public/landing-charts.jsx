import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/**
 * Landing page charts — real plots, not CSS bars.
 *
 * Palette is the brand's own categorical order, validated for colour-vision
 * deficiency before use (Feather → Macaw → Fox → Beetle → Humpback; worst
 * adjacent pair ΔE 26.2 protan, 29.6 normal). Because the brand hues sit under
 * 3:1 against the surface, every chart ships a legend plus direct labels — the
 * required relief, so identity never rests on colour alone.
 *
 * One y-axis per chart, always. Two measures of different scale get two charts.
 */

const INK = { primary: "#4B4B4B", secondary: "#777777", muted: "#AFAFAF" }
const GRID = "#E5E5E5"
const SURFACE = "#FFFFFF"

const SERIES = {
  feather: "#58CC02",
  macaw: "#1CB0F6",
  fox: "#FF9600",
  beetle: "#CE82FF",
  humpback: "#2B70C9",
}

const axisProps = {
  stroke: GRID,
  tick: { fill: INK.secondary, fontSize: 12, fontWeight: 600 },
  tickLine: false,
}

const legendStyle = { fontSize: 13, fontWeight: 700, color: INK.secondary }

/**
 * Value key. The brand hues sit under 3:1 against the surface, so every chart
 * owes the reader a visible label set — this is it: swatch, series name, and
 * the number the story turns on, in text ink rather than the series colour.
 */
export function ValueKey({ items, note }) {
  return (
    <div className="mt-4">
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ background: item.color }}
              aria-hidden="true"
            />
            <span className="font-semibold text-rb-wolf">{item.name}</span>
            <span className="font-bold tabular-nums text-rb-eel">{item.value}</span>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-2 text-xs font-semibold text-rb-hare">{note}</p> : null}
    </div>
  )
}

function ChartTooltip({ active, payload, label, suffix = "%" }) {
<<<<<<< Updated upstream
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-lg border border-[#DCE4EF] bg-white px-3 py-2 shadow-[0_10px_26px_rgba(11,31,58,0.12)]">
            <p className="text-[11px] font-semibold text-[#6A7A91]">{label}</p>
            <p className="mt-0.5 text-sm font-bold text-[#0B1F3A]">
                {payload[0].value}
                {suffix}
            </p>
        </div>
    );
=======
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border-2 border-rb-swan bg-rb-snow px-3 py-2 shadow-sm">
      <div className="text-xs font-bold text-rb-wolf">{label}</div>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            <span className="text-rb-wolf">{entry.name}</span>
            <span className="ml-auto font-bold tabular-nums text-rb-eel">
              {entry.value}
              {suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
>>>>>>> Stashed changes
}

/* ------------------------------------------------------------------ problem */

// Ebbinghaus-shaped retention. Two series, one axis, both direct-labelled at
// their endpoint so the gap reads without matching colours to a key.
const RETENTION = [
  { day: "Day 0", cram: 100, spaced: 100 },
  { day: "Day 3", cram: 58, spaced: 88 },
  { day: "Day 7", cram: 38, spaced: 82 },
  { day: "Day 14", cram: 25, spaced: 79 },
  { day: "Day 21", cram: 19, spaced: 81 },
  { day: "Day 30", cram: 14, spaced: 84 },
]

export function RetentionChart() {
  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Percentage of material recalled over 30 days, comparing cramming once with spaced review.
        Cramming falls from 100% to 14%; spaced review holds at 84%.
      </figcaption>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={RETENTION} margin={{ top: 16, right: 56, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID, strokeWidth: 1 }} />
            <Legend wrapperStyle={legendStyle} iconType="plainline" />

            <Line
              type="monotone"
              dataKey="spaced"
              name="Spaced review"
              stroke={SERIES.feather}
              strokeWidth={2}
              dot={{ r: 4, fill: SERIES.feather, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
            />

            <Line
              type="monotone"
              dataKey="cram"
              name="Crammed once"
              stroke={SERIES.humpback}
              strokeWidth={2}
              dot={{ r: 4, fill: SERIES.humpback, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ValueKey
        items={[
          { name: "Spaced review", value: "84%", color: SERIES.feather },
          { name: "Crammed once", value: "14%", color: SERIES.humpback },
        ]}
        note="Recall remaining at day 30"
      />
    </figure>
  )
}

/* ----------------------------------------------------------------- solution */

<<<<<<< Updated upstream
    return (
        <div ref={containerRef} className={`${className} w-full`}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={readinessData}
                    margin={{ top: 12, right: 8, left: -24, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="8%" stopColor="#275DF5" stopOpacity={0.26} />
                            <stop offset="92%" stopColor="#275DF5" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        vertical={false}
                        stroke="#E7EDF5"
                        strokeDasharray="4 5"
                    />
                    <XAxis
                        dataKey="stage"
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        tick={{ fontSize: 10, fill: "#6B7C93" }}
                        tickMargin={10}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                        cursor={{ stroke: "#B8C7E2", strokeDasharray: "4 4" }}
                        content={<ChartTooltip />}
                    />
                    <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#275DF5"
                        strokeWidth={3}
                        fill={`url(#${gradientId})`}
                        dot={{ r: 3, fill: "#FFFFFF", stroke: "#275DF5", strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: "#275DF5", stroke: "#FFFFFF", strokeWidth: 2 }}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
=======
const MASTERY = [
  { week: "W1", databases: 22, networks: 30, os: 41, programming: 55 },
  { week: "W2", databases: 28, networks: 34, os: 49, programming: 63 },
  { week: "W3", databases: 31, networks: 39, os: 55, programming: 70 },
  { week: "W4", databases: 34, networks: 41, os: 58, programming: 74 },
  { week: "W5", databases: 36, networks: 43, os: 60, programming: 76 },
  { week: "W6", databases: 38, networks: 44, os: 62, programming: 78 },
]

const MASTERY_SERIES = [
  { key: "programming", name: "Programming", color: SERIES.feather },
  { key: "os", name: "Operating systems", color: SERIES.macaw },
  { key: "networks", name: "Networks", color: SERIES.fox },
  { key: "databases", name: "Databases", color: SERIES.beetle },
]

export function MasteryChart() {
  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Estimated mastery per domain over six weeks. Programming rises from 55% to 78%; Databases
        remains the weakest at 38%.
      </figcaption>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={MASTERY} margin={{ top: 16, right: 16, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
            <XAxis dataKey="week" {...axisProps} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID, strokeWidth: 1 }} />
            <Legend wrapperStyle={legendStyle} iconType="plainline" />

            {MASTERY_SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.name}
                stroke={series.color}
                strokeWidth={2}
                dot={{ r: 4, fill: series.color, stroke: SURFACE, strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ValueKey
        items={MASTERY_SERIES.map((series) => ({
          name: series.name,
          value: `${MASTERY[MASTERY.length - 1][series.key]}%`,
          color: series.color,
        }))}
        note="Mastery at week 6"
      />
    </figure>
  )
>>>>>>> Stashed changes
}

/* ----------------------------------------------------------------- features */

<<<<<<< Updated upstream
    return (
        <div ref={containerRef} className={`${className} w-full`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={topicMasteryData}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 2, bottom: 4 }}
                >
                    <CartesianGrid
                        horizontal={false}
                        stroke="#E7EDF5"
                        strokeDasharray="4 5"
                    />
                    <XAxis type="number" hide domain={[0, 100]} />
                    <YAxis
                        dataKey="topic"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        width={88}
                        tick={{ fontSize: 10, fill: "#314766", fontWeight: 600 }}
                    />
                    <Tooltip
                        cursor={{ fill: "rgba(39,93,245,0.04)" }}
                        content={<ChartTooltip />}
                    />
                    <Bar
                        dataKey="mastery"
                        radius={[0, 5, 5, 0]}
                        barSize={18}
                        isAnimationActive={false}
                    >
                        {topicMasteryData.map((entry) => (
                            <Cell
                                key={entry.topic}
                                fill={entry.mastery < 60 ? "#E88962" : "#275DF5"}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function StudyConsistencyChart({ className = "h-44" }) {
    const gradientId = useId().replaceAll(":", "");
    const containerRef = useChartEntrance("line");

    return (
        <div ref={containerRef} className={`${className} w-full`}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={studyConsistencyData}
                    margin={{ top: 8, right: 8, left: -26, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#7C9BFF" />
                            <stop offset="100%" stopColor="#275DF5" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        vertical={false}
                        stroke="#E7EDF5"
                        strokeDasharray="4 5"
                    />
                    <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#6B7C93" }}
                        tickMargin={8}
                    />
                    <YAxis hide domain={[0, 70]} />
                    <Tooltip
                        cursor={{ stroke: "#B8C7E2", strokeDasharray: "4 4" }}
                        content={<ChartTooltip suffix=" min" />}
                    />
                    <Line
                        type="monotone"
                        dataKey="minutes"
                        stroke={`url(#${gradientId})`}
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#FFFFFF", stroke: "#275DF5", strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: "#275DF5", stroke: "#FFFFFF", strokeWidth: 2 }}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export function AssessmentPerformanceChart({ className = "h-48" }) {
    const containerRef = useChartEntrance("vertical-bars");

    return (
        <div ref={containerRef} className={`${className} w-full`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={assessmentData}
                    margin={{ top: 8, right: 4, left: -24, bottom: 4 }}
                >
                    <CartesianGrid
                        vertical={false}
                        stroke="#E7EDF5"
                        strokeDasharray="4 5"
                    />
                    <XAxis
                        dataKey="assessment"
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tick={{ fontSize: 9, fill: "#6B7C93" }}
                        tickMargin={9}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                        cursor={{ fill: "rgba(39,93,245,0.04)" }}
                        content={<ChartTooltip />}
                    />
                    <Bar
                        dataKey="score"
                        fill="#275DF5"
                        radius={[5, 5, 0, 0]}
                        barSize={30}
                        isAnimationActive={false}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function ReadinessRadialChart({ value = 84, className = "h-40 w-40" }) {
    const containerRef = useRef(null);
    const valueRef = useRef(null);
    const data = [{ name: "Readiness", value, fill: "#275DF5" }];

    useLayoutEffect(() => {
        const root = containerRef.current;
        if (!root) return undefined;

        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        let frameId;

        const ctx = gsap.context(() => {
            frameId = window.requestAnimationFrame(() => {
                if (reducedMotion) {
                    if (valueRef.current) valueRef.current.textContent = `${value}%`;
                    return;
                }

                const sectors = root.querySelectorAll(".recharts-radial-bar-sector");
                const counter = { value: 0 };
                const timeline = gsap.timeline({
                    scrollTrigger: {
                        trigger: root,
                        start: "top 86%",
                        once: true,
                    },
                });

                timeline.fromTo(
                    sectors,
                    {
                        opacity: 0,
                        scale: 0.72,
                        rotate: -18,
                        transformOrigin: "50% 50%",
                    },
                    {
                        opacity: 1,
                        scale: 1,
                        rotate: 0,
                        duration: 0.8,
                        ease: "back.out(1.35)",
                    },
                );

                timeline.to(
                    counter,
                    {
                        value,
                        duration: 0.8,
                        ease: "power2.out",
                        onUpdate: () => {
                            if (valueRef.current) {
                                valueRef.current.textContent = `${Math.round(counter.value)}%`;
                            }
                        },
                    },
                    0,
                );
            });
        }, root);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            ctx.revert();
        };
    }, [value]);

    return (
        <div
            ref={containerRef}
            className={`relative flex items-center justify-center ${className}`}
        >
            <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="73%"
                        outerRadius="100%"
                        barSize={10}
                        data={data}
                        startAngle={90}
                        endAngle={-270}
                    >
                        <PolarAngleAxis
                            type="number"
                            domain={[0, 100]}
                            angleAxisId={0}
                            tick={false}
                        />
                        <RadialBar
                            background={{ fill: "#E8EEF8" }}
                            dataKey="value"
                            cornerRadius={20}
                            isAnimationActive={false}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
            </div>
            <div className="relative flex flex-col items-center justify-center">
        <span
            ref={valueRef}
            className="text-3xl font-bold tracking-tight text-[#0B1F3A]"
        >
          0%
        </span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B7C93]">
          Ready
        </span>
            </div>
        </div>
    );
}
=======
// Two states, not a value ramp: at-or-above target vs below. Ordering carries
// priority; colour only says whether the bar has cleared the line.
const DOMAINS = [
  { domain: "Databases", mastery: 38 },
  { domain: "Networks", mastery: 44 },
  { domain: "Operating sys.", mastery: 62 },
  { domain: "Security", mastery: 66 },
  { domain: "Programming", mastery: 78 },
  { domain: "Foundation", mastery: 94 },
]

const TARGET = 70

export function DomainMasteryChart() {
  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Mastery by exam domain against a 70% target. Databases 38%, Networks 44%, Operating systems
        62%, Security 66%, Programming 78%, Foundation 94%.
      </figcaption>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={DOMAINS}
            layout="vertical"
            margin={{ top: 16, right: 48, bottom: 4, left: 8 }}
            barCategoryGap="28%"
          >
            <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              unit="%"
              {...axisProps}
            />
            <YAxis type="category" dataKey="domain" width={112} {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />

            <ReferenceLine
              x={TARGET}
              stroke={INK.muted}
              strokeWidth={1}
              label={{
                value: `target ${TARGET}%`,
                position: "top",
                fill: INK.secondary,
                fontSize: 12,
                fontWeight: 700,
              }}
            />

            <Bar dataKey="mastery" name="Mastery" barSize={20} radius={[0, 4, 4, 0]}>
              {DOMAINS.map((entry) => (
                <Cell
                  key={entry.domain}
                  fill={entry.mastery >= TARGET ? SERIES.feather : SERIES.macaw}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ValueKey
        items={DOMAINS.map((entry) => ({
          name: entry.domain,
          value: `${entry.mastery}%`,
          color: entry.mastery >= TARGET ? SERIES.feather : SERIES.macaw,
        }))}
        note={`Green is at or above the ${TARGET}% target; blue is below it.`}
      />
    </figure>
  )
}
>>>>>>> Stashed changes
