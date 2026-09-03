import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  ChevronDownIcon,
  ChevronUpIcon,
  Clock,
  ListChecks,
  Search,
  Target,
  X,
  XCircle,
} from "@/components/icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  LearnerEmptyState,
  LearnerErrorState,
  LearnerStatCard,
} from "@/components/learner/learner-ui.jsx"
import { getMistakes, setMistakeReviewed } from "@/services/learnerToolsService"

const ALL_VALUE = "all"

/* The server groups by question, so one row is one question the learner has
   got wrong -- `mistakeCount` is how many separate attempts they got it wrong
   in. Two or more is the line the backend itself draws between "weak" and
   "developing" (see LearnerToolsService#mapMistake), and it is the only signal
   here that separates a slip from something not understood. */
const REPEAT_THRESHOLD = 2

/* The list is rendered a page at a time. A learner with 250 mistakes was
   getting 250 cards -- every one with two answer panels and an explanation --
   built on the first paint, which is both slow and useless: nobody reads past
   the first screen without filtering. */
const PAGE_SIZE = 20

const FILTERS = [
  { value: ALL_VALUE, label: "All" },
  { value: "todo", label: "To review" },
  { value: "repeated", label: "Missed twice or more" },
  { value: "reviewed", label: "Reviewed" },
]

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function questionTypeLabel(type) {
  if (!type) return "Question"
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase())
}

/**
 * Where the mistakes cluster.
 *
 * The list answers "what did I get wrong"; this answers "what am I actually
 * weak at", which is the question worth acting on. Lessons are ranked by how
 * many separate wrong answers they account for -- not by how many distinct
 * questions -- so one question missed four times counts as the four times it
 * cost.
 *
 * Two things keep it from becoming an obstacle on a bank this size. Each row
 * is a filter, so the panel is the fastest route *into* the list rather than
 * something to scroll past to reach it. And it collapses to its single-line
 * summary, because a learner who already knows their worst lesson should not
 * pay for the chart on every visit.
 */
