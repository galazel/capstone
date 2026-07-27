import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useOutletContext } from "react-router-dom"
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Code2,
  Crown,
  Database,
  Flame,
  Medal,
  Network,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { getChallengeGamificationData } from "@/services/challengeService.js"
import LearnerPremiumGuard from "@/components/learner/learner-premium-guard.jsx"
import { FEATURES } from "@/services/subscriptionService.js"

const challenges = [
  {
    title: "CodeStrike",
    role: "Coding Skills",
    description:
      "Coding practice challenges for algorithmic and implementation skills.",
    icon: Code2,
    tag: "Practice",
    accent: "linear-gradient(135deg, #2563a8, #4ba8c8)",
    surface: "#e8f4f8",
    available: false,
  },
  {
    title: "BlueprintArena",
    role: "Design Skills",
    description:
      "System design prompts for architecture and diagram reasoning.",
    icon: Network,
    tag: "Design",
    accent: "linear-gradient(135deg, #6552a3, #8977c4)",
    surface: "#f0edf8",
    available: false,
  },
  {
    title: "QueryRealm",
    role: "Data Skills",
    description: "SQL and ERD practice for data modeling and querying.",
    icon: Database,
    tag: "Database",
    accent: "linear-gradient(135deg, #237a6b, #48a892)",
    surface: "#e8f5f1",
    available: false,
  },
  {
    title: "Sprint Challenge",
    role: "Speed and Accuracy",
    description:
      "Timed short practice using the existing competitive challenge experience.",
    icon: Timer,
    tag: "Timed",
    accent: "linear-gradient(135deg, #d06548, #e58c55)",
    surface: "#fbefe9",
    available: true,
    route: "/challenges",
  },
  {
    title: "Daily Ranked",
    role: "Exam Readiness",
    description:
      "A daily assessment challenge built to sharpen exam readiness.",
    icon: Flame,
    tag: "Daily",
    accent: "linear-gradient(135deg, #b88716, #e2bd4f)",
    surface: "#fff7d6",
    available: false,
  },
]

const previewLeaderboard = [
  { learnerId: "preview-1", name: "Mika Santos", points: 2480, completed: 18, bestScore: 196, rank: 1 },
  { learnerId: "preview-2", name: "Andre Reyes", points: 2215, completed: 16, bestScore: 188, rank: 2 },
  { learnerId: "preview-current", name: "You", points: 1960, completed: 14, bestScore: 181, rank: 3, isCurrentLearner: true },
  { learnerId: "preview-4", name: "Sam Rivera", points: 1740, completed: 13, bestScore: 176, rank: 4 },
  { learnerId: "preview-5", name: "Jamie Cruz", points: 1585, completed: 12, bestScore: 169, rank: 5 },
]

const previewActivity = [
  { challengeSessionId: "preview-a", title: "Sprint Challenge", startedTime: new Date().toISOString(), status: "passed", score: 181 },
  { challengeSessionId: "preview-b", title: "QueryRealm", startedTime: new Date(Date.now() - 86400000).toISOString(), status: "passed", score: 164 },
  { challengeSessionId: "preview-c", title: "Daily Ranked", startedTime: new Date(Date.now() - 172800000).toISOString(), status: "completed", score: 152 },
]

function relativePosition(index, activeIndex) {
  let difference = index - activeIndex
  const midpoint = Math.floor(challenges.length / 2)
  if (difference > midpoint) difference -= challenges.length
  if (difference < -midpoint) difference += challenges.length
  return difference
}

