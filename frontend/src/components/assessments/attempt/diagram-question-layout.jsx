import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { getFileViewUrl } from "@/services/fileService.js"
import DiagramArea from "@/components/challenges/diagram-area.jsx"
import { getDiagramTypeLabel } from "@/components/questions/question-editors.jsx"
import RubricPanel from "./rubric-panel.jsx"
import SubQuestionTabs from "./sub-question-tabs.jsx"

// Three-column diagram environment: problem | diagram editor | navigation +
// rubric. There is no in-attempt Check: diagram grading compares against
// `reference_diagram_xml`, which generation never fills (it writes
// `reference_diagram_json`), so a Check could only report failure.
//
// `checker`, `attemptId`, `attemptQuestionId` and `learnerId` are kept on the
// signature though nothing reads them now: they are exactly what a restored
// Check would need, callers already pass them, and dropping them would make
// bringing it back a change across several files rather than one.
export default function DiagramQuestionLayout({
  question,
  index,
  answer,
  onAnswer,
  attemptId,
  attemptQuestionId,
  learnerId,
  navigator,
  checker = null,
  editingLocked = false,
}) {
  const [rubric, setRubric] = useState(question.rubric ?? [])
  const [notice, setNotice] = useState(null)

  const diagramType = question.diagramType ?? "ERD"
  const subQuestions = question.subQuestions ?? []

  // This layout is deliberately NOT remounted per question: remounting would
  // tear down the draw.io iframe and re-download the editor on every step
  // through a diagram exam. Everything question-scoped resets here instead.
  useEffect(() => {
    setRubric(question.rubric ?? [])
    setNotice(null)
  }, [question.attemptQuestionId, question.rubric])

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(240px,1fr)_minmax(0,1.5fr)_300px]">
      {/* Left — problem statement */}
      <ScrollArea className="max-h-full rounded-xl border bg-card">
        <div className="space-y-4 p-4">
          {/* Title and difficulty live here, at the head of the problem
              statement. An arena run used to carry them in a strip across the
              top of the workspace, which is a second header for one column's
              worth of information. Both are optional: an exam item has neither,
              and nothing renders when they are absent. */}
          {question.title ? (
            <h2 className="text-base font-bold leading-6">{question.title}</h2>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Item {index + 1}
            </span>
            {question.difficultyLevel ? (
              <Badge variant="outline" className="capitalize">
                {question.difficultyLevel}
              </Badge>
            ) : null}
            {question.points != null ? (
              <Badge variant="secondary">{Number(question.points)} pt(s)</Badge>
            ) : null}
            {/* The label, not the raw enum: this badge was showing learners
                "SEQUENCE_DIAGRAM" mid-exam. */}
            <Badge variant="outline">Diagram · {getDiagramTypeLabel(diagramType)}</Badge>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-7">
            {question.question}
          </p>

          {question.instructions ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Instructions
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {question.instructions}
              </p>
            </div>
          ) : null}

          {question.questionImageKey ? (
            <img
              src={getFileViewUrl(question.questionImageKey)}
              alt="Problem reference"
              className="w-full rounded-xl border"
            />
          ) : null}

          {subQuestions.length > 0 ? (
            <div className="rounded-xl border bg-background p-3">
              <SubQuestionTabs
                key={question.attemptQuestionId ?? question.questionId ?? index}
                subQuestions={subQuestions.map((sub) => ({
                  questionId: sub.subQuestionId,
                  questionText: sub.questionText,
                }))}
                answers={answer?.subAnswers ?? {}}
                readOnly={editingLocked}
                onAnswerChange={(subQuestionId, text) =>
                  onAnswer({
                    subAnswers: {
                      ...(answer?.subAnswers ?? {}),
                      [subQuestionId]: text,
                    },
                  })
                }
              />
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* Center — diagram editor */}
      <div className="flex min-h-0 flex-col gap-2">
        {/* Check Diagram removed deliberately.
            It offered a verdict the server cannot currently produce: diagram
            grading compares the learner's drawing against
            `reference_diagram_xml`, and generation writes the reference to
            `reference_diagram_json` instead, leaving that column blank on
            every generated question. So Check could only ever report failure
            or nothing, which is worse than not offering it -- a learner who
            presses it concludes their diagram is wrong.

            Restore it once the grader reads a reference that exists. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Your diagram is saved automatically with your attempt.
          </span>
        </div>

        <div
          className={cn(
            "min-h-[420px] flex-1 overflow-hidden rounded-xl border",
            editingLocked && "pointer-events-none opacity-70"
          )}
        >
          <DiagramArea
            diagramType={diagramType}
            documentId={
              question.attemptQuestionId ?? question.questionId ?? index
            }
            initialXml={answer?.diagramSubmissionData}
            onChange={(diagramXml) =>
              onAnswer({ diagramSubmissionData: diagramXml })
            }
          />
        </div>
      </div>

      {/* Right — navigation + rubric */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="rounded-xl border bg-card p-3">{navigator}</div>
        <div className="rounded-xl border bg-card p-3">
          <RubricPanel rubric={rubric} notice={notice} />
        </div>
      </div>
    </div>
  )
}
