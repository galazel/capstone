import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Trophy } from "@/components/icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  QUESTION_TYPES,
  QuestionTypeButton,
  cloneQuestionData,
  createLocalId,
  validateQuestionData,
} from "@/components/questions/question-editors.jsx"
import { getAllCertifications } from "@/services/certificationService.js"

/**
 * Authoring surface for one arena's problem set.
 *
 * Deliberately not a second question builder: the editors, the per-type data
 * shapes, and the validation are the ones the certification Question Bank uses,
 * imported from `question-editors`. An arena problem IS a question — a
 * CodeStrike problem is the PROGRAMMING editor with its test cases, a Blueprint
 * problem is the DIAGRAM editor with its reference canvas — so forking them
 * would leave two definitions of "a valid programming question" to drift apart.
 *
 * What this adds on top is what an arena needs and a lesson question does not:
 * a reward line per problem (points, XP) and, for a tracked arena, the
 * certification the problem is drawn from. Those sit in a strip above each
 * editor rather than inside it, so the editor stays the shared component.
 *
 * Problems live in local state. There is no arena-problems endpoint yet, and
 * `saveAuthoredQuestion` cannot stand in for one — it writes a question against
 * a lesson and certification, which an arena problem has neither of. Save
 * validates and reports; the shape authored here is what the endpoint has to
 * accept.
 */

/** Defaults per problem. Points score the run, XP feeds the learner's level. */
const DEFAULT_REWARD = { points: "10", xp: "25" }