function WeakestLessons({ mistakes, selected, onSelect }) {
  const [open, setOpen] = useState(true)

  const lessons = useMemo(() => {
    const totals = new Map()
    mistakes.forEach((mistake) => {
      const key = mistake.lessonTitle || "Unassigned lesson"
      const current = totals.get(key) ?? { lesson: key, misses: 0, questions: 0 }
      current.misses += Number(mistake.mistakeCount ?? 1)
      current.questions += 1
      totals.set(key, current)
    })
    return [...totals.values()].sort((a, b) => b.misses - a.misses).slice(0, 5)
  }, [mistakes])

  if (lessons.length < 2) return null

  const worst = lessons[0].misses

  return (
    <div className="rounded-rb-card border-2 border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-foreground">
            Where your mistakes cluster
          </span>
          {/* The headline fact survives the collapse: shut, the panel still
              names the lesson costing the most. */}
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {open
              ? "Your five heaviest lessons. Pick one to filter the list."
              : `Worst: ${lessons[0].lesson} · ${worst} wrong`}
          </span>
        </span>
        {open ? (
          <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <ul className="space-y-1 px-3 pb-3">
          {lessons.map((lesson) => {
            const active = selected === lesson.lesson
            return (
              <li key={lesson.lesson}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : lesson.lesson)}
                  className={cn(
                    "w-full rounded-rb-tile px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active ? "bg-rb-cardinal-wash" : "hover:bg-muted/60"
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {lesson.lesson}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {lesson.misses} wrong · {lesson.questions} q
                    </span>
                  </span>
                  {/* 6px rather than 8, and the row's own padding does the
                      spacing: five lessons used to stand 300px tall between the
                      counters and the first mistake. */}
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-rb-cardinal"
                      style={{ width: `${Math.max(4, (lesson.misses / worst) * 100)}%` }}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/** One missed question, with what was answered and what was right. */
function MistakeCard({ mistake, onToggleReviewed, isPending }) {
  const repeated = Number(mistake.mistakeCount ?? 1) >= REPEAT_THRESHOLD

  return (
    <li
      className={cn(
        "rounded-rb-card border-2 bg-card p-5",
        mistake.reviewed
          ? "border-border"
          : repeated
            ? "border-rb-cardinal/45"
            : "border-rb-fox/45"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="secondary">{questionTypeLabel(mistake.questionType)}</Badge>
          {mistake.difficulty ? (
            <Badge variant="outline">{questionTypeLabel(mistake.difficulty)}</Badge>
          ) : null}
          {repeated ? (
            <Badge className="border-transparent bg-rb-cardinal text-white">
              Missed {mistake.mistakeCount}×
            </Badge>
          ) : null}
          {mistake.reviewed ? (
            <Badge className="border-transparent bg-rb-leaf text-white">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Reviewed
            </Badge>
          ) : null}
        </div>

        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          {formatDate(mistake.lastMistakeAt)}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium leading-6 text-foreground">
        {mistake.question}
      </p>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {[mistake.certificationTitle, mistake.lessonTitle, mistake.attemptSource]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-rb-tile border-2 border-rb-cardinal/45 bg-rb-cardinal-wash p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-rb-cardinal-lip">
            <XCircle className="size-3.5" aria-hidden="true" />
            You answered
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {mistake.learnerAnswer?.trim() || "No answer submitted"}
          </p>
        </div>
        <div className="rounded-rb-tile border-2 border-rb-leaf/45 bg-rb-leaf-wash p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-rb-leaf">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Correct answer
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {mistake.correctAnswer}
          </p>
        </div>
      </div>

      {mistake.explanation ? (
        <div className="mt-3 rounded-rb-tile border-2 border-border bg-muted/40 p-3">
          <p className="text-xs font-bold text-muted-foreground">Why</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {mistake.explanation}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant={mistake.reviewed ? "ghost" : "outline"}
          disabled={isPending}
          onClick={() => onToggleReviewed(mistake)}
        >
          {mistake.reviewed ? (
            "Mark as still to review"
          ) : (
            <>
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark reviewed
            </>
          )}
        </Button>
      </div>
    </li>
  )
}

/**
 * Every question this learner has got wrong in a submitted attempt, grouped by
 * question, with the counts that say which ones are habits rather than slips.
 *
 * The endpoint behind it has existed since the community/library work and had
 * no page: `GET /api/learner-tools/mistakes` already returned all of this,
 * including the reviewed flag that `PUT .../reviewed` toggles.
 */
export default function LearnerMistakeBankPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [certification, setCertification] = useState(ALL_VALUE)
  const [filter, setFilter] = useState(ALL_VALUE)
  const [lesson, setLesson] = useState(null)
  const [sort, setSort] = useState("recent")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const mistakesQuery = useQuery({
    queryKey: ["learner-mistakes"],
    queryFn: getMistakes,
    retry: 1,
  })

  const mistakes = useMemo(
    () => (Array.isArray(mistakesQuery.data) ? mistakesQuery.data : []),
    [mistakesQuery.data]
  )

  const reviewMutation = useMutation({
    mutationFn: ({ questionId, reviewed }) => setMistakeReviewed(questionId, reviewed),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(["learner-mistakes"], (current) =>
        Array.isArray(current)
          ? current.map((mistake) =>
              mistake.questionId === variables.questionId
                ? { ...mistake, reviewed: variables.reviewed }
                : mistake
            )
          : current
      )
      toast.success(variables.reviewed ? "Marked as reviewed." : "Back on the list.")
    },
    onError: () => toast.error("That could not be saved. Try again."),
  })

  const stats = useMemo(() => {
    const totalMisses = mistakes.reduce(
      (sum, mistake) => sum + Number(mistake.mistakeCount ?? 1),
      0
    )
    return {
      questions: mistakes.length,
      totalMisses,
      repeated: mistakes.filter(
        (mistake) => Number(mistake.mistakeCount ?? 1) >= REPEAT_THRESHOLD
      ).length,
      reviewed: mistakes.filter((mistake) => mistake.reviewed).length,
      todo: mistakes.filter((mistake) => !mistake.reviewed).length,
    }
  }, [mistakes])

  const certifications = useMemo(
    () =>
      [...new Set(mistakes.map((mistake) => mistake.certificationTitle).filter(Boolean))].sort(),
    [mistakes]
  )

  const query = search.trim().toLowerCase()

  const visible = useMemo(() => {
    const filtered = mistakes.filter((mistake) => {
      const repeated = Number(mistake.mistakeCount ?? 1) >= REPEAT_THRESHOLD
      const matchesFilter =
        filter === ALL_VALUE ||
        (filter === "todo" && !mistake.reviewed) ||
        (filter === "reviewed" && mistake.reviewed) ||
        (filter === "repeated" && repeated)

      const matchesCertification =
        certification === ALL_VALUE || mistake.certificationTitle === certification

      const matchesLesson =
        !lesson || (mistake.lessonTitle || "Unassigned lesson") === lesson

      const matchesSearch =
        !query ||
        [
          mistake.question,
          mistake.lessonTitle,
          mistake.certificationTitle,
          mistake.attemptSource,
          mistake.correctAnswer,
        ]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query))

      return matchesFilter && matchesCertification && matchesLesson && matchesSearch
    })

    return filtered.sort((a, b) =>
      sort === "missed"
        ? Number(b.mistakeCount ?? 0) - Number(a.mistakeCount ?? 0)
        : new Date(b.lastMistakeAt ?? 0) - new Date(a.lastMistakeAt ?? 0)
    )
  }, [mistakes, filter, certification, lesson, query, sort])

  /* Any change of filter starts the list again from the top -- carrying a
     "showing 120" count across a filter change shows a page of results the
     learner never asked to expand. */
  const resetPaging = () => setVisibleCount(PAGE_SIZE)

  const shown = visible.slice(0, visibleCount)

  if (mistakesQuery.isError) {
    return (
      <LearnerErrorState
        title="Could not load your mistake bank"
        error={mistakesQuery.error}
        onRetry={mistakesQuery.refetch}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-rb-display text-2xl font-extrabold lowercase text-foreground">
          <Target className="size-6 text-rb-cardinal" aria-hidden="true" />
          mistake bank
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every question you have got wrong in a submitted attempt, with the
          right answer beside it. Marking one reviewed keeps it in the bank —
          nothing here is ever deleted.
        </p>
      </div>

      {mistakesQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-rb-card" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-rb-card" />
        </div>
      ) : mistakes.length === 0 ? (
        <LearnerEmptyState
          icon={ListChecks}
          title="nothing to review yet"
          description="Questions you get wrong in an assessment land here automatically, together with the correct answer and the explanation."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LearnerStatCard
              icon={ListChecks}
              label="Questions missed"
              value={stats.questions}
              helper={`${stats.totalMisses} wrong answer${stats.totalMisses === 1 ? "" : "s"} in total`}
              tone="macaw"
            />
            <LearnerStatCard
              icon={AlertTriangle}
              label="Missed twice or more"
              value={stats.repeated}
              helper="These are habits, not slips. Start here."
              tone="fox"
            />
            <LearnerStatCard
              icon={Clock}
              label="Still to review"
              value={stats.todo}
              helper="Not yet marked as gone over."
              tone="beetle"
            />
            <LearnerStatCard
              icon={CheckCheck}
              label="Reviewed"
              value={stats.reviewed}
              helper="Kept in the bank so you can come back to them."
              tone="bee"
            />
          </div>

          <WeakestLessons
            mistakes={mistakes}
            selected={lesson}
            onSelect={(next) => {
              setLesson(next)
              resetPaging()
            }}
          />

          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filter === option.value ? "default" : "ghost"}
                onClick={() => {
                  setFilter(option.value)
                  resetPaging()
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_200px]">
            <label className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetPaging()
                }}
                placeholder="Search your mistakes"
                className="pl-9"
                aria-label="Search your mistakes"
              />
            </label>

            <Select
              value={certification}
              onValueChange={(value) => {
                setCertification(value)
                resetPaging()
              }}
            >
              <SelectTrigger aria-label="Filter by certification">
                <SelectValue placeholder="All certifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All certifications</SelectItem>
                {certifications.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort mistakes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent first</SelectItem>
                <SelectItem value="missed">Most missed first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* What the list is currently showing, and the one click that clears
              it. A lesson picked from the panel above is otherwise invisible
              once the panel is collapsed. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(shown.length, visible.length)} of {visible.length}
              {visible.length === mistakes.length ? "" : ` (${mistakes.length} in the bank)`}
            </p>
            {lesson ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setLesson(null)
                  resetPaging()
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
                {lesson}
              </Button>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <LearnerEmptyState
              icon={Search}
              title="nothing matches"
              description="No mistake matches this filter. Widen the search or switch back to All."
            />
          ) : (
            <ol className="space-y-3">
              {shown.map((mistake) => (
                <MistakeCard
                  key={mistake.questionId ?? mistake.mistakeId}
                  mistake={mistake}
                  isPending={
                    reviewMutation.isPending &&
                    reviewMutation.variables?.questionId === mistake.questionId
                  }
                  onToggleReviewed={(target) =>
                    reviewMutation.mutate({
                      questionId: target.questionId,
                      reviewed: !target.reviewed,
                    })
                  }
                />
              ))}
            </ol>
          )}

          {visible.length > shown.length ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
            >
              Show {Math.min(PAGE_SIZE, visible.length - shown.length)} more
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
