import { useCallback, useEffect, useState } from "react"
import { CheckCheckIcon, Loader2Icon, PlayIcon, TerminalIcon } from "@/components/icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getFileViewUrl } from "@/services/fileService.js"
import {
  checkAttemptProgramming,
  getAttemptExecutions,
  runAttemptProgramming,
} from "@/services/assessmentService.js"
import CodeMirrorProgrammingWorkspace from "./code-mirror-programming-workspace.jsx"
import ExecutionHistoryPanel from "./execution-history-panel.jsx"
import SubQuestionTabs from "./sub-question-tabs.jsx"
import TestCasesPanel from "./test-cases-panel.jsx"

// Three-column programming environment: problem | editor | navigation + tests.
// Run/Check hit real endpoints; the executor is stubbed server-side, so results
// come back as "not run / unavailable" — nothing is fake-scored here.
export default function ProgrammingQuestionLayout({
  question,
  index,
  answer,
  onAnswer,
  attemptId,
  attemptQuestionId,
  learnerId,
  navigator,
  editingLocked = false,
}) {
  const [tests, setTests] = useState(question.testCases ?? [])
  const [notice, setNotice] = useState(null)
  const [output, setOutput] = useState(null)
  const [running, setRunning] = useState(false)
  const [checking, setChecking] = useState(false)
  const [activeTab, setActiveTab] = useState("tests")
  const [executions, setExecutions] = useState([])
  const [executionsLoading, setExecutionsLoading] = useState(false)

  const language = answer?.programmingLanguage ?? "Java"
  // The editor starts blank — starter code is never auto-filled. "Reset
  // Code" (in CodeMirrorProgrammingWorkspace) remains available as an
  // explicit, learner-initiated action when starter code exists.
  const code = answer?.submittedCode ?? ""
  const busy = running || checking
  const subQuestions = question.subQuestions ?? []

  // Reset test/output panels when switching items.
  useEffect(() => {
    setTests(question.testCases ?? [])
    setNotice(null)
    setOutput(null)
  }, [question.attemptQuestionId, question.testCases])

  const refreshExecutions = useCallback(() => {
    setExecutionsLoading(true)
    getAttemptExecutions(attemptId, attemptQuestionId, learnerId)
      .then((rows) => setExecutions(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => setExecutionsLoading(false))
  }, [attemptId, attemptQuestionId, learnerId])

  useEffect(() => {
    refreshExecutions()
  }, [refreshExecutions])

  const execute = async (mode) => {
    const setBusy = mode === "run" ? setRunning : setChecking
    setBusy(true)
    try {
      const runner = mode === "run" ? runAttemptProgramming : checkAttemptProgramming
      const result = await runner(
        attemptId,
        attemptQuestionId,
        learnerId,
        code,
        language
      )
      setTests(result.tests ?? [])
      setNotice(result.message ?? null)
      setOutput(result.message ?? null)
      setActiveTab("tests")
      refreshExecutions()
    } catch (error) {
      toast.error(
        error?.response?.data?.message ?? "Unable to run your code right now."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(240px,1fr)_minmax(0,1.5fr)_300px]">
      {/* Left — problem statement */}
      <ScrollArea className="max-h-full rounded-xl border bg-card">
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Item {index + 1}
            </span>
            {question.points != null ? (
              <Badge variant="secondary">{Number(question.points)} pt(s)</Badge>
            ) : null}
            <Badge variant="outline">Programming</Badge>
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

      {/* Center — code editor + actions + output */}
      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => execute("run")}
            disabled={busy || editingLocked}
          >
            {running ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <PlayIcon aria-hidden="true" />
            )}
            Run Code
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => execute("check")}
            disabled={busy || editingLocked}
          >
            {checking ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheckIcon aria-hidden="true" />
            )}
            Check Code
          </Button>
          <span className="text-xs text-muted-foreground">
            Code is saved automatically with your attempt.
          </span>
        </div>

        <div className="min-h-0 flex-1">
          <CodeMirrorProgrammingWorkspace
            value={code}
            language={language}
            starterCode={question.starterCode ?? ""}
            readOnly={editingLocked}
            onChange={(next) => onAnswer({ submittedCode: next })}
            onLanguageChange={(next) => onAnswer({ programmingLanguage: next })}
          />
        </div>

        {output ? (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <TerminalIcon className="size-3.5" aria-hidden="true" />
              Output
            </div>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap p-3 text-xs">
              {output}
            </pre>
          </div>
        ) : null}
      </div>

      {/* Right — navigation + tests / executions */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="rounded-xl border bg-card p-3">{navigator}</div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="rounded-xl border bg-card p-3"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
          </TabsList>
          <TabsContent value="tests" className="mt-3">
            <TestCasesPanel tests={tests} notice={notice} />
          </TabsContent>
          <TabsContent value="executions" className="mt-3">
            <ExecutionHistoryPanel
              executions={executions}
              loading={executionsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
