import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Loader2, Lock, Trophy } from "@/components/icons"
import { BackButton, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { CHALLENGE_ARENAS_KEY, getChallengeArenas } from "@/services/challengeService.js"

/**
 * The way into a solo arena.
 *
 * <p>The run itself is an ordinary assessment attempt. An arena's problems are
 * a CHALLENGE exam, so entering one hands the learner to
 * `/learner/assessments/:examId` -- the same runner they sit a real exam in,
 * with the same CodeMirror workspace, the same autosave, the same timer, and
 * the same grading. Judge0 marks the code; the structural grader marks the
 * diagrams. None of that had to be written twice, and none of it can drift
 * from how the learner is marked everywhere else.
 *
 * <p>This page therefore stops at the door: it says what the arena is, whether
 * it is ready, and starts it.
 *
 * <p>It used to render the run itself from `arena-run-fixtures` -- ten
 * hardcoded problems and a stubbed judge that replayed a fixed result. That
 * was honest scaffolding while no arena problems existed. They exist now, so a
 * fixture would be a lie rather than a placeholder.
 */
export function ArenaLobby({ arenaId, name, blurb, icon: Icon = Trophy, tone }) {
  const navigate = useNavigate()

  const arenasQuery = useQuery({
    queryKey: [CHALLENGE_ARENAS_KEY],
    queryFn: getChallengeArenas,
    staleTime: 60_000,
  })

  const arena = (arenasQuery.data ?? []).find((row) => row.arenaId === arenaId) ?? null
  const configured = Boolean(arena?.configured)

  return (
    <div className="rebyu-ds min-h-dvh bg-rb-polar">
      <div className="flex items-center gap-4 px-5 pt-6 lg:px-8">
        <BackButton asChild label="Back to arenas">
          <Link to="/learner/challenges" />
        </BackButton>
        <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
          {name.toLowerCase()}
        </div>
      </div>

      <div className="grid place-items-center px-5 py-12">
        <div className="w-full max-w-lg text-center">
          <div
            className={`mx-auto grid size-24 place-items-center rounded-full ${
              tone?.face ?? "bg-rb-macaw"
            }`}
          >
            <Icon className="size-12 text-white" aria-hidden="true" />
          </div>

          <h1 className="rb-display rb-display-lg mt-6 !text-center">{name.toLowerCase()}</h1>
          <p className="rb-body-lg mt-3">{blurb}</p>

          {arenasQuery.isLoading ? (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-rb-wolf">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Checking this arena
            </div>
          ) : !configured ? (
            /* Reachable by typing the URL even though the card is locked, so
               the same answer is given here rather than starting a run with
               nothing in it. */
            <div className="rb-card rb-card-raised mt-8 flex items-center gap-4 text-left">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rb-swan text-rb-wolf">
                <Lock className="size-6" aria-hidden="true" />
              </span>
              <div>
                <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
                  not open yet
                </div>
                <div className="text-sm font-semibold text-rb-wolf">
                  This arena has no problems set up yet. It opens as soon as an admin
                  adds them.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rb-card rb-card-raised">
                  <div className="rb-numeric text-2xl text-rb-eel">{arena.problemCount}</div>
                  <div className="mt-1 text-xs font-bold text-rb-wolf">
                    problem{arena.problemCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="rb-card rb-card-raised">
                  <div className="rb-numeric text-2xl text-rb-eel">judged</div>
                  <div className="mt-1 text-xs font-bold text-rb-wolf">on submit</div>
                </div>
              </div>

              {/* Says where the button goes. A run that turns out to be a
                  graded attempt against your record is not what "practice"
                  implies, and finding that out afterwards is worse. */}
              <p className="mt-5 text-sm font-semibold text-rb-wolf">
                Entering starts a graded run in the standard exam workspace. You need
                to be enrolled in the certification this arena draws from.
              </p>

              <TactileButton
                className="mt-6 w-full"
                onClick={() => navigate(`/learner/assessments/${arena.examId}`)}
              >
                enter arena
              </TactileButton>
            </>
          )}

          <TactileButton asChild variant="ghost" className="mt-3 w-full">
            <Link to="/learner/challenges">back to arenas</Link>
          </TactileButton>
        </div>
      </div>
    </div>
  )
}

export default ArenaLobby