function getChallengeStreak(sessions) {
  const days = new Set(
    sessions
      .map((session) => session.startedTime)
      .filter(Boolean)
      .map((value) => new Date(value).toISOString().slice(0, 10))
  )
  if (!days.size) return 0

  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
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
  const [activeIndex, setActiveIndex] = useState(3)
  const activeChallenge = challenges[activeIndex]
  const gamificationQuery = useQuery({
    queryKey: ["challenge-gamification"],
    queryFn: getChallengeGamificationData,
  })

  const gamification = useMemo(() => {
    const sessions = gamificationQuery.data?.sessions ?? []
    const learners = gamificationQuery.data?.learners ?? []
    const modes = gamificationQuery.data?.modes ?? []
    const learnerById = new Map(learners.map((learner) => [String(learner.learnerId), learner]))
    const modeById = new Map(modes.map((mode) => [String(mode.challengeModeId), mode]))
    const standings = new Map()

    sessions.forEach((session) => {
      if (session.score == null || session.status === "in_progress") return
      const key = String(session.learnerId)
      const learner = learnerById.get(key)
      const entry = standings.get(key) ?? {
        learnerId: session.learnerId,
        name: learner
          ? `${learner.firstName ?? ""} ${learner.lastName ?? ""}`.trim() || learner.username
          : `Learner ${session.learnerId}`,
        points: 0,
        completed: 0,
        bestScore: 0,
      }
      const score = Number(session.score) || 0
      entry.points += score
      entry.completed += 1
      entry.bestScore = Math.max(entry.bestScore, score)
      standings.set(key, entry)
    })

    const leaderboard = [...standings.values()]
      .sort((a, b) => b.points - a.points || b.bestScore - a.bestScore)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
    const mine = leaderboard.find((entry) => String(entry.learnerId) === String(learnerId))
    const mySessions = sessions
      .filter((session) => String(session.learnerId) === String(learnerId))
      .sort((a, b) => new Date(b.startedTime ?? 0) - new Date(a.startedTime ?? 0))

    return {
      leaderboard: leaderboard.length ? leaderboard : previewLeaderboard,
      mine: mine ?? previewLeaderboard.find((entry) => entry.isCurrentLearner),
      mySessions: mySessions.length ? mySessions : previewActivity,
      streak: mySessions.length ? getChallengeStreak(mySessions) : 3,
      modeById,
      isPreview: leaderboard.length === 0,
    }
  }, [gamificationQuery.data, learnerId])

  const move = (direction) => {
    setActiveIndex(
      (current) => (current + direction + challenges.length) % challenges.length
    )
  }

  const selectChallenge = (challenge) => {
    if (challenge.available) {
      navigate(challenge.route)
      return
    }
    toast.info(`${challenge.title} is coming soon`, {
      description: "This challenge will unlock when its activity is ready.",
    })
  }

  return (
    <LearnerPremiumGuard
      feature={FEATURES.CHALLENGES_ACCESS}
      title="Pro challenges and battles"
      description="Unlock ranked challenges, battles, leaderboards, rewards, and certification-specific practice with Pro or institution access."
    >
    <div
      className="relative left-1/2 isolate -my-6 min-h-[calc(100dvh-4rem)] w-screen -translate-x-1/2 overflow-hidden bg-[#f1f7fc] px-4 py-8 sm:px-6 lg:px-8 dark:bg-[#111b26]"
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
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Trophy className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-bold tracking-[0.2em] text-primary uppercase">Choose your challenge</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">Choose what you want to practice and take on your next challenge.</p>
          </div>

          <div className="relative mt-7 h-[390px] sm:h-[420px]">
            {challenges.map((challenge, index) => {
              const position = relativePosition(index, activeIndex)
              const isActive = position === 0
              const Icon = challenge.icon
              return (
                <button
                  key={challenge.title}
                  type="button"
                  onClick={() => isActive ? selectChallenge(challenge) : setActiveIndex(index)}
                  className={`absolute top-1/2 left-1/2 isolate h-[350px] w-[250px] overflow-hidden rounded-2xl bg-[var(--challenge-surface)] text-left shadow-[0_22px_55px_-18px_rgba(15,23,42,0.48)] transition-all duration-500 ease-out [backface-visibility:hidden] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none sm:w-[280px] ${isActive ? "shadow-[0_26px_65px_-18px_rgba(37,99,235,0.5)] dark:bg-zinc-900" : "dark:bg-zinc-900"}`}
                  style={{
                    transform: `translate(calc(-50% + ${position * 190}px), -50%) scale(${isActive ? 1 : Math.abs(position) === 1 ? 0.82 : 0.66})`,
                    opacity: 1,
                    visibility: "visible",
                    zIndex: 10 - Math.abs(position),
                    pointerEvents: "auto",
                    "--challenge-surface": challenge.surface,
                    backgroundColor: challenge.surface,
                  }}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${challenge.title}${isActive ? ", selected" : ", select"}`}
                >
                  <div className="relative flex h-44 items-center justify-center overflow-hidden" style={{ background: challenge.accent }}>
                    <div className="absolute top-3 right-3 left-3 z-10 flex items-center justify-between gap-2">
                      <span className="rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-bold tracking-wide text-zinc-800 uppercase shadow-sm backdrop-blur-sm">{challenge.tag}</span>
                      <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase shadow-sm backdrop-blur-sm ${challenge.available ? "bg-emerald-500 text-white" : "bg-zinc-950/70 text-white"}`}>
                        {challenge.available ? "Ready" : "Coming soon"}
                      </span>
                    </div>
                    <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
                    <div className="absolute -bottom-10 -left-7 h-32 w-32 rounded-full bg-white/10" />
                    <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-white shadow-xl transition-transform duration-500 ${isActive ? "scale-100" : "scale-90"}`}>
                      <Icon className="h-12 w-12" strokeWidth={1.7} />
                    </div>
                  </div>
                  <div className="h-[176px] p-5 text-center" style={{ backgroundColor: challenge.surface }}>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-primary uppercase">{challenge.role}</p>
                    <h2 className="mt-1 text-xl font-bold text-zinc-950">{challenge.title}</h2>
                    <p className="mt-2 min-h-12 text-xs leading-5 text-zinc-500">{challenge.description}</p>
                    <div className={`mx-auto mt-4 h-1 rounded-full transition-all ${isActive ? "w-14 bg-primary" : "w-6 bg-zinc-300"}`} aria-hidden="true" />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-white shadow-sm" onClick={() => move(-1)} aria-label="Previous challenge">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex gap-1.5" aria-hidden="true">
              {challenges.map((challenge, index) => (
                <span key={challenge.title} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-7 bg-primary" : "w-1.5 bg-zinc-300"}`} />
              ))}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-white shadow-sm" onClick={() => move(1)} aria-label="Next challenge">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </section>

        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-2 pt-5 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-semibold text-zinc-950">{activeChallenge.title}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {activeChallenge.available ? "This game mode is ready to play." : "This activity is part of the upcoming challenge lineup."}
            </p>
          </div>
          <Button type="button" onClick={() => selectChallenge(activeChallenge)} variant={activeChallenge.available ? "default" : "secondary"}>
            {activeChallenge.available ? "Start challenge" : "Notify me"}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <section className="mx-auto max-w-6xl border-t border-blue-200/70 pt-10 dark:border-blue-900/70">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
            <div className="min-w-0">
              <div className="flex items-end justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                    <Crown className="h-4 w-4 text-amber-500" />
                    Leaderboard
                    {gamification.isPreview && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-blue-700 uppercase dark:bg-blue-950 dark:text-blue-300">
                        Preview
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Ranked by points earned from completed challenges.
                  </p>
                </div>
                <span className="text-xs font-medium text-zinc-500">
                  {gamification.leaderboard.length} ranked
                </span>
              </div>

              {(
                <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                  {gamification.leaderboard.slice(0, 10).map((entry) => {
                    const isCurrentLearner = entry.isCurrentLearner || String(entry.learnerId) === String(learnerId)
                    return (
                      <div
                        key={entry.learnerId}
                        className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-3.5 ${isCurrentLearner ? "bg-blue-50/80 dark:bg-blue-950/30" : ""}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-zinc-500">
                          {entry.rank <= 3 ? (
                            <Medal className={`h-5 w-5 ${entry.rank === 1 ? "text-amber-500" : entry.rank === 2 ? "text-zinc-400" : "text-orange-600"}`} />
                          ) : entry.rank}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                            {entry.name}{isCurrentLearner && entry.name !== "You" ? " (You)" : ""}
                          </p>
                          <p className="text-xs text-zinc-500">{entry.completed} completed · Best {entry.bestScore.toLocaleString()} pts</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">
                          {entry.points.toLocaleString()} pts
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                  <Target className="h-4 w-4 text-blue-600" />
                  Your competition record
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 border-y border-zinc-200 py-5 dark:border-zinc-800">
                  <div>
                    <dt className="text-xs text-zinc-500">Global rank</dt>
                    <dd className="mt-1 text-2xl font-bold text-zinc-950 dark:text-white">{gamification.mine ? `#${gamification.mine.rank}` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Total points</dt>
                    <dd className="mt-1 text-2xl font-bold text-zinc-950 dark:text-white">{gamification.mine?.points?.toLocaleString() ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-zinc-500"><Flame className="h-3.5 w-3.5" /> Challenge streak</dt>
                    <dd className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{gamification.streak} {gamification.streak === 1 ? "day" : "days"}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-zinc-500"><Zap className="h-3.5 w-3.5" /> Best score</dt>
                    <dd className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{gamification.mine?.bestScore?.toLocaleString() ?? "—"}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
                  <Activity className="h-4 w-4 text-violet-600" />
                  Recent activity
                </div>
                {gamification.mySessions.length === 0 ? (
                  <p className="mt-4 text-sm leading-6 text-zinc-500">Your completed challenges will appear here.</p>
                ) : (
                  <div className="mt-3 divide-y divide-zinc-200/80 dark:divide-zinc-800">
                    {gamification.mySessions.slice(0, 4).map((session) => (
                      <div key={session.challengeSessionId} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                            {session.title ?? gamification.modeById.get(String(session.challengeModeId))?.name ?? "Challenge"}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">{formatSessionDate(session.startedTime)} · {String(session.status ?? "").replace("_", " ")}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">
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
      </div>
    </div>
    </LearnerPremiumGuard>
  )
}
