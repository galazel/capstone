import { Check, Lock } from "lucide-react"

import { ProgressBar } from "@/components/rebyu/rebyu-ui.jsx"

/**
 * Numbered problem selector shared by CodeStrike and Blueprint Arena.
 *
 * States are carried by colour *and* an icon, so the grid never depends on
 * colour alone. Locked cells stay in the grid rather than being hidden — seeing
 * how far the run goes is part of what makes it read as an endurance run.
 */

export function buildProblems(count, titles, solvedCount) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: titles[i % titles.length],
    difficulty: i < count * 0.3 ? "easy" : i < count * 0.7 ? "medium" : "hard",
    state: i < solvedCount ? "solved" : i === solvedCount ? "current" : "locked",
  }))
}

export const DIFFICULTY_CHIP = {
  easy: "bg-rb-feather-wash text-[#3d6b06]",
  medium: "bg-rb-fox-wash text-rb-fox-lip",
  hard: "bg-rb-cardinal-wash text-rb-cardinal-lip",
}

function Cell({ problem, onOpen, tone }) {
  const locked = problem.state === "locked"
  const solved = problem.state === "solved"
  const current = problem.state === "current"

  return (
    <button
      type="button"
      onClick={() => onOpen(problem.id)}
      aria-label={`Problem ${problem.id} — ${problem.title} — ${problem.state}`}
      className={`relative grid aspect-square place-items-center rounded-2xl border-2 transition active:translate-y-[3px] active:shadow-none ${
        solved
          ? "border-rb-feather bg-rb-feather text-white shadow-[0_4px_0_var(--color-rb-feather-lip)]"
          : current
            ? `${tone.border} ${tone.face} text-white shadow-[0_4px_0_rgb(0_0_0/0.18)]`
            : "border-rb-swan bg-rb-polar text-rb-wolf shadow-[0_4px_0_var(--color-rb-swan)] hover:bg-rb-snow"
      }`}
    >
      <span className="rb-numeric text-2xl leading-none sm:text-3xl">{problem.id}</span>

      <span className="absolute right-1.5 top-1.5">
        {solved ? <Check className="size-3.5" aria-hidden="true" /> : null}
        {locked ? <Lock className="size-3 opacity-60" aria-hidden="true" /> : null}
      </span>

      {current ? (
        <span className="absolute -bottom-px left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-white/80" />
      ) : null}
    </button>
  )
}

export default function ProblemGrid({
  arena,
  tagline,
  problems,
  onOpen,
  tone,
  footer,
}) {
  const solved = problems.filter((p) => p.state === "solved").length

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12">
      <div className="flex flex-col items-center">
        <h1 className="font-rb-display text-4xl font-extrabold lowercase text-rb-eel sm:text-5xl">
          {arena}
        </h1>
        <p className="rb-body-lg mt-3 max-w-md text-center">{tagline}</p>
      </div>

      <div className="mt-10 rounded-rb-card border-2 border-rb-swan bg-rb-snow p-6 shadow-[0_6px_0_var(--color-rb-swan)] sm:p-8">
        <div className="flex items-baseline justify-between">
          <span className="rb-eyebrow">Progress</span>
          <span className="rb-numeric text-base text-rb-wolf">
            {solved} / {problems.length} solved
          </span>
        </div>
        <ProgressBar
          value={(solved / problems.length) * 100}
          label="Run progress"
          className="mt-4 !h-5"
        />

        {/* 5 across on mobile so a 20-problem run is exactly four tidy rows. */}
        <div className="mt-8 grid grid-cols-5 gap-3 sm:gap-4 lg:grid-cols-10">
          {problems.map((problem) => (
            <Cell key={problem.id} problem={problem} onOpen={onOpen} tone={tone} />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t-2 border-rb-swan pt-5 text-sm font-bold text-rb-wolf">
          <span className="flex items-center gap-1.5">
            <span className="size-4 rounded border-2 border-rb-feather bg-rb-feather" /> solved
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`size-4 rounded border-2 ${tone.border} ${tone.face}`} /> up next
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-4 rounded border-2 border-rb-swan bg-rb-polar" /> locked
          </span>
        </div>
      </div>

      {footer}
    </div>
  )
}
