import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Award, Crown, Gauge, Trophy, Users, Zap } from "lucide-react"

import { TactileButton } from "@/components/rebyu/rebyu-ui.jsx"

/**
 * World Cup — 8-player synchronised tournament.
 *
 * UI only: the whole journey (track select -> lobby -> bracket -> stats) runs
 * on local timers and fixture data so it can be reviewed before matchmaking,
 * sockets, or scoring exist. Nothing here calls an API.
 *
 * Uses the system palette throughout — Feather for the primary plates, Fox /
 * Macaw / Cardinal for bracket rounds, Bee for the trophy. The only thing the
 * arena keeps from broadcast styling is the uppercase display voice.
 */

const TRACKS = [
  { id: "it-passport", name: "IT Passport", short: "Passport", tone: "bee", blurb: "Strategy, management, and core technology fundamentals.", queue: 128 },
  { id: "topcit", name: "TOPCIT", short: "TOPCIT", tone: "macaw", blurb: "Software development, databases, networking, information systems.", queue: 214 },
  { id: "fe-exam", name: "FE Exam", short: "FE Exam", tone: "beetle", blurb: "Computer science, algorithms, databases, networks, IT fundamentals.", queue: 176 },
]

/* Blade fills stay saturated: they are the one bold moment on a light page,
   and white type needs the depth to stay legible over the full panel. */
const BLADE_TONE = {
  bee: { bg: "bg-gradient-to-b from-rb-bee to-rb-bee-lip" },
  macaw: { bg: "bg-gradient-to-b from-rb-macaw to-rb-macaw-lip" },
  beetle: { bg: "bg-gradient-to-b from-rb-beetle to-rb-beetle-lip" },
}

const TRACK_TONE = {
  bee: { face: "bg-rb-bee", lip: "shadow-[0_5px_0_var(--color-rb-bee-lip)]", wash: "bg-rb-bee-wash", ink: "text-[#8a6d00]" },
  macaw: { face: "bg-rb-macaw", lip: "shadow-[0_5px_0_var(--color-rb-macaw-lip)]", wash: "bg-rb-macaw-wash", ink: "text-rb-macaw-lip" },
  beetle: { face: "bg-rb-beetle", lip: "shadow-[0_5px_0_var(--color-rb-beetle-lip)]", wash: "bg-rb-beetle-wash", ink: "text-rb-beetle-lip" },
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
      <div className="rb-standee rb-standee-empty min-h-[188px] justify-center">
        <div className="rb-pulse-slot grid size-16 place-items-center rounded-full border-2 border-dashed border-rb-swan">
          <Users className="size-6 text-rb-hare" aria-hidden="true" />
        </div>
        <p className="mt-3 text-center text-[0.625rem] font-bold uppercase leading-tight tracking-wide text-rb-hare">
          waiting for
          <br />
          challenger
        </p>
        <span className="mt-auto pt-3 text-[0.625rem] font-bold text-rb-hare">{index + 1}</span>
      </div>
    )
  }

  const tier = TIERS[player.tier]

  return (
    <div className={`rb-standee rb-pop-in min-h-[188px] ${player.you ? "rb-standee-you" : ""}`}>
      <span className={`rb-frame ${tier.frame}`} aria-hidden="true">
        {player.initials}
      </span>

      <p className="mt-3 w-full truncate text-center text-sm font-extrabold text-rb-eel">
        {player.name}
      </p>
      <p className="w-full truncate text-center text-[0.625rem] font-semibold text-rb-wolf">
        {player.title}
      </p>

      <span
        className={`mt-auto rounded-full px-2.5 py-1 text-[0.625rem] font-extrabold uppercase tracking-wide text-rb-snow ${tier.badge}`}
      >
        {tier.label}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------- bracket */

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
      className={`relative w-5 shrink-0 ${
        isLeft ? "border-r-2 border-rb-swan" : "border-l-2 border-rb-swan"
      } my-[17px]`}
    >
      <span
        className={`absolute top-0 h-0.5 w-5 bg-rb-swan ${isLeft ? "-left-5" : "-right-5"}`}
      />
      <span
        className={`absolute bottom-0 h-0.5 w-5 bg-rb-swan ${isLeft ? "-left-5" : "-right-5"}`}
      />
      <span
        className={`absolute top-1/2 h-0.5 w-5 bg-rb-swan ${isLeft ? "-right-5" : "-left-5"}`}
      />
    </div>
  )
}

