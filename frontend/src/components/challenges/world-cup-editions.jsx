import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CalendarDays, Check, Plus, Trophy } from "@/components/icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createLocalId } from "@/components/questions/question-editors.jsx"
import QuestionSetEditor, {
  totalPointsOf,
  totalXpOf,
  validateArenaQuestions,
} from "@/components/challenges/question-set-editor.jsx"
import { getAllCertifications } from "@/services/certificationService.js"

/**
 * World Cup authoring: one exam per week, one question set per bracket stage.
 *
 * The arena is a weekly event, so its questions cannot be a single standing set
 * the way a solo run's are. Everyone sits the same tournament at the same time,
 * which means last week's questions are already public by the time this week's
 * lobby fills — each week needs its own exam.
 *
 * And a bracket is not one round: the same eight players meet at quarterfinals,
 * again at semis, and twice more in the final. One shared set would have the
 * two finalists answering questions they had already seen two rounds earlier,
 * so every stage carries its own set.
 *
 * Editions live in local state. There is no weekly-exam endpoint yet; publish
 * validates the whole edition and reports what is missing. The shape here —
 * week, certification, and a question set per stage — is what that endpoint has
 * to accept.
 */

/**
 * Monday of the week containing `date`, as a YYYY-MM-DD string.
 *
 * Formatted from the local date parts, NOT `toISOString()`: east of UTC that
 * converts local Monday 00:00 into the previous Sunday, so every week landed a
 * day early and "this week" never matched the week just created.
 */
function toDateString(date) {
  const pad = (value) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function weekStartOf(date) {
  const monday = new Date(date)
  // getDay(): 0 = Sunday. Shift back to the Monday that starts this week.
  const offset = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - offset)
  monday.setHours(0, 0, 0, 0)
  return toDateString(monday)
}

function formatWeek(weekStart) {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const month = (date) => date.toLocaleDateString(undefined, { month: "short" })
  const sameMonth = start.getMonth() === end.getMonth()

  return sameMonth
    ? `${month(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`
}

function emptyStages(arena) {
  return Object.fromEntries(arena.stages.map((stage) => [stage.id, []]))
}

