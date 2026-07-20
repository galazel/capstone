import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Code2,
  FileQuestion,
  FileText,
  ListChecks,
  Maximize,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { getFileViewUrl } from "@/services/fileService.js"
import DiagramArea from "@/components/challenges/diagram-area.jsx"
import BigDialog from "@/components/commons/dialog.jsx"
import { extractDiagramData } from "@/utils/diagram-graph.js"

/**
 * The five question-type editors (MCQ, Short Answer, Descriptive, Programming,
 * Diagram) and their shared building blocks, extracted verbatim from the
 * admin Question Bank builder (pages/admin/QuestionBank.jsx) so any other
 * question-authoring surface (e.g. the Enterprise assessment builder) gets
 * the exact same layout, image upload, correct-answer marking, test cases,
 * sub-questions, and diagram editor -- not a re-implementation.
 *
 * Each editor takes { questionKey, questionNumber, onRemove, data,
 * onDataChange, errors } and is otherwise self-contained; `data` matches the
 * shapes in QUESTION_TYPES below.
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

export const DIAGRAM_TYPE_OPTIONS = [
  {
    value: "ACTIVITY_DIAGRAM",
    label: "Activity Diagram",
    description: "Process flow with actions, decisions, start, and end nodes.",
  },
  {
    value: "UML_CLASS",
    label: "Class Diagram",
    description: "Classes, attributes, methods, inheritance, and relationships.",
  },
  {
    value: "UML_COMPONENT",
    label: "Component Diagram",
    description: "System components, interfaces, dependencies, and services.",
  },
  {
    value: "ERD",
    label: "ER Diagram",
    description: "Entities, attributes, primary keys, foreign keys, and relationships.",
  },
  {
    value: "FLOWCHART",
    label: "Flowchart",
    description: "Algorithm or business-process steps with decisions and outputs.",
  },
  {
    value: "SEQUENCE_DIAGRAM",
    label: "Sequence Diagram",
    description: "Actors, objects, lifelines, and message order over time.",
  },
  {
    value: "UI_DESIGN",
    label: "UI Design",
    description: "Screen layout, wireframe, prototype, or interface structure.",
  },
  {
    value: "USE_CASE",
    label: "Use Case Diagram",
    description: "Actors, use cases, system boundary, includes, and extends.",
  },
]

const diagramTypeLabels = Object.fromEntries(
  DIAGRAM_TYPE_OPTIONS.map((diagramType) => [diagramType.value, diagramType.label])
)

const diagramTypeDescriptions = Object.fromEntries(
  DIAGRAM_TYPE_OPTIONS.map((diagramType) => [diagramType.value, diagramType.description])
)

export function getDiagramTypeLabel(value) {
  return diagramTypeLabels[value] ?? "Diagram"
}

export function getDiagramTypeDescription(value) {
  return diagramTypeDescriptions[value] ?? "Create the correct reference diagram."
}

/** The question-type palette: id/title/description/icon/component/default data. */
export const QUESTION_TYPES = [
  {
    id: "MCQ",
    title: "Multiple Choice",
    description: "Choose from answer options",
    icon: ListChecks,
    component: null, // set below once MultipleChoices is defined
    data: {
      questionType: "MCQ",
      question: "",
      image: null,
      choices: [
        { choiceText: "", image: null, explanation: "", isCorrect: false },
        { choiceText: "", image: null, explanation: "", isCorrect: false },
        { choiceText: "", image: null, explanation: "", isCorrect: false },
        { choiceText: "", image: null, explanation: "", isCorrect: false },
      ],
      correctChoiceIndex: null,
      difficulty: "average",
    },
  },
  {
    id: "SHORT_ANSWER",
    title: "Short Answer",
    description: "Brief text response",
    icon: FileText,
    component: null,
    data: {
      questionType: "SHORT_ANSWER",
      question: "",
      image: null,
      correctAnswer: "",
      checkingMethod: "EXACT_MATCH",
      difficulty: "average",
    },
  },
  {
    id: "DESCRIPTIVE",
    title: "Descriptive",
    description: "Written explanation or rubric-based answer",
    icon: FileQuestion,
    component: null,
    data: {
      questionType: "DESCRIPTIVE",
      question: "",
      image: null,
      rubricBasedAnswer: "",
      checkingMethod: "AI_SEMANTIC",
      difficulty: "average",
    },
  },
  {
    id: "PROGRAMMING",
    title: "Programming",
    description: "Code-based problem",
    icon: Code2,
    component: null,
    data: {
      questionType: "CRITICAL_THINKING",
      criticalThinkingType: "PROGRAMMING",
      question: "",
      image: null,
      starterCode: "",
      testCases: [{ inputData: "", expectedOutput: "" }],
      subQuestions: [],
      difficulty: "average",
    },
  },
  {
    id: "DIAGRAM",
    title: "Diagram",
    description:
      "Activity, class, component, ERD, flowchart, sequence, UI, or use case problem",
    icon: Workflow,
    component: null,
    data: {
      questionType: "CRITICAL_THINKING",
      criticalThinkingType: "DIAGRAM",
      question: "",
      image: null,
      diagramType: "ERD",
      instructions: "",
      referenceDiagramXml: "",
      referenceDiagramNodes: [],
      referenceDiagramEdges: [],
      subQuestions: [],
      difficulty: "average",
    },
  },
]

