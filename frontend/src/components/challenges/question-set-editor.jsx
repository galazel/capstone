import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  QUESTION_TYPES,
  QuestionTypeButton,
  cloneQuestionData,
  createLocalId,
  validateQuestionData,
} from "@/components/questions/question-editors.jsx"

/**
 * One flat set of authored arena questions.
 *
 * The unit every arena is built from: a roadmap node holds one of these, and so
 * does a World Cup bracket stage. Extracted so the reward strip, the editor
 * wiring and the "what a valid arena question is" rule exist once rather than
 * once per arena shape.
 *
 * The editors themselves are the certification Question Bank's, imported from
 * `question-editors` — an arena question IS a question. What this adds is the
 * reward line (points, XP), which sits in a strip above each editor rather than
 * inside it so the editor stays the shared component.
 *
 * Controlled: the owner holds the list and decides what a full set means.
 */

/** Defaults per question. Points score the round, XP feeds the learner's level. */
const DEFAULT_REWARD = { points: "10", xp: "25" }

export function createArenaQuestion(questionType) {
  return {
    id: createLocalId(),
    typeId: questionType.id,
    typeName: questionType.title,
    ...DEFAULT_REWARD,
    data: cloneQuestionData(questionType.data),
  }
}

export function allowedQuestionTypes(typeIds) {
  return QUESTION_TYPES.filter((type) => typeIds.includes(type.id))
}

/**
 * The bank's own validator plus the rules that are the arena's: a reward has to
 * be a positive number. Returns errors keyed by question id, so a caller can
 * merge several sets (every stage of a bracket, every node of a path) into one
 * map without them colliding.
 */
export function validateArenaQuestions(problems) {
  const errors = {}

  for (const problem of problems) {
    const problemErrors = validateQuestionData(problem.typeId, problem.data)

    if (!(Number(problem.points) > 0)) {
      problemErrors.points = "Points must be greater than zero."
    }
    if (!(Number(problem.xp) >= 0)) {
      problemErrors.xp = "XP cannot be negative."
    }

    if (Object.keys(problemErrors).length > 0) {
      errors[problem.id] = problemErrors
    }
  }

  return errors
}

export function totalPointsOf(problems) {
  return problems.reduce((total, problem) => total + (Number(problem.points) || 0), 0)
}

export function totalXpOf(problems) {
  return problems.reduce((total, problem) => total + (Number(problem.xp) || 0), 0)
}

export default function QuestionSetEditor({
  problems,
  onChange,
  typeIds,
  errors = {},
  full = false,
  fullMessage = "This set is complete.",
  emptyState = null,
}) {
  const allowedTypes = allowedQuestionTypes(typeIds)

  function addQuestion(questionType) {
    onChange([...problems, createArenaQuestion(questionType)])
  }

  function removeQuestion(id) {
    onChange(problems.filter((problem) => problem.id !== id))
  }

  function updateField(id, field, value) {
    onChange(
      problems.map((problem) =>
        problem.id === id ? { ...problem, [field]: value } : problem,
      ),
    )
  }

  /** The editors call `onDataChange` with an updater, not a value — they edit
   *  deep paths and need the current data to merge into. */
  function updateData(id, update) {
    onChange(
      problems.map((problem) =>
        problem.id === id
          ? {
              ...problem,
              data: typeof update === "function" ? update(problem.data) : update,
            }
          : problem,
      ),
    )
  }

  return (
    <div className="space-y-5">
      {problems.length === 0 && emptyState ? emptyState : null}

      {problems.map((problem, index) => {
        const questionType = QUESTION_TYPES.find((type) => type.id === problem.typeId)
        if (!questionType) return null

        const Editor = questionType.component
        const problemErrors = errors[problem.id] ?? {}

        return (
          <div key={problem.id} className="space-y-2">
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
                    updateField(problem.id, "points", event.target.value)
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
                  onChange={(event) => updateField(problem.id, "xp", event.target.value)}
                />
              </div>

              <span className="ml-auto text-xs font-semibold text-muted-foreground">
                Question {index + 1} · {problem.typeName}
              </span>
            </div>

            {problemErrors.points || problemErrors.xp ? (
              <p className="px-1 text-xs text-destructive">
                {problemErrors.points ?? problemErrors.xp}
              </p>
            ) : null}

            <Editor
              questionKey={problem.id}
              questionNumber={index + 1}
              data={problem.data}
              errors={problemErrors}
              onRemove={() => removeQuestion(problem.id)}
              onDataChange={(update) => updateData(problem.id, update)}
            />
          </div>
        )
      })}

      {full ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs font-semibold text-muted-foreground">
          {fullMessage}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {allowedTypes.map((questionType) => (
            <QuestionTypeButton
              key={questionType.id}
              questionType={questionType}
              onAdd={addQuestion}
            />
          ))}
        </div>
      )}
    </div>
  )
}
