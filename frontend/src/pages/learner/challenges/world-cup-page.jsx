import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Award, Clock, Crown, Gauge, Trophy, Users, Zap } from "@/components/icons"

import { BackButton, ProgressBar, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { getWorldCupTracks } from "@/lib/arenas.js"
import { getLearnerPortalData } from "@/services/learnerService.js"

/**
 * World Cup — 8-player synchronised tournament.
 *
 * UI only: the whole journey (track select -> lobby -> bracket -> stats) runs
 * on local timers and fixture data so it can be reviewed before matchmaking,
 * sockets, or scoring exist. Nothing here calls an API.
 *
 * Same shell as CodeStrike and Blueprint Arena — h-20 header, back key, the
 * run's name in lowercase display type — and the same full-height body: a
 * tournament is the whole screen for as long as you are in it, not a panel in
 * the middle of a centred page. The arena's own voice is carried by scale and
 * colour (Fox quarters, Macaw semis, Cardinal final, Bee trophy), not by a
 * second set of type rules.
 */

/* Blade fills stay saturated: they are the one bold moment on a light page,
   and white type needs the depth to stay legible over the full panel. */
const BLADE_TONE = {
  bee: { bg: "bg-gradient-to-b from-rb-bee to-rb-bee-lip" },
  macaw: { bg: "bg-gradient-to-b from-rb-macaw to-rb-macaw-lip" },
  beetle: { bg: "bg-gradient-to-b from-rb-beetle to-rb-beetle-lip" },
}

const TRACK_TONE = {
  bee: { wash: "bg-rb-bee-wash", ink: "text-rb-bee-ink" },
  macaw: { wash: "bg-rb-macaw-wash", ink: "text-rb-macaw-lip" },
  beetle: { wash: "bg-rb-beetle-wash", ink: "text-rb-beetle-lip" },
}

// Tier drives the avatar frame colour, weakest to strongest.
const TIERS = {
  bronze: { label: "Bronze", frame: "border-[#c98a4b]", badge: "bg-[#a9722f]" },
  silver: { label: "Silver", frame: "border-rb-hare", badge: "bg-rb-wolf" },
  gold: { label: "Gold", frame: "border-rb-bee", badge: "bg-rb-bee-lip" },
  elite: { label: "Elite", frame: "border-rb-beetle", badge: "bg-rb-beetle-lip" },
}

const ROSTER = [
  { name: "You", title: "Cebu Institute", initials: "yo", tier: "gold", you: true },
  { name: "Rina D.", title: "UP Cebu", initials: "rd", tier: "elite" },
  { name: "Jed R.", title: "USC", initials: "jr", tier: "silver" },
  { name: "Maya L.", title: "CIT-U", initials: "ml", tier: "gold" },
  { name: "Karl V.", title: "UST", initials: "kv", tier: "bronze" },
  { name: "Ana P.", title: "Ateneo", initials: "ap", tier: "silver" },
  { name: "Noel S.", title: "Mapúa", initials: "ns", tier: "gold" },
  { name: "Tin M.", title: "DLSU", initials: "tm", tier: "bronze" },
]

const AWARDS = [
  { key: "mvp", label: "Tournament MVP", who: "Rina D.", detail: "4 wins · 96% accuracy", icon: Crown, tone: "bg-rb-bee text-[#4a3600]" },
  { key: "speed", label: "Speed Demon", who: "Maya L.", detail: "Fastest solve — 41s", icon: Zap, tone: "bg-rb-fox text-white" },
  { key: "architect", label: "Master Architect", who: "You", detail: "Highest accuracy — 94%", icon: Gauge, tone: "bg-rb-macaw text-white" },
]

const STANDINGS = [
  { name: "Rina D.", solved: 12, accuracy: 96, avg: "0:52" },
  { name: "You", solved: 11, accuracy: 94, avg: "1:04", you: true },
  { name: "Maya L.", solved: 11, accuracy: 88, avg: "0:41" },
  { name: "Noel S.", solved: 9, accuracy: 84, avg: "1:12" },
  { name: "Jed R.", solved: 8, accuracy: 81, avg: "1:20" },
]

/* --------------------------------------------------------------- lobby line-up */

function Standee({ player, index }) {
  if (!player) {
    return (
      <div className="rb-standee rb-standee-empty justify-center">
        <div className="rb-pulse-slot grid size-[clamp(64px,8vh,104px)] place-items-center rounded-full border-2 border-dashed border-rb-swan">
          <Users className="size-7 text-rb-hare" aria-hidden="true" />
        </div>
        <p className="mt-4 text-center text-xs font-bold leading-tight text-rb-hare">
          waiting for
          <br />
          challenger
        </p>
        <span className="rb-numeric mt-auto pt-3 text-sm text-rb-hare">{index + 1}</span>
      </div>
    )
  }

  const tier = TIERS[player.tier]

  return (
    <div className={`rb-standee rb-pop-in ${player.you ? "rb-standee-you" : ""}`}>
      <span className={`rb-frame ${tier.frame}`} aria-hidden="true">
        {player.initials}
      </span>

      <p className="mt-4 w-full truncate text-center text-base font-extrabold text-rb-eel">
        {player.name}
      </p>
      <p className="w-full truncate text-center text-xs font-semibold text-rb-wolf">
        {player.title}
      </p>

      <span
        className={`mt-auto rounded-rb-pill px-3 py-1 text-[0.6875rem] font-extrabold uppercase tracking-wide text-rb-snow ${tier.badge}`}
      >
        {tier.label}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------- bracket */

/* Bracket geometry, in pixels. The elbow connectors are drawn with borders
   rather than SVG, so every one of these numbers has to agree with the seat
   height set on `.rb-arena` in the stylesheet:
     pair height   = 2*SEAT + PAIR_GAP        = 110
     quarters span = 2*pair + GROUP_GAP       = 260
     semi gap      = span - 2*SEAT - 2*(pair/2 - SEAT/2) rounded to 106
   which lands each semifinal seat's centre on the centre of its quarter pair. */
const SEAT_H = 44
const PAIR_GAP = 22
const GROUP_GAP = 40
const SEMI_GAP = 106
const SEAT_W = 168

function Seat({ name, variant = "outer" }) {
  return <div className={`rb-seat rb-seat-${variant}`}>{name}</div>
}

/* Elbow connector: out from the seat, down/up to the midpoint, then inward.
   Drawn with borders rather than SVG so it reflows with the seat rows. */
function Elbow({ side }) {
  const isLeft = side === "left"
  return (
    <div
      aria-hidden="true"
      style={{ marginTop: SEAT_H / 2, marginBottom: SEAT_H / 2 }}
      className={`relative w-6 shrink-0 ${
        isLeft ? "border-r-2 border-rb-swan" : "border-l-2 border-rb-swan"
      }`}
    >
      <span className={`absolute top-0 h-0.5 w-6 bg-rb-swan ${isLeft ? "-left-6" : "-right-6"}`} />
      <span className={`absolute bottom-0 h-0.5 w-6 bg-rb-swan ${isLeft ? "-left-6" : "-right-6"}`} />
      <span className={`absolute top-1/2 h-0.5 w-6 bg-rb-swan ${isLeft ? "-right-6" : "-left-6"}`} />
    </div>
  )
}

function QuarterPair({ pair, side }) {
  return (
    <div className={`flex items-stretch ${side === "right" ? "flex-row-reverse" : ""}`}>
      <div
        className="flex shrink-0 flex-col"
        style={{ width: SEAT_W, gap: PAIR_GAP }}
      >
        {pair.map(([name, alive]) => (
          <Seat key={name} name={name} variant={alive ? "outer" : "out"} />
        ))}
      </div>
      <Elbow side={side} />
    </div>
  )
}

function BranchSide({ side, quarters, semis }) {
  const reverse = side === "right"
  return (
    <div className={`flex items-center ${reverse ? "flex-row-reverse" : ""}`}>
      <div className="flex flex-col" style={{ gap: GROUP_GAP }}>
        {quarters.map((pair, i) => (
          <QuarterPair key={i} pair={pair} side={side} />
        ))}
      </div>

      {/* semifinal column, vertically centred against its two quarter pairs */}
      <div className={`flex items-stretch ${reverse ? "flex-row-reverse" : ""}`}>
        <div className="flex shrink-0 flex-col" style={{ width: SEAT_W, gap: SEMI_GAP }}>
          {semis.map(([name, alive]) => (
            <Seat key={name} name={name} variant={alive ? "inner" : "out"} />
          ))}
        </div>
        <Elbow side={side} />
      </div>
    </div>
  )
}

function Bracket() {
  const LEFT_Q = [
    [["Rina D.", true], ["Karl V.", false]],
    [["Maya L.", true], ["Tin M.", false]],
  ]
  const RIGHT_Q = [
    [["You", true], ["Ana P.", false]],
    [["Noel S.", true], ["Jed R.", false]],
  ]

  return (
    <div className="flex items-center justify-center gap-3">
      <BranchSide side="left" quarters={LEFT_Q} semis={[["Rina D.", true], ["Maya L.", false]]} />

      {/* centre stage */}
      <div className="flex w-[260px] shrink-0 flex-col items-center px-2 lg:w-[300px]">
        <div className="rb-halo relative">
          <Trophy
            className="size-28 text-rb-bee drop-shadow-[0_6px_14px_rgba(255,200,0,0.5)] lg:size-32"
            aria-hidden="true"
          />
        </div>

        <div className="mt-5 font-rb-display text-2xl font-extrabold lowercase text-rb-eel">
          the final
        </div>

        <div className="mt-5 flex w-full items-center gap-2">
          <div className="rb-seat rb-seat-final flex-1 justify-center">Rina D.</div>
          <span className="font-rb-display text-lg font-extrabold lowercase text-rb-wolf">vs</span>
          <div className="rb-seat rb-seat-final flex-1 justify-center">You</div>
        </div>

        <span className="mt-5 rounded-rb-pill border-2 border-rb-swan bg-rb-polar px-3 py-1.5 text-xs font-bold text-rb-wolf">
          3:00 per round
        </span>
      </div>

      <BranchSide side="right" quarters={RIGHT_Q} semis={[["You", true], ["Noel S.", false]]} />
    </div>
  )
}

/* ---------------------------------------------------------------------- page */

export default function WorldCupPage() {
  const [phase, setPhase] = useState("track")
  const [track, setTrack] = useState(null)
  const [filled, setFilled] = useState(1)
  const [countdown, setCountdown] = useState(3)
  const [lobbyClock, setLobbyClock] = useState(40)

  /* The blades are this learner's enrolments, not the catalogue. Same query key
     as the learner layout, so arriving from the challenges page reads the cache
     rather than refetching the whole portal snapshot. */
  const portalQuery = useQuery({
    queryKey: ["learner-portal-data"],
    queryFn: getLearnerPortalData,
    staleTime: 5 * 60 * 1000,
  })

  const tracks = useMemo(
    () => getWorldCupTracks(portalQuery.data?.enrolledCertifications ?? []),
    [portalQuery.data],
  )

  useEffect(() => {
    if (phase !== "lobby" || filled >= 8) return undefined
    const id = setTimeout(() => setFilled((n) => n + 1), 750)
    return () => clearTimeout(id)
  }, [phase, filled])

  useEffect(() => {
    if (phase !== "lobby") return undefined
    const id = setInterval(() => setLobbyClock((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== "lobby" || filled < 8) return undefined
    const id = setTimeout(() => setPhase("found"), 600)
    return () => clearTimeout(id)
  }, [phase, filled])

  useEffect(() => {
    if (phase !== "found") return undefined
    if (countdown <= 0) {
      setPhase("bracket")
      return undefined
    }
    const id = setTimeout(() => setCountdown((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, countdown])

  const slots = useMemo(
    () => Array.from({ length: 8 }, (_, i) => (i < filled ? ROSTER[i] : null)),
    [filled],
  )

  const clock = `00:${String(lobbyClock).padStart(2, "0")}`

  const SUBTITLE = {
    track: "Choose your certification track",
    lobby: "Matchmaking · 8-player tournament",
    found: "Matchmaking · 8-player tournament",
    bracket: "Knockout bracket · quarter-finals to final",
    stats: "Tournament results",
  }

  return (
    <div className="rebyu-ds rb-arena flex h-dvh flex-col overflow-hidden">
      {/* No header bar, same as the CodeStrike run: a ruled white strip framed
          the tournament as a panel inside an app rather than the thing you came
          here for. Back, the run's name, and its state sit on the page itself. */}
      <div className="flex shrink-0 items-center gap-4 px-5 pt-6 lg:px-8">
        <BackButton asChild label="Back to arenas">
          <Link to="/learner/challenges" />
        </BackButton>
        <div className="min-w-0">
          <div className="font-rb-display text-xl font-extrabold lowercase text-rb-eel">
            world cup
          </div>
          <div className="truncate text-xs font-semibold text-rb-wolf">{SUBTITLE[phase]}</div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {phase === "lobby" || phase === "found" ? (
            <>
              <span className="rb-numeric text-sm text-rb-wolf">{filled} / 8 ready</span>
              <span className="flex items-center gap-1.5 rounded-rb-pill border-2 border-rb-swan bg-rb-polar px-3 py-1.5 text-sm font-bold tabular-nums text-rb-eel">
                <Clock className="size-4" aria-hidden="true" />
                {clock}
              </span>
            </>
          ) : null}
          {track ? (
            <span
              className={`rounded-rb-pill px-3 py-1.5 text-xs font-bold ${TRACK_TONE[track.tone].wash} ${TRACK_TONE[track.tone].ink}`}
            >
              {track.name}
            </span>
          ) : null}
          {phase === "bracket" ? (
            <TactileButton size="sm" variant="ghost" onClick={() => setPhase("stats")}>
              view results
            </TactileButton>
          ) : null}
          {phase === "stats" ? (
            <TactileButton
              size="sm"
              variant="ghost"
              onClick={() => {
                setPhase("track")
                setTrack(null)
                setFilled(1)
                setCountdown(3)
                setLobbyClock(40)
              }}
            >
              play again
            </TactileButton>
          ) : null}
        </div>
      </div>

      {/* The body owns the rest of the viewport. Each phase fills it rather
          than sitting in a centred column — a tournament with dead space above
          and below it reads as a widget, not an event. */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
        {/* ---------------------------------------------------- track select */}
        {phase === "track" && portalQuery.isLoading ? (
          <div className="grid flex-1 place-items-center px-5">
            <p className="text-sm font-bold text-rb-wolf">Loading your tracks…</p>
          </div>
        ) : null}

        {/* No enrolment, no bracket. The questions come from a certification's
            own bank, and eight people scored against each other on a syllabus
            one of them has never opened is not a tournament. */}
        {phase === "track" && !portalQuery.isLoading && tracks.length === 0 ? (
          <div className="grid flex-1 place-items-center px-5 pb-10">
            <div className="max-w-md text-center">
              <Trophy className="mx-auto size-12 text-rb-hare" aria-hidden="true" />
              <div className="mt-5 font-rb-display text-2xl font-extrabold lowercase text-rb-eel">
                no tracks yet
              </div>
              <p className="mt-3 text-sm leading-6 text-rb-wolf">
                The World Cup is played on a certification you are enrolled in. Enrol in
                one and its track appears here.
              </p>
              <TactileButton asChild className="mt-6">
                <Link to="/learner/certifications">browse certifications</Link>
              </TactileButton>
            </div>
          </div>
        ) : null}

        {phase === "track" && tracks.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col px-5 pt-6 lg:px-8">
            <div className="rb-blades min-h-[560px] flex-1 pb-6 lg:min-h-0">
              {tracks.map((item, index) => {
                const tone = BLADE_TONE[item.tone]
                // The blade strip overhangs both edges of the viewport so the
                // skewed ends are cropped rather than leaving triangular gaps.
                // The copy has to be pushed back inside by that overhang plus
                // the skew's own lean, or the first and last blade's text runs
                // off the screen.
                const edge =
                  index === 0
                    ? "lg:pl-[6.5rem]"
                    : index === tracks.length - 1
                      ? "lg:pr-[6.5rem]"
                      : ""
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`rb-blade ${tone.bg}`}
                    onClick={() => {
                      setTrack(item)
                      setPhase("lobby")
                    }}
                  >
                    <span className="rb-blade-ghost">{item.short}</span>

                    {/* darkened foot keeps the label legible over the colour */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 to-transparent"
                    />

                    <span
                      className={`rb-blade-inner flex flex-col justify-end p-6 text-left lg:p-8 ${edge}`}
                    >
                      <span className="block font-rb-display text-3xl font-extrabold lowercase leading-none tracking-tight text-white drop-shadow lg:text-5xl">
                        {item.name}
                      </span>

                      <span className="rb-blade-detail mt-4 block">
                        <span className="block max-w-xs text-sm leading-6 text-white/90">
                          {item.blurb}
                        </span>
                        {/* No "N in queue" chip. The tracks are real
                            certifications now, and a made-up queue count
                            attached to one reads as live matchmaking data. */}
                        <span className="mt-5 flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center rounded-rb-pill bg-white px-4 py-2 text-xs font-extrabold lowercase tracking-wide text-rb-eel">
                            enter queue
                          </span>
                        </span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ----------------------------------------------------------- lobby */}
        {phase === "lobby" || phase === "found" ? (
          <div className="flex min-h-0 flex-1 flex-col px-5 pt-6 lg:px-8">
            <ProgressBar value={(filled / 8) * 100} label="Challengers ready" className="!h-4" />

            {/* the line-up — eight standees stretched across the whole stage */}
            <div className="mt-5 grid min-h-0 flex-1 auto-rows-[minmax(230px,1fr)] grid-cols-2 items-stretch gap-3 pb-0 sm:grid-cols-4 lg:auto-rows-fr lg:grid-cols-8">
              {slots.map((player, index) => (
                <Standee key={index} player={player} index={index} />
              ))}
            </div>

            {phase === "found" ? (
              <div className="fixed inset-0 z-50 grid place-items-center bg-rb-eel/70 px-5">
                <div className="rb-pop-in text-center">
                  <div className="font-rb-display text-4xl font-extrabold lowercase text-rb-snow sm:text-6xl">
                    match found.
                  </div>
                  <p className="rb-numeric mt-8 text-8xl text-rb-snow">{countdown}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* --------------------------------------------------------- bracket */}
        {phase === "bracket" ? (
          <div className="flex min-h-0 flex-1 flex-col px-5 lg:px-8">
            {/* Centred in whatever is left of the viewport and scaled up on
                large screens: the bracket is the screen on this phase. */}
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto py-6">
              <div className="origin-center xl:scale-110 2xl:scale-125">
                <Bracket />
              </div>
            </div>
          </div>
        ) : null}

        {/* ----------------------------------------------------------- stats */}
        {phase === "stats" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-6 pb-8 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-3">
              {AWARDS.map((award) => (
                <div key={award.key} className="rb-card rb-card-raised">
                  <span className={`grid size-14 place-items-center rounded-2xl ${award.tone}`}>
                    <award.icon className="size-7" aria-hidden="true" />
                  </span>
                  <div className="mt-4 font-rb-display text-lg font-extrabold lowercase text-rb-eel">
                    {award.label}
                  </div>
                  <div className="mt-1 font-bold text-rb-eel">{award.who}</div>
                  <div className="text-sm font-semibold text-rb-wolf">{award.detail}</div>
                </div>
              ))}
            </div>

            <div className="rb-card rb-card-raised mt-5 flex min-h-0 flex-1 flex-col !p-0">
              <div className="flex shrink-0 items-center gap-2 border-b-2 border-rb-swan px-5 py-4">
                <Award className="size-5 text-rb-wolf" aria-hidden="true" />
                <span className="font-rb-display text-lg font-extrabold lowercase text-rb-eel">
                  final standings
                </span>
                <span className="ml-auto flex gap-4 text-[0.625rem] font-bold uppercase tracking-wide text-rb-wolf">
                  <span className="w-12 text-right">solved</span>
                  <span className="w-14 text-right">acc.</span>
                  <span className="w-14 text-right">avg</span>
                </span>
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-rb-swan overflow-y-auto">
                {STANDINGS.map((row, index) => (
                  <li
                    key={row.name}
                    className={`flex items-center gap-4 px-5 py-4 ${row.you ? "bg-rb-feather-wash" : ""}`}
                  >
                    <span className="rb-numeric w-6 text-rb-wolf">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-rb-eel">{row.name}</span>
                    <span className="rb-numeric w-12 text-right text-sm text-rb-wolf">{row.solved}</span>
                    <span className="rb-numeric w-14 text-right text-sm text-rb-wolf">{row.accuracy}%</span>
                    <span className="rb-numeric w-14 text-right text-sm text-rb-wolf">{row.avg}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
