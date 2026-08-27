import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useOutletContext } from "react-router-dom"
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Code2,
  Crown,
  Flame,
  Medal,
  Network,
  Target,
  Trophy,
  Zap,
} from "@/components/icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  CHALLENGE_ARENAS_KEY,
  getChallengeArenas,
  getChallengeLeaderboard,
  getMyChallengeRecord,
} from "@/services/challengeService.js"
import LearnerPremiumGuard from "@/components/learner/learner-premium-guard.jsx"
import { XpRankingsPanel } from "@/components/learner/xp-rankings-panel.jsx"
import { FEATURES } from "@/services/subscriptionService.js"
import { getWorldCupTracks } from "@/lib/arenas.js"

/* The three IT Olympics arenas, and only those three.

   QueryRealm, Sprint Challenge and Daily Ranked were listed here with no page
   behind them -- two of the three permanently "coming soon", the third pointing
   at the standalone compiler playground. Meanwhile CodeStrike and Blueprint
   Arena, which *do* have routes, sat greyed out as unavailable.

   The two solo arenas are the default: they draw from the whole published bank,
   so there is nothing to be enrolled in and nothing to unlock. World Cup is the
   exception -- see `worldCupTracks` below. */
/* Each arena takes one accent from the brand palette rather than its own
   invented gradient, so the carousel reads as three cards in one system. The
   surface is the matching wash token, which has a dark-mode partner — the old
   hardcoded pastels stayed light while everything around them went dark. */
const CHALLENGES = [
  {
    id: "codestrike",
    title: "CodeStrike",
    role: "Coding Skills",
    description:
      "Ten stages of coding problems, judged against real unit tests and scored on time complexity.",
    icon: Code2,
    tag: "Practice",
    accent: "linear-gradient(135deg, var(--color-rb-feather), var(--color-rb-macaw))",
    surfaceClass: "bg-rb-macaw-wash dark:bg-[#12283d]",
    route: "/learner/challenges/codestrike",
  },
  {
    id: "blueprint",
    title: "Blueprint Arena",
    role: "Design Skills",
    description:
      "Ten stages of UML and system design on a drag-and-drop canvas, checked against structural rules.",
    icon: Network,
    tag: "Design",
    accent: "linear-gradient(135deg, var(--color-rb-beetle-lip), var(--color-rb-beetle))",
    surfaceClass: "bg-rb-beetle-wash dark:bg-[#2a1f3a]",
    route: "/learner/challenges/blueprint-arena",
  },
  {
    id: "worldcup",
    title: "World Cup",
    role: "Exam Readiness",
    description:
      "An eight-player bracket on one of your certification tracks — quarterfinals, semis, and a timed final.",
    icon: Trophy,
    tag: "Tournament",
    accent: "linear-gradient(135deg, var(--color-rb-fox-lip), var(--color-rb-fox))",
    surfaceClass: "bg-rb-fox-wash dark:bg-[#3a2a12]",
    route: "/learner/challenges/world-cup",
    // The bracket is played on one certification's question bank, so it opens
    // only for a learner who is enrolled in at least one.
    needsEnrollment: true,
  },
]

/* No preview data here any more.
   The board and the activity list used to fall back to five invented learners
   and three invented sessions whenever the request came back empty -- which it
   always did for a learner, because the page was reading `/api/challenge-
   sessions` (every session on the platform) and `/api/learners` (every learner)
   to build them, and those are not a learner's to read. Both now come from
   endpoints scoped to the caller, and empty means empty: a board nobody is on
   says so, and says that finishing a challenge puts you top of it. */

/* Wrapped against the number of cards actually shown, not the full catalogue.
   Filtering by industry can leave two arenas on screen while this still
   assumed three, which put a card at a position no slot rendered. */
function relativePosition(index, activeIndex, total) {
  let difference = index - activeIndex
  const midpoint = Math.floor(total / 2)
  if (difference > midpoint) difference -= total
  if (difference < -midpoint) difference += total
  return difference
}

