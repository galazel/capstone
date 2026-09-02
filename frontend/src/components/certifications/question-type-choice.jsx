import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

/**
 * What the four boxes mean, in the admin's words rather than the schema's.
 *
 * "Critical thinking" is one choice here and two types to the generator --
 * programming tasks and diagramming tasks are both stored as
 * CRITICAL_THINKING -- so ticking it turns on both. The description says which
 * two, because "critical thinking" on its own does not tell an admin they are
 * about to ask for code and diagrams.
 */
export const QUESTION_TYPE_OPTIONS = [
  {
    value: "MCQ",
    label: "Multiple choice",
    description: "Four options, one right answer. Marked automatically.",
  },
  {
    value: "SHORT_ANSWER",
    label: "Short answer",
    description: "One exact term, value or acronym. Marked by exact match.",
  },
  {
    value: "DESCRIPTIVE",
    label: "Descriptive",
    description: "Explain, compare or justify in writing. Marked on meaning.",
  },
  {
    value: "CRITICAL_THINKING",
    label: "Critical thinking",
    description:
      "Programming and diagramming tasks — the learner writes code or builds a model, then answers questions about it.",
  },
]

/**
 * Which question formats a certification examines.
 *
 * <p>Asked once, at the start, and then obeyed everywhere: lesson quizzes,
 * middle and major exams, the diagnostic, the mock and the question bank all
 * read the same answer. Left untouched, the planner researches the real
 * paper's formats instead -- which is what every run did before this existed,
 * and is still the right default for a certification the admin does not know
 * the shape of.
 *
 * <p>Ticking a format does not merely permit it: each generated paper is held
 * to a minimum number of the performance types, because a permitted format
 * that is never cheap to write is a format the model quietly skips.
 */
export function QuestionTypeChoice({ value = [], onChange, disabled }) {
  function toggle(optionValue) {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue]
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          Question formats <span className="text-muted-foreground">(optional)</span>
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Tick what the real exam contains. Everything generated — lesson
          quizzes, unit exams, the diagnostic, the mock and the question bank —
          uses only these. Leave all unticked and the planner researches the
          real paper and decides.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {QUESTION_TYPE_OPTIONS.map((option) => {
          const id = `question-type-${option.value}`
          const checked = value.includes(option.value)

          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                checked
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:bg-muted/40"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={() => toggle(option.value)}
                disabled={disabled}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <Label
                  htmlFor={id}
                  className="cursor-pointer text-sm font-medium text-foreground"
                >
                  {option.label}
                </Label>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
