import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  Check,
  Code2,
  Network,
  Settings,
  Trophy,
  Users,
} from "@/components/icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { industries } from "@/constants/industries.js"

import {
  CHALLENGE_ARENAS_KEY,
  getChallengeArenas,
  saveArenaIndustries,
} from "@/services/challengeService.js"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BubbleCard } from "@/components/commons/bubble-card.jsx"

/* The industries a certification can carry, not a list of our own.
   This page used to define eight labels of its own ("Information Technology",
   "Training Center", ...) while every certification is tagged from
   `constants/industries`. Nothing matched anything: an arena assigned to
   "Information Technology" could never line up with a certification in
   "Information and Communications Technology (ICT)", so gating a learner on it
   would have hidden every arena from everybody. One vocabulary, shared. */
const INDUSTRIES = industries

/* The IT Olympics, and only the IT Olympics — the same three arenas the
   landing page sells and the learner can actually enter. QueryRealm, Sprint
   Challenge and Daily Ranked Exam Challenge were listed here with no route, no
   page and no learner-facing mention anywhere: an admin could assign an
   industry to a challenge that did not exist.

   The three are built into the product, so there is no status to flip and
   nothing to remove — an admin manages their problems and decides which
   industries see them. That is the whole page.

   `tone`, `role` and `format` are copied from the landing page's arena cards so
   an arena is the same colour and carries the same line to an admin as it does
   to a visitor and to the learner who enters it. */
const INITIAL_CHALLENGES = [
  {
    challengeId: 1,
    arenaId: "codestrike",
    title: "CodeStrike",
    description:
        "Ten coding problems back to back, judged against real unit tests and scored on time complexity as well as correctness.",
    icon: Code2,
    tone: "macaw",
    role: "Coding Skills",
    tag: "Solo",
    format: "solo · 10 problems",
    assignedIndustries: [
      "Information Technology",
      "Training Center",
      "Education",
    ],
  },
  {
    challengeId: 2,
    arenaId: "blueprint",
    title: "Blueprint Arena",
    description:
        "Ten UML and system design problems on a drag-and-drop canvas, checked against structural rules rather than opinion.",
    icon: Network,
    tone: "beetle",
    role: "Design Skills",
    tag: "Solo",
    format: "solo · 10 problems",
    assignedIndustries: [
      "Information Technology",
      "Education",
      "Training Center",
    ],
  },
  {
    challengeId: 3,
    arenaId: "worldcup",
    title: "World Cup",
    description:
        "An eight-player bracket on one certification track — quarterfinals, semis, and a timed grand final.",
    icon: Trophy,
    tone: "fox",
    role: "Exam Readiness",
    tag: "Tournament",
    format: "8 players · live bracket",
    assignedIndustries: [
      "Information Technology",
      "Education",
      "Training Center",
      "Review Center",
    ],
  },
]

