import { useState } from "react"
import { Code2, Network, Save, Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * IT Olympics arena configuration (admin).
 *
 * UI only — nothing is persisted yet. This screen defines the shape of the
 * config each arena needs so the backend contract can be agreed before it is
 * built: problem count, timing, scoring weights, and which tracks are live.
 */

const ARENAS = [
  {
    id: "codestrike",
    name: "CodeStrike",
    icon: Code2,
    tone: "bg-rb-macaw-wash text-rb-macaw-lip",
    format: "Solo",
    fields: [
      { key: "problems", label: "Problems per run", value: "10", hint: "Fixed-length run" },
      { key: "timeLimit", label: "Run time limit (min)", value: "45", hint: "0 for untimed" },
      { key: "weightCorrect", label: "Weight — correctness (%)", value: "60" },
      { key: "weightSpeed", label: "Weight — speed (%)", value: "20" },
      { key: "weightBigO", label: "Weight — complexity (%)", value: "20" },
    ],
  },
  {
    id: "blueprint",
    name: "Blueprint Arena",
    icon: Network,
    tone: "bg-rb-beetle-wash text-rb-beetle-lip",
    format: "Solo",
    fields: [
      { key: "problems", label: "Problems per run", value: "10" },
      { key: "timeLimit", label: "Run time limit (min)", value: "60" },
      { key: "passRules", label: "Rules to pass a problem (%)", value: "80", hint: "Structural checks satisfied" },
      { key: "components", label: "Palette components", value: "8", hint: "Load balancer, database, …" },
    ],
  },
  {
    id: "worldcup",
    name: "World Cup",
    icon: Trophy,
    tone: "bg-rb-bee-wash text-[#8a6d00]",
    format: "8-player tournament",
    fields: [
      { key: "lobbySize", label: "Lobby size", value: "8", hint: "Bracket requires a power of two" },
      { key: "roundSeconds", label: "Seconds per round", value: "180" },
      { key: "countdown", label: "Lock-in countdown (s)", value: "3" },
      { key: "queueTimeout", label: "Queue timeout (s)", value: "120", hint: "Before offering a bot lobby" },
    ],
  },
]

const TRACKS = [
  { id: "it-passport", name: "IT Passport", enabled: true },
  { id: "topcit", name: "TOPCIT", enabled: true },
  { id: "fe-exam", name: "FE Exam", enabled: false },
]

export default function ArenaConfigPage() {
  const [tracks, setTracks] = useState(TRACKS)
  const [live, setLive] = useState({ codestrike: true, blueprint: true, worldcup: false })

  return (
    <div className="rebyu-page">
      <div className="rebyu-page-header">
        <div>
          <h1 className="font-rb-display text-2xl font-extrabold lowercase">it olympics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure each arena, then choose which certification tracks players can queue into.
          </p>
        </div>
        <Button>
          <Save className="mr-2 size-4" />
          Save configuration
        </Button>
      </div>

      {/* Track availability gates World Cup matchmaking — a track with too few
          players queued will never fill a lobby, so it stays admin-controlled. */}
      <section className="rebyu-section">
        <div className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="text-base font-bold">Certification tracks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Disabled tracks are hidden from the World Cup track-selection screen.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {tracks.map((track) => (
              <label
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-border bg-background px-4 py-3"
              >
                <span className="text-sm font-bold">{track.name}</span>
                <Switch
                  checked={track.enabled}
                  onCheckedChange={(next) =>
                    setTracks((current) =>
                      current.map((item) =>
                        item.id === track.id ? { ...item, enabled: next } : item,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rebyu-section">
        <div className="grid gap-5 xl:grid-cols-3">
          {ARENAS.map((arena) => (
            <div key={arena.id} className="flex flex-col rounded-2xl border-2 border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${arena.tone}`}>
                  <arena.icon className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-rb-display text-lg font-extrabold">{arena.name}</h2>
                  <Badge variant="secondary" className="mt-1">{arena.format}</Badge>
                </div>
                <Switch
                  checked={live[arena.id]}
                  onCheckedChange={(next) => setLive((c) => ({ ...c, [arena.id]: next }))}
                  aria-label={`${arena.name} live`}
                />
              </div>

              <div className="mt-5 space-y-4">
                {arena.fields.map((field) => (
                  <div key={field.key}>
                    <Label htmlFor={`${arena.id}-${field.key}`} className="text-sm font-bold">
                      {field.label}
                    </Label>
                    <Input
                      id={`${arena.id}-${field.key}`}
                      defaultValue={field.value}
                      inputMode="numeric"
                      className="mt-1.5"
                    />
                    {field.hint ? (
                      <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Scoring weights must total 100, so surface the sum rather than
                  letting an admin discover it after a broken run. */}
              {arena.id === "codestrike" ? (
                <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Weights must total 100%. Currently 100%.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
