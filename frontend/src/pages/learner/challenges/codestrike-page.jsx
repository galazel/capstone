import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Clock, Gauge, Play, Trophy, X, Zap } from "lucide-react"

import { ProgressBar, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import ProblemGrid, {
  buildProblems,
  DIFFICULTY_CHIP as DIFFICULTY,
} from "@/components/challenges/problem-grid.jsx"

/**
 * CodeStrike — solo run of 20 coding problems.
 *
 * UI only. The editor is a read-only sample and "run tests" replays a scripted
 * result set; there is no judge engine wired up yet. Layout and states are what
 * this file exists to prove.
 */

const TITLES = [
  "Two Sum",
  "Valid Parentheses",
  "Merge Intervals",
  "LRU Cache",
  "Binary Tree Paths",
  "Course Schedule",
  "Word Ladder",
  "Median of Two Arrays",
  "Serialize Binary Tree",
  "Trapping Rain Water",
  "Longest Substring",
  "Rotate Matrix",
  "Group Anagrams",
  "Kth Largest Element",
  "Number of Islands",
  "Coin Change",
  "Edit Distance",
  "Sliding Window Max",
  "Alien Dictionary",
  "Regular Expression Match",
]

const SOLVED_COUNT = 3
const PROBLEMS = buildProblems(20, TITLES, SOLVED_COUNT)

const TONE = {
  face: "bg-rb-macaw",
  border: "border-rb-macaw-lip",
  plate: "rb-plate-macaw",
}

const CODE = [
  [["class ", "kw"], ["LRUCache", "fn"], [":", "pl"]],
  [["    def ", "kw"], ["__init__", "fn"], ["(self, capacity):", "pl"]],
  [["        self.cap ", "pl"], ["= ", "op"], ["capacity", "pl"]],
  [["        self.cache ", "pl"], ["= ", "op"], ["OrderedDict", "fn"], ["()", "pl"]],
  [["", "pl"]],
  [["    def ", "kw"], ["get", "fn"], ["(self, key):", "pl"]],
  [["        if ", "kw"], ["key ", "pl"], ["not in ", "kw"], ["self.cache:", "pl"]],
  [["            return ", "kw"], ["-1", "num"]],
  [["        self.cache.", "pl"], ["move_to_end", "fn"], ["(key)", "pl"]],
  [["        return ", "kw"], ["self.cache[key]", "pl"]],
]

// Brighter than the light-theme tokens: on a sunk dark editor the -lip shades
// go muddy, so these use the base accents.
const TOKEN = {
  kw: "text-rb-beetle-lip",
  fn: "text-rb-macaw-lip",
  num: "text-rb-fox-lip",
  op: "text-rb-cardinal-lip",
  pl: "text-rb-eel",
}

const TESTS = [
  { label: "get on empty cache returns -1", state: "pass" },
  { label: "put then get returns value", state: "pass" },
  { label: "evicts least recently used", state: "pass" },
  { label: "capacity 1 edge case", state: "fail" },
]

export default function CodeStrikePage() {
  const [view, setView] = useState("grid")
  const [active, setActive] = useState(SOLVED_COUNT + 1)
  const [running, setRunning] = useState(false)
  const [shown, setShown] = useState(TESTS.length)
  const [elapsed, setElapsed] = useState(742)
  const [finished, setFinished] = useState(false)

  const openProblem = (id) => {
    setActive(id)
    setView("play")
  }

  useEffect(() => {
    if (finished) return undefined
    const id = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [finished])

  // "Run tests" reveals results one at a time so the runner reads as live.
  useEffect(() => {
    if (!running) return undefined
    if (shown >= TESTS.length) {
      setRunning(false)
      return undefined
    }
    const id = setTimeout(() => setShown((n) => n + 1), 420)
    return () => clearTimeout(id)
  }, [running, shown])

  const solved = PROBLEMS.filter((p) => p.state === "solved").length
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
  const passing = TESTS.slice(0, shown).filter((t) => t.state === "pass").length

  if (finished) {
    return (
      <div className="rebyu-ds grid min-h-dvh place-items-center bg-rb-polar px-5 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-rb-bee shadow-[0_6px_0_var(--color-rb-bee-lip)]">
            <Trophy className="size-12 text-rb-eel" aria-hidden="true" />
          </div>
          <h1 className="rb-display rb-display-lg mt-6 text-center">run complete.</h1>
          <p className="rb-body-lg mt-3">20 of 20 problems solved in {clock}.</p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["Accuracy", "92%", "text-[#3d6b06]"],
              ["Avg. solve", "1:14", "text-rb-eel"],
              ["Efficiency", "A−", "text-rb-macaw-lip"],
            ].map(([label, value, ink]) => (
              <div key={label} className="rb-card rb-card-raised">
                <div className={`rb-numeric text-2xl ${ink}`}>{value}</div>
                <div className="mt-1 text-xs font-bold text-rb-wolf">{label}</div>
              </div>
            ))}
          </div>

          <div className="rb-card rb-card-raised mt-5 flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-rb-beetle-wash text-rb-beetle-lip">
              <Gauge className="size-6" aria-hidden="true" />
            </span>
            <div className="text-left">
              <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
                gold tier · rank 412
              </div>
              <div className="text-sm font-semibold text-rb-wolf">Top 8% globally this week</div>
            </div>
          </div>

          <TactileButton asChild className="mt-8 w-full">
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
            codestrike
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan bg-rb-polar px-3 py-1.5 text-sm font-bold tabular-nums text-rb-eel">
            <Clock className="size-4" aria-hidden="true" />
            {clock}
          </span>
        </header>

        <ProblemGrid
          arena="codestrike"
          tagline="Twenty coding problems. Pick a number to enter the arena."
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
          <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">codestrike</div>
          <div className="text-xs font-semibold text-rb-wolf">Problem {active} of 20</div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan bg-rb-polar px-3 py-1.5 text-sm font-bold tabular-nums text-rb-eel">
            <Clock className="size-4" aria-hidden="true" />
            {clock}
          </span>
          <TactileButton size="sm" variant="ghost" onClick={() => setFinished(true)}>
            finish run
          </TactileButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row lg:overflow-hidden lg:p-5">
        {/* problem ladder */}
        <aside className="shrink-0 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-5 lg:w-72 lg:overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="rb-eyebrow">Problems</span>
            <span className="rb-numeric text-sm text-rb-wolf">{solved}/20</span>
          </div>
          <ProgressBar value={(solved / 20) * 100} label="Run progress" className="mt-3" />

          {/* Compact jump grid — same numbering as the home screen, so the
              mental map of the run does not change when you enter a problem. */}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {PROBLEMS.map((problem) => {
              const isActive = problem.id === active
              return (
                <button
                  key={problem.id}
                  type="button"
                  onClick={() => setActive(problem.id)}
                  aria-label={`Go to problem ${problem.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`grid aspect-square place-items-center rounded-xl border-2 text-sm font-bold tabular-nums transition active:translate-y-[2px] ${
                    isActive
                      ? "border-rb-eel bg-rb-eel text-rb-snow"
                      : problem.state === "solved"
                        ? "border-rb-feather bg-rb-feather text-rb-eel"
                        : "border-rb-swan bg-rb-polar text-rb-wolf hover:bg-rb-snow"
                  }`}
                >
                  {problem.id}
                </button>
              )
            })}
          </div>

          <p className="mt-4 truncate text-sm font-bold text-rb-eel">
            {PROBLEMS[active - 1]?.title}
          </p>
        </aside>

        {/* statement + editor */}
        <section className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-hidden">
          <div className="shrink-0 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-rb-display text-2xl font-extrabold text-rb-eel">{PROBLEMS[active - 1]?.title}</h1>
              <span className={`rounded-rb-pill px-2.5 py-1 text-xs font-bold ${DIFFICULTY.medium}`}>
                medium
              </span>
              <span className="rounded-rb-pill bg-rb-polar px-2.5 py-1 text-xs font-bold text-rb-wolf">
                target O(1)
              </span>
            </div>
            <p className="rb-body mt-3 text-[0.9375rem]">
              Design a cache with a fixed capacity that evicts the least recently used entry once
              full. Both <span className="font-mono font-bold text-rb-macaw-lip">get</span> and{" "}
              <span className="font-mono font-bold text-rb-macaw-lip">put</span> must run in
              constant time.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b-2 border-rb-swan px-5 py-3">
                <span className="rounded-rb-pill bg-rb-macaw-wash px-2.5 py-1 text-[0.6875rem] font-bold text-rb-macaw-lip">
                  solution.py
                </span>
                <span className="text-[0.6875rem] font-bold text-rb-hare">python 3.11</span>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto bg-rb-polar p-5 font-mono text-sm leading-7">
                <code>
                  {CODE.map((line, i) => (
                    <div key={i} className="flex gap-3 whitespace-pre">
                      <span className="w-5 shrink-0 select-none text-right text-rb-hare">{i + 1}</span>
                      <span>
                        {line.map(([text, tok], j) => (
                          <span key={j} className={TOKEN[tok]}>{text}</span>
                        ))}
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>

            {/* split-screen test runner */}
            <div className="flex w-full max-w-sm shrink-0 flex-col border-l-2 border-rb-swan">
              <div className="flex shrink-0 items-center justify-between border-b-2 border-rb-swan px-5 py-3">
                <span className="rb-eyebrow">Tests</span>
                <span className="rb-numeric text-sm text-rb-wolf">{passing}/{TESTS.length}</span>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {TESTS.slice(0, shown).map((test) => (
                  <div
                    key={test.label}
                    className={`rb-pop-in flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                      test.state === "pass"
                        ? "bg-rb-feather-wash text-[#3d6b06]"
                        : "bg-rb-cardinal-wash text-rb-cardinal-lip"
                    }`}
                  >
                    {test.state === "pass" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    )}
                    <span className="min-w-0">{test.label}</span>
                  </div>
                ))}
                {running && shown < TESTS.length ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-rb-wolf">
                    <span className="size-3 animate-spin rounded-full border-2 border-rb-hare border-t-transparent" />
                    running…
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t-2 border-rb-swan p-5">
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-rb-polar px-3 py-2">
                  <Zap className="size-4 text-rb-fox-lip" aria-hidden="true" />
                  <span className="text-xs font-bold text-rb-wolf">Complexity O(1) · +40 pts</span>
                </div>
                <TactileButton
                  variant="macaw"
                  className="w-full"
                  onClick={() => {
                    setShown(0)
                    setRunning(true)
                  }}
                >
                  <Play className="size-5" />
                  run tests
                </TactileButton>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
