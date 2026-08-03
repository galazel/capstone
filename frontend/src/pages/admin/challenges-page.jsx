import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  Check,
  Code2,
  MoreVertical,
  Network,
  Plus,
  Trophy,
  Users,
} from "@/components/icons"
import { toast } from "sonner"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

const INDUSTRIES = [
  "Information Technology",
  "Education",
  "Training Center",
  "Review Center",
  "Government",
  "Banking and Finance",
  "Business Process Outsourcing",
  "Healthcare",
]

/* The IT Olympics, and only the IT Olympics — the same three arenas the
   landing page sells and the learner can actually enter. QueryRealm, Sprint
   Challenge and Daily Ranked Exam Challenge were listed here with no route, no
   page and no learner-facing mention anywhere: an admin could assign an
   industry to a challenge that did not exist.

   The three are built into the product, so there is no status to flip and
   nothing to remove — an admin manages their problems and decides which
   industries see them. That is the whole page. */
const INITIAL_CHALLENGES = [
  {
    challengeId: 1,
    arenaId: "codestrike",
    title: "CodeStrike",
    description:
        "Ten coding problems back to back, judged against real unit tests and scored on time complexity as well as correctness.",
    icon: Code2,
    tag: "Solo",
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
    tag: "Solo",
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
    tag: "Tournament",
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
    if (!selectedChallenge) return

    setChallenges((current) =>
        current.map((challenge) =>
            challenge.challengeId === selectedChallenge.challengeId
                ? {
                  ...challenge,
                  assignedIndustries: [...selectedIndustries],
                }
                : challenge
        )
    )

    toast.success("Challenge assignments updated", {
      description:
          selectedIndustries.length > 0
              ? `${selectedChallenge.title} is assigned to ${selectedIndustries.length} industr${
                  selectedIndustries.length === 1 ? "y" : "ies"
              }.`
              : `${selectedChallenge.title} is no longer assigned to any industry.`,
    })

    setAssignDialogOpen(false)
    setSelectedChallenge(null)
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

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {challenges.map((challenge) => {
            const Icon = challenge.icon
            const assignedIndustries = challenge.assignedIndustries ?? []
            const visibleIndustries = assignedIndustries.slice(0, 2)
            const remainingIndustryCount =
                assignedIndustries.length - visibleIndustries.length

            return (
                <article
                    key={challenge.challengeId}
                    className="flex min-h-[290px] flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-foreground">
                      <Icon className="h-6 w-6" />
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg"
                            aria-label={`Actions for ${challenge.title}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-52">
                        {/* Straight into this arena's own workspace,
                            where its problems and its scoring live. */}
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/arenas/${challenge.arenaId}`}>
                            <Plus className="mr-2 h-4 w-4" />
                            Manage problems
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onSelect={() => openAssignDialog(challenge)}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          Assign industries
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* The title is the way in: clicking a challenge
                          should open the challenge, not just its menu. */}
                      <h2 className="text-lg font-semibold text-foreground">
                        <Link
                            to={`/admin/arenas/${challenge.arenaId}`}
                            className="rounded-sm hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {challenge.title}
                        </Link>
                      </h2>

                      <Badge variant="secondary">{challenge.tag}</Badge>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {challenge.description}
                    </p>
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Assigned industries
                    </div>

                    {assignedIndustries.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {visibleIndustries.map((industry) => (
                              <Badge
                                  key={industry}
                                  variant="outline"
                                  className="max-w-full"
                              >
                                <span className="truncate">{industry}</span>
                              </Badge>
                          ))}

                          {remainingIndustryCount > 0 ? (
                              <Badge variant="outline">
                                +{remainingIndustryCount} more
                              </Badge>
                          ) : null}
                        </div>
                    ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Not assigned to any industry.
                        </p>
                    )}
                  </div>
                </article>
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
              >
                Save assignments
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
  )
}