function QuarterPair({ pair, side }) {
  return (
    <div className={`flex items-stretch ${side === "right" ? "flex-row-reverse" : ""}`}>
      <div className="flex w-[132px] shrink-0 flex-col gap-[18px]">
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
      <div className="flex flex-col gap-8">
        {quarters.map((pair, i) => (
          <QuarterPair key={i} pair={pair} side={side} />
        ))}
      </div>

      {/* semifinal column, vertically centred against its two quarter pairs */}
      <div className={`flex items-stretch ${reverse ? "flex-row-reverse" : ""}`}>
        <div className="flex w-[132px] shrink-0 flex-col gap-[92px]">
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
    <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4">
      <BranchSide side="left" quarters={LEFT_Q} semis={[["Rina D.", true], ["Maya L.", false]]} />

      {/* centre stage */}
      <div className="flex w-[220px] shrink-0 flex-col items-center px-2">
        <div className="rb-halo relative">
          <Trophy className="size-24 text-rb-bee drop-shadow-[0_6px_14px_rgba(255,200,0,0.5)]" aria-hidden="true" />
        </div>

        <div className="rb-plate rb-plate-cardinal mt-4 text-sm">Champion</div>

        <div className="mt-5 flex w-full items-center gap-2">
          <div className="rb-seat rb-seat-final flex-1 justify-center">Rina D.</div>
          <span className="font-rb-display text-xl font-black italic text-rb-eel">
            VS
          </span>
          <div className="rb-seat rb-seat-final flex-1 justify-center">You</div>
        </div>

        <span className="mt-4 rounded-full bg-rb-polar px-3 py-1 text-[0.625rem] font-bold uppercase tracking-wide text-rb-wolf">
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

  // Every phase is the arena now — the track selector is the opening shot of
  // the tournament, not a settings page, so it shares the same dark stage.
  const isArena = true
  const clock = `00:${String(lobbyClock).padStart(2, "0")}`

  return (
    <div className="rebyu-ds rb-arena min-h-dvh overflow-x-hidden">
      <header className={"border-b-2 border-rb-swan bg-rb-snow"}>
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-5 lg:px-8">
          <Link
            to="/learner/challenges"
            className={`grid size-10 place-items-center rounded-xl transition-colors ${
              "text-rb-eel hover:bg-rb-polar"
            }`}
            aria-label="Back to challenges"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <div
              className={`font-rb-display text-lg font-extrabold ${
                "uppercase tracking-wide text-rb-eel"
              }`}
            >
              world cup
            </div>
            <div className={`text-xs font-semibold ${"text-rb-wolf"}`}>
              {track ? `${track.name} · 8-player tournament` : "Choose your certification track"}
            </div>
          </div>
          {track ? (
            <span
              className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${
                `${TRACK_TONE[track.tone].wash} ${TRACK_TONE[track.tone].ink}`
              }`}
            >
              {track.name}
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 py-10 lg:px-8">
        {/* ---------------------------------------------------- track select */}
        {phase === "track" ? (
          <div>
            <div className="flex flex-col items-center">
              <div className="rb-plate rb-plate-macaw text-lg sm:text-2xl">Choose your track</div>
              <p className="mt-4 max-w-md text-center text-sm text-rb-wolf">
                Matchmaking is locked to the track you pick, so every opponent is studying the
                same syllabus as you.
              </p>
            </div>

            <div className="rb-blades mt-10 h-[clamp(360px,58vh,540px)] lg:h-[58vh]">
              {TRACKS.map((item) => {
                const tone = BLADE_TONE[item.tone]
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

                    <span className="rb-blade-inner flex flex-col justify-end p-6 text-left lg:p-8">
                      <span className="block font-rb-display text-2xl font-black uppercase italic leading-none text-white drop-shadow lg:text-4xl">
                        {item.name}
                      </span>

                      <span className="rb-blade-detail mt-3 block">
                        <span className="block max-w-xs text-sm leading-6 text-rb-eel">
                          {item.blurb}
                        </span>
                        <span className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rb-polar px-3 py-1.5 text-xs font-bold text-rb-eel">
                            <Users className="size-3.5" aria-hidden="true" />
                            {item.queue} in queue
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-rb-eel">
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
          <div>
            <div className="flex flex-col items-center">
              <div className="rb-plate rb-plate-macaw text-lg sm:text-2xl">World Cup</div>
              <div className="-mt-1 rb-plate rb-plate-cardinal px-8 py-1 text-[0.625rem] sm:text-xs">
                {track?.name}
              </div>

              <div className="mt-5 flex items-center gap-3 text-rb-wolf">
                <span className="text-[0.625rem] font-bold uppercase tracking-[0.2em]">
                  Estimated
                </span>
                <span className="rb-numeric text-lg text-white">{clock}</span>
              </div>
            </div>

            {/* the line-up */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {slots.map((player, index) => (
                <Standee key={index} player={player} index={index} />
              ))}
            </div>

            <p className="mt-6 text-center text-sm font-bold text-rb-wolf">
              {filled} of 8 challengers ready
            </p>

            {phase === "found" ? (
              <div className="fixed inset-0 z-50 grid place-items-center bg-rb-eel/70 px-5">
                <div className="rb-pop-in text-center">
                  <div className="rb-plate rb-plate-cardinal px-12 py-4 text-3xl sm:text-5xl">
                    Match Found
                  </div>
                  <p className="rb-numeric mt-8 text-7xl text-rb-snow">{countdown}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* --------------------------------------------------------- bracket */}
        {phase === "bracket" ? (
          <div>
            <div className="flex flex-col items-center">
              <div className="rb-plate rb-plate-macaw text-lg sm:text-2xl">World Tournament</div>
              <div className="-mt-1 rb-plate rb-plate-cardinal px-8 py-1 text-[0.625rem] sm:text-xs">
                {track?.name} Championship
              </div>
            </div>

            <div className="mt-10">
              <Bracket />
            </div>

            <div className="mt-8 flex justify-center">
              <TactileButton variant="snow" size="sm" onClick={() => setPhase("stats")}>
                view stats lead
              </TactileButton>
            </div>
          </div>
        ) : null}

        {/* ----------------------------------------------------------- stats */}
        {phase === "stats" ? (
          <div>
            <div className="flex flex-col items-center">
              <div className="rb-plate rb-plate-macaw text-lg sm:text-2xl">Stats Lead</div>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {AWARDS.map((award) => (
                <div
                  key={award.key}
                  className="rounded-rb-card border-2 border-rb-swan bg-rb-snow p-5 shadow-[0_4px_0_var(--color-rb-swan)]"
                >
                  <span className={`grid size-12 place-items-center rounded-2xl ${award.tone}`}>
                    <award.icon className="size-6" aria-hidden="true" />
                  </span>
                  <div className="mt-4 font-rb-display text-base font-extrabold uppercase tracking-wide text-rb-eel">
                    {award.label}
                  </div>
                  <div className="mt-1 font-bold text-rb-eel">{award.who}</div>
                  <div className="text-sm font-semibold text-rb-wolf">{award.detail}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-rb-card border-2 border-rb-swan bg-rb-snow">
              <div className="flex items-center gap-2 border-b border-rb-swan px-5 py-4">
                <Award className="size-5 text-rb-wolf" aria-hidden="true" />
                <span className="font-rb-display text-base font-extrabold uppercase tracking-wide text-rb-eel">
                  Final standings
                </span>
              </div>
              <ul className="divide-y divide-rb-swan">
                {STANDINGS.map((row, index) => (
                  <li
                    key={row.name}
                    className={`flex items-center gap-4 px-5 py-3.5 ${row.you ? "bg-rb-feather-wash" : ""}`}
                  >
                    <span className="rb-numeric w-6 text-rb-wolf">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-rb-eel">{row.name}</span>
                    <span className="rb-numeric w-12 text-right text-sm text-rb-wolf">{row.solved}</span>
                    <span className="rb-numeric w-14 text-right text-sm text-rb-wolf">{row.accuracy}%</span>
                    <span className="rb-numeric w-14 text-right text-sm text-rb-wolf">{row.avg}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-4 border-t-2 border-rb-swan px-5 py-3 text-[0.625rem] font-bold uppercase tracking-wide text-rb-wolf">
                <span className="ml-auto w-12 text-right">solved</span>
                <span className="w-14 text-right">acc.</span>
                <span className="w-14 text-right">avg</span>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <TactileButton
                variant="snow"
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
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
