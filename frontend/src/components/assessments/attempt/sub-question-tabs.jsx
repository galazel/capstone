import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Tabbed editor for critical-thinking sub-questions. Answers are kept in the
// parent's answer state and submitted together with the whole assessment.
export default function SubQuestionTabs({
  subQuestions,
  answers,
  onAnswerChange,
  readOnly = false,
}) {
  const [activeId, setActiveId] = useState(subQuestions[0]?.questionId ?? null)

  const active = subQuestions.find(
    (question) => question.questionId === activeId
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        role="tablist"
        aria-label="Sub questions"
        className="flex gap-1.5 overflow-x-auto pb-1"
      >
        {subQuestions.map((question, index) => {
          const answered = Boolean(answers[question.questionId]?.trim())
          const isActive = question.questionId === activeId
          return (
            <button
              key={question.questionId}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(question.questionId)}
              className={cn(
                "shrink-0 rounded-[var(--radius-rb-control)] border px-3 py-1.5 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : answered
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              Sub Question {index + 1}
              {answered ? " ●" : ""}
            </button>
          )
        })}
      </div>

      {active ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p className="text-sm leading-6">{active.questionText}</p>
          <Label htmlFor={`sub-answer-${active.questionId}`} className="sr-only">
            Answer for sub question
          </Label>
          <Textarea
            id={`sub-answer-${active.questionId}`}
            value={answers[active.questionId] ?? ""}
            onChange={(event) =>
              onAnswerChange(active.questionId, event.target.value)
            }
            readOnly={readOnly}
            placeholder="Write your answer..."
            className="min-h-40 flex-1 resize-none"
          />
          <p className="text-right text-xs text-muted-foreground">
            {(answers[active.questionId] ?? "").length} characters
          </p>
        </div>
      ) : null}
    </div>
  )
}
