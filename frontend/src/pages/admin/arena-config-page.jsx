import { useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ARENAS, ARENA_TRACKS } from "@/lib/arenas.js"

/**
 * IT Olympics overview (admin).
 *
 * A directory, not a workspace: which arenas are live, which tracks players can
 * queue into, and a way into each arena. The settings and the problem builder
 * live on the arena's own page — three builders stacked here meant scrolling
 * past CodeStrike's test cases to reach Blueprint's canvas.
 *
 * UI only. Nothing here is persisted yet; this defines the config shape the
 * backend contract has to accept.
 */
export default function ArenaConfigPage() {
  const [tracks, setTracks] = useState(ARENA_TRACKS)
  const [live, setLive] = useState({ codestrike: true, blueprint: true, worldcup: false })

  return (
    <div className="rebyu-page">
      <div className="rebyu-page-header">
        <div>
          <h1 className="font-rb-display text-2xl font-extrabold lowercase">it olympics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open an arena to author its problems and set how a run is scored.
          </p>
        </div>
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
        <div className="grid gap-4 xl:grid-cols-3">
          {ARENAS.map((arena) => (
            <div
              key={arena.id}
              className="flex flex-col rounded-2xl border-2 border-border bg-card p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl ${arena.tone}`}
                >
                  <arena.icon className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-rb-display text-lg font-extrabold">{arena.name}</h2>
                  <Badge variant="secondary" className="mt-1">
                    {arena.format}
                  </Badge>
                </div>
                {/* The switch is the one thing you'd change without opening the
                    arena, so it stays on the card. */}
                <Switch
                  checked={live[arena.id]}
                  onCheckedChange={(next) => setLive((c) => ({ ...c, [arena.id]: next }))}
                  aria-label={`${arena.name} live`}
                />
              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">{arena.blurb}</p>

              <Link
                to={`/admin/arenas/${arena.id}`}
                className="mt-5 flex items-center justify-between gap-2 rounded-xl border-2 border-border px-4 py-3 text-sm font-bold transition hover:border-primary/45 hover:bg-accent/40"
              >
                Problems and settings
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
