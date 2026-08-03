import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Gauge, Trophy } from "@/components/icons"

import { BackButton, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import ProblemGrid from "@/components/challenges/problem-grid.jsx"
import ArenaRun from "@/components/challenges/arena-run.jsx"
import DiagramQuestionLayout from "@/components/assessments/attempt/diagram-question-layout.jsx"
import {
  BLUEPRINT_PROBLEMS,
  checkBlueprintDiagram,
} from "@/components/challenges/arena-run-fixtures.js"

/**
 * Blueprint Arena — solo run of UML and system design problems.
 *
 * The run is the assessment attempt's own diagram environment:
 * `DiagramQuestionLayout`, the same three columns, the same drawing canvas and
 * rubric panel a learner meets sitting a real exam. The hand-built SVG canvas
 * and bespoke rule list this page used to carry are gone — practising on a
 * different canvas from the one you are marked on is the one thing an arena
 * must not do.
 *
 * Problems and marking are dummies — see `arena-run-fixtures`. There is no
 * arena-problems endpoint and no structural checker yet, and the rubric says so
 * rather than showing an invented score.
 */

const SOLVED_COUNT = 2

const TONE = {
  face: "bg-rb-beetle",
  border: "border-rb-beetle-lip",
}

const GRID_PROBLEMS = BLUEPRINT_PROBLEMS.map((problem, index) => ({
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

export default function BlueprintArenaPage() {
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
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-rb-beetle shadow-[0_6px_0_var(--color-rb-beetle-lip)]">
            <Trophy className="size-12 text-white" aria-hidden="true" />
          </div>
          <h1 className="rb-display rb-display-lg mt-6 !text-center">run complete.</h1>
          <p className="rb-body-lg mt-3">
            {BLUEPRINT_PROBLEMS.length} blueprints attempted in {clock}.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["Accuracy", "—"],
              ["Rules passed", "—"],
              ["Avg. time", "—"],
            ].map(([label, value]) => (
              <div key={label} className="rb-card rb-card-raised">
                <div className="rb-numeric text-2xl text-rb-wolf">{value}</div>
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
                not scored yet
              </div>
              <div className="text-sm font-semibold text-rb-wolf">
                Runs are scored once structural marking is wired up.
              </div>
            </div>
          </div>

          <TactileButton asChild variant="beetle" className="mt-8 w-full">
            <Link to="/learner/challenges">back to arenas</Link>
          </TactileButton>
        </div>
      </div>
    )
  }

  if (view === "grid") {
    return (
      <div className="rebyu-ds min-h-dvh bg-rb-polar">
        <div className="flex items-center gap-4 px-5 pt-6 lg:px-8">
          <BackButton asChild label="Back to arenas">
            <Link to="/learner/challenges" />
          </BackButton>
          <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
            blueprint arena
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
      arenaName="blueprint arena"
      problems={BLUEPRINT_PROBLEMS}
      initialIndex={startIndex}
      clock={clock}
      onExit={() => setView("grid")}
      onFinish={() => setFinished(true)}
      renderProblem={({ key, problem, index, answer, onAnswer, navigator }) => (
        <DiagramQuestionLayout
          key={key}
          question={problem}
          index={index}
          answer={answer}
          onAnswer={onAnswer}
          navigator={navigator}
          checker={checkBlueprintDiagram}
        />
      )}
    />
  )
}