export default function WorldCupEditions({ arena }) {
  const [editions, setEditions] = useState([])
  const [openEditionId, setOpenEditionId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [errors, setErrors] = useState({})

  const thisWeek = weekStartOf(new Date())
  const [draftWeek, setDraftWeek] = useState(thisWeek)
  const [draftCertification, setDraftCertification] = useState("")
  const [draftError, setDraftError] = useState("")

  const { data: certifications = [] } = useQuery({
    queryKey: ["admin-certifications", "world-cup-editions"],
    queryFn: () => getAllCertifications(),
    staleTime: 5 * 60 * 1000,
  })

  const certificationName = useMemo(() => {
    const byId = new Map(
      certifications.map((certification) => [
        String(certification.certificationId ?? certification.id),
        certification.title,
      ]),
    )
    return (id) => byId.get(String(id)) ?? "Certification"
  }, [certifications])

  const openEdition = editions.find((edition) => edition.id === openEditionId) ?? null

  function createEdition() {
    if (!draftCertification) {
      setDraftError("Choose the certification this week's bracket runs on.")
      return
    }

    if (editions.some((edition) => edition.weekStart === draftWeek)) {
      setDraftError("An exam already exists for that week.")
      return
    }

    const edition = {
      id: createLocalId(),
      weekStart: draftWeek,
      certificationId: draftCertification,
      published: false,
      stages: emptyStages(arena),
    }

    setEditions((current) =>
      [...current, edition].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    )
    setOpenEditionId(edition.id)
    setCreateOpen(false)
    setDraftError("")
    setDraftCertification("")
    setDraftWeek(thisWeek)
  }

  function setStageQuestions(editionId, stageId, problems) {
    setEditions((current) =>
      current.map((edition) =>
        edition.id === editionId
          ? { ...edition, stages: { ...edition.stages, [stageId]: problems } }
          : edition,
      ),
    )
  }

  /** Every stage has to hold questions and every question has to be valid: a
   *  bracket that runs out of questions at the semifinal cannot be played. */
  function publishEdition(edition) {
    const allQuestions = arena.stages.flatMap((stage) => edition.stages[stage.id])
    const nextErrors = validateArenaQuestions(allQuestions)
    setErrors(nextErrors)

    const emptyStageNames = arena.stages
      .filter((stage) => edition.stages[stage.id].length === 0)
      .map((stage) => stage.name)

    if (emptyStageNames.length > 0) {
      toast.error("Every stage needs questions", {
        description: `${emptyStageNames.join(", ")} ${emptyStageNames.length === 1 ? "has" : "have"} none.`,
      })
      return
    }

    const invalidCount = Object.keys(nextErrors).length
    if (invalidCount > 0) {
      toast.error("Fix the highlighted questions", {
        description: `${invalidCount} of ${allQuestions.length} questions are incomplete.`,
      })
      return
    }

    setEditions((current) =>
      current.map((item) =>
        item.id === edition.id ? { ...item, published: true } : item,
      ),
    )

    toast.success(`${formatWeek(edition.weekStart)} exam validated`, {
      description: `${allQuestions.length} questions across ${arena.stages.length} stages. Publishing needs the weekly-exam endpoint.`,
    })
  }

  /* ------------------------------------------------------------- one edition */

  if (openEdition) {
    const stageCounts = arena.stages.map((stage) => ({
      stage,
      count: openEdition.stages[stage.id].length,
    }))
    const allQuestions = arena.stages.flatMap((stage) => openEdition.stages[stage.id])

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setOpenEditionId(null)}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to weekly exams</span>
          </Button>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold">{formatWeek(openEdition.weekStart)}</h3>
            <p className="text-xs text-muted-foreground">
              {certificationName(openEdition.certificationId)} ·{" "}
              {allQuestions.length} question{allQuestions.length === 1 ? "" : "s"} ·{" "}
              {totalPointsOf(allQuestions)} points · {totalXpOf(allQuestions)} XP
            </p>
          </div>

          <Button size="sm" onClick={() => publishEdition(openEdition)}>
            <Check className="mr-2 size-4" />
            Publish week
          </Button>
        </div>

        {/* One tab per bracket stage. The count rides on the tab so an admin can
            see which round is still empty without opening it. */}
        <Tabs defaultValue={arena.stages[0].id}>
          <TabsList>
            {stageCounts.map(({ stage, count }) => (
              <TabsTrigger key={stage.id} value={stage.id}>
                {stage.name}
                <Badge variant="outline" className="ml-2 tabular-nums">
                  {count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {arena.stages.map((stage) => (
            <TabsContent key={stage.id} value={stage.id} className="mt-5 space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
                <p className="text-sm font-bold">{stage.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stage.matches} match{stage.matches === 1 ? "" : "es"} ·{" "}
                  {stage.players} players · every match in this stage answers this set.
                </p>
              </div>

              <QuestionSetEditor
                problems={openEdition.stages[stage.id]}
                onChange={(problems) =>
                  setStageQuestions(openEdition.id, stage.id, problems)
                }
                typeIds={arena.questionTypes}
                errors={errors}
                emptyState={
                  <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                    <Trophy
                      className="mx-auto size-7 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-medium">
                      No {stage.name.toLowerCase()} questions yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add one below. Same editors as a certification&rsquo;s question bank.
                    </p>
                  </div>
                }
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    )
  }

  /* ------------------------------------------------------------ edition list */

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Weekly exams</h3>
          <p className="text-xs text-muted-foreground">
            One exam per week, with its own question set for each bracket stage.
          </p>
        </div>

        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create this week&rsquo;s exam
        </Button>
      </div>

      {editions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <CalendarDays className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No weekly exams yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one to author its {arena.stages.map((stage) => stage.name.toLowerCase()).join(", ")} questions.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {editions.map((edition) => {
            const counts = arena.stages.map((stage) => ({
              stage,
              count: edition.stages[stage.id].length,
            }))
            const total = counts.reduce((sum, item) => sum + item.count, 0)

            return (
              <li key={edition.id}>
                <button
                  type="button"
                  onClick={() => setOpenEditionId(edition.id)}
                  className="flex w-full flex-wrap items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3 text-left transition hover:border-primary/45 hover:bg-accent/40"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                    <CalendarDays className="size-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">
                      {formatWeek(edition.weekStart)}
                      {edition.weekStart === thisWeek ? (
                        <Badge variant="secondary" className="ml-2">
                          This week
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {certificationName(edition.certificationId)} · {total} question
                      {total === 1 ? "" : "s"}
                    </span>
                  </span>

                  <span className="flex flex-wrap items-center gap-1.5">
                    {counts.map(({ stage, count }) => (
                      <Badge
                        key={stage.id}
                        variant="outline"
                        className={count === 0 ? "text-muted-foreground" : ""}
                      >
                        {stage.name} {count}
                      </Badge>
                    ))}
                    <Badge variant={edition.published ? "default" : "secondary"}>
                      {edition.published ? "Published" : "Draft"}
                    </Badge>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create weekly exam</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="world-cup-week" className="text-sm font-bold">
                Week starting
              </Label>
              <Input
                id="world-cup-week"
                type="date"
                value={draftWeek}
                className="mt-1.5"
                onChange={(event) => setDraftWeek(weekStartOf(event.target.value))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatWeek(draftWeek)} — any date snaps to that week&rsquo;s Monday.
              </p>
            </div>

            <div>
              <Label htmlFor="world-cup-certification" className="text-sm font-bold">
                Certification
              </Label>
              <Select value={draftCertification} onValueChange={setDraftCertification}>
                <SelectTrigger
                  id="world-cup-certification"
                  className="mt-1.5"
                  aria-invalid={Boolean(draftError)}
                >
                  <SelectValue placeholder="Select a certification" />
                </SelectTrigger>
                <SelectContent>
                  {certifications.map((certification) => {
                    const id = String(certification.certificationId ?? certification.id)
                    return (
                      <SelectItem key={id} value={id}>
                        {certification.title}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Every player in the bracket answers from this syllabus.
              </p>
            </div>

            {draftError ? <p className="text-xs text-destructive">{draftError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createEdition}>Create exam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
