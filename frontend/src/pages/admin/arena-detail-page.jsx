import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Save } from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ArenaProblemBuilder from "@/components/challenges/arena-problem-builder.jsx"
import WorldCupEditions from "@/components/challenges/world-cup-editions.jsx"
import { getArena } from "@/lib/arenas.js"

/**
 * One arena's workspace: its settings and its problems, and nothing else.
 *
 * Split out of the arena overview because three question builders on one screen
 * is three screens of editors stacked in a column -- you scrolled past
 * CodeStrike's test-case tables to reach Blueprint's canvas. Authoring is
 * per-arena work, so it gets a per-arena page.
 */
export default function ArenaDetailPage() {
  const { arenaId } = useParams()
  const arena = getArena(arenaId)

  if (!arena) {
    return (
      <div className="rebyu-page">
        <div className="rounded-2xl border-2 border-border bg-card p-10 text-center">
          <h1 className="text-lg font-bold">Arena not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No arena is registered under &ldquo;{arenaId}&rdquo;.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/admin/challenges">Back to challenges</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rebyu-page">
      <div className="rebyu-page-header">
        <div className="flex items-start gap-3">
          {/* Back to the challenge list, which is where "Manage problems" is
              clicked from and the only entry in the admin nav. */}
          <Button asChild variant="ghost" size="icon" className="mt-0.5">
            <Link to="/admin/challenges" aria-label="Back to challenges">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>

          <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${arena.tone}`}>
            <arena.icon className="size-6" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h1 className="font-rb-display text-2xl font-extrabold lowercase">
              {arena.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{arena.format}</Badge>
              {arena.tracked ? <Badge variant="outline">Track-locked</Badge> : null}
            </div>
          </div>
        </div>

        <Button>
          <Save className="mr-2 size-4" />
          Save configuration
        </Button>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">{arena.blurb}</p>

      <Tabs defaultValue="problems" className="w-full">
        <TabsList>
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Problems first: the config is set once, the problem set is the work
            an admin comes back to. */}
        <TabsContent value="problems" className="mt-5">
          {/* A weekly arena is authored a week at a time, not as one standing
              set: everyone sits the same bracket at once, so last week's
              questions are public by the time this week's lobby fills. */}
          {arena.weekly ? (
            <WorldCupEditions arena={arena} />
          ) : (
            <ArenaProblemBuilder arena={arena} />
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <div className="rounded-2xl border-2 border-border bg-card p-5">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
              <p className="mt-5 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                Weights must total 100%. Currently 100%.
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
