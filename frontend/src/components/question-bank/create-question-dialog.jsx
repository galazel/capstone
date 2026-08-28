import React, { useState } from "react"
import { Code2, Plus, Trash2 } from "@/components/icons"

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    useQuery,
} from "@tanstack/react-query"
import {getAllLessons} from '../../services/lessonService.js'

function createId() {
    return `${Date.now()}-${Math.random()}`
}

function createEmptyChoice() {
    return {
        id: createId(),
        choiceText: "",
        explanation: "",
        imageFile: null,
    }
}

function createEmptySubQuestion() {
    return {
        id: createId(),
        questionText: "",
        correctAnswer: "",
        explanation: "",
        maxScore: "",
    }
}

function getLessonId(lesson) {
    return String(lesson.lessonId ?? lesson.id)
}

function getLessonLabel(lesson) {
    return (
        lesson.lessonName ??
        lesson.lessonTitle ??
        lesson.title ??
        lesson.name ??
        `Lesson #${getLessonId(lesson)}`
    )
}


const PROGRAMMING_LANGUAGES = [
    "Java",
    "JavaScript",
    "Python",
    "C",
    "C++",
    "C#",
    "SQL",
    "Pseudocode",
]

export default function CreateQuestionDialog({
                                                 onClickCreateQuestion
                                             }) {
    const [questionType, setQuestionType] = useState("MULTIPLE_CHOICE")
    const [difficultyLevel, setDifficultyLevel] = useState("")
    const [questionText, setQuestionText] = useState("")
    const [questionImage, setQuestionImage] = useState(null)


    const [choices, setChoices] = useState([
        createEmptyChoice(),
        createEmptyChoice(),
    ])
    const [correctChoiceId, setCorrectChoiceId] = useState("")


    const [expectedAnswer, setExpectedAnswer] = useState("")
    const [explanation, setExplanation] = useState("")


    const [referenceAnswer, setReferenceAnswer] = useState("")
    const [evaluationRubric, setEvaluationRubric] = useState("")
    const [maxScore, setMaxScore] = useState("")


    const [criticalThinkingFormat, setCriticalThinkingFormat] =
        useState("CODING")
    const [programmingLanguage, setProgrammingLanguage] = useState("Java")
    const [starterCode, setStarterCode] = useState("")
    const [subQuestions, setSubQuestions] = useState([
        createEmptySubQuestion(),
    ])

    const isMultipleChoice = questionType === "MULTIPLE_CHOICE"
    const isDescriptive = questionType === "DESCRIPTIVE"
    const isShortAnswer = questionType === "SHORT_ANSWER"
    const isCriticalThinking = questionType === "CRITICAL_THINKING"

    const isCodingProblem =
        isCriticalThinking && criticalThinkingFormat === "CODING"

    const isDiagramProblem =
        isCriticalThinking && criticalThinkingFormat === "DIAGRAM"

    const {data : lessons = []} = useQuery({
        queryKey: ['lessons'],
        queryFn: getAllLessons,
    })
    const [lesson, setLesson] = useState('')

    function handleQuestionTypeChange(value) {
        setQuestionType(value)
    }

    function handleCriticalThinkingFormatChange(value) {
        setCriticalThinkingFormat(value)
    }

    function addChoice() {
        setChoices((currentChoices) => [
            ...currentChoices,
            createEmptyChoice(),
        ])
    }

    function removeChoice(choiceId) {
        if (choices.length <= 2) return

        setChoices((currentChoices) =>
            currentChoices.filter((choice) => choice.id !== choiceId)
        )

        if (correctChoiceId === choiceId) {
            setCorrectChoiceId("")
        }
    }

    function updateChoice(choiceId, field, value) {
        setChoices((currentChoices) =>
            currentChoices.map((choice) =>
                choice.id === choiceId
                    ? {
                        ...choice,
                        [field]: value,
                    }
                    : choice
            )
        )
    }

    function addSubQuestion() {
        setSubQuestions((currentSubQuestions) => [
            ...currentSubQuestions,
            createEmptySubQuestion(),
        ])
    }

    function removeSubQuestion(subQuestionId) {
        if (subQuestions.length <= 1) return

        setSubQuestions((currentSubQuestions) =>
            currentSubQuestions.filter(
                (subQuestion) => subQuestion.id !== subQuestionId
            )
        )
    }

    function updateSubQuestion(subQuestionId, field, value) {
        setSubQuestions((currentSubQuestions) =>
            currentSubQuestions.map((subQuestion) =>
                subQuestion.id === subQuestionId
                    ? {
                        ...subQuestion,
                        [field]: value,
                    }
                    : subQuestion
            )
        )
    }

    function getQuestionLabel() {
        if (isDescriptive) {
            return "Scenario and Instruction"
        }

        if (isCodingProblem) {
            return "Parent Coding Scenario"
        }

        if (isDiagramProblem) {
            return "Parent Diagram Scenario"
        }

        return "Question"
    }

    function getQuestionPlaceholder() {
        if (isDescriptive) {
            return "Enter the scenario and instruction for the learner..."
        }

        if (isCodingProblem) {
            return "Describe the shared programming scenario, rules, inputs, outputs, and constraints for all sub-questions..."
        }

        if (isDiagramProblem) {
            return "Describe the shared system scenario and instructions for analyzing the diagram..."
        }

        return "Type the question here..."
    }

    function getQuestionImageLabel() {
        if (isDiagramProblem) {
            return "Shared Parent Diagram"
        }

        return "Supporting Image"
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" onClick={onClickCreateQuestion}>
                    Create
                </Button>
            </DialogTrigger>

            <DialogContent
                className="h-[calc(100dvh-2rem)]
          w-[calc(100vw-2rem)]
          max-w-none
          overflow-hidden
          rounded-2xl
          border-zinc-200
          bg-white
          p-0

          sm:h-[calc(100dvh-4rem)]
          sm:w-[80vw]
          sm:max-w-[80vw]

          md:w-[65vw]
          md:max-w-[65vw]

          lg:h-[min(700px,calc(100dvh-4rem))]
          lg:w-[55vw]
          lg:max-w-[55vw]
        "
            >
                <div className="flex h-full min-h-0 flex-col">
                    <DialogHeader className="border-b border-zinc-200 px-6 py-5">
                        <DialogTitle className="text-xl font-semibold text-zinc-950">
                            Create Question
                        </DialogTitle>

                        <DialogDescription className="text-sm text-zinc-500">
                            Add a question to your question bank.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <div className="space-y-6">
                            <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Question Type</Label>

                                    <Select
                                        value={questionType}
                                        onValueChange={handleQuestionTypeChange}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select question type" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem value="MULTIPLE_CHOICE">
                                                Multiple Choice
                                            </SelectItem>

                                            <SelectItem value="DESCRIPTIVE">
                                                Descriptive
                                            </SelectItem>

                                            <SelectItem value="SHORT_ANSWER">
                                                Short Answer
                                            </SelectItem>

                                            <SelectItem value="CRITICAL_THINKING">
                                                Critical Thinking
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Difficulty Level</Label>

                                    <Select
                                        value={difficultyLevel}
                                        onValueChange={setDifficultyLevel}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select difficulty" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem value="EASY">Easy</SelectItem>
                                            <SelectItem value="AVERAGE">Average</SelectItem>
                                            <SelectItem value="HARD">Hard</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Lesson</Label>

                                <Select value={lesson} onValueChange={setLesson}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select lesson" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        {lessons.length === 0 ? (
                                            <SelectItem value="no-lessons" disabled>
                                                No lessons available
                                            </SelectItem>
                                        ) : (
                                            lessons.map((item) => (
                                                <SelectItem
                                                    key={item.lessonId}
                                                    value={String(item.lessonId)}
                                                >
                                                    {item.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {isCriticalThinking && (
                                <section className="space-y-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-700 ring-1 ring-zinc-200">
                                            <Code2 className="h-5 w-5" />
                                        </div>

                                        <div>
                                            <h3 className="text-sm font-semibold text-zinc-950">
                                                Critical Thinking Parent Problem
                                            </h3>

                                            <p className="mt-1 text-sm text-zinc-500">
                                                Add one parent coding scenario or one shared diagram.
                                                All sub-questions below will be based on it.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Problem Format</Label>

                                            <Select
                                                value={criticalThinkingFormat}
                                                onValueChange={handleCriticalThinkingFormatChange}
                                            >
                                                <SelectTrigger className="w-full bg-white">
                                                    <SelectValue placeholder="Select problem format" />
                                                </SelectTrigger>

                                                <SelectContent>
                                                    <SelectItem value="CODING">
                                                        Coding Problem
                                                    </SelectItem>

                                                    <SelectItem value="DIAGRAM">
                                                        Diagram Problem
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {isCodingProblem && (
                                            <div className="space-y-2">
                                                <Label>Programming Language</Label>

                                                <Select
                                                    value={programmingLanguage}
                                                    onValueChange={setProgrammingLanguage}
                                                >
                                                    <SelectTrigger className="w-full bg-white">
                                                        <SelectValue placeholder="Select language" />
                                                    </SelectTrigger>

                                                    <SelectContent>
                                                        {PROGRAMMING_LANGUAGES.map((language) => (
                                                            <SelectItem key={language} value={language}>
                                                                {language}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>

                                    {isCodingProblem && (
                                        <div className="space-y-2">
                                            <Label htmlFor="starterCode">
                                                Starter Code or Code Context{" "}
                                                <span className="text-zinc-400">(optional)</span>
                                            </Label>

                                            <Textarea
                                                id="starterCode"
                                                value={starterCode}
                                                onChange={(event) => setStarterCode(event.target.value)}
                                                placeholder={
                                                    "Example:\npublic class Main {\n  public static void main(String[] args) {\n    // Write your solution here\n  }\n}"
                                                }
                                                className="min-h-40 resize-y font-mono text-sm"
                                            />
                                        </div>
                                    )}
                                </section>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="questionText">{getQuestionLabel()}</Label>

                                <Textarea
                                    id="questionText"
                                    value={questionText}
                                    onChange={(event) => setQuestionText(event.target.value)}
                                    placeholder={getQuestionPlaceholder()}
                                    className="min-h-28 resize-y"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="questionImage">
                                    {getQuestionImageLabel()}{" "}
                                    <span className="text-zinc-400">
                    {isDiagramProblem ? "(required)" : "(optional)"}
                  </span>
                                </Label>

                                <Input
                                    id="questionImage"
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) =>
                                        setQuestionImage(event.target.files?.[0] ?? null)
                                    }
                                />

                                {isDiagramProblem && (
                                    <p className="text-xs text-zinc-500">
                                        Upload one ERD, UML, flowchart, architecture diagram, or
                                        another visual that all sub-questions will use.
                                    </p>
                                )}
                            </div>

                            {isMultipleChoice && (
                                <section className="space-y-4 border-t border-zinc-200 pt-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-base font-semibold text-zinc-950">
                                                Answer Choices
                                            </h3>

                                            <p className="mt-1 text-sm text-zinc-500">
                                                Add answer choices and select one correct answer.
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addChoice}
                                        >
                                            <Plus />
                                            Add Choice
                                        </Button>
                                    </div>

                                    <div className="space-y-4">
                                        {choices.map((choice, index) => (
                                            <div
                                                key={choice.id}
                                                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                                            >
                                                <div className="mb-4 flex items-center justify-between gap-3">
                                                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
                                                        <input
                                                            type="radio"
                                                            name="correctChoice"
                                                            checked={correctChoiceId === choice.id}
                                                            onChange={() => setCorrectChoiceId(choice.id)}
                                                            className="h-4 w-4 accent-zinc-950"
                                                        />
                                                        Correct answer
                                                    </label>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={() => removeChoice(choice.id)}
                                                        disabled={choices.length <= 2}
                                                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                        aria-label={`Remove choice ${index + 1}`}
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`choice-${choice.id}`}>
                                                            Choice {index + 1}
                                                        </Label>

                                                        <Input
                                                            id={`choice-${choice.id}`}
                                                            value={choice.choiceText}
                                                            onChange={(event) =>
                                                                updateChoice(
                                                                    choice.id,
                                                                    "choiceText",
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder={`Type choice ${index + 1}`}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor={`choice-image-${choice.id}`}>
                                                            Choice Image{" "}
                                                            <span className="text-zinc-400">
                                (optional)
                              </span>
                                                        </Label>

                                                        <Input
                                                            id={`choice-image-${choice.id}`}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(event) =>
                                                                updateChoice(
                                                                    choice.id,
                                                                    "imageFile",
                                                                    event.target.files?.[0] ?? null
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor={`choice-explanation-${choice.id}`}>
                                                            Explanation{" "}
                                                            <span className="text-zinc-400">
                                (optional)
                              </span>
                                                        </Label>

                                                        <Textarea
                                                            id={`choice-explanation-${choice.id}`}
                                                            value={choice.explanation}
                                                            onChange={(event) =>
                                                                updateChoice(
                                                                    choice.id,
                                                                    "explanation",
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder="Explain why this choice is correct or incorrect..."
                                                            className="min-h-20 resize-y"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {isDescriptive && (
                                <section className="space-y-5 border-t border-zinc-200 pt-6">
                                    <div>
                                        <h3 className="text-base font-semibold text-zinc-950">
                                            Descriptive Question Evaluation
                                        </h3>

                                        <p className="mt-1 text-sm text-zinc-500">
                                            Add the reference answer and scoring criteria that the AI
                                            will use when evaluating the learner’s response.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="referenceAnswer">Reference Answer</Label>

                                        <Textarea
                                            id="referenceAnswer"
                                            value={referenceAnswer}
                                            onChange={(event) =>
                                                setReferenceAnswer(event.target.value)
                                            }
                                            placeholder="Enter a sample high-quality answer with expected technical concepts..."
                                            className="min-h-36 resize-y"
                                        />

                                        <p className="text-xs text-zinc-500">
                                            Include the expected technical concepts, solution steps,
                                            and important details the learner should mention.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="evaluationRubric">
                                            Evaluation Rubric
                                        </Label>

                                        <Textarea
                                            id="evaluationRubric"
                                            value={evaluationRubric}
                                            onChange={(event) =>
                                                setEvaluationRubric(event.target.value)
                                            }
                                            placeholder={
                                                "Example:\n• Identifies the problem correctly — 3 points\n• Gives a valid technical solution — 4 points\n• Explains implementation steps — 3 points"
                                            }
                                            className="min-h-36 resize-y"
                                        />

                                        <p className="text-xs text-zinc-500">
                                            Write the criteria and points the AI must use when
                                            scoring the learner’s answer.
                                        </p>
                                    </div>

                                    <div className="max-w-xs space-y-2">
                                        <Label htmlFor="maxScore">Maximum Score</Label>

                                        <Input
                                            id="maxScore"
                                            type="number"
                                            min="1"
                                            value={maxScore}
                                            onChange={(event) => setMaxScore(event.target.value)}
                                            placeholder="Example: 5, 10, or 15"
                                        />
                                    </div>
                                </section>
                            )}

                            {isShortAnswer && (
                                <section className="space-y-5 border-t border-zinc-200 pt-6">
                                    <div>
                                        <h3 className="text-base font-semibold text-zinc-950">
                                            Expected Short Answer
                                        </h3>

                                        <p className="mt-1 text-sm text-zinc-500">
                                            Add the expected short answer or required key terms.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="expectedAnswer">
                                            Expected Short Answer
                                        </Label>

                                        <Textarea
                                            id="expectedAnswer"
                                            value={expectedAnswer}
                                            onChange={(event) =>
                                                setExpectedAnswer(event.target.value)
                                            }
                                            placeholder="Enter the expected short answer..."
                                            className="min-h-32 resize-y"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="explanation">
                                            Explanation{" "}
                                            <span className="text-zinc-400">(optional)</span>
                                        </Label>

                                        <Textarea
                                            id="explanation"
                                            value={explanation}
                                            onChange={(event) => setExplanation(event.target.value)}
                                            placeholder="Add feedback or an explanation for learners..."
                                            className="min-h-28 resize-y"
                                        />
                                    </div>
                                </section>
                            )}

                            {isCriticalThinking && (
                                <section className="space-y-5 border-t border-zinc-200 pt-6">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-base font-semibold text-zinc-950">
                                                Parent-Based Sub-questions
                                            </h3>

                                            <p className="mt-1 text-sm text-zinc-500">
                                                Each sub-question uses the parent scenario or shared
                                                diagram above, but has its own question and correct
                                                answer.
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addSubQuestion}
                                        >
                                            <Plus />
                                            Add Sub-question
                                        </Button>
                                    </div>

                                    <div className="space-y-4">
                                        {subQuestions.map((subQuestion, index) => (
                                            <div
                                                key={subQuestion.id}
                                                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                                            >
                                                <div className="mb-4 flex items-center justify-between gap-3">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-zinc-950">
                                                            Sub-question {index + 1}
                                                        </h4>

                                                        <p className="mt-1 text-xs text-zinc-500">
                                                            Based on the parent{" "}
                                                            {isDiagramProblem ? "diagram" : "coding problem"}.
                                                        </p>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={() => removeSubQuestion(subQuestion.id)}
                                                        disabled={subQuestions.length <= 1}
                                                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                        aria-label={`Remove sub-question ${index + 1}`}
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`sub-question-${subQuestion.id}`}>
                                                            Sub-question
                                                        </Label>

                                                        <Textarea
                                                            id={`sub-question-${subQuestion.id}`}
                                                            value={subQuestion.questionText}
                                                            onChange={(event) =>
                                                                updateSubQuestion(
                                                                    subQuestion.id,
                                                                    "questionText",
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder={
                                                                isCodingProblem
                                                                    ? "Example: What will be the output when the input value is 10?"
                                                                    : "Example: Identify the relationship between Customer and Order in the diagram."
                                                            }
                                                            className="min-h-24 resize-y"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor={`correct-answer-${subQuestion.id}`}>
                                                            Correct Answer
                                                        </Label>

                                                        <Textarea
                                                            id={`correct-answer-${subQuestion.id}`}
                                                            value={subQuestion.correctAnswer}
                                                            onChange={(event) =>
                                                                updateSubQuestion(
                                                                    subQuestion.id,
                                                                    "correctAnswer",
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder={
                                                                isCodingProblem
                                                                    ? "Enter the correct code, expected output, algorithm, or solution..."
                                                                    : "Enter the correct answer based on the shared diagram..."
                                                            }
                                                            className={`min-h-28 resize-y ${
                                                                isCodingProblem ? "font-mono text-sm" : ""
                                                            }`}
                                                        />
                                                    </div>

                                                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
                                                        <div className="space-y-2">
                                                            <Label
                                                                htmlFor={`sub-explanation-${subQuestion.id}`}
                                                            >
                                                                Explanation{" "}
                                                                <span className="text-zinc-400">
                                  (optional)
                                </span>
                                                            </Label>

                                                            <Textarea
                                                                id={`sub-explanation-${subQuestion.id}`}
                                                                value={subQuestion.explanation}
                                                                onChange={(event) =>
                                                                    updateSubQuestion(
                                                                        subQuestion.id,
                                                                        "explanation",
                                                                        event.target.value
                                                                    )
                                                                }
                                                                placeholder="Explain why this is the correct answer..."
                                                                className="min-h-20 resize-y"
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label htmlFor={`sub-score-${subQuestion.id}`}>
                                                                Max Score
                                                            </Label>

                                                            <Input
                                                                id={`sub-score-${subQuestion.id}`}
                                                                type="number"
                                                                min="1"
                                                                value={subQuestion.maxScore}
                                                                onChange={(event) =>
                                                                    updateSubQuestion(
                                                                        subQuestion.id,
                                                                        "maxScore",
                                                                        event.target.value
                                                                    )
                                                                }
                                                                placeholder="5"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>

                        <Button type="button">Create Question</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}