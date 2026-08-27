import { Network } from "@/components/icons"

import ArenaLobby from "@/components/challenges/arena-lobby.jsx"

/**
 * Blueprint Arena — solo run of UML and system design problems.
 *
 * The run is the assessment attempt's own diagram surface, reached through
 * {@link ArenaLobby}: the same canvas a learner meets in an exam, and now the
 * same structural grader marking it, rather than the fixture set and stubbed
 * check this page used to render.
 */
export default function BlueprintArenaPage() {
  return (
    <ArenaLobby
      arenaId="blueprint"
      name="Blueprint Arena"
      icon={Network}
      tone={{ face: "bg-rb-beetle" }}
      blurb="UML and system design problems on a canvas, checked against structural rules."
    />
  )
}
