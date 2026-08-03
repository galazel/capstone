import { useMemo, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { java } from "@codemirror/lang-java"
import { python } from "@codemirror/lang-python"
import { sql } from "@codemirror/lang-sql"
import { Maximize2Icon, Minimize2Icon, RotateCcwIcon } from "@/components/icons"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const PROGRAMMING_LANGUAGES = [
  "Java",
  "JavaScript",
  "Python",
  "C",
  "C++",
  "C#",
  "SQL",
  "Pseudocode",
]

function getLanguageExtension(language) {
  switch (language) {
    case "JavaScript":
      return [javascript()]
    case "Java":
    case "C":
    case "C++":
    case "C#":
      return [java()]
    case "Python":
      return [python()]
    case "SQL":
      return [sql()]
    default:
      return []
  }
}

// CodeMirror-based programming answer workspace. This is an editor only — the
// backend has no code-execution endpoint, so there are intentionally no
// Run/Check/test-output controls. Code is submitted with the assessment.
export default function CodeMirrorProgrammingWorkspace({
  value,
  language,
  starterCode = "",
  onChange,
  onLanguageChange,
  readOnly = false,
}) {
  const [fullscreen, setFullscreen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const extensions = useMemo(() => getLanguageExtension(language), [language])

  const editor = (
    <CodeMirror
      value={value}
      onChange={readOnly ? undefined : onChange}
      readOnly={readOnly}
      extensions={extensions}
      height="100%"
      style={{ height: "100%", fontSize: "14px" }}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
      }}
    />
  )

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background p-4"
          : "flex h-full min-h-0 flex-col"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          {readOnly ? (
            <Badge variant="secondary">{language}</Badge>
          ) : (
            <Select value={language} onValueChange={onLanguageChange}>
              <SelectTrigger
                size="sm"
                className="h-8 w-[140px]"
                aria-label="Programming language"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROGRAMMING_LANGUAGES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!readOnly ? (
            <span className="text-xs text-muted-foreground">
              Your code is saved as part of your assessment answer.
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && starterCode ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcwIcon aria-hidden="true" />
              Reset Code
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen editor"}
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-b-lg border border-t-0">
        {editor}
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset code?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current code will be replaced with the original starter
              code. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange(starterCode)
                setResetOpen(false)
              }}
            >
              Reset Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