export default function ArenaProblemBuilder({ arena }) {
  const [problems, setProblems] = useState([])
  const [errors, setErrors] = useState({})

  const targetCount = Number(
    arena.fields.find((field) => field.key === "problems")?.value ?? 0,
  )

  const allowedTypes = useMemo(
    () => QUESTION_TYPES.filter((type) => arena.questionTypes.includes(type.id)),
    [arena.questionTypes],
  )

  // Only a tracked arena needs this, so only a tracked arena pays for the call.
  const { data: certifications = [] } = useQuery({
    queryKey: ["admin-certifications", "arena-problems"],
    queryFn: () => getAllCertifications(),
    enabled: Boolean(arena.tracked),
    staleTime: 5 * 60 * 1000,
  })

  function addProblem(questionType) {
    setProblems((current) => [
      ...current,
      {
        id: createLocalId(),
        typeId: questionType.id,
        typeName: questionType.title,
        certificationId: "",
        ...DEFAULT_REWARD,
        data: cloneQuestionData(questionType.data),
      },
    ])
  }

  function removeProblem(id) {
    setProblems((current) => current.filter((problem) => problem.id !== id))
    setErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function updateProblemField(id, field, value) {
    setProblems((current) =>
      current.map((problem) =>
        problem.id === id ? { ...problem, [field]: value } : problem,
      ),
    )
  }

  /** The editors call `onDataChange` with an updater, not a value — they edit
   *  deep paths and need the current data to merge into. */
  function updateProblemData(id, update) {
    setProblems((current) =>
      current.map((problem) =>
        problem.id === id
          ? {
              ...problem,
              data: typeof update === "function" ? update(problem.data) : update,
            }
          : problem,
      ),
    )
  }

  /** The bank's own validator, plus the two rules that are the arena's: a
   *  reward has to be a positive number, and a tracked arena's problem has to
   *  name its certification. */
  function saveProblems() {
    const nextErrors = {}

    for (const problem of problems) {
      const problemErrors = validateQuestionData(problem.typeId, problem.data)

      if (!(Number(problem.points) > 0)) {
        problemErrors.points = "Points must be greater than zero."
      }
      if (!(Number(problem.xp) >= 0)) {
        problemErrors.xp = "XP cannot be negative."
      }
      if (arena.tracked && !problem.certificationId) {
        problemErrors.certificationId = "Choose the certification this question comes from."
      }

      if (Object.keys(problemErrors).length > 0) {
        nextErrors[problem.id] = problemErrors
      }
    }

    setErrors(nextErrors)

    const invalidCount = Object.keys(nextErrors).length
    if (invalidCount > 0) {
      toast.error("Fix the highlighted problems", {
        description: `${invalidCount} of ${problems.length} problems are incomplete.`,
      })
      return
    }

    toast.success(`${arena.name} problems validated`, {
      description: `${problems.length} problem${problems.length === 1 ? "" : "s"} ready. Saving needs the arena-problems endpoint.`,
    })
  }

  const totalPoints = problems.reduce(
    (total, problem) => total + (Number(problem.points) || 0),
    0,
  )
  const totalXp = problems.reduce((total, problem) => total + (Number(problem.xp) || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {problems.length}
            {targetCount ? ` / ${targetCount}` : ""} problems
          </Badge>
          {problems.length > 0 ? (
            <>
              <Badge variant="outline" className="tabular-nums">
                {totalPoints} points
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                {totalXp} XP
              </Badge>
            </>
          ) : null}
          {targetCount && problems.length < targetCount ? (
            <span className="text-xs text-muted-foreground">
              {targetCount - problems.length} more to fill a run
            </span>
          ) : null}
        </div>

        <Button size="sm" onClick={saveProblems} disabled={problems.length === 0}>
          <Check className="mr-2 size-4" />
          Save problems
        </Button>
      </div>

      {problems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Trophy className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No problems yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one below. {arena.name} uses the same editors as a certification&rsquo;s
            question bank.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {problems.map((problem, index) => {
            const questionType = QUESTION_TYPES.find((type) => type.id === problem.typeId)
            if (!questionType) return null

            const Editor = questionType.component
            const problemErrors = errors[problem.id] ?? {}

            return (
              <div key={problem.id} className="space-y-2">
                {/* Reward and source sit above the editor, not inside it: the
                    editor is shared with the question bank, where a question
                    carries neither. */}
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <div className="w-24">
                    <Label htmlFor={`${problem.id}-points`} className="text-xs font-bold">
                      Points
                    </Label>
                    <Input
                      id={`${problem.id}-points`}
                      value={problem.points}
                      inputMode="numeric"
                      className="mt-1 h-9"
                      aria-invalid={Boolean(problemErrors.points)}
                      onChange={(event) =>
                        updateProblemField(problem.id, "points", event.target.value)
                      }
                    />
                  </div>

                  <div className="w-24">
                    <Label htmlFor={`${problem.id}-xp`} className="text-xs font-bold">
                      XP
                    </Label>
                    <Input
                      id={`${problem.id}-xp`}
                      value={problem.xp}
                      inputMode="numeric"
                      className="mt-1 h-9"
                      aria-invalid={Boolean(problemErrors.xp)}
                      onChange={(event) =>
                        updateProblemField(problem.id, "xp", event.target.value)
                      }
                    />
                  </div>

                  {arena.tracked ? (
                    <div className="min-w-56 flex-1">
                      <Label className="text-xs font-bold">Certification</Label>
                      <Select
                        value={problem.certificationId}
                        onValueChange={(value) =>
                          updateProblemField(problem.id, "certificationId", value)
                        }
                      >
                        <SelectTrigger
                          className="mt-1 h-9"
                          aria-invalid={Boolean(problemErrors.certificationId)}
                        >
                          <SelectValue placeholder="Select a certification" />
                        </SelectTrigger>
                        <SelectContent>
                          {certifications.map((certification) => {
                            const id = String(
                              certification.certificationId ?? certification.id,
                            )
                            return (
                              <SelectItem key={id} value={id}>
                                {certification.title}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <span className="ml-auto text-xs font-semibold text-muted-foreground">
                    Problem {index + 1} · {problem.typeName}
                  </span>
                </div>

                {problemErrors.points || problemErrors.xp || problemErrors.certificationId ? (
                  <p className="px-1 text-xs text-destructive">
                    {problemErrors.points ??
                      problemErrors.xp ??
                      problemErrors.certificationId}
                  </p>
                ) : null}

                <Editor
                  questionKey={problem.id}
                  questionNumber={index + 1}
                  data={problem.data}
                  errors={problemErrors}
                  onRemove={() => removeProblem(problem.id)}
                  onDataChange={(update) => updateProblemData(problem.id, update)}
                />
              </div>
            )
          })}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {allowedTypes.map((questionType) => (
          <QuestionTypeButton
            key={questionType.id}
            questionType={questionType}
            onAdd={addProblem}
          />
        ))}
      </div>
    </div>
  )
}