export function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getQuestionFieldName(questionKey, fieldName) {
  return `questions[${questionKey}].${fieldName}`
}

export function cloneQuestionData(data) {
  if (typeof structuredClone === "function") {
    return structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

export function scheduleIdleWork(callback, timeout = 500) {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    return { type: "idle", id: window.requestIdleCallback(callback, { timeout }) }
  }
  return { type: "timeout", id: window.setTimeout(callback, timeout) }
}

export function cancelIdleWork(task) {
  if (!task) return
  if (
    task.type === "idle" &&
    typeof window !== "undefined" &&
    typeof window.cancelIdleCallback === "function"
  ) {
    window.cancelIdleCallback(task.id)
    return
  }
  clearTimeout(task.id)
}

export function isBlank(value) {
  return typeof value !== "string" || value.trim() === ""
}

export function updateDataAtPath(data, path, value) {
  const parts = path.split(".")

  function update(currentValue, index) {
    const key = parts[index]
    const isLastPart = index === parts.length - 1
    const copy = Array.isArray(currentValue) ? [...currentValue] : { ...currentValue }

    if (isLastPart) {
      copy[key] = value
      return copy
    }

    const nextKey = parts[index + 1]
    const defaultNextValue = /^\d+$/.test(nextKey) ? [] : {}
    copy[key] = update(currentValue?.[key] ?? defaultNextValue, index + 1)
    return copy
  }

  return update(data, 0)
}

export function validateOptionalImage(file, label) {
  if (!file) return ""
  if (typeof File !== "undefined" && !(file instanceof File)) {
    return `${label} is invalid. Please choose the image again.`
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${label} must be a JPG, PNG, WebP, or GIF file.`
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `${label} must be 5 MB or smaller.`
  }
  return ""
}

export function hasSavedDiagram(xml) {
  return typeof xml === "string" && xml.trim().length > 0
}

function validateSubQuestions(data, errors) {
  const subQuestions = data.subQuestions ?? []
  subQuestions.forEach((subQuestion, index) => {
    if (isBlank(subQuestion.question)) {
      errors[`subQuestions.${index}.question`] = `Sub-question ${index + 1} needs a question.`
    }
    if (isBlank(subQuestion.correctAnswer)) {
      errors[`subQuestions.${index}.correctAnswer`] =
        `Sub-question ${index + 1} needs an expected answer.`
    }
  })
}

export function validateQuestionData(typeId, data) {
  const errors = {}

  if (isBlank(data.question)) {
    errors.question = "Question prompt is required."
  }

  const questionImageError = validateOptionalImage(data.image, "Question image")
  if (questionImageError) {
    errors.image = questionImageError
  }

  if (typeId === "MCQ") {
    const choices = data.choices ?? []
    choices.forEach((choice, index) => {
      const letter = String.fromCharCode(65 + index)
      if (isBlank(choice.choiceText)) {
        errors[`choices.${index}.choiceText`] = `Choice ${letter} is required.`
      }
      const choiceImageError = validateOptionalImage(choice.image, `Choice ${letter} image`)
      if (choiceImageError) {
        errors[`choices.${index}.image`] = choiceImageError
      }
    })
    if (data.correctChoiceIndex === null || data.correctChoiceIndex === undefined) {
      errors.correctChoiceIndex = "Select which answer choice is correct."
    }
  }

  if (typeId === "SHORT_ANSWER" && isBlank(data.correctAnswer)) {
    errors.correctAnswer = "Correct answer is required."
  }

  if (typeId === "DESCRIPTIVE" && isBlank(data.rubricBasedAnswer)) {
    errors.rubricBasedAnswer = "Model answer or rubric is required."
  }

  if (typeId === "PROGRAMMING") {
    const testCases = data.testCases ?? []
    if (testCases.length === 0) {
      errors.testCases = "Add at least one programming test case."
    }
    testCases.forEach((testCase, index) => {
      if (isBlank(testCase.expectedOutput)) {
        errors[`testCases.${index}.expectedOutput`] = `Test case ${index + 1} needs an expected output.`
      }
    })
    validateSubQuestions(data, errors)
  }

  if (typeId === "DIAGRAM") {
    const labeledNodes = data.referenceDiagramNodes?.filter((node) => node.labelKey) ?? []
    if (!hasSavedDiagram(data.referenceDiagramXml) || labeledNodes.length === 0) {
      errors.referenceDiagramXml = "Create a reference diagram with at least one labeled node."
    }
    validateSubQuestions(data, errors)
  }

  return errors
}

export function FieldError({ message }) {
  if (!message) return null
  return (
    <p className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

export function ImageUpload({
  id,
  name,
  label = "Image",
  description = "Upload a JPG, PNG, WebP, or GIF image.",
  file,
  onFileChange,
  error,
}) {
  const [inputKey, setInputKey] = useState(0)

  function clearImage() {
    onFileChange?.(null)
    setInputKey((currentKey) => currentKey + 1)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
          <span className="ml-1 font-normal text-muted-foreground">(Optional)</span>
        </Label>

        {file?.name && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearImage}
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Remove
          </Button>
        )}
      </div>

      <Input
        key={inputKey}
        id={id}
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        aria-invalid={Boolean(error)}
        onChange={(event) => onFileChange?.(event.target.files?.[0] ?? null)}
        className={`h-9 cursor-pointer text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/80 ${
          error ? "border-destructive focus-visible:ring-destructive" : ""
        }`}
      />

      {file?.name ? (
        <p className="truncate text-xs text-muted-foreground">Selected: {file.name}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <FieldError message={error} />
    </div>
  )
}

export function CompactQuestionCard({
  type,
  title,
  questionNumber,
  onRemove,
  errors = {},
  headerExtra = null,
  children,
}) {
  const errorCount = Object.keys(errors).length
  const hasErrors = errorCount > 0

  return (
    <Card
      data-question-invalid={hasErrors ? "true" : undefined}
      className={`overflow-hidden shadow-sm ${hasErrors ? "border-destructive/70" : ""}`}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex min-w-0 items-center gap-2 border-b border-border pb-3">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {questionNumber}.
          </span>
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {type}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</p>
          {hasErrors && (
            <span className="hidden shrink-0 items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive sm:flex">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorCount} issue{errorCount === 1 ? "" : "s"}
            </span>
          )}
          {headerExtra}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label="Remove question"
            className="h-8 shrink-0 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export function DifficultySelect({ questionKey, value, onValueChange }) {
  return (
    <>
      <input type="hidden" name={getQuestionFieldName(questionKey, "difficulty")} value={value} />
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 w-full rounded-lg bg-background px-3 text-sm sm:w-40">
          <SelectValue placeholder="Difficulty" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="end"
          sideOffset={6}
          className="max-h-60 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-1"
        >
          <SelectItem value="easy" className="min-h-10">Easy</SelectItem>
          <SelectItem value="average" className="min-h-10">Average</SelectItem>
          <SelectItem value="hard" className="min-h-10">Hard</SelectItem>
        </SelectContent>
      </Select>
    </>
  )
}

export function DiagramTypeSelect({ questionKey, value, onValueChange }) {
  return (
    <>
      <input type="hidden" name={getQuestionFieldName(questionKey, "diagramType")} value={value} />
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 w-full min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate">
          <SelectValue placeholder="Select diagram type" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          sideOffset={6}
          className="max-h-72 w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
        >
          <SelectGroup>
            {DIAGRAM_TYPE_OPTIONS.map((diagramType) => (
              <SelectItem key={diagramType.value} value={diagramType.value} className="min-h-10">
                {diagramType.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  )
}

export function QuestionMetaFields({ questionKey, data, onFieldChange }) {
  return (
    <div className="border-t border-border pt-4">
      {(data.suggestedLessonTitle || data.lessonId) && (
        <p className="mb-3 text-xs leading-5 text-muted-foreground">
          {data.suggestedLessonTitle
            ? `Suggested lesson: ${data.suggestedLessonTitle}`
            : `Lesson ID: ${data.lessonId}`}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Difficulty Level</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Points are assigned later in quizzes, middle exams, or mock exams.
          </p>
        </div>
        <DifficultySelect
          questionKey={questionKey}
          value={data.difficulty}
          onValueChange={(value) => onFieldChange("difficulty", value)}
        />
      </div>
    </div>
  )
}

export function QuestionPromptFields({ questionKey, data, onFieldChange, errors = {} }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${questionKey}-question-text`} className="text-sm font-medium">
          Question Prompt
          <span className="ml-1 text-destructive">*</span>
        </Label>
        <Textarea
          id={`${questionKey}-question-text`}
          name={getQuestionFieldName(questionKey, "question")}
          value={data.question ?? ""}
          aria-invalid={Boolean(errors.question)}
          onChange={(event) => onFieldChange("question", event.target.value)}
          placeholder="Write the question, scenario, or instructions..."
          className={`min-h-24 resize-y ${
            errors.question ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
        />
        <FieldError message={errors.question} />
      </div>

      <details className="rounded-md border border-dashed border-border px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Add question image
        </summary>
        <div className="mt-3">
          {data.imageKey && !data.image && (
            <img
              src={getFileViewUrl(data.imageKey)}
              alt="Extracted source question"
              className="mb-3 max-h-64 rounded-md border object-contain"
            />
          )}
          <ImageUpload
            id={`${questionKey}-question-image`}
            name={getQuestionFieldName(questionKey, "image")}
            label="Question Image"
            file={data.image}
            error={errors.image}
            onFileChange={(file) => onFieldChange("image", file)}
            description="Optional image displayed with the question."
          />
        </div>
      </details>
    </div>
  )
}

export function SubQuestions({ questionKey, data, onDataChange, onFieldChange, errors = {} }) {
  const subQuestions = data.subQuestions ?? []

  function addSubQuestion() {
    onDataChange((currentData) => ({
      ...currentData,
      subQuestions: [...(currentData.subQuestions ?? []), { question: "", correctAnswer: "" }],
    }))
  }

  function removeSubQuestion(indexToRemove) {
    onDataChange((currentData) => ({
      ...currentData,
      subQuestions: currentData.subQuestions.filter((_, index) => index !== indexToRemove),
    }))
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Sub-Questions
            <span className="ml-1 text-xs font-normal text-muted-foreground">(Optional)</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add follow-up questions based on the main problem.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addSubQuestion}>
          <Plus className="mr-2 h-4 w-4" />
          Add Sub-Question
        </Button>
      </div>

      {subQuestions.length > 0 && (
        <div className="space-y-3">
          {subQuestions.map((subQuestion, index) => {
            const questionError = errors[`subQuestions.${index}.question`]
            const answerError = errors[`subQuestions.${index}.correctAnswer`]
            return (
              <div
                key={`${questionKey}-sub-question-${index}`}
                className={`rounded-md border bg-muted/20 p-3 ${
                  questionError || answerError ? "border-destructive/70" : "border-border"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Sub-Question {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSubQuestion(index)}
                    className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${questionKey}-sub-question-${index}`} className="text-xs font-medium">
                      Question
                      <span className="ml-1 text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`${questionKey}-sub-question-${index}`}
                      value={subQuestion.question ?? ""}
                      aria-invalid={Boolean(questionError)}
                      onChange={(event) =>
                        onFieldChange(`subQuestions.${index}.question`, event.target.value)
                      }
                      placeholder="Write the follow-up question..."
                      className={`min-h-16 resize-y ${
                        questionError ? "border-destructive focus-visible:ring-destructive" : ""
                      }`}
                    />
                    <FieldError message={questionError} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${questionKey}-sub-answer-${index}`} className="text-xs font-medium">
                      Expected Answer
                      <span className="ml-1 text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`${questionKey}-sub-answer-${index}`}
                      value={subQuestion.correctAnswer ?? ""}
                      aria-invalid={Boolean(answerError)}
                      onChange={(event) =>
                        onFieldChange(`subQuestions.${index}.correctAnswer`, event.target.value)
                      }
                      placeholder="Accepted answer, keywords, or key points..."
                      className={`min-h-16 resize-y ${
                        answerError ? "border-destructive focus-visible:ring-destructive" : ""
                      }`}
                    />
                    <FieldError message={answerError} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MultipleChoices({ questionKey, questionNumber, onRemove, data, onDataChange, errors = {}, headerExtra = null }) {
  const choices = data.choices ?? []

  function onFieldChange(path, value) {
    onDataChange((currentData) => updateDataAtPath(currentData, path, value))
  }

  function chooseCorrectChoice(correctIndex) {
    onDataChange((currentData) => ({
      ...currentData,
      correctChoiceIndex: correctIndex,
      choices: currentData.choices.map((choice, index) => ({
        ...choice,
        isCorrect: index === correctIndex,
      })),
    }))
  }

  return (
    <CompactQuestionCard type="MCQ" title="Multiple Choice Question" questionNumber={questionNumber} onRemove={onRemove} errors={errors} headerExtra={headerExtra}>
      <QuestionPromptFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} errors={errors} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">
              Answer Choices
              <span className="ml-1 text-destructive">*</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fill every choice and select one correct answer.
            </p>
          </div>
          {errors.correctChoiceIndex && (
            <span className="text-xs font-medium text-destructive">Correct answer required</span>
          )}
        </div>

        <RadioGroup
          value={data.correctChoiceIndex === null ? "" : String(data.correctChoiceIndex)}
          onValueChange={(value) => chooseCorrectChoice(Number(value))}
          className="grid gap-3 sm:grid-cols-2"
        >
          {choices.map((choice, index) => {
            const letter = String.fromCharCode(65 + index)
            const choiceError = errors[`choices.${index}.choiceText`]
            const imageError = errors[`choices.${index}.image`]
            const isCorrect = data.correctChoiceIndex === index

            return (
              <div
                key={`${questionKey}-choice-${index}`}
                className={`rounded-md border p-3 transition ${
                  isCorrect
                    ? "border-primary bg-primary/5"
                    : choiceError || imageError
                      ? "border-destructive/70 bg-destructive/5"
                      : "border-border bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id={`${questionKey}-correct-${index}`} value={String(index)} className="shrink-0" />
                  <Label
                    htmlFor={`${questionKey}-correct-${index}`}
                    className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border text-xs font-semibold ${
                      isCorrect ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                    }`}
                  >
                    {letter}
                  </Label>
                  <Input
                    name={getQuestionFieldName(questionKey, `choices[${index}].choiceText`)}
                    value={choice.choiceText ?? ""}
                    aria-invalid={Boolean(choiceError)}
                    onChange={(event) => onFieldChange(`choices.${index}.choiceText`, event.target.value)}
                    placeholder={`Choice ${letter}`}
                    className={`h-8 min-w-0 ${choiceError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                </div>

                <div className="ml-9 mt-2">
                  <FieldError message={choiceError} />
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Add image or explanation
                    <span className="ml-1">(Optional)</span>
                  </summary>
                  <div className="mt-3 space-y-3">
                    {choice.imageKey && !choice.image && (
                      <img
                        src={getFileViewUrl(choice.imageKey)}
                        alt={`Extracted source choice ${letter}`}
                        className="max-h-40 rounded-md border object-contain"
                      />
                    )}
                    <ImageUpload
                      id={`${questionKey}-choice-image-${index}`}
                      name={getQuestionFieldName(questionKey, `choices[${index}].image`)}
                      label="Choice Image"
                      file={choice.image}
                      error={imageError}
                      onFileChange={(file) => onFieldChange(`choices.${index}.image`, file)}
                      description="Optional image for this answer choice."
                    />
                    <Textarea
                      value={choice.explanation ?? ""}
                      onChange={(event) => onFieldChange(`choices.${index}.explanation`, event.target.value)}
                      placeholder="Optional explanation shown after answering..."
                      className="min-h-16 resize-y text-xs"
                    />
                  </div>
                </details>
              </div>
            )
          })}
        </RadioGroup>

        <FieldError message={errors.correctChoiceIndex} />
      </div>

      <QuestionMetaFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} />
    </CompactQuestionCard>
  )
}

export function ShortAnswer({ questionKey, questionNumber, onRemove, data, onDataChange, errors = {}, headerExtra = null }) {
  function onFieldChange(path, value) {
    onDataChange((currentData) => updateDataAtPath(currentData, path, value))
  }

  return (
    <CompactQuestionCard type="Short Answer" title="Short Answer Question" questionNumber={questionNumber} onRemove={onRemove} errors={errors} headerExtra={headerExtra}>
      <QuestionPromptFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} errors={errors} />

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor={`${questionKey}-correct-answer`} className="text-sm font-medium">
          Correct Answer
          <span className="ml-1 text-destructive">*</span>
        </Label>
        <Textarea
          id={`${questionKey}-correct-answer`}
          value={data.correctAnswer ?? ""}
          aria-invalid={Boolean(errors.correctAnswer)}
          onChange={(event) => onFieldChange("correctAnswer", event.target.value)}
          placeholder="Enter the exact answer or accepted keywords..."
          className={`min-h-20 resize-y ${errors.correctAnswer ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        <p className="text-xs text-muted-foreground">Short answers use exact-match checking automatically.</p>
        <FieldError message={errors.correctAnswer} />
      </div>

      <QuestionMetaFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} />
    </CompactQuestionCard>
  )
}

export function Descriptive({ questionKey, questionNumber, onRemove, data, onDataChange, errors = {}, headerExtra = null }) {
  function onFieldChange(path, value) {
    onDataChange((currentData) => updateDataAtPath(currentData, path, value))
  }

  return (
    <CompactQuestionCard type="Descriptive" title="Descriptive Question" questionNumber={questionNumber} onRemove={onRemove} errors={errors} headerExtra={headerExtra}>
      <QuestionPromptFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} errors={errors} />

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor={`${questionKey}-rubric`} className="text-sm font-medium">
          Model Answer / Rubric
          <span className="ml-1 text-destructive">*</span>
        </Label>
        <Textarea
          id={`${questionKey}-rubric`}
          value={data.rubricBasedAnswer ?? ""}
          aria-invalid={Boolean(errors.rubricBasedAnswer)}
          onChange={(event) => onFieldChange("rubricBasedAnswer", event.target.value)}
          placeholder="Write the expected explanation, key points, or grading guide..."
          className={`min-h-28 resize-y ${errors.rubricBasedAnswer ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        <p className="text-xs text-muted-foreground">Descriptive answers use the rubric automatically.</p>
        <FieldError message={errors.rubricBasedAnswer} />
      </div>

      <QuestionMetaFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} />
    </CompactQuestionCard>
  )
}

export function Programming({ questionKey, questionNumber, onRemove, data, onDataChange, errors = {}, headerExtra = null }) {
  const testCases = data.testCases ?? []

  function onFieldChange(path, value) {
    onDataChange((currentData) => updateDataAtPath(currentData, path, value))
  }

  function addTestCase() {
    onDataChange((currentData) => ({
      ...currentData,
      testCases: [...(currentData.testCases ?? []), { inputData: "", expectedOutput: "" }],
    }))
  }

  function removeTestCase(indexToRemove) {
    if (testCases.length === 1) return
    onDataChange((currentData) => ({
      ...currentData,
      testCases: currentData.testCases.filter((_, index) => index !== indexToRemove),
    }))
  }

  return (
    <CompactQuestionCard type="Programming" title="Programming Question" questionNumber={questionNumber} onRemove={onRemove} errors={errors} headerExtra={headerExtra}>
      <QuestionPromptFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} errors={errors} />

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor={`${questionKey}-starter-code`} className="text-sm font-medium">
          Starter Code
          <span className="ml-1 font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <Textarea
          id={`${questionKey}-starter-code`}
          value={data.starterCode ?? ""}
          onChange={(event) => onFieldChange("starterCode", event.target.value)}
          spellCheck={false}
          placeholder="// Optional code template..."
          className="min-h-32 resize-y font-mono text-sm"
        />
      </div>

      <div className={`space-y-3 rounded-md border border-dashed p-3 ${errors.testCases ? "border-destructive/70 bg-destructive/5" : "border-border"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Programming Test Cases
              <span className="ml-1 text-destructive">*</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Input is optional. Every test case needs an expected output.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addTestCase}>
            <Plus className="mr-2 h-4 w-4" />
            Add Test Case
          </Button>
        </div>

        <FieldError message={errors.testCases} />

        <div className="space-y-3">
          {testCases.map((testCase, index) => {
            const expectedOutputError = errors[`testCases.${index}.expectedOutput`]
            return (
              <div
                key={`${questionKey}-test-case-${index}`}
                className={`rounded-md border p-3 ${expectedOutputError ? "border-destructive/70 bg-destructive/5" : "border-border bg-muted/20"}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Test Case {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={testCases.length === 1}
                    onClick={() => removeTestCase(index)}
                    className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${questionKey}-test-case-${index}-input`} className="text-xs font-medium">
                      Input Data
                      <span className="ml-1 font-normal text-muted-foreground">(Optional)</span>
                    </Label>
                    <Textarea
                      id={`${questionKey}-test-case-${index}-input`}
                      value={testCase.inputData ?? ""}
                      onChange={(event) => onFieldChange(`testCases.${index}.inputData`, event.target.value)}
                      spellCheck={false}
                      placeholder={"Example:\n5\n10 20 30 40 50"}
                      className="min-h-20 resize-y font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${questionKey}-test-case-${index}-output`} className="text-xs font-medium">
                      Expected Output
                      <span className="ml-1 text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`${questionKey}-test-case-${index}-output`}
                      value={testCase.expectedOutput ?? ""}
                      aria-invalid={Boolean(expectedOutputError)}
                      onChange={(event) => onFieldChange(`testCases.${index}.expectedOutput`, event.target.value)}
                      spellCheck={false}
                      placeholder="Example: 150"
                      className={`min-h-20 resize-y font-mono text-xs ${expectedOutputError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <FieldError message={expectedOutputError} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <SubQuestions questionKey={questionKey} data={data} onDataChange={onDataChange} onFieldChange={onFieldChange} errors={errors} />
      <QuestionMetaFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} />
    </CompactQuestionCard>
  )
}

export function Diagram({ questionKey, questionNumber, onRemove, data, onDataChange, errors = {}, headerExtra = null }) {
  const diagramTimerRef = useRef(null)

  useEffect(() => {
    return () => cancelIdleWork(diagramTimerRef.current)
  }, [])

  function onFieldChange(path, value) {
    onDataChange((currentData) => updateDataAtPath(currentData, path, value))
  }

  function handleReferenceDiagramChange(xml) {
    cancelIdleWork(diagramTimerRef.current)

    diagramTimerRef.current = scheduleIdleWork(() => {
      try {
        const { nodes, edges } = extractDiagramData(xml)
        onDataChange((currentData) => ({
          ...currentData,
          referenceDiagramXml: xml,
          referenceDiagramNodes: nodes,
          referenceDiagramEdges: edges,
        }))
      } catch (error) {
        console.error("Could not extract diagram nodes and connections:", error)
        onDataChange((currentData) => ({
          ...currentData,
          referenceDiagramXml: xml,
          referenceDiagramNodes: [],
          referenceDiagramEdges: [],
        }))
      }
    }, 600)
  }

  const diagramTypeLabel = getDiagramTypeLabel(data.diagramType)
  const diagramTypeDescription = getDiagramTypeDescription(data.diagramType)
  const hasDiagram = hasSavedDiagram(data.referenceDiagramXml)

  return (
    <CompactQuestionCard type="Diagram" title="Diagram Question" questionNumber={questionNumber} onRemove={onRemove} errors={errors} headerExtra={headerExtra}>
      <QuestionPromptFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} errors={errors} />

      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Diagram Type</Label>
          <DiagramTypeSelect questionKey={questionKey} value={data.diagramType} onValueChange={(value) => onFieldChange("diagramType", value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${questionKey}-instructions`} className="text-sm font-medium">
            Instructions
            <span className="ml-1 font-normal text-muted-foreground">(Optional)</span>
          </Label>
          <Input
            id={`${questionKey}-instructions`}
            value={data.instructions ?? ""}
            onChange={(event) => onFieldChange("instructions", event.target.value)}
            placeholder="Example: Include PK and FK labels."
          />
        </div>
      </div>

      {data.authoringNotes && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
          <p className="font-medium text-foreground">Authoring notes</p>
          <p className="mt-1">{data.authoringNotes}</p>
        </div>
      )}

      <section className={`overflow-hidden rounded-xl border bg-background ${errors.referenceDiagramXml ? "border-destructive/70" : "border-border"}`}>
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
              <Workflow className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Reference Diagram
                  <span className="ml-1 text-destructive">*</span>
                </p>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {diagramTypeLabel}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {diagramTypeDescription} Create the correct reference diagram that learners will be compared against.
              </p>
              <p className={`mt-2 text-xs font-medium ${hasDiagram ? "text-primary" : "text-muted-foreground"}`}>
                {hasDiagram ? "Reference diagram saved automatically." : "No reference diagram created yet."}
              </p>
            </div>
          </div>

          <BigDialog
            title={`${diagramTypeLabel} Editor`}
            description="Your diagram is saved automatically while you edit."
            trigger={
              <Button type="button" size="sm" className="shrink-0">
                <Maximize className="mr-2 h-4 w-4" />
                Open Editor
              </Button>
            }
            content={
              <div className="h-full w-full overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                <DiagramArea
                  diagramType={data.diagramType}
                  initialXml={data.referenceDiagramXml || undefined}
                  onChange={handleReferenceDiagramChange}
                />
              </div>
            }
          />
        </div>

        {errors.referenceDiagramXml && (
          <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3">
            <FieldError message={errors.referenceDiagramXml} />
          </div>
        )}
      </section>

      <SubQuestions questionKey={questionKey} data={data} onDataChange={onDataChange} onFieldChange={onFieldChange} errors={errors} />
      <QuestionMetaFields questionKey={questionKey} data={data} onFieldChange={onFieldChange} />
    </CompactQuestionCard>
  )
}

// Wire the palette's component refs now that the editors are defined.
QUESTION_TYPES[0].component = MultipleChoices
QUESTION_TYPES[1].component = ShortAnswer
QUESTION_TYPES[2].component = Descriptive
QUESTION_TYPES[3].component = Programming
QUESTION_TYPES[4].component = Diagram

export function QuestionTypeButton({ questionType, onAdd, disabled }) {
  const Icon = questionType.icon
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-left"
      onClick={() => onAdd(questionType)}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium">{questionType.title}</span>
        <span className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">
          {questionType.description}
        </span>
      </span>
    </Button>
  )
}

/**
 * Persists one authored question with the same per-type backend calls the
 * admin builder uses (saveQuestion + saveChoices/saveTextQuestion/
 * saveProgrammingQuestion/saveDiagramQuestion), parametrized by totalPoints
 * (admin hardcodes 1; callers configuring points per-question pass their
 * own) and ownerGroupId (undefined for official/admin-authored questions,
 * a group id to author the question as that Enterprise group's own).
 */
export async function saveAuthoredQuestion(
  question,
  { lessonId, certificationId, totalPoints = 1, ownerGroupId } = {},
  api
) {
  const { saveQuestion, saveChoices, saveTextQuestion, saveProgrammingQuestion, saveDiagramQuestion } = api

  switch (question.typeId) {
    case "MCQ": {
      const savedMCQ = await saveQuestion(
        {
          questionType: question.data.questionType,
          difficultyLevel: question.data.difficulty,
          questionText: question.data.question,
          imageKey: question.data.imageKey ?? null,
          lessonId: Number(lessonId),
          certificationId,
          totalPoints,
        },
        ownerGroupId
      )

      for (const choice of question.data.choices) {
        await saveChoices({
          questionId: savedMCQ.questionId,
          choiceText: choice.choiceText,
          imageKey: choice.imageKey ?? null,
          correct: choice.isCorrect,
          explanation: choice.explanation,
        })
      }
      return savedMCQ
    }
    case "SHORT_ANSWER": {
      const savedShortAnswer = await saveQuestion(
        {
          questionType: question.data.questionType,
          difficultyLevel: question.data.difficulty,
          questionText: question.data.question,
          imageKey: question.data.imageKey ?? null,
          lessonId: Number(lessonId),
          certificationId,
          totalPoints,
        },
        ownerGroupId
      )
      await saveTextQuestion({
        questionId: savedShortAnswer.questionId,
        correctAnswer: question.data.correctAnswer,
        checkingMethod: question.data.checkingMethod,
        acceptedVariations: Array.isArray(question.data.acceptedVariations)
          ? question.data.acceptedVariations
          : null,
      })
      return savedShortAnswer
    }
    case "DESCRIPTIVE": {
      const savedDescriptive = await saveQuestion(
        {
          questionType: question.data.questionType,
          difficultyLevel: question.data.difficulty,
          questionText: question.data.question,
          imageKey: question.data.imageKey ?? null,
          lessonId: Number(lessonId),
          certificationId,
          totalPoints,
        },
        ownerGroupId
      )
      await saveTextQuestion({
        questionId: savedDescriptive.questionId,
        correctAnswer: question.data.rubricBasedAnswer,
        checkingMethod: question.data.checkingMethod,
      })
      return savedDescriptive
    }
    case "PROGRAMMING": {
      const savedProgramming = await saveQuestion(
        {
          questionType: question.data.questionType,
          difficultyLevel: question.data.difficulty,
          questionText: question.data.question,
          imageKey: question.data.imageKey ?? null,
          lessonId: Number(lessonId),
          certificationId,
          totalPoints,
        },
        ownerGroupId
      )
      await saveProgrammingQuestion({
        questionId: savedProgramming.questionId,
        starterCode: question.data.starterCode,
        testCases: question.data.testCases.map((testCase) => ({
          inputData: testCase.inputData,
          expectedOutput: testCase.expectedOutput,
        })),
      })

      for (const subQuestion of question.data.subQuestions ?? []) {
        const savedSub = await saveQuestion(
          {
            parentQuestionId: savedProgramming.questionId,
            questionType: question.data.questionType,
            difficultyLevel: question.data.difficulty,
            questionText: subQuestion.question,
            lessonId: Number(lessonId),
            totalPoints: 1,
          },
          ownerGroupId
        )
        await saveTextQuestion({
          questionId: savedSub.questionId,
          correctAnswer: subQuestion.correctAnswer,
          checkingMethod: "AI_SEMANTIC",
        })
      }
      return savedProgramming
    }
    case "DIAGRAM": {
      const savedDiagram = await saveQuestion(
        {
          questionType: question.data.questionType,
          difficultyLevel: question.data.difficulty,
          questionText: question.data.question,
          imageKey: question.data.imageKey ?? null,
          lessonId: Number(lessonId),
          certificationId,
          totalPoints,
        },
        ownerGroupId
      )
      await saveDiagramQuestion({
        questionId: savedDiagram.questionId,
        diagramType: question.data.diagramType,
        instructions: question.data.instructions,
        referenceDiagramXml: question.data.referenceDiagramXml,
        referenceDiagramJson: JSON.stringify({
          nodes: question.data.referenceDiagramNodes,
          edges: question.data.referenceDiagramEdges,
        }),
      })

      for (const subQuestion of question.data.subQuestions ?? []) {
        const savedSub = await saveQuestion(
          {
            parentQuestionId: savedDiagram.questionId,
            questionType: question.data.questionType,
            difficultyLevel: question.data.difficulty,
            questionText: subQuestion.question,
            lessonId: Number(lessonId),
            totalPoints: 1,
          },
          ownerGroupId
        )
        await saveTextQuestion({
          questionId: savedSub.questionId,
          correctAnswer: subQuestion.correctAnswer,
          checkingMethod: "AI_SEMANTIC",
        })
      }
      return savedDiagram
    }
    default:
      throw new Error(`Unknown question type: ${question.typeId}`)
  }
}