export default function Challenges({
                                     initialChallenges = INITIAL_CHALLENGES,
                                     industries = INDUSTRIES,
                                   }) {
  const [challenges, setChallenges] = useState(initialChallenges)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  /* The stored assignments, which are the truth.
     The list above supplies each arena's name, blurb and artwork -- those are
     properties of a built surface, not data. What an admin can change is
     stored, so it is read back rather than assumed. */
  const arenasQuery = useQuery({
    queryKey: [CHALLENGE_ARENAS_KEY],
    queryFn: getChallengeArenas,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!arenasQuery.data) return
    const byArena = new Map(arenasQuery.data.map((arena) => [arena.arenaId, arena]))
    setChallenges((current) =>
      current.map((challenge) => {
        const arena = byArena.get(challenge.arenaId)
        return arena
          ? {
              ...challenge,
              assignedIndustries: arena.industries ?? [],
              problemCount: arena.problemCount,
              configured: arena.configured,
            }
          : challenge
      }),
    )
  }, [arenasQuery.data])

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [selectedIndustries, setSelectedIndustries] = useState([])

  function openAssignDialog(challenge) {
    setSelectedChallenge(challenge)
    setSelectedIndustries(challenge.assignedIndustries ?? [])
    setAssignDialogOpen(true)
  }

  function toggleIndustry(industry, checked) {
    setSelectedIndustries((current) => {
      if (checked) {
        return current.includes(industry)
            ? current
            : [...current, industry]
      }

      return current.filter((item) => item !== industry)
    })
  }

  function selectAllIndustries() {
    setSelectedIndustries([...industries])
  }

  function clearAllIndustries() {
    setSelectedIndustries([])
  }

  function saveIndustryAssignments() {
    if (!selectedChallenge || saving) return

    /* Persisted, not just held on screen.
       This used to update local state and toast "assignments updated", so the
       change survived exactly until the next reload -- an admin could assign
       an arena, be told it worked, and find it unassigned on returning. */
    setSaving(true)
    const arenaId = selectedChallenge.arenaId
    const industriesToSave = [...selectedIndustries]

    void (async () => {
      try {
        const arena = await saveArenaIndustries(arenaId, industriesToSave)

        setChallenges((current) =>
          current.map((challenge) =>
            challenge.arenaId === arenaId
              ? { ...challenge, assignedIndustries: arena.industries ?? [] }
              : challenge,
          ),
        )
        await queryClient.invalidateQueries({ queryKey: [CHALLENGE_ARENAS_KEY] })

        toast.success("Challenge assignments updated", {
          description:
            industriesToSave.length > 0
              ? `${selectedChallenge.title} is assigned to ${industriesToSave.length} industr${
                  industriesToSave.length === 1 ? "y" : "ies"
                }.`
              : `${selectedChallenge.title} is no longer assigned to any industry.`,
        })

        setAssignDialogOpen(false)
        setSelectedChallenge(null)
      } catch (error) {
        toast.error("Could not save the assignment", {
          description:
            error?.response?.data?.message ?? error?.message ?? "Please try again.",
        })
      } finally {
        setSaving(false)
      }
    })()
  }

  return (
      <section className="space-y-6">
        {/* Label and sub label only. There is no search or status filter over
            three fixed rows, and no summary tiles counting them. */}
        <div className="rebyu-page-header">
          <div>
            <h1 className="font-rb-display text-2xl font-extrabold lowercase">
              challenges
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage each arena&rsquo;s problems and the industries that can enter it.
            </p>
          </div>
        </div>

        {/* The arena card from the landing carousel, via BubbleCard: gradient
            cap, bubbles, icon medallion, matching wash below. The kebab menu is
            gone — with two actions and room for them, they sit in the card as
            buttons rather than hiding behind a click. */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {challenges.map((challenge) => {
            const assignedIndustries = challenge.assignedIndustries ?? []
            const visibleIndustries = assignedIndustries.slice(0, 2)
            const remainingIndustryCount =
                assignedIndustries.length - visibleIndustries.length

            return (
                <BubbleCard
                    key={challenge.challengeId}
                    tone={challenge.tone}
                    icon={challenge.icon}
                    eyebrow={challenge.role}
                    title={
                      <Link
                          to={`/admin/arenas/${challenge.arenaId}`}
                          className="rounded-sm hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-rb-macaw"
                      >
                        {challenge.title}
                      </Link>
                    }
                    chips={[
                      { label: challenge.tag },
                      { label: challenge.format, side: "right" },
                    ]}
                    footer={
                      <div className="flex flex-wrap gap-2">
                        <Button
                            asChild
                            size="sm"
                            className="rounded-full"
                        >
                          <Link to={`/admin/arenas/${challenge.arenaId}`}>
                            <Settings className="mr-2 h-4 w-4" />
                            Manage problems
                          </Link>
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full bg-card"
                            onClick={() => openAssignDialog(challenge)}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          Assign industries
                        </Button>
                      </div>
                    }
                >
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {challenge.description}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Assigned industries
                  </div>

                  {assignedIndustries.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {visibleIndustries.map((industry) => (
                            <Badge
                                key={industry}
                                variant="outline"
                                className="max-w-full bg-card"
                            >
                              <span className="truncate">{industry}</span>
                            </Badge>
                        ))}

                        {remainingIndustryCount > 0 ? (
                            <Badge variant="outline" className="bg-card">
                              +{remainingIndustryCount} more
                            </Badge>
                        ) : null}
                      </div>
                  ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Not assigned to any industry.
                      </p>
                  )}
                </BubbleCard>
            )
          })}
        </div>

        <Dialog
            open={assignDialogOpen}
            onOpenChange={(open) => {
              setAssignDialogOpen(open)

              if (!open) {
                setSelectedChallenge(null)
                setSelectedIndustries([])
              }
            }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign industries</DialogTitle>

              <DialogDescription>
                Select one or more industries that can access{" "}
                <span className="font-medium text-foreground">
                {selectedChallenge?.title}
              </span>
                .
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-sm text-muted-foreground">
                {selectedIndustries.length} of {industries.length} selected
              </p>

              <div className="flex items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllIndustries}
                >
                  Select all
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllIndustries}
                >
                  Clear
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-80 rounded-xl border">
              <div className="space-y-1 p-3">
                {industries.map((industry) => {
                  const checked = selectedIndustries.includes(industry)
                  const checkboxId = `challenge-industry-${industry
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")}`

                  return (
                      <Label
                          key={industry}
                          htmlFor={checkboxId}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-muted/60"
                      >
                        <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={(value) =>
                                toggleIndustry(industry, value === true)
                            }
                        />

                        <span className="min-w-0 flex-1 text-sm font-medium">
                      {industry}
                    </span>

                        {checked ? (
                            <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </Label>
                  )
                })}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssignDialogOpen(false)}
              >
                Cancel
              </Button>

              <Button
                  type="button"
                  onClick={saveIndustryAssignments}
                  disabled={saving}
              >
                {saving ? "Saving..." : "Save assignments"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
  )
}
