import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Gauge, Trophy } from "@/components/icons"

import { BackButton, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import ProblemGrid from "@/components/challenges/problem-grid.jsx"
import ArenaRun from "@/components/challenges/arena-run.jsx"
import ProgrammingQuestionLayout from "@/components/assessments/attempt/programming-question-layout.jsx"
import {
  CODESTRIKE_PROBLEMS,
  CODESTRIKE_RUNNERS,
} from "@/components/challenges/arena-run-fixtures.js"

/**
 * CodeStrike — solo run of coding problems.
 *
 * The run itself is the assessment attempt's own programming environment:
 * `ProgrammingQuestionLayout`, the same three columns, the same CodeMirror
 * workspace, the same tests and executions panels a learner meets when sitting
 * a real exam. This page used to render a hand-built read-only editor and its
 * own test list, which meant practising in a workspace that resembled nothing
 * the learner would be marked in.
 *
 * Problems and judging are dummies — see `arena-run-fixtures`. There is no
 * arena-problems endpoint and no executor yet, and the panels say so rather
 * than showing an invented score.
 */

const SOLVED_COUNT = 3

const TONE = {
  face: "bg-rb-macaw",
  border: "border-rb-macaw-lip",
}

const GRID_PROBLEMS = CODESTRIKE_PROBLEMS.map((problem, index) => ({
  id: index + 1,
  title: problem.title,
  difficulty:
    problem.difficultyLevel === "difficult"
      ? "hard"
      : problem.difficultyLevel === "easy"
        ? "easy"
        : "medium",
  state: index < SOLVED_COUNT ? "solved" : index === SOLVED_COUNT ? "current" : "locked",
}))

export default function CodeStrikePage() {
  const [view, setView] = useState("grid")
  const [startIndex, setStartIndex] = useState(SOLVED_COUNT)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (view !== "play" || finished) return undefined
    const id = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [view, finished])

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`

  if (finished) {
    return (
      <div className="rebyu-ds grid min-h-dvh place-items-center bg-rb-polar px-5 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-rb-bee shadow-[0_6px_0_var(--color-rb-bee-lip)]">
            <Trophy className="size-12 text-rb-eel" aria-hidden="true" />
          </div>
          <h1 className="rb-display rb-display-lg mt-6 !text-center">run complete.</h1>
          <p className="rb-body-lg mt-3">
            {CODESTRIKE_PROBLEMS.length} problems attempted in {clock}.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["Accuracy", "—", "text-rb-wolf"],
              ["Avg. solve", "—", "text-rb-wolf"],
              ["Efficiency", "—", "text-rb-wolf"],
            ].map(([label, value, ink]) => (
              <div key={label} className="rb-card rb-card-raised">
                <div className={`rb-numeric text-2xl ${ink}`}>{value}</div>
                <div className="mt-1 text-xs font-bold text-rb-wolf">{label}</div>
              </div>
            ))}
          </div>

          {/* Nothing is scored until a judge exists; a rank here would be an
              invention, so the tiles stay empty and say why. */}
          <div className="rb-card rb-card-raised mt-5 flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-rb-beetle-wash text-rb-beetle-lip">
              <Gauge className="size-6" aria-hidden="true" />
            </span>
            <div className="text-left">
              <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
                not scored yet
              </div>
              <div className="text-sm font-semibold text-rb-wolf">
                Runs are scored once the judge is wired up.
              </div>
            </div>
          </div>

          <TactileButton asChild className="mt-8 w-full">
            <Link to="/learner/challenges">back to arenas</Link>
          </TactileButton>
        </div>
      </div>
    )
  }

  if (view === "grid") {
    return (
      <div className="rebyu-ds min-h-dvh bg-rb-polar">
        {/* No header bar on the run's home screen: the map is the page. */}
        <div className="flex items-center gap-4 px-5 pt-6 lg:px-8">
          <BackButton asChild label="Back to arenas">
            <Link to="/learner/challenges" />
          </BackButton>
          <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
            codestrike
          </div>
        </div>

        <ProblemGrid
          problems={GRID_PROBLEMS}
          onOpen={(id) => {
            setStartIndex(id - 1)
            setView("play")
          }}
          tone={TONE}
        />
      </div>
    )
  }

  return (
    <ArenaRun
      arenaName="codestrike"
      problems={CODESTRIKE_PROBLEMS}
      initialIndex={startIndex}
      clock={clock}
      onExit={() => setView("grid")}
      onFinish={() => setFinished(true)}
      renderProblem={({ key, problem, index, answer, onAnswer, navigator }) => (
        <ProgrammingQuestionLayout
          key={key}
          question={problem}
          index={index}
          answer={answer}
          onAnswer={onAnswer}
          navigator={navigator}
          runner={CODESTRIKE_RUNNERS[problem.attemptQuestionId]}
        />
      )}
    />
  )
}