function formatSessionDate(value) {
  if (!value) return "Date unavailable"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date unavailable"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export default function LearnerChallengesPage() {
  const navigate = useNavigate()
  const outletContext = useOutletContext()
  const learnerId = outletContext?.data?.learnerId ?? null
  const [activeIndex, setActiveIndex] = useState(0)

  /* The learner's own tracks. Enrolled in TOPCIT and nothing else? TOPCIT is
     the only track the World Cup can put you in. */
  const worldCupTracks = useMemo(
    () => getWorldCupTracks(outletContext?.data?.enrolledCertifications ?? []),
    [outletContext?.data?.enrolledCertifications],
  )

  /* Which arenas an admin has actually put problems into.
     An arena with no problems is not a hard challenge -- it is a run that opens
     onto nothing, and finding that out after clicking in is worse than being
     told on the card. */
  const arenaQuery = useQuery({
    queryKey: [CHALLENGE_ARENAS_KEY],
    queryFn: getChallengeArenas,
    staleTime: 60_000,
  })

  const configuredArenas = useMemo(() => {
    const map = new Map()
    for (const arena of arenaQuery.data ?? []) {
      map.set(arena.arenaId, arena)
    }
    return map
  }, [arenaQuery.data])

  /* The industries this learner is actually in, taken from what they are
     enrolled in. A certification carries one; an arena is assigned a set. */
  const learnerIndustries = useMemo(() => {
    const set = new Set()
    for (const certification of outletContext?.data?.enrolledCertifications ?? []) {
      if (certification?.industry) set.add(certification.industry)
    }
    return set
  }, [outletContext?.data?.enrolledCertifications])

  const challenges = useMemo(
    () =>
      CHALLENGES.map((challenge) => {
        const arena = configuredArenas.get(challenge.id)
        const configured = Boolean(arena?.configured)

        /* Unknown is not unconfigured. While the lookup is in flight -- or if it
           failed -- every arena would otherwise read as locked, which is a page
           full of padlocks caused by a slow request. */
        const known = arenaQuery.isSuccess
        const ready = !known || configured

        const enrolled = !challenge.needsEnrollment || worldCupTracks.length > 0

        /* Whether this arena is meant for this learner at all.
           An arena with no industries assigned is open to everyone -- that is
           the state every arena starts in, and reading it as "nobody" would
           empty the page the moment the feature shipped. Once an admin assigns
           industries, only learners enrolled in a certification from one of
           them belong there. */
        const restricted = (arena?.industries ?? []).length > 0
        const inIndustry =
          !known ||
          !restricted ||
          (arena.industries ?? []).some((industry) => learnerIndustries.has(industry))

        return {
          ...challenge,
          ...(challenge.needsEnrollment ? { tracks: worldCupTracks } : null),
          problemCount: arena?.problemCount ?? 0,
          // Told apart so the message can say which of the two it is: nothing
          // to run, or nothing of yours to run it on.
          unconfigured: known && !configured,
          inIndustry,
          available: ready && enrolled,
        }
      }),
    [worldCupTracks, configuredArenas, arenaQuery.isSuccess, learnerIndustries],
  )

  /* Arenas for someone else's industry are not shown at all, rather than shown
     locked. A padlock invites the learner to work out how to open it; this one
     never opens for them, and saying so on a card they cannot use is noise. */
  const visibleChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.inIndustry),
    [challenges],
  )

  // Clamped: filtering can shorten the list under a carousel that was already
  // scrolled, leaving `activeIndex` past the end and `activeChallenge`
  // undefined.
  const safeIndex = visibleChallenges.length
    ? Math.min(activeIndex, visibleChallenges.length - 1)
    : 0
  const activeChallenge = visibleChallenges[safeIndex] ?? null

  /* Two scoped reads. The server ranks and names the board (and marks which row
     is yours), and returns your own totals, streak and recent sessions -- work
     that used to be done in the browser over data belonging to everybody. */
  const leaderboardQuery = useQuery({
    queryKey: ["challenge-leaderboard"],
    queryFn: () => getChallengeLeaderboard(10),
    staleTime: 60_000,
  })

  const recordQuery = useQuery({
    queryKey: ["challenge-record", learnerId],
    queryFn: getMyChallengeRecord,
    enabled: learnerId != null,
    staleTime: 60_000,
  })

  const leaderboard = Array.isArray(leaderboardQuery.data) ? leaderboardQuery.data : []
  const record = recordQuery.data ?? null
  const recentSessions = Array.isArray(record?.recent) ? record.recent : []

  const move = (direction) => {
    // Modulo zero is NaN, which would wedge the carousel permanently.
    if (visibleChallenges.length === 0) return
    setActiveIndex(
      (current) =>
        (current + direction + visibleChallenges.length) % visibleChallenges.length
    )
  }

  const selectChallenge = (challenge) => {
    if (challenge.available) {
      navigate(challenge.route)
      return
    }
    /* Two reasons an arena can be shut, and they need different answers: one
       is on the learner to fix, the other is not theirs at all. */
    if (challenge.unconfigured) {
      toast.info(`${challenge.title} is not ready yet`, {
        description:
          "This arena has no problems set up yet. It unlocks as soon as an admin adds them.",
      })
      return
    }

    toast.info("Enrol in a certification first", {
      description:
        "The World Cup bracket runs on one certification's question bank. Enrol in a certification to unlock it.",
    })
  }

  return (
    <LearnerPremiumGuard
      feature={FEATURES.CHALLENGES_ACCESS}
      title="Pro challenges and battles"
      description="Unlock ranked challenges, battles, leaderboards, rewards, and certification-specific practice with Pro or institution access."
    >
    <div
      className="relative left-1/2 isolate -my-6 min-h-[calc(100dvh-4rem)] w-screen -translate-x-1/2 overflow-hidden bg-[var(--rb-page-surface)] px-4 py-8 sm:px-6 lg:px-8"
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 18%, rgba(47,125,211,0.16), transparent 27%), radial-gradient(circle at 82% 22%, rgba(53,169,160,0.12), transparent 28%), radial-gradient(circle at 50% 92%, rgba(226,170,54,0.09), transparent 30%)",
      }}
    >
      <div className="pointer-events-none absolute top-24 -left-20 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute top-48 -right-20 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-32 bg-gradient-to-t from-blue-200/40 to-transparent dark:from-blue-950/40" />

      <div className="relative mx-auto w-full max-w-6xl space-y-6">
        <section
          className="relative overflow-hidden px-1 py-6 before:absolute before:top-20 before:left-1/2 before:h-72 before:w-[80%] before:-translate-x-1/2 before:rounded-full before:bg-white/45 before:blur-3xl before:content-[''] sm:px-4 dark:before:bg-blue-950/25"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") move(-1)
            if (event.key === "ArrowRight") move(1)
          }}
          tabIndex={0}
          aria-label="Challenge activity carousel"
        >
          <div className="text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Trophy className="size-5" />
            </div>
            <p className="mt-3 font-rb-display text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
              Choose your challenge
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose what you want to practice and take on your next challenge.
            </p>
          </div>

          <div className="relative mt-7 h-[390px] sm:h-[420px]">
            {visibleChallenges.map((challenge, index) => {
              const position = relativePosition(index, safeIndex, visibleChallenges.length)
              const isActive = position === 0
              const Icon = challenge.icon
              return (
                <button
                  key={challenge.title}
                  type="button"
                  onClick={() => isActive ? selectChallenge(challenge) : setActiveIndex(index)}
                  className={`absolute top-1/2 left-1/2 isolate h-[350px] w-[250px] overflow-hidden rounded-rb-card border-2 text-left transition-all duration-500 ease-out [backface-visibility:hidden] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw sm:w-[280px] ${challenge.surfaceClass} ${
                    isActive
                      ? "border-rb-macaw shadow-[0_26px_65px_-18px_rgba(27,110,243,0.45)]"
                      : "border-border shadow-[0_22px_55px_-18px_rgba(15,23,42,0.35)]"
                  }`}
                  style={{
                    transform: `translate(calc(-50% + ${position * 190}px), -50%) scale(${isActive ? 1 : Math.abs(position) === 1 ? 0.82 : 0.66})`,
                    opacity: 1,
                    visibility: "visible",
                    zIndex: 10 - Math.abs(position),
                    pointerEvents: "auto",
                  }}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${challenge.title}${isActive ? ", selected" : ", select"}`}
                >
                  <div className="relative flex h-44 items-center justify-center overflow-hidden" style={{ background: challenge.accent }}>
                    <div className="absolute top-3 right-3 left-3 z-10 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-white/90 px-2.5 py-1 font-rb-display text-[10px] font-extrabold uppercase tracking-wide text-rb-eel backdrop-blur-sm">
                        {challenge.tag}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 font-rb-display text-[10px] font-extrabold uppercase tracking-wide backdrop-blur-sm ${challenge.available ? "bg-white/90 text-rb-feather-lip" : "bg-black/45 text-white"}`}>
                        {challenge.available ? "Ready" : "Enrol to unlock"}
                      </span>
                    </div>
                    <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
                    <div className="absolute -bottom-10 -left-7 h-32 w-32 rounded-full bg-white/10" />
                    <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-white shadow-xl transition-transform duration-500 ${isActive ? "scale-100" : "scale-90"}`}>
                      <Icon className="h-12 w-12" strokeWidth={1.7} />
                    </div>
                  </div>
                  <div className={`h-[176px] p-5 text-center ${challenge.surfaceClass}`}>
                    <p className="font-rb-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">{challenge.role}</p>
                    <h2 className="mt-1 font-rb-display text-xl font-extrabold text-foreground">{challenge.title}</h2>
                    <p className="mt-2 min-h-12 text-xs leading-5 text-muted-foreground">{challenge.description}</p>

                    {/* Your tracks, named on the card. "Choose your certification
                        track" on the next screen is no help if you cannot tell
                        from here which ones are yours. */}
                    {challenge.tracks ? (
                      <div className="mt-2 flex flex-wrap justify-center gap-1">
                        {challenge.tracks.length > 0 ? (
                          challenge.tracks.slice(0, 3).map((track) => (
                            <span
                              key={track.id}
                              className="max-w-full truncate rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                            >
                              {track.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground">
                            No certification enrolled
                          </span>
                        )}
                        {challenge.tracks.length > 3 ? (
                          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            +{challenge.tracks.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className={`mx-auto mt-4 h-1 rounded-full transition-all ${isActive ? "w-14 bg-primary" : "w-6 bg-muted"}`} aria-hidden="true" />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button type="button" variant="ghost" size="icon" className="size-11 rounded-full border-2 border-border bg-card" onClick={() => move(-1)} aria-label="Previous challenge">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex gap-1.5" aria-hidden="true">
              {visibleChallenges.map((challenge, index) => (
                <span key={challenge.title} className={`h-1.5 rounded-full transition-all ${index === safeIndex ? "w-7 bg-primary" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-11 rounded-full border-2 border-border bg-card" onClick={() => move(1)} aria-label="Next challenge">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </section>

        {/* Nothing on screen when no arena belongs to this learner's industry.
            The strip below reads off the active card, so without this it would
            dereference a card that is not there. */}
        {activeChallenge ? (
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-2 pt-5 text-center sm:flex-row sm:text-left">
            <div>
              <p className="font-semibold text-foreground">{activeChallenge.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeChallenge.available
                  ? "This game mode is ready to play."
                  : activeChallenge.unconfigured
                    ? "This arena is not set up yet."
                    : "Enrol in a certification to queue for the World Cup bracket."}
              </p>
            </div>
            <Button type="button" onClick={() => selectChallenge(activeChallenge)} variant={activeChallenge.available ? "default" : "secondary"}>
              {activeChallenge.available ? "Start challenge" : "Enrol to unlock"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-xl px-2 pt-5 text-center">
            <p className="font-semibold text-foreground">No arenas for you yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Arenas are opened to particular industries. None currently covers a
              certification you are enrolled in.
            </p>
          </div>
        )}

        <section className="mx-auto max-w-6xl border-t border-blue-200/70 pt-10 dark:border-blue-900/70">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
            <div className="min-w-0">
              <div className="flex items-end justify-between gap-4 border-b-2 border-border pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    <Crown className="size-4 text-rb-fox-lip" />
                    Leaderboard
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ranked by points earned from completed challenges.
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {leaderboard.length} ranked
                </span>
              </div>

              {leaderboardQuery.isLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Loading the board…
                </p>
              ) : leaderboard.length === 0 ? (
                /* The honest empty state, and an invitation: nobody has
                   finished a challenge yet, so the first to finish one tops
                   the board. */
                <div className="py-10 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rb-fox-wash text-rb-fox-lip">
                    <Crown className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-rb-display text-base font-extrabold text-foreground">
                    Nobody is on the board yet
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Finish a challenge and you take first place.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {leaderboard.map((entry) => (
                    <div
                      key={`${entry.rank}-${entry.name}`}
                      className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-3.5 ${entry.you ? "bg-rb-macaw-wash dark:bg-rb-macaw/10" : ""}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-muted-foreground">
                        {entry.rank <= 3 ? (
                          <Medal className={`h-5 w-5 ${entry.rank === 1 ? "text-rb-fox" : entry.rank === 2 ? "text-rb-hare" : "text-rb-fox-lip"}`} />
                        ) : entry.rank}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {entry.name}{entry.you ? " (You)" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.completed} completed · Best {entry.bestScore.toLocaleString()} pts</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-rb-macaw-lip dark:text-rb-macaw">
                        {entry.points.toLocaleString()} pts
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Target className="h-4 w-4 text-blue-600" />
                  Your competition record
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 border-y-2 border-border py-5">
                  <div>
                    <dt className="text-xs text-muted-foreground">Global rank</dt>
                    <dd className="mt-1 text-2xl font-bold text-foreground">{record?.rank ? `#${record.rank}` : "Unranked"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total points</dt>
                    <dd className="mt-1 text-2xl font-bold text-foreground">{(record?.points ?? 0).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5" /> Challenge streak</dt>
                    <dd className="mt-1 text-lg font-semibold text-foreground">{record?.streakDays ?? 0} {record?.streakDays === 1 ? "day" : "days"}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Zap className="h-3.5 w-3.5" /> Best score</dt>
                    <dd className="mt-1 text-lg font-semibold text-foreground">{(record?.bestScore ?? 0).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Activity className="size-4 text-rb-beetle-lip" />
                  Recent activity
                </div>
                {recentSessions.length === 0 ? (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">Your completed challenges will appear here.</p>
                ) : (
                  <div className="mt-3 divide-y divide-border">
                    {recentSessions.slice(0, 4).map((session) => (
                      <div key={session.challengeSessionId} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {session.mode ?? "Challenge"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatSessionDate(session.startedAt)} · {String(session.status ?? "").replace("_", " ")}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {session.score == null ? "—" : `${Number(session.score).toLocaleString()} pts`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* The XP board, which used to be its own /learner/rankings page and
            its own top-level nav item. Both boards are standings, so they
            belong on the same page; they stay separate blocks because they
            rank different things — challenge points above, XP here. */}
        <section className="mx-auto max-w-6xl border-t border-blue-200/70 pt-10 dark:border-blue-900/70">
          <XpRankingsPanel />
        </section>
      </div>
    </div>
    </LearnerPremiumGuard>
  )
}
