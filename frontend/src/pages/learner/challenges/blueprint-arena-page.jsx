import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  GitBranch,
  Layers,
  Network,
  Server,
  Shield,
  Trophy,
  X,
} from "lucide-react"

import { ProgressBar, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import ProblemGrid, { buildProblems } from "@/components/challenges/problem-grid.jsx"

const TITLES = [
  "Scalable order processing",
  "Class diagram — library system",
  "Sequence diagram — checkout",
  "Read-heavy news feed",
  "URL shortener",
  "Use case — ATM withdrawal",
  "Chat message delivery",
  "ER model — school registry",
  "Rate-limited public API",
  "File upload pipeline",
  "Activity diagram — returns",
  "Multi-region failover",
  "Event-driven inventory",
  "State diagram — order status",
  "Search indexing service",
  "Payment reconciliation",
  "Component diagram — POS",
  "Notification fan-out",
  "Audit logging store",
  "Session management",
]

const SOLVED_COUNT = 2
const PROBLEMS = buildProblems(20, TITLES, SOLVED_COUNT)

const TONE = {
  face: "bg-rb-beetle",
  border: "border-rb-beetle-lip",
}

/**
 * Blueprint Arena — solo run of 20 UML / system design problems.
 *
 * UI only. The canvas renders a fixed sample layout and validation replays a
 * scripted rule set; there is no drag-and-drop engine or real checker yet.
 */

const PALETTE = [
  { id: "lb", label: "Load balancer", icon: Network, tone: "text-rb-macaw-lip" },
  { id: "api", label: "API gateway", icon: Cloud, tone: "text-rb-macaw-lip" },
  { id: "svc", label: "Microservice", icon: Box, tone: "text-rb-beetle-lip" },
  { id: "db", label: "Database", icon: Database, tone: "text-rb-feather-lip" },
  { id: "cache", label: "Cache", icon: Layers, tone: "text-rb-fox-lip" },
  { id: "queue", label: "Queue", icon: GitBranch, tone: "text-rb-fox-lip" },
  { id: "auth", label: "Auth service", icon: Shield, tone: "text-rb-cardinal-lip" },
  { id: "worker", label: "Worker", icon: Server, tone: "text-rb-wolf" },
]

// Validation is structural: each rule is a fact about the graph, not a matter
// of taste. That is what makes automated marking defensible.
const RULES = [
  { label: "Client reaches the load balancer", state: "pass" },
  { label: "API gateway sits behind the load balancer", state: "pass" },
  { label: "Auth service guards the gateway", state: "pass" },
  { label: "Services connect to a database", state: "pass" },
  { label: "Cache sits between service and database", state: "fail" },
]

const NODES = [
  { id: "client", label: "Client", x: 30, y: 120, tone: "polar" },
  { id: "lb", label: "Load Balancer", x: 170, y: 120, tone: "macaw" },
  { id: "auth", label: "Auth", x: 310, y: 34, tone: "cardinal" },
  { id: "api", label: "API Gateway", x: 310, y: 120, tone: "macaw" },
  { id: "svc", label: "Order Service", x: 450, y: 120, tone: "beetle" },
  { id: "db", label: "Database", x: 590, y: 120, tone: "feather" },
]

const EDGES = [
  ["client", "lb"],
  ["lb", "api"],
  ["api", "auth"],
  ["api", "svc"],
  ["svc", "db"],
]

const NODE_FILL = {
  polar: { fill: "var(--color-rb-polar)", stroke: "var(--color-rb-swan)", ink: "var(--color-rb-eel)" },
  macaw: { fill: "var(--color-rb-macaw-wash)", stroke: "var(--color-rb-macaw)", ink: "var(--color-rb-macaw-lip)" },
  beetle: { fill: "var(--color-rb-beetle-wash)", stroke: "var(--color-rb-beetle)", ink: "var(--color-rb-beetle-lip)" },
  feather: { fill: "var(--color-rb-feather-wash)", stroke: "var(--color-rb-feather)", ink: "#3d6b06" },
  cardinal: { fill: "var(--color-rb-cardinal-wash)", stroke: "var(--color-rb-cardinal)", ink: "var(--color-rb-cardinal-lip)" },
}

const NODE_W = 110
const NODE_H = 52

function centreOf(id) {
  const node = NODES.find((n) => n.id === id)
  return { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 }
}

export default function BlueprintArenaPage() {
  const [view, setView] = useState("grid")
  const [active, setActive] = useState(SOLVED_COUNT + 1)
  const [selected, setSelected] = useState("svc")
  const [validated, setValidated] = useState(false)
  const [finished, setFinished] = useState(false)

  const passing = RULES.filter((r) => r.state === "pass").length

  const openProblem = (id) => {
    setActive(id)
    setValidated(false)
    setView("play")
  }

  if (finished) {
    return (
      <div className="rebyu-ds grid min-h-dvh place-items-center bg-rb-polar px-5 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-rb-beetle shadow-[0_6px_0_var(--color-rb-beetle-lip)]">
            <Trophy className="size-12 text-white" aria-hidden="true" />
          </div>
          <h1 className="rb-display rb-display-lg mt-6 text-center">run complete.</h1>
          <p className="rb-body-lg mt-3">20 of 20 blueprints submitted.</p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["Accuracy", "88%", "text-rb-beetle-lip"],
              ["Rules passed", "44/50", "text-rb-eel"],
              ["Avg. time", "2:36", "text-rb-eel"],
            ].map(([label, value, ink]) => (
              <div key={label} className="rb-card rb-card-raised">
                <div className={`rb-numeric text-2xl ${ink}`}>{value}</div>
                <div className="mt-1 text-xs font-bold text-rb-wolf">{label}</div>
              </div>
            ))}
          </div>

          <TactileButton asChild variant="beetle" className="mt-8 w-full">
            <Link to="/learner/challenges">back to arenas</Link>
          </TactileButton>
        </div>
      </div>
    )
  }

  /* Problem selector — the run's home screen. */
  if (view === "grid") {
    return (
      <div className="rebyu-ds min-h-dvh bg-rb-polar">
        <header className="flex h-20 items-center gap-4 border-b-2 border-rb-swan bg-rb-snow px-5 lg:px-8">
          <Link
            to="/learner/challenges"
            className="grid size-12 place-items-center rounded-2xl text-rb-eel transition-colors hover:bg-rb-polar"
            aria-label="Back to arenas"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
            blueprint arena
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan bg-rb-polar px-3 py-1.5 text-sm font-bold tabular-nums text-rb-eel">
            <Clock className="size-4" aria-hidden="true" />
            04:12
          </span>
        </header>

        <ProblemGrid
          arena="blueprint arena"
          tagline="Twenty design problems. Pick a number to enter the arena."
          problems={PROBLEMS}
          onOpen={openProblem}
          tone={TONE}
          footer={
            <TactileButton variant="ghost" className="mt-6 w-full" onClick={() => setFinished(true)}>
              finish run
            </TactileButton>
          }
        />
      </div>
    )
  }

  return (
    <div className="rebyu-ds flex h-dvh flex-col overflow-hidden bg-rb-polar">
      <header className="flex h-20 shrink-0 items-center gap-4 border-b-2 border-rb-swan bg-rb-snow px-5 lg:px-8">
        <button
          type="button"
          onClick={() => setView("grid")}
          className="grid size-12 place-items-center rounded-2xl text-rb-eel transition-colors hover:bg-rb-polar"
          aria-label="Back to problem list"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
            blueprint arena
          </div>
          <div className="text-sm font-semibold text-rb-wolf">Problem {active} of 20</div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan bg-rb-polar px-3 py-1.5 text-sm font-bold tabular-nums text-rb-eel">
            <Clock className="size-4" aria-hidden="true" />
            04:12
          </span>
          <TactileButton size="sm" variant="ghost" onClick={() => setFinished(true)}>
            finish run
          </TactileButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-5 lg:flex-row lg:overflow-hidden lg:p-6">
        {/* component palette */}
        <aside className="shrink-0 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-5 lg:w-56 lg:overflow-y-auto">
          <span className="rb-eyebrow">Components</span>
          <p className="mt-2 text-sm font-semibold text-rb-wolf">
            Drag onto the canvas to place.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {PALETTE.map((item) => (
              <button
                key={item.id}
                type="button"
                draggable
                onClick={() => setSelected(item.id)}
                className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition active:translate-y-[2px] ${
                  selected === item.id
                    ? "border-rb-beetle bg-rb-beetle-wash"
                    : "border-rb-swan bg-rb-polar hover:bg-rb-snow"
                }`}
              >
                <item.icon className={`size-4 shrink-0 ${item.tone}`} aria-hidden="true" />
                <span className="min-w-0 truncate text-xs font-bold text-rb-eel">{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* canvas */}
        <section className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-hidden">
          <div className="shrink-0 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-rb-display text-xl font-extrabold text-rb-eel">
                {PROBLEMS[active - 1]?.title}
              </h1>
              <span className="rounded-rb-pill bg-rb-fox-wash px-2.5 py-1 text-xs font-bold text-rb-fox-lip">
                medium
              </span>
            </div>
            <p className="rb-body mt-3 text-[0.9375rem]">
              Design a system that accepts client orders, authenticates each request, and persists
              them. Traffic must be distributed, and reads should not hit the database directly.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-rb-card border-2 border-rb-swan bg-rb-snow">
            {/* dot grid marks this as an editable canvas */}
            <svg viewBox="0 0 730 260" className="w-full min-w-[640px]" role="img" aria-label="System design canvas">
              <defs>
                <pattern id="rb-dots" width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.5" fill="var(--color-rb-swan)" />
                </pattern>
              </defs>
              <rect width="730" height="260" fill="url(#rb-dots)" />

              {EDGES.map(([from, to]) => {
                const a = centreOf(from)
                const b = centreOf(to)
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--color-rb-hare)"
                    strokeWidth="2.5"
                  />
                )
              })}

              {NODES.map((node) => {
                const tone = NODE_FILL[node.tone]
                const isSelected = node.id === selected
                return (
                  <g key={node.id}>
                    <rect
                      x={node.x}
                      y={node.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={12}
                      fill={tone.fill}
                      stroke={isSelected ? "var(--color-rb-beetle)" : tone.stroke}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text
                      x={node.x + NODE_W / 2}
                      y={node.y + NODE_H / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11"
                      fontWeight="700"
                      fill={tone.ink}
                    >
                      {node.label}
                    </text>
                    {isSelected
                      ? [
                          [node.x, node.y],
                          [node.x + NODE_W, node.y],
                          [node.x, node.y + NODE_H],
                          [node.x + NODE_W, node.y + NODE_H],
                        ].map(([hx, hy]) => (
                          <rect
                            key={`${hx}-${hy}`}
                            x={hx - 4}
                            y={hy - 4}
                            width={8}
                            height={8}
                            fill="var(--color-rb-beetle)"
                          />
                        ))
                      : null}
                  </g>
                )
              })}
            </svg>
          </div>
        </section>

        {/* validation */}
        <aside className="flex shrink-0 flex-col rounded-rb-card border-2 border-rb-swan bg-rb-snow lg:w-72">
          <div className="flex shrink-0 items-center justify-between border-b-2 border-rb-swan px-5 py-4">
            <span className="rb-eyebrow">Structural checks</span>
            {validated ? (
              <span className="rb-numeric text-sm text-rb-wolf">{passing}/{RULES.length}</span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {validated ? (
              RULES.map((rule) => (
                <div
                  key={rule.label}
                  className={`rb-pop-in flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                    rule.state === "pass"
                      ? "bg-rb-feather-wash text-[#3d6b06]"
                      : "bg-rb-cardinal-wash text-rb-cardinal-lip"
                  }`}
                >
                  {rule.state === "pass" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0">{rule.label}</span>
                </div>
              ))
            ) : (
              <p className="text-sm font-medium text-rb-wolf">
                Your diagram is checked against the structural rules for this problem — not graded
                by opinion. Validate to see which rules you have satisfied.
              </p>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t-2 border-rb-swan p-5">
            <ProgressBar
              value={validated ? (passing / RULES.length) * 100 : 0}
              tone="beetle"
              label="Rules satisfied"
            />
            <TactileButton variant="beetle" className="w-full" onClick={() => setValidated(true)}>
              validate design
            </TactileButton>
          </div>
        </aside>
      </div>
    </div>
  )
}
