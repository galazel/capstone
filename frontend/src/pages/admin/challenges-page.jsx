import { useMemo, useState } from "react"
import {
  Building2,
  Check,
  Code2,
  Database,
  Flame,
  MoreVertical,
  Network,
  Search,
  Timer,
  Trash2,
  Trophy,
  Users,
} from "lucide-react"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL_FILTER_VALUE = "all"

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

const INITIAL_CHALLENGES = [
  {
    challengeId: 1,
    title: "CodeStrike",
    description:
        "Coding practice challenges for algorithmic and implementation skills.",
    icon: Code2,
    tag: "Practice",
    status: "coming_soon",
    assignedIndustries: [
      "Information Technology",
      "Training Center",
      "Education",
    ],
  },
  {
    challengeId: 2,
    title: "BlueprintArena",
    description:
        "System design prompts for architecture and diagram reasoning.",
    icon: Network,
    tag: "Design",
    status: "coming_soon",
    assignedIndustries: [
      "Information Technology",
      "Education",
      "Training Center",
    ],
  },
  {
    challengeId: 3,
    title: "QueryRealm",
    description:
        "SQL and ERD practice for data modeling and querying.",
    icon: Database,
    tag: "Database",
    status: "coming_soon",
    assignedIndustries: [
      "Information Technology",
      "Training Center",
      "Business Process Outsourcing",
    ],
  },
  {
    challengeId: 4,
    title: "Sprint Challenge",
    description:
        "Timed short practice challenge using the existing challenge experience.",
    icon: Timer,
    tag: "Timed",
    status: "active",
    assignedIndustries: [
      "Information Technology",
      "Education",
      "Training Center",
      "Review Center",
    ],
  },
  {
    challengeId: 5,
    title: "Daily Ranked Exam Challenge",
    description:
        "Daily assessment challenge for exam readiness and competitive ranking.",
    icon: Flame,
    tag: "Daily",
    status: "coming_soon",
    assignedIndustries: [
      "Education",
      "Review Center",
      "Training Center",
    ],
  },
]

const STATUS_STYLES = {
  active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  coming_soon:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  disabled:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
}

function getStatusLabel(status) {
  if (status === "active") return "Active"
  if (status === "disabled") return "Disabled"
  return "Coming Soon"
}

function ChallengeStatusBadge({ status }) {
  return (
      <Badge
          variant="outline"
          className={STATUS_STYLES[status] ?? STATUS_STYLES.coming_soon}
      >
        {getStatusLabel(status)}
      </Badge>
  )
}

export default function Challenges({
                                     initialChallenges = INITIAL_CHALLENGES,
                                     industries = INDUSTRIES,
                                   }) {
  const [challenges, setChallenges] = useState(initialChallenges)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE)

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [selectedChallenge, setSelectedChallenge] = useState(null)
  const [selectedIndustries, setSelectedIndustries] = useState([])

  const filteredChallenges = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return challenges.filter((challenge) => {
      const matchesSearch =
          !normalizedSearch ||
          challenge.title.toLowerCase().includes(normalizedSearch) ||
          challenge.description.toLowerCase().includes(normalizedSearch) ||
          challenge.tag.toLowerCase().includes(normalizedSearch)

      const matchesStatus =
          statusFilter === ALL_FILTER_VALUE ||
          challenge.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [challenges, searchQuery, statusFilter])

  const activeCount = challenges.filter(
      (challenge) => challenge.status === "active"
  ).length

  const totalAssignments = challenges.reduce(
      (total, challenge) =>
          total + (challenge.assignedIndustries?.length ?? 0),
      0
  )

  function openAssignDialog(challenge) {
    setSelectedChallenge(challenge)
    setSelectedIndustries(challenge.assignedIndustries ?? [])
    setAssignDialogOpen(true)
  }

  function openRemoveDialog(challenge) {
    setSelectedChallenge(challenge)
    setRemoveDialogOpen(true)
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

  function removeChallenge() {
    if (!selectedChallenge) return

    setChallenges((current) =>
        current.filter(
            (challenge) =>
                challenge.challengeId !== selectedChallenge.challengeId
        )
    )

    toast.success("Challenge removed", {
      description: `${selectedChallenge.title} was removed from the admin challenge list.`,
    })

    setRemoveDialogOpen(false)
    setSelectedChallenge(null)
  }

  return (
      <section className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Total challenges
            </p>

            <div className="mt-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <p className="text-xl font-semibold tabular-nums">
                {challenges.length}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Active challenges
            </p>

            <div className="mt-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="text-xl font-semibold tabular-nums">
                {activeCount}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Industry assignments
            </p>

            <div className="mt-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <p className="text-xl font-semibold tabular-nums">
                {totalAssignments}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search challenges..."
                className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="coming_soon">Coming Soon</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredChallenges.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredChallenges.map((challenge) => {
                const Icon = challenge.icon
                const assignedIndustries =
                    challenge.assignedIndustries ?? []
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

                        <div className="flex items-center gap-2">
                          <ChallengeStatusBadge status={challenge.status} />

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
                              <DropdownMenuItem
                                  onSelect={() => openAssignDialog(challenge)}
                              >
                                <Building2 className="mr-2 h-4 w-4" />
                                Assign industries
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                  onSelect={() => openRemoveDialog(challenge)}
                                  className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove challenge
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-foreground">
                            {challenge.title}
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
        ) : (
            <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
              <Trophy className="mx-auto h-7 w-7 text-muted-foreground" />

              <h2 className="mt-4 text-base font-semibold">
                No challenges found
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Try changing the search or status filter.
              </p>
            </div>
        )}

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

        <Dialog
            open={removeDialogOpen}
            onOpenChange={(open) => {
              setRemoveDialogOpen(open)

              if (!open) {
                setSelectedChallenge(null)
              }
            }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remove challenge?</DialogTitle>

              <DialogDescription className="leading-6">
                This will remove{" "}
                <span className="font-medium text-foreground">
                {selectedChallenge?.title}
              </span>{" "}
                from the admin challenge list. Existing learner results should
                remain stored in the backend.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              This action cannot be undone from this page.
            </div>

            <DialogFooter>
              <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRemoveDialogOpen(false)}
              >
                Cancel
              </Button>

              <Button
                  type="button"
                  variant="destructive"
                  onClick={removeChallenge}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove challenge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
  )
}
