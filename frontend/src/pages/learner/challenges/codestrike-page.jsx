import { Code2 } from "@/components/icons"

import ArenaLobby from "@/components/challenges/arena-lobby.jsx"

/**
 * CodeStrike — solo run of coding problems.
 *
 * The run is the assessment attempt's own programming environment, reached
 * through {@link ArenaLobby}: same three columns, same CodeMirror workspace,
 * same tests and executions panels, and now the same Judge0 grading a learner
 * meets sitting a real exam.
 *
 * Everything this page used to render itself -- ten fixture problems, a
 * roadmap of fake solved/locked states, and a finish screen that admitted it
 * could not score anything -- is gone. The problems are an admin's now, and the
 * judge is the one the rest of the platform already uses.
 */
export default function CodeStrikePage() {
  return (
    <ArenaLobby
      arenaId="codestrike"
      name="CodeStrike"
      icon={Code2}
      tone={{ face: "bg-rb-macaw" }}
      blurb="Coding problems back to back, judged against real unit tests."
    />
  )
}
