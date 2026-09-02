import React, { useEffect, useMemo, useRef, useState } from "react";

import {
    AlertCircle,
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Code2,
    Eye,
    FileArchive,
    FileIcon,
    FileQuestion,
    FileSpreadsheet,
    FileText,
    Headphones,
    Image,
    ListChecks,
    Maximize,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Trash2,
    UploadCloud,
    UploadIcon,
    Video,
    Workflow,
    XIcon,
} from "@/components/icons";

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatBytes, useFileUpload } from "@/hooks/use-file-upload";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";

import { getAllCertifications } from "../../services/certificationService.js";
import { getFileViewUrl } from "../../services/fileService.js";
import DiagramArea from "../../components/challenges/diagram-area.jsx";
import BigDialog from "../../components/commons/dialog.jsx";
import AiGenerationProgress from "../../components/commons/ai-generation-progress.jsx";
import { extractDiagramData } from "../../utils/diagram-graph.js";
import {
    DEFAULT_GENERATION_TARGET,
    deleteQuestion,
    generateQuestionsFromFiles,
    getQuestions,
    saveChoices,
    saveDiagramQuestion,
    saveProgrammingQuestion,
    saveQuestion,
    saveTextQuestion,
    updateQuestion,
} from "../../services/questionService.js";

function getBackendErrorMessage(error, fallbackMessage) {
    const responseData = error?.response?.data;
    const status = error?.response?.status;

    if (status === 429) {
        return (
            responseData?.message ||
            "The AI provider is temporarily rate limiting question generation. Please wait a minute and try again."
        );
    }

    return (
        (typeof responseData === "string" && responseData) ||
        responseData?.message ||
        error?.message ||
        fallbackMessage
    );
}

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ALL_FILTER_VALUE = "all";

const PAGE_SIZE = 10;

const questionTypeLabels = {
    MCQ: "Multiple Choice",
    SHORT_ANSWER: "Short Answer",
    DESCRIPTIVE: "Descriptive",
    CRITICAL_THINKING: "Critical Thinking",
    // Written by AI generation, which stores the workspace type directly
    // rather than as CRITICAL_THINKING + criticalThinkingType the way the
    // manual builder does. Unlabelled, the Type column showed the raw enum.
    PROGRAMMING: "Programming",
    DIAGRAM: "Diagram",
};

/**
 * The stored types each filter option should match.
 *
 * Two paths write these and they disagree: the manual builder saves a
 * programming task as CRITICAL_THINKING with criticalThinkingType=PROGRAMMING,
 * while AI generation saves it as PROGRAMMING. Java treats all three as
 * workspace items when grading (`isWorkspaceType`), so the difference is a
 * storage detail -- but the filter compared the stored value to the option
 * verbatim, so "Critical Thinking" matched none of the generated ones and
 * there was no option that did. A TOPCIT bank holding 13 programming tasks and
 * a diagram reported "No questions found".
 */
const QUESTION_TYPE_FILTER_MATCHES = {
    CRITICAL_THINKING: ["CRITICAL_THINKING", "PROGRAMMING", "DIAGRAM"],
    PROGRAMMING: ["PROGRAMMING"],
    DIAGRAM: ["DIAGRAM"],
};

/**
 * Which workspace task a question is, as the server reports it.
 *
 * `questionType` alone cannot answer this: AI generation stores every
 * programming task AND every diagram task as CRITICAL_THINKING, with the
 * difference held in the one-to-one config. `criticalThinkingType` is derived
 * server-side from that config (see QuestionMapper). Falling back to
 * `questionType` keeps the manual builder working, which does write
 * PROGRAMMING/DIAGRAM directly.
 */
function workspaceKindOf(question) {
    return question?.criticalThinkingType ?? question?.questionType ?? null;
}

function matchesQuestionTypeFilter(question, filterValue) {
    if (filterValue === ALL_FILTER_VALUE) return true;
    const questionType = typeof question === "string" ? question : question?.questionType;

    // Programming and Diagram are subsets of CRITICAL_THINKING rather than
    // stored types of their own, so they are matched on the derived kind. The
    // earlier version compared them against questionType and matched nothing.
    if (filterValue === "PROGRAMMING" || filterValue === "DIAGRAM") {
        return workspaceKindOf(typeof question === "string" ? null : question) === filterValue
            || questionType === filterValue;
    }

    const accepted = QUESTION_TYPE_FILTER_MATCHES[filterValue] ?? [filterValue];
    return accepted.includes(questionType);
}

const difficultyLabels = {
    easy: "Easy",
    average: "Average",
    hard: "Hard",
};

const diagramTypeOptions = [
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
];

const diagramTypeLabels = Object.fromEntries(
    diagramTypeOptions.map((diagramType) => [diagramType.value, diagramType.label]),
);

const diagramTypeDescriptions = Object.fromEntries(
    diagramTypeOptions.map((diagramType) => [
        diagramType.value,
        diagramType.description,
    ]),
);

function getDiagramTypeLabel(value) {
    return diagramTypeLabels[value] ?? "Diagram";
}

function getDiagramTypeDescription(value) {
    return diagramTypeDescriptions[value] ?? "Create the correct reference diagram.";
}

const questionTypes = [
    {
        id: "MCQ",
        title: "Multiple Choice",
        description: "Choose from answer options",
        icon: ListChecks,
        component: MultipleChoices,
        data: {
            questionType: "MCQ",
            question: "",
            image: null,
            choices: [
                {
                    choiceText: "",
                    image: null,
                    explanation: "",
                    isCorrect: false,
                },
                {
                    choiceText: "",
                    image: null,
                    explanation: "",
                    isCorrect: false,
                },
                {
                    choiceText: "",
                    image: null,
                    explanation: "",
                    isCorrect: false,
                },
                {
                    choiceText: "",
                    image: null,
                    explanation: "",
                    isCorrect: false,
                },
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
        component: ShortAnswer,
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
        component: Descriptive,
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
        component: Programming,
        data: {
            questionType: "CRITICAL_THINKING",
            criticalThinkingType: "PROGRAMMING",
            question: "",
            image: null,
            starterCode: "",
            testCases: [
                {
                    inputData: "",
                    expectedOutput: "",
                },
            ],
            subQuestions: [],
            difficulty: "average",
        },
    },
    {
        id: "DIAGRAM",
        title: "Diagram",
        description: "Activity, class, component, ERD, flowchart, sequence, UI, or use case problem",
        icon: Workflow,
        component: Diagram,
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
];

function createLocalId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getQuestionFieldName(questionKey, fieldName) {
    return `questions[${questionKey}].${fieldName}`;
}

function cloneQuestionData(data) {
    if (typeof structuredClone === "function") {
        return structuredClone(data);
    }

    return JSON.parse(JSON.stringify(data));
}

function scheduleIdleWork(callback, timeout = 500) {
    if (
        typeof window !== "undefined" &&
        typeof window.requestIdleCallback === "function"
    ) {
        return {
            type: "idle",
            id: window.requestIdleCallback(callback, { timeout }),
        };
    }

    return {
        type: "timeout",
        id: window.setTimeout(callback, timeout),
    };
}

function cancelIdleWork(task) {
    if (!task) {
        return;
    }

    if (
        task.type === "idle" &&
        typeof window !== "undefined" &&
        typeof window.cancelIdleCallback === "function"
    ) {
        window.cancelIdleCallback(task.id);
        return;
    }

    clearTimeout(task.id);
}

function isBlank(value) {
    return typeof value !== "string" || value.trim() === "";
}

function updateDataAtPath(data, path, value) {
    const parts = path.split(".");

    function update(currentValue, index) {
        const key = parts[index];
        const isLastPart = index === parts.length - 1;

        const copy = Array.isArray(currentValue)
            ? [...currentValue]
            : { ...currentValue };

        if (isLastPart) {
            copy[key] = value;
            return copy;
        }

        const nextKey = parts[index + 1];

        const defaultNextValue = /^\d+$/.test(nextKey) ? [] : {};

        copy[key] = update(currentValue?.[key] ?? defaultNextValue, index + 1);

        return copy;
    }

    return update(data, 0);
}

function validateOptionalImage(file, label) {
    if (!file) {
        return "";
    }

    if (typeof File !== "undefined" && !(file instanceof File)) {
        return `${label} is invalid. Please choose the image again.`;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return `${label} must be a JPG, PNG, WebP, or GIF file.`;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return `${label} must be 5 MB or smaller.`;
    }

    return "";
}

function hasSavedDiagram(xml) {
    return typeof xml === "string" && xml.trim().length > 0;
}

function validateSubQuestions(data, errors) {
    const subQuestions = data.subQuestions ?? [];

    subQuestions.forEach((subQuestion, index) => {
        if (isBlank(subQuestion.question)) {
            errors[`subQuestions.${index}.question`] =
                `Sub-question ${index + 1} needs a question.`;
        }

        if (isBlank(subQuestion.correctAnswer)) {
            errors[`subQuestions.${index}.correctAnswer`] =
                `Sub-question ${index + 1} needs an expected answer.`;
        }
    });
}

function validateQuestionData(typeId, data) {
    const errors = {};

    if (isBlank(data.question)) {
        errors.question = "Question prompt is required.";
    }

    const questionImageError = validateOptionalImage(
        data.image,
        "Question image",
    );

    if (questionImageError) {
        errors.image = questionImageError;
    }

    if (typeId === "MCQ") {
        const choices = data.choices ?? [];

        choices.forEach((choice, index) => {
            const letter = String.fromCharCode(65 + index);

            if (isBlank(choice.choiceText)) {
                errors[`choices.${index}.choiceText`] = `Choice ${letter} is required.`;
            }

            const choiceImageError = validateOptionalImage(
                choice.image,
                `Choice ${letter} image`,
            );

            if (choiceImageError) {
                errors[`choices.${index}.image`] = choiceImageError;
            }
        });

        if (
            data.correctChoiceIndex === null ||
            data.correctChoiceIndex === undefined
        ) {
            errors.correctChoiceIndex = "Select which answer choice is correct.";
        }
    }

    if (typeId === "SHORT_ANSWER" && isBlank(data.correctAnswer)) {
        errors.correctAnswer = "Correct answer is required.";
    }

    if (typeId === "DESCRIPTIVE" && isBlank(data.rubricBasedAnswer)) {
        errors.rubricBasedAnswer = "Model answer or rubric is required.";
    }

    if (typeId === "PROGRAMMING") {
        const testCases = data.testCases ?? [];

        if (testCases.length === 0) {
            errors.testCases = "Add at least one programming test case.";
        }

        testCases.forEach((testCase, index) => {
            if (isBlank(testCase.expectedOutput)) {
                errors[`testCases.${index}.expectedOutput`] =
                    `Test case ${index + 1} needs an expected output.`;
            }
        });

        validateSubQuestions(data, errors);
    }

    if (typeId === "DIAGRAM") {
        const labeledNodes =
            data.referenceDiagramNodes?.filter((node) => node.labelKey) ?? [];

        if (
            !hasSavedDiagram(data.referenceDiagramXml) ||
            labeledNodes.length === 0
        ) {
            errors.referenceDiagramXml =
                "Create a reference diagram with at least one labeled node.";
        }

        validateSubQuestions(data, errors);
    }

    return errors;
}

function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return (
        <p className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{message}</span>
        </p>
    );
}

function ImageUpload({
                         id,
                         name,
                         label = "Image",
                         description = "Upload a JPG, PNG, WebP, or GIF image.",
                         file,
                         onFileChange,
                         error,
                     }) {
    const [inputKey, setInputKey] = useState(0);

    function clearImage() {
        onFileChange?.(null);
        setInputKey((currentKey) => currentKey + 1);
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor={id} className="text-xs font-medium">
                    {label}
                    <span className="ml-1 font-normal text-muted-foreground">
            (Optional)
          </span>
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
                onChange={(event) => {
                    onFileChange?.(event.target.files?.[0] ?? null);
                }}
                className={`h-9 cursor-pointer text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/80 ${
                    error ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
            />

            {file?.name ? (
                <p className="truncate text-xs text-muted-foreground">
                    Selected: {file.name}
                </p>
            ) : (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}

            <FieldError message={error} />
        </div>
    );
}

function CompactQuestionCard({
                                 type,
                                 title,
                                 questionNumber,
                                 onRemove,
                                 errors = {},
                                 children,
                             }) {
    const errorCount = Object.keys(errors).length;
    const hasErrors = errorCount > 0;

    return (
        <Card
            data-question-invalid={hasErrors ? "true" : undefined}
            className={`overflow-hidden shadow-sm ${
                hasErrors ? "border-destructive/70" : ""
            }`}
        >
            <CardContent className="space-y-4 p-4">
                <div className="flex min-w-0 items-center gap-2 border-b border-border pb-3">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {questionNumber}.
          </span>

                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {type}
          </span>

                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {title}
                    </p>

                    {hasErrors && (
                        <span className="hidden shrink-0 items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive sm:flex">
              <AlertCircle className="h-3.5 w-3.5" />
                            {errorCount} issue{errorCount === 1 ? "" : "s"}
            </span>
                    )}

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
    );
}

function DifficultySelect({ questionKey, value, onValueChange }) {
    return (
        <>
            <input
                type="hidden"
                name={getQuestionFieldName(questionKey, "difficulty")}
                value={value}
            />

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
                    <SelectItem value="easy" className="min-h-10">
                        Easy
                    </SelectItem>

                    <SelectItem value="average" className="min-h-10">
                        Average
                    </SelectItem>

                    <SelectItem value="hard" className="min-h-10">
                        Hard
                    </SelectItem>
                </SelectContent>
            </Select>
        </>
    );
}

function DiagramTypeSelect({ questionKey, value, onValueChange }) {
    return (
        <>
            <input
                type="hidden"
                name={getQuestionFieldName(questionKey, "diagramType")}
                value={value}
            />

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
                        {diagramTypeOptions.map((diagramType) => (
                            <SelectItem
                                key={diagramType.value}
                                value={diagramType.value}
                                className="min-h-10"
                            >
                                {diagramType.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </>
    );
}


function QuestionMetaFields({ questionKey, data, onFieldChange }) {
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
                    <p className="text-sm font-medium text-foreground">
                        Difficulty Level
                    </p>

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
    );
}

function QuestionPromptFields({
                                  questionKey,
                                  data,
                                  onFieldChange,
                                  errors = {},
                              }) {
    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label
                    htmlFor={`${questionKey}-question-text`}
                    className="text-sm font-medium"
                >
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
                        errors.question
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
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
    );
}

function SubQuestions({
                          questionKey,
                          data,
                          onDataChange,
                          onFieldChange,
                          errors = {},
                      }) {
    const subQuestions = data.subQuestions ?? [];

    function addSubQuestion() {
        onDataChange((currentData) => ({
            ...currentData,
            subQuestions: [
                ...(currentData.subQuestions ?? []),
                {
                    question: "",
                    correctAnswer: "",
                },
            ],
        }));
    }

    function removeSubQuestion(indexToRemove) {
        onDataChange((currentData) => ({
            ...currentData,
            subQuestions: currentData.subQuestions.filter(
                (_, index) => index !== indexToRemove,
            ),
        }));
    }

    return (
        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-foreground">
                        Sub-Questions
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
              (Optional)
            </span>
                    </p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Add follow-up questions based on the main problem.
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSubQuestion}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Sub-Question
                </Button>
            </div>

            {subQuestions.length > 0 && (
                <div className="space-y-3">
                    {subQuestions.map((subQuestion, index) => {
                        const questionError = errors[`subQuestions.${index}.question`];

                        const answerError = errors[`subQuestions.${index}.correctAnswer`];

                        return (
                            <div
                                key={`${questionKey}-sub-question-${index}`}
                                className={`rounded-md border bg-muted/20 p-3 ${
                                    questionError || answerError
                                        ? "border-destructive/70"
                                        : "border-border"
                                }`}
                            >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">
                                        Sub-Question {index + 1}
                                    </p>

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
                                        <Label
                                            htmlFor={`${questionKey}-sub-question-${index}`}
                                            className="text-xs font-medium"
                                        >
                                            Question
                                            <span className="ml-1 text-destructive">*</span>
                                        </Label>

                                        <Textarea
                                            id={`${questionKey}-sub-question-${index}`}
                                            value={subQuestion.question ?? ""}
                                            aria-invalid={Boolean(questionError)}
                                            onChange={(event) =>
                                                onFieldChange(
                                                    `subQuestions.${index}.question`,
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Write the follow-up question..."
                                            className={`min-h-16 resize-y ${
                                                questionError
                                                    ? "border-destructive focus-visible:ring-destructive"
                                                    : ""
                                            }`}
                                        />

                                        <FieldError message={questionError} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label
                                            htmlFor={`${questionKey}-sub-answer-${index}`}
                                            className="text-xs font-medium"
                                        >
                                            Expected Answer
                                            <span className="ml-1 text-destructive">*</span>
                                        </Label>

                                        <Textarea
                                            id={`${questionKey}-sub-answer-${index}`}
                                            value={subQuestion.correctAnswer ?? ""}
                                            aria-invalid={Boolean(answerError)}
                                            onChange={(event) =>
                                                onFieldChange(
                                                    `subQuestions.${index}.correctAnswer`,
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Accepted answer, keywords, or key points..."
                                            className={`min-h-16 resize-y ${
                                                answerError
                                                    ? "border-destructive focus-visible:ring-destructive"
                                                    : ""
                                            }`}
                                        />

                                        <FieldError message={answerError} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MultipleChoices({
                             questionKey,
                             questionNumber,
                             onRemove,
                             data,
                             onDataChange,
                             errors = {},
                         }) {
    const choices = data.choices ?? [];

    function onFieldChange(path, value) {
        onDataChange((currentData) => updateDataAtPath(currentData, path, value));
    }

    function chooseCorrectChoice(correctIndex) {
        onDataChange((currentData) => ({
            ...currentData,
            correctChoiceIndex: correctIndex,
            choices: currentData.choices.map((choice, index) => ({
                ...choice,
                isCorrect: index === correctIndex,
            })),
        }));
    }

    return (
        <CompactQuestionCard
            type="MCQ"
            title="Multiple Choice Question"
            questionNumber={questionNumber}
            onRemove={onRemove}
            errors={errors}
        >
            <QuestionPromptFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
                errors={errors}
            />

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
                        <span className="text-xs font-medium text-destructive">
              Correct answer required
            </span>
                    )}
                </div>

                <RadioGroup
                    value={
                        data.correctChoiceIndex === null
                            ? ""
                            : String(data.correctChoiceIndex)
                    }
                    onValueChange={(value) => chooseCorrectChoice(Number(value))}
                    className="grid gap-3 sm:grid-cols-2"
                >
                    {choices.map((choice, index) => {
                        const letter = String.fromCharCode(65 + index);

                        const choiceError = errors[`choices.${index}.choiceText`];

                        const imageError = errors[`choices.${index}.image`];

                        const isCorrect = data.correctChoiceIndex === index;

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
                                    <RadioGroupItem
                                        id={`${questionKey}-correct-${index}`}
                                        value={String(index)}
                                        className="shrink-0"
                                    />

                                    <Label
                                        htmlFor={`${questionKey}-correct-${index}`}
                                        className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border text-xs font-semibold ${
                                            isCorrect
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "bg-background"
                                        }`}
                                    >
                                        {letter}
                                    </Label>

                                    <Input
                                        name={getQuestionFieldName(
                                            questionKey,
                                            `choices[${index}].choiceText`,
                                        )}
                                        value={choice.choiceText ?? ""}
                                        aria-invalid={Boolean(choiceError)}
                                        onChange={(event) =>
                                            onFieldChange(
                                                `choices.${index}.choiceText`,
                                                event.target.value,
                                            )
                                        }
                                        placeholder={`Choice ${letter}`}
                                        className={`h-8 min-w-0 ${
                                            choiceError
                                                ? "border-destructive focus-visible:ring-destructive"
                                                : ""
                                        }`}
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
                                            name={getQuestionFieldName(
                                                questionKey,
                                                `choices[${index}].image`,
                                            )}
                                            label="Choice Image"
                                            file={choice.image}
                                            error={imageError}
                                            onFileChange={(file) =>
                                                onFieldChange(`choices.${index}.image`, file)
                                            }
                                            description="Optional image for this answer choice."
                                        />

                                        <Textarea
                                            value={choice.explanation ?? ""}
                                            onChange={(event) =>
                                                onFieldChange(
                                                    `choices.${index}.explanation`,
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Optional explanation shown after answering..."
                                            className="min-h-16 resize-y text-xs"
                                        />
                                    </div>
                                </details>
                            </div>
                        );
                    })}
                </RadioGroup>

                <FieldError message={errors.correctChoiceIndex} />
            </div>

            <QuestionMetaFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
            />
        </CompactQuestionCard>
    );
}

function ShortAnswer({
                         questionKey,
                         questionNumber,
                         onRemove,
                         data,
                         onDataChange,
                         errors = {},
                     }) {
    function onFieldChange(path, value) {
        onDataChange((currentData) => updateDataAtPath(currentData, path, value));
    }

    return (
        <CompactQuestionCard
            type="Short Answer"
            title="Short Answer Question"
            questionNumber={questionNumber}
            onRemove={onRemove}
            errors={errors}
        >
            <QuestionPromptFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
                errors={errors}
            />

            <div className="space-y-2 border-t border-border pt-4">
                <Label
                    htmlFor={`${questionKey}-correct-answer`}
                    className="text-sm font-medium"
                >
                    Correct Answer
                    <span className="ml-1 text-destructive">*</span>
                </Label>

                <Textarea
                    id={`${questionKey}-correct-answer`}
                    value={data.correctAnswer ?? ""}
                    aria-invalid={Boolean(errors.correctAnswer)}
                    onChange={(event) =>
                        onFieldChange("correctAnswer", event.target.value)
                    }
                    placeholder="Enter the exact answer or accepted keywords..."
                    className={`min-h-20 resize-y ${
                        errors.correctAnswer
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                    }`}
                />

                <p className="text-xs text-muted-foreground">
                    Short answers use exact-match checking automatically.
                </p>

                <FieldError message={errors.correctAnswer} />
            </div>

            <QuestionMetaFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
            />
        </CompactQuestionCard>
    );
}

function Descriptive({
                         questionKey,
                         questionNumber,
                         onRemove,
                         data,
                         onDataChange,
                         errors = {},
                     }) {
    function onFieldChange(path, value) {
        onDataChange((currentData) => updateDataAtPath(currentData, path, value));
    }

    return (
        <CompactQuestionCard
            type="Descriptive"
            title="Descriptive Question"
            questionNumber={questionNumber}
            onRemove={onRemove}
            errors={errors}
        >
            <QuestionPromptFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
                errors={errors}
            />

            <div className="space-y-2 border-t border-border pt-4">
                <Label
                    htmlFor={`${questionKey}-rubric`}
                    className="text-sm font-medium"
                >
                    Model Answer / Rubric
                    <span className="ml-1 text-destructive">*</span>
                </Label>

                <Textarea
                    id={`${questionKey}-rubric`}
                    value={data.rubricBasedAnswer ?? ""}
                    aria-invalid={Boolean(errors.rubricBasedAnswer)}
                    onChange={(event) =>
                        onFieldChange("rubricBasedAnswer", event.target.value)
                    }
                    placeholder="Write the expected explanation, key points, or grading guide..."
                    className={`min-h-28 resize-y ${
                        errors.rubricBasedAnswer
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                    }`}
                />

                <p className="text-xs text-muted-foreground">
                    Descriptive answers use the rubric automatically.
                </p>

                <FieldError message={errors.rubricBasedAnswer} />
            </div>

            <QuestionMetaFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
            />
        </CompactQuestionCard>
    );
}

function Programming({
                         questionKey,
                         questionNumber,
                         onRemove,
                         data,
                         onDataChange,
                         errors = {},
                     }) {
    const testCases = data.testCases ?? [];

    function onFieldChange(path, value) {
        onDataChange((currentData) => updateDataAtPath(currentData, path, value));
    }

    function addTestCase() {
        onDataChange((currentData) => ({
            ...currentData,
            testCases: [
                ...(currentData.testCases ?? []),
                {
                    inputData: "",
                    expectedOutput: "",
                },
            ],
        }));
    }

    function removeTestCase(indexToRemove) {
        if (testCases.length === 1) {
            return;
        }

        onDataChange((currentData) => ({
            ...currentData,
            testCases: currentData.testCases.filter(
                (_, index) => index !== indexToRemove,
            ),
        }));
    }

    return (
        <CompactQuestionCard
            type="Programming"
            title="Programming Question"
            questionNumber={questionNumber}
            onRemove={onRemove}
            errors={errors}
        >
            <QuestionPromptFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
                errors={errors}
            />

            <div className="space-y-2 border-t border-border pt-4">
                <Label
                    htmlFor={`${questionKey}-starter-code`}
                    className="text-sm font-medium"
                >
                    Starter Code
                    <span className="ml-1 font-normal text-muted-foreground">
            (Optional)
          </span>
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

            <div
                className={`space-y-3 rounded-md border border-dashed p-3 ${
                    errors.testCases
                        ? "border-destructive/70 bg-destructive/5"
                        : "border-border"
                }`}
            >
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

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addTestCase}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Test Case
                    </Button>
                </div>

                <FieldError message={errors.testCases} />

                <div className="space-y-3">
                    {testCases.map((testCase, index) => {
                        const expectedOutputError =
                            errors[`testCases.${index}.expectedOutput`];

                        return (
                            <div
                                key={`${questionKey}-test-case-${index}`}
                                className={`rounded-md border p-3 ${
                                    expectedOutputError
                                        ? "border-destructive/70 bg-destructive/5"
                                        : "border-border bg-muted/20"
                                }`}
                            >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">
                                        Test Case {index + 1}
                                    </p>

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
                                        <Label
                                            htmlFor={`${questionKey}-test-case-${index}-input`}
                                            className="text-xs font-medium"
                                        >
                                            Input Data
                                            <span className="ml-1 font-normal text-muted-foreground">
                        (Optional)
                      </span>
                                        </Label>

                                        <Textarea
                                            id={`${questionKey}-test-case-${index}-input`}
                                            value={testCase.inputData ?? ""}
                                            onChange={(event) =>
                                                onFieldChange(
                                                    `testCases.${index}.inputData`,
                                                    event.target.value,
                                                )
                                            }
                                            spellCheck={false}
                                            placeholder={"Example:\n5\n10 20 30 40 50"}
                                            className="min-h-20 resize-y font-mono text-xs"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label
                                            htmlFor={`${questionKey}-test-case-${index}-output`}
                                            className="text-xs font-medium"
                                        >
                                            Expected Output
                                            <span className="ml-1 text-destructive">*</span>
                                        </Label>

                                        <Textarea
                                            id={`${questionKey}-test-case-${index}-output`}
                                            value={testCase.expectedOutput ?? ""}
                                            aria-invalid={Boolean(expectedOutputError)}
                                            onChange={(event) =>
                                                onFieldChange(
                                                    `testCases.${index}.expectedOutput`,
                                                    event.target.value,
                                                )
                                            }
                                            spellCheck={false}
                                            placeholder="Example: 150"
                                            className={`min-h-20 resize-y font-mono text-xs ${
                                                expectedOutputError
                                                    ? "border-destructive focus-visible:ring-destructive"
                                                    : ""
                                            }`}
                                        />

                                        <FieldError message={expectedOutputError} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <SubQuestions
                questionKey={questionKey}
                data={data}
                onDataChange={onDataChange}
                onFieldChange={onFieldChange}
                errors={errors}
            />

            <QuestionMetaFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
            />
        </CompactQuestionCard>
    );
}

function Diagram({
                     questionKey,
                     questionNumber,
                     onRemove,
                     data,
                     onDataChange,
                     errors = {},
                 }) {
    const diagramTimerRef = useRef(null);

    useEffect(() => {
        return () => cancelIdleWork(diagramTimerRef.current);
    }, []);

    function onFieldChange(path, value) {
        onDataChange((currentData) => updateDataAtPath(currentData, path, value));
    }

    function handleReferenceDiagramChange(xml) {
        cancelIdleWork(diagramTimerRef.current);

        diagramTimerRef.current = scheduleIdleWork(() => {
            try {
                const { nodes, edges } = extractDiagramData(xml);

                onDataChange((currentData) => ({
                    ...currentData,
                    referenceDiagramXml: xml,
                    referenceDiagramNodes: nodes,
                    referenceDiagramEdges: edges,
                }));
            } catch (error) {
                console.error(
                    "Could not extract diagram nodes and connections:",
                    error,
                );

                onDataChange((currentData) => ({
                    ...currentData,
                    referenceDiagramXml: xml,
                    referenceDiagramNodes: [],
                    referenceDiagramEdges: [],
                }));
            }
        }, 600);
    }

    const diagramTypeLabel = getDiagramTypeLabel(data.diagramType);
    const diagramTypeDescription = getDiagramTypeDescription(data.diagramType);

    const hasDiagram = hasSavedDiagram(data.referenceDiagramXml);

    return (
        <CompactQuestionCard
            type="Diagram"
            title="Diagram Question"
            questionNumber={questionNumber}
            onRemove={onRemove}
            errors={errors}
        >
            <QuestionPromptFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
                errors={errors}
            />

            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Diagram Type</Label>

                    <DiagramTypeSelect
                        questionKey={questionKey}
                        value={data.diagramType}
                        onValueChange={(value) => onFieldChange("diagramType", value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor={`${questionKey}-instructions`}
                        className="text-sm font-medium"
                    >
                        Instructions
                        <span className="ml-1 font-normal text-muted-foreground">
              (Optional)
            </span>
                    </Label>

                    <Input
                        id={`${questionKey}-instructions`}
                        value={data.instructions ?? ""}
                        onChange={(event) =>
                            onFieldChange("instructions", event.target.value)
                        }
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

            <section
                className={`overflow-hidden rounded-xl border bg-background ${
                    errors.referenceDiagramXml ? "border-destructive/70" : "border-border"
                }`}
            >
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

                            <p
                                className={`mt-2 text-xs font-medium ${
                                    hasDiagram ? "text-primary" : "text-muted-foreground"
                                }`}
                            >
                                {hasDiagram
                                    ? "Reference diagram saved automatically."
                                    : "No reference diagram created yet."}
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
                            <div className="h-full w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
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

            <SubQuestions
                questionKey={questionKey}
                data={data}
                onDataChange={onDataChange}
                onFieldChange={onFieldChange}
                errors={errors}
            />

            <QuestionMetaFields
                questionKey={questionKey}
                data={data}
                onFieldChange={onFieldChange}
            />
        </CompactQuestionCard>
    );
}


function getQuestionGenerationFileIcon(file) {
    const fileType = file.file?.type ?? "";
    const fileName = (file.file?.name ?? "").toLowerCase();

    if (
        fileType.includes("pdf") ||
        fileName.endsWith(".pdf") ||
        fileType.includes("word") ||
        fileName.endsWith(".doc") ||
        fileName.endsWith(".docx")
    ) {
        return <FileText className="h-4 w-4 opacity-60" />;
    }

    if (
        fileType.includes("zip") ||
        fileType.includes("archive") ||
        fileName.endsWith(".zip") ||
        fileName.endsWith(".rar")
    ) {
        return <FileArchive className="h-4 w-4 opacity-60" />;
    }

    if (
        fileType.includes("csv") ||
        fileType.includes("excel") ||
        fileName.endsWith(".csv") ||
        fileName.endsWith(".xls") ||
        fileName.endsWith(".xlsx")
    ) {
        return <FileSpreadsheet className="h-4 w-4 opacity-60" />;
    }

    if (fileType.includes("video/")) {
        return <Video className="h-4 w-4 opacity-60" />;
    }

    if (fileType.includes("audio/")) {
        return <Headphones className="h-4 w-4 opacity-60" />;
    }

    if (fileType.startsWith("image/")) {
        return <Image className="h-4 w-4 opacity-60" />;
    }

    return <FileIcon className="h-4 w-4 opacity-60" />;
}

function getQuestionGenerationFileType(file) {
    const fileType = file.file?.type ?? "";
    const fileName = (file.file?.name ?? "").toLowerCase();

    if (fileType.includes("pdf") || fileName.endsWith(".pdf")) {
        return "PDF";
    }

    if (
        fileType.includes("word") ||
        fileName.endsWith(".doc") ||
        fileName.endsWith(".docx")
    ) {
        return "WORD";
    }

    if (fileType.includes("csv") || fileName.endsWith(".csv")) {
        return "CSV";
    }

    return fileType.split("/")[1]?.toUpperCase() || "UNKNOWN";
}

function QuestionFileGeneratorDialog({
                                         open,
                                         onOpenChange,
                                         onGenerate,
                                         selectedCertification,
                                         isGenerating = false,
                                     }) {
    const maxFiles = 10;
    // Matches AiUploadValidator.MAX_FILE_SIZE_BYTES and the certification
    // uploader. A real handbook runs past 10MB -- TOPCIT's Business guide is
    // 12.2MB -- and a stricter client cap just refuses a file the server
    // would have taken.
    const maxSizeMB = 50;
    const maxSize = maxSizeMB * 1024 * 1024;

    const [submitError, setSubmitError] = useState("");
    const [generationOptions, setGenerationOptions] = useState({
        total: DEFAULT_GENERATION_TARGET,
        questionType: "AUTO",
        easy: Math.floor(DEFAULT_GENERATION_TARGET / 3),
        average: DEFAULT_GENERATION_TARGET - 2 * Math.floor(DEFAULT_GENERATION_TARGET / 3),
        hard: Math.floor(DEFAULT_GENERATION_TARGET / 3),
    });

    const [
        { files, isDragging, errors },
        {
            handleDragEnter,
            handleDragLeave,
            handleDragOver,
            handleDrop,
            openFileDialog,
            removeFile,
            clearFiles,
            getInputProps,
        },
    ] = useFileUpload({
        accept: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/csv",
            ".pdf",
            ".doc",
            ".docx",
            ".csv",
        ].join(","),
        initialFiles: [],
        maxFiles,
        maxSize,
        multiple: true,
    });

    function resetGeneratorForm() {
        clearFiles();
        setSubmitError("");
    }

    function handleDialogOpenChange(nextOpen) {
        if (isGenerating) {
            return;
        }

        if (!nextOpen) {
            resetGeneratorForm();
        }

        onOpenChange(nextOpen);
    }

    function handleCancel() {
        if (isGenerating) {
            return;
        }

        resetGeneratorForm();
        onOpenChange(false);
    }

    async function handleGenerate() {
        // Files are optional: with none, the AI generates from the
        // certification's indexed knowledge (embeddings). With files, it uses
        // the uploaded material. The backend resolves the source mode.
        const selectedDocuments = files.map((item) => item.file);

        setSubmitError("");

        const difficultyTotal = generationOptions.easy + generationOptions.average + generationOptions.hard;
        if (generationOptions.total < 1 || generationOptions.total > 100) {
            setSubmitError("Number of items must be between 1 and 100.");
            return;
        }
        if (difficultyTotal !== generationOptions.total) {
            setSubmitError("Easy, average, and hard counts must equal the total number of items.");
            return;
        }

        try {
            await onGenerate(selectedDocuments, generationOptions);
            resetGeneratorForm();
        } catch (error) {
            setSubmitError(
                getBackendErrorMessage(
                    error,
                    "REBYU could not generate questions. Please try again.",
                ),
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Generate Questions</DialogTitle>

                    <DialogDescription className="leading-6">
                        Generate draft questions for{" "}
                        <span className="font-medium text-foreground">
                            {getCertificationTitle(selectedCertification)}
                        </span>
                        . Uploading files is optional — leave it empty to
                        generate from the certification's existing knowledge, or
                        add files to ground generation in specific material.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <section className="space-y-4 rounded-xl border p-4">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Question setup</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Choose the number, type, and exact difficulty distribution.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="ai-question-total">Number of items</Label>
                                <Input
                                    id="ai-question-total"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={generationOptions.total}
                                    disabled={isGenerating}
                                    onChange={(event) => setGenerationOptions((current) => ({
                                        ...current,
                                        total: Number(event.target.value) || 0,
                                    }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Question type</Label>
                                <Select
                                    value={generationOptions.questionType}
                                    disabled={isGenerating}
                                    onValueChange={(questionType) => setGenerationOptions((current) => ({
                                        ...current,
                                        questionType,
                                    }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AUTO">AI-selected mix</SelectItem>
                                        <SelectItem value="MCQ">Multiple Choice</SelectItem>
                                        <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                                        <SelectItem value="DESCRIPTIVE">Descriptive</SelectItem>
                                        <SelectItem value="PROGRAMMING">Programming</SelectItem>
                                        <SelectItem value="DIAGRAM">Diagram</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {[
                                ["easy", "Easy"],
                                ["average", "Average"],
                                ["hard", "Hard"],
                            ].map(([field, label]) => (
                                <div key={field} className="space-y-2">
                                    <Label htmlFor={`ai-question-${field}`}>{label}</Label>
                                    <Input
                                        id={`ai-question-${field}`}
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={generationOptions[field]}
                                        disabled={isGenerating}
                                        onChange={(event) => setGenerationOptions((current) => ({
                                            ...current,
                                            [field]: Math.max(0, Number(event.target.value) || 0),
                                        }))}
                                    />
                                </div>
                            ))}
                        </div>

                        <p className={`text-xs ${
                            generationOptions.easy + generationOptions.average + generationOptions.hard === generationOptions.total
                                ? "text-muted-foreground"
                                : "font-medium text-destructive"
                        }`}>
                            Difficulty total: {generationOptions.easy + generationOptions.average + generationOptions.hard} of {generationOptions.total} items
                        </p>
                    </section>

                    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Sparkles className="h-5 w-5" />
                            </div>

                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-foreground">
                                    AI-selected question types
                                </h3>

                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    You do not need to choose MCQ, short answer,
                                    descriptive, programming, or diagram manually.
                                    REBYU analyzes the uploaded content first and creates
                                    only the question types supported by the material.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-border bg-background p-3">
                                <div className="flex items-center gap-2">
                                    <ListChecks className="h-4 w-4 text-primary" />
                                    <p className="text-sm font-medium text-foreground">
                                        Concepts and terminology
                                    </p>
                                </div>

                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Definitions, processes, classifications, and rules may
                                    become MCQ, short-answer, or descriptive drafts.
                                </p>
                            </div>

                            <div className="rounded-lg border border-border bg-background p-3">
                                <div className="flex items-center gap-2">
                                    <Code2 className="h-4 w-4 text-primary" />
                                    <p className="text-sm font-medium text-foreground">
                                        Programming material
                                    </p>
                                </div>

                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Programming questions appear only when REBYU detects
                                    code, algorithms, pseudocode, or coding lessons.
                                </p>
                            </div>

                            <div className="rounded-lg border border-border bg-background p-3">
                                <div className="flex items-center gap-2">
                                    <Workflow className="h-4 w-4 text-primary" />
                                    <p className="text-sm font-medium text-foreground">
                                        Diagram material
                                    </p>
                                </div>

                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Diagram questions appear only when the material supports
                                    activity diagrams, class diagrams, component diagrams, ER diagrams, flowcharts, sequence diagrams, UI designs, or use case diagrams.
                                </p>
                            </div>

                            <div className="rounded-lg border border-border bg-background p-3">
                                <div className="flex items-center gap-2">
                                    <Pencil className="h-4 w-4 text-primary" />
                                    <p className="text-sm font-medium text-foreground">
                                        Author review
                                    </p>
                                </div>

                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Questions are editable drafts. Authors still create
                                    reference diagrams manually before saving.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Source files (optional)
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Optionally upload modules, reviewer notes, or reference
                                documents to ground the drafts. Leave empty to generate
                                from the certification's existing indexed knowledge.
                            </p>
                        </div>

                        <div
                            className="flex min-h-64 flex-col items-center overflow-hidden rounded-xl border border-input border-dashed p-5 transition-colors not-data-[files]:justify-center has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50"
                            data-dragging={isDragging || undefined}
                            data-files={files.length > 0 || undefined}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            <input
                                {...getInputProps()}
                                aria-label="Upload source documents for AI question generation"
                                className="sr-only"
                            />

                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border bg-background">
                                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                                </div>

                                <p className="text-sm font-semibold text-foreground">
                                    Upload learning materials
                                </p>

                                <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                                    PDF, DOC, DOCX, or CSV · Maximum {maxFiles} files · Up
                                    to {formatBytes(maxSize)} each
                                </p>

                                <Button
                                    type="button"
                                    className="mt-4"
                                    onClick={openFileDialog}
                                    variant="outline"
                                    disabled={isGenerating}
                                >
                                    <UploadIcon className="mr-2 h-4 w-4" />
                                    Select Files
                                </Button>
                            </div>
                        </div>

                        {files.length > 0 && (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-sm font-medium text-foreground">
                                            Ready for AI analysis
                                        </h4>

                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {files.length} of {maxFiles} file
                                            {files.length === 1 ? "" : "s"} selected
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            onClick={openFileDialog}
                                            size="sm"
                                            variant="outline"
                                            disabled={isGenerating}
                                        >
                                            <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                                            Add Files
                                        </Button>

                                        <Button
                                            type="button"
                                            onClick={clearFiles}
                                            size="sm"
                                            variant="outline"
                                            disabled={isGenerating}
                                        >
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                            Remove All
                                        </Button>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-lg border bg-background">
                                    <Table>
                                        <TableHeader className="text-xs">
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="h-9 py-2">
                                                    File
                                                </TableHead>

                                                <TableHead className="h-9 py-2">
                                                    Type
                                                </TableHead>

                                                <TableHead className="h-9 py-2">
                                                    Size
                                                </TableHead>

                                                <TableHead className="h-9 w-0 py-2 text-right">
                                                    Actions
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody className="text-[13px]">
                                            {files.map((file) => (
                                                <TableRow key={file.id}>
                                                    <TableCell className="max-w-56 py-2 font-medium">
                                                        <span className="flex items-center gap-2">
                                                            <span className="shrink-0">
                                                                {getQuestionGenerationFileIcon(file)}
                                                            </span>

                                                            <span className="truncate">
                                                                {file.file.name}
                                                            </span>
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="py-2 text-muted-foreground">
                                                        {getQuestionGenerationFileType(file)}
                                                    </TableCell>

                                                    <TableCell className="py-2 text-muted-foreground">
                                                        {formatBytes(file.file.size)}
                                                    </TableCell>

                                                    <TableCell className="whitespace-nowrap py-2 text-right">
                                                        <Button
                                                            type="button"
                                                            aria-label={`Open ${file.file.name}`}
                                                            className="h-8 w-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
                                                            onClick={() =>
                                                                window.open(
                                                                    file.preview,
                                                                    "_blank",
                                                                    "noopener,noreferrer",
                                                                )
                                                            }
                                                            size="icon"
                                                            variant="ghost"
                                                            disabled={isGenerating}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            aria-label={`Remove ${file.file.name}`}
                                                            className="h-8 w-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
                                                            onClick={() => removeFile(file.id)}
                                                            size="icon"
                                                            variant="ghost"
                                                            disabled={isGenerating}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}

                        {(submitError || errors.length > 0) && (
                            <div
                                className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                                role="alert"
                            >
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>{submitError || errors[0]}</span>
                            </div>
                        )}
                    </section>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isGenerating}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                    >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {isGenerating
                            ? "Generating Drafts..."
                            : files.length > 0
                                ? "Generate from Files"
                                : "Generate from Certification Knowledge"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}


function QuestionTypeButton({ questionType, onAdd, disabled }) {
    const Icon = questionType.icon;

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
    );
}

function EmptyState({ icon: Icon, title, description, size = "lg" }) {
    if (size === "sm") {
        return (
            <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center">
                <p className="text-sm font-medium text-foreground">{title}</p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-dashed border-border bg-background px-6 py-16 text-center">
            <Icon className="mx-auto h-7 w-7 text-muted-foreground" />

            <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>

            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function FeedbackDialog({ open, type, title, description, onClose }) {
    const isSuccess = type === "success";

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div
                        className={`mb-2 flex h-11 w-11 items-center justify-center rounded-full ${
                            isSuccess
                                ? "bg-primary/10 text-primary"
                                : "bg-amber-500/10 text-amber-600"
                        }`}
                    >
                        {isSuccess ? (
                            <CheckCircle2 className="h-6 w-6" />
                        ) : (
                            <AlertCircle className="h-6 w-6" />
                        )}
                    </div>

                    <DialogTitle>{title}</DialogTitle>

                    <DialogDescription className="leading-6">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-end pt-2">
                    <Button type="button" onClick={onClose}>
                        Okay
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function getCertificationValue(certification) {
    return String(
        certification.certificationId ??
        certification.id ??
        certification.title ??
        certification.name ??
        "unknown-certification",
    );
}

function getCertificationTitle(certification) {
    if (!certification || typeof certification !== "object") {
        return "Selected certification";
    }

    return certification.title ?? certification.name ?? "Untitled Certification";
}

function getCertificationLessons(certification) {
    if (!certification) {
        return [];
    }

    return (certification.majorCategory ?? []).flatMap(
        (majorCategory, majorIndex) =>
            (majorCategory.middleCategory ?? []).flatMap(
                (middleCategory, middleIndex) =>
                    (middleCategory.lessons ?? []).map((lesson, lessonIndex) => ({
                        id: String(
                            lesson.lessonId ??
                            lesson.id ??
                            `${majorIndex}-${middleIndex}-${lessonIndex}`,
                        ),
                        numericId: lesson.lessonId ?? lesson.id ?? null,
                        name: lesson.name ?? lesson.title ?? "Untitled Lesson",
                        majorCategoryTitle: majorCategory.title ?? "Untitled Category",
                        middleCategoryTitle: middleCategory.title ?? "Untitled Category",
                    })),
            ),
    );
}

function getQuestionTypeLabel(questionType) {
    return questionTypeLabels[questionType] ?? questionType ?? "Unknown";
}

function getDifficultyLabel(difficulty) {
    return difficultyLabels[difficulty] ?? difficulty ?? "Unknown";
}

const QuestionCardWrapper = React.memo(function QuestionCardWrapper({
                                                                        question,
                                                                        index,
                                                                        validationErrors,
                                                                        onRemove,
                                                                        onDataChange,
                                                                    }) {
    const questionType = questionTypes.find(
        (item) => item.id === question.typeId,
    );

    if (!questionType) return null;

    const QuestionComponent = questionType.component;

    return (
        <QuestionComponent
            questionKey={question.id}
            questionNumber={index + 1}
            data={question.data}
            errors={validationErrors[question.id] ?? {}}
            onRemove={onRemove}
            onDataChange={onDataChange}
        />
    );
});

// `certificationId` locks the bank to a single certification: the certification
// pickers disappear and every tab works against that one. Passed in when the
// bank is embedded as a tab on the view-certification page.
function QuestionBank({
    certificationId = null,
    embedded = false,
    initialTab = "all-questions",
    initialBuilderMode = "",
}) {
    const navigate = useNavigate();
    const lockedCertificationId = certificationId ? String(certificationId) : "";
    const isLockedToCertification = Boolean(lockedCertificationId);

    const [activeTab, setActiveTab] = useState(initialTab);
    // Sub-mode inside the single Question Builder tab. "" shows the centered
    // Create Manually / Generate with AI chooser; selecting one swaps the same
    // builder area in place (manual form vs AI generation interface).
    const [builderMode, setBuilderMode] = useState(initialBuilderMode);

    const [filterCertificationId, setFilterCertificationId] =
        useState(lockedCertificationId);

    const [filterLessonId, setFilterLessonId] = useState(ALL_FILTER_VALUE);

    const [filterQuestionType, setFilterQuestionType] =
        useState(ALL_FILTER_VALUE);

    const [filterDifficulty, setFilterDifficulty] = useState(ALL_FILTER_VALUE);





    const [questionPage, setQuestionPage] = useState(1);

    const [selectedCertificationId, setSelectedCertificationId] =
        useState(lockedCertificationId);

    const [selectedLesson, setSelectedLesson] = useState(null);

    const [lessonSearch, setLessonSearch] = useState("");

    const [questions, setQuestions] = useState([]);

    const [validationErrors, setValidationErrors] = useState({});

    const [isSavingQuestions, setIsSavingQuestions] = useState(false);

    const [isQuestionFileGeneratorOpen, setIsQuestionFileGeneratorOpen] =
        useState(false);

    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);


    const [isUpdatingQuestion, setIsUpdatingQuestion] = useState(false);

    const [feedbackDialog, setFeedbackDialog] = useState({
        open: false,
        type: "success",
        title: "",
        description: "",
    });

    const [questionDialog, setQuestionDialog] = useState({
        open: false,
        mode: "view",
        question: null,
    });

    const [questionForm, setQuestionForm] = useState(null);

    /* The same key the page framing this bank reads under, so the two share
       one fetch. They were on different keys for the identical call, which
       meant every visit here fetched the certification list twice over -- once
       to title the header, once to fill the pickers -- and the second copy was
       never the one on screen first. Still under the "admin-certifications"
       prefix, so the invalidations that follow a certification edit reach it. */
    const {
        data: certifications = [],
        isPending,
        isError,
    } = useQuery({
        queryKey: ["admin-certifications", "question-bank-page"],
        queryFn: () => getAllCertifications(),
        staleTime: 5 * 60 * 1000,
    });

    /* Scoped to the certification this bank is locked to, rather than fetched
       whole and narrowed below.

       The filter further down still discards everything outside this
       certification's lessons, so the displayed set is unchanged -- what
       changes is that the discarding no longer happens after every question on
       the platform has been read, mapped and sent. Unlocked (no certification
       passed), this is the whole-bank read it always was. */
    const {
        data: allQuestions = [],
        isPending: isQuestionsPending,
        isError: isQuestionsError,
        refetch: refetchQuestions,
    } = useQuery({
        /* "certification" is in the key, not just the id: the assessment
           question picker already caches under ["questions", <groupId>], and a
           bare id here would collide with a group id that happened to match --
           two different reads quietly sharing one cache entry. */
        queryKey: ["questions", "certification", lockedCertificationId || null],
        queryFn: () =>
            getQuestions(
                undefined,
                lockedCertificationId ? Number(lockedCertificationId) : undefined,
            ),
    });

    const selectedCertification = useMemo(() => {
        return certifications.find(
            (certification) =>
                getCertificationValue(certification) === selectedCertificationId,
        );
    }, [certifications, selectedCertificationId]);

    const selectedFilterCertification = useMemo(() => {
        return certifications.find(
            (certification) =>
                getCertificationValue(certification) === filterCertificationId,
        );
    }, [certifications, filterCertificationId]);

    const filterLessons = useMemo(
        () => getCertificationLessons(selectedFilterCertification),
        [selectedFilterCertification],
    );

    const builderLessons = useMemo(
        () => getCertificationLessons(selectedCertification),
        [selectedCertification],
    );

    const filterLessonMap = useMemo(
        () =>
            new Map(
                filterLessons.map((lesson) => [
                    String(lesson.numericId ?? lesson.id),
                    lesson,
                ]),
            ),
        [filterLessons],
    );

    const filteredQuestions = useMemo(() => {
        if (!selectedFilterCertification) {
            return [];
        }

        const allowedLessonIds = new Set(
            filterLessons.map((lesson) => String(lesson.numericId ?? lesson.id)),
        );






        return allQuestions.filter((question) => {
            const questionLessonId = String(question.lessonId ?? "");

            if (!allowedLessonIds.has(questionLessonId)) {
                return false;
            }

            if (
                filterLessonId !== ALL_FILTER_VALUE &&
                questionLessonId !== filterLessonId
            ) {
                return false;
            }

            // The whole question, not just its type: Programming and Diagram
            // are told apart by `criticalThinkingType`, which the type string
            // alone does not carry.
            if (!matchesQuestionTypeFilter(question, filterQuestionType)) {
                return false;
            }

            if (
                filterDifficulty !== ALL_FILTER_VALUE &&
                question.difficultyLevel !== filterDifficulty
            ) {
                return false;
            }





            return true;
        });
    }, [
        allQuestions,
        filterDifficulty,
        filterLessonId,
        filterLessons,
        filterQuestionType,
        selectedFilterCertification,
    ]);

    const questionPageCount = Math.max(
        1,
        Math.ceil(filteredQuestions.length / PAGE_SIZE),
    );

    const paginatedQuestions = useMemo(() => {
        const startIndex = (questionPage - 1) * PAGE_SIZE;
        return filteredQuestions.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredQuestions, questionPage]);

    const normalizedLessonSearch = lessonSearch.trim().toLowerCase();

    const visibleStructure = useMemo(() => {
        if (!selectedCertification) {
            return [];
        }

        return (selectedCertification.majorCategory ?? [])
            .map((majorCategory, majorIndex) => ({
                ...majorCategory,
                key: `major-${majorIndex}`,
                visibleMiddleCategories: (majorCategory.middleCategory ?? [])
                    .map((middleCategory, middleIndex) => ({
                        ...middleCategory,
                        key: `middle-${majorIndex}-${middleIndex}`,
                        visibleLessons: (middleCategory.lessons ?? []).filter((lesson) =>
                            (lesson.name ?? lesson.title ?? "")
                                .toLowerCase()
                                .includes(normalizedLessonSearch),
                        ),
                    }))
                    .filter((middleCategory) => middleCategory.visibleLessons.length > 0),
            }))
            .filter(
                (majorCategory) => majorCategory.visibleMiddleCategories.length > 0,
            );
    }, [selectedCertification, normalizedLessonSearch]);

    const hasMatchingLesson = visibleStructure.length > 0;

    const validationTimerRef = useRef(null);

    useEffect(() => {
        cancelIdleWork(validationTimerRef.current);

        validationTimerRef.current = scheduleIdleWork(() => {
            setValidationErrors((currentErrors) => {
                if (Object.keys(currentErrors).length === 0) {
                    return currentErrors;
                }

                const nextErrors = {};

                questions.forEach((question) => {
                    if (!currentErrors[question.id]) {
                        return;
                    }

                    const errors = validateQuestionData(question.typeId, question.data);

                    if (Object.keys(errors).length > 0) {
                        nextErrors[question.id] = errors;
                    }
                });

                return nextErrors;
            });
        }, 350);

        return () => {
            cancelIdleWork(validationTimerRef.current);
        };
    }, [questions]);

    useEffect(() => {
        if (!isLockedToCertification) {
            return;
        }

        setFilterCertificationId(lockedCertificationId);
        setSelectedCertificationId(lockedCertificationId);
    }, [isLockedToCertification, lockedCertificationId]);

    useEffect(() => {
        setFilterLessonId(ALL_FILTER_VALUE);
        setFilterQuestionType(ALL_FILTER_VALUE);
        setFilterDifficulty(ALL_FILTER_VALUE);




        setQuestionPage(1);
    }, [filterCertificationId]);

    useEffect(() => {
        setQuestionPage(1);
    }, [filterDifficulty, filterLessonId, filterQuestionType]);

    useEffect(() => {
        setQuestionPage((currentPage) => Math.min(currentPage, questionPageCount));
    }, [questionPageCount]);

    function showFeedbackDialog({ type = "success", title, description }) {
        setFeedbackDialog({
            open: true,
            type,
            title,
            description,
        });
    }

    function closeFeedbackDialog() {
        setFeedbackDialog((currentDialog) => ({
            ...currentDialog,
            open: false,
        }));
    }

    function openQuestionDialog(question, mode) {
        setQuestionDialog({
            open: true,
            mode,
            question,
        });
        setQuestionForm({
            questionId: question.questionId,
            parentQuestionId: question.parentQuestionId ?? null,
            questionType: question.questionType ?? "MCQ",
            difficultyLevel: question.difficultyLevel ?? "average",
            questionText: question.questionText ?? "",
            imageKey: question.imageKey ?? null,
            lessonId: String(question.lessonId ?? ""),
            totalPoints: question.totalPoints ?? 1,
        });
    }

    function closeQuestionDialog() {
        setQuestionDialog((currentDialog) => ({
            ...currentDialog,
            open: false,
        }));
    }

    function setQuestionFormField(field, value) {
        setQuestionForm((currentForm) => ({
            ...currentForm,
            [field]: value,
        }));
    }

    async function handleUpdateSavedQuestion() {
        if (!questionForm?.questionId || isUpdatingQuestion) {
            return;
        }

        if (isBlank(questionForm.questionText)) {
            showFeedbackDialog({
                type: "warning",
                title: "Question Required",
                description: "Enter a question prompt before saving.",
            });
            return;
        }

        if (!questionForm.lessonId) {
            showFeedbackDialog({
                type: "warning",
                title: "Lesson Required",
                description: "Select a lesson before saving.",
            });
            return;
        }

        try {
            setIsUpdatingQuestion(true);

            await updateQuestion(questionForm.questionId, {
                parentQuestionId: questionForm.parentQuestionId,
                questionType: questionForm.questionType,
                difficultyLevel: questionForm.difficultyLevel,
                questionText: questionForm.questionText,
                imageKey: questionForm.imageKey,
                lessonId: Number(questionForm.lessonId),
                totalPoints: Number(questionForm.totalPoints || 1),
            });

            await refetchQuestions();
            closeQuestionDialog();

            showFeedbackDialog({
                type: "success",
                title: "Question Updated",
                description: "The question details were saved.",
            });
        } catch (error) {
            showFeedbackDialog({
                type: "warning",
                title: "Update Failed",
                description:
                    error.response?.data?.message ??
                    "The question could not be updated. Please try again.",
            });
        } finally {
            setIsUpdatingQuestion(false);
        }
    }

    async function handleDeleteSavedQuestion(question) {
        const confirmed = window.confirm(
            "Delete this question? This action cannot be undone.",
        );

        if (!confirmed) {
            return;
        }

        try {
            await deleteQuestion(question.questionId);
            await refetchQuestions();
            showFeedbackDialog({
                type: "success",
                title: "Question Deleted",
                description: "The question was removed from the bank.",
            });
        } catch (error) {
            showFeedbackDialog({
                type: "warning",
                title: "Delete Failed",
                description:
                    error.response?.data?.message ??
                    "The question could not be deleted. It may already be used by an exam or learner answer.",
            });
        }
    }

    function handleBuilderCertificationChange(value) {
        const isChangingCertification =
            selectedCertificationId && selectedCertificationId !== value;

        if (isChangingCertification && questions.length > 0) {
            showFeedbackDialog({
                type: "warning",
                title: "Unsaved Questions",
                description:
                    "Save or remove the current questions before changing certifications.",
            });

            return;
        }

        setSelectedCertificationId(value);
        setSelectedLesson(null);
        setLessonSearch("");
        setQuestions([]);
        setValidationErrors({});
    }

    function handleLessonSelect({
                                    lesson,
                                    lessonId,
                                    majorCategoryTitle,
                                    middleCategoryTitle,
                                }) {
        if (selectedLesson?.id === lessonId) {
            return;
        }

        const isChangingLesson = selectedLesson && selectedLesson.id !== lessonId;

        if (isChangingLesson && questions.length > 0) {
            showFeedbackDialog({
                type: "warning",
                title: "Unsaved Questions",
                description:
                    "Save or remove the current questions before selecting another lesson.",
            });

            return;
        }

        setSelectedLesson({
            id: lessonId,
            name: lesson.name ?? lesson.title ?? "Untitled Lesson",
            majorCategoryTitle,
            middleCategoryTitle,
        });

        setQuestions([]);
        setValidationErrors({});
    }

    function addQuestion(questionType) {
        setQuestions((previousQuestions) => [
            ...previousQuestions,
            {
                id: createLocalId(),
                typeId: questionType.id,
                questionTypeName: questionType.title,
                data: {
                    ...cloneQuestionData(questionType.data),
                    lessonId: selectedLesson?.id ?? "",
                },
            },
        ]);
    }

    function updateQuestionData(questionId, updater) {
        setQuestions((previousQuestions) =>
            previousQuestions.map((question) => {
                if (question.id !== questionId) {
                    return question;
                }

                return {
                    ...question,
                    data:
                        typeof updater === "function" ? updater(question.data) : updater,
                };
            }),
        );
    }

    function removeQuestion(questionId) {
        setQuestions((previousQuestions) =>
            previousQuestions.filter((question) => question.id !== questionId),
        );

        setValidationErrors((currentErrors) => {
            const nextErrors = { ...currentErrors };
            delete nextErrors[questionId];
            return nextErrors;
        });
    }

    const submitQuestions = async () => {
        // Sent with each save so the backend verifies the lesson belongs to this
        // certification before persisting the question.
        const certificationId = selectedCertification?.certificationId ?? null;
        for (const question of questions) {
            const lessonId = question.data.lessonId || selectedLesson?.id;
            if (!lessonId) {
                throw new Error("Each draft needs a lesson before it can be saved.");
            }

            switch (question.typeId) {
                case "MCQ": {
                    const savedMCQ = await saveQuestion({
                        questionType: question.data.questionType,
                        difficultyLevel: question.data.difficulty,
                        questionText: question.data.question,
                        imageKey: question.data.imageKey ?? null,
                        lessonId: Number(lessonId),
                        certificationId,
                        totalPoints: 1,
                    });

                    for (const choice of question.data.choices) {
                        await saveChoices({
                            questionId: savedMCQ.questionId,
                            choiceText: choice.choiceText,
                            imageKey: choice.imageKey ?? null,
                            correct: choice.isCorrect,
                            explanation: choice.explanation,
                        });
                    }
                    break;
                }
                case "SHORT_ANSWER": {
                    const savedShortAnswer = await saveQuestion({
                        questionType: question.data.questionType,
                        difficultyLevel: question.data.difficulty,
                        questionText: question.data.question,
                        imageKey: question.data.imageKey ?? null,
                        lessonId: Number(lessonId),
                        certificationId,
                        totalPoints: 1,
                    });
                    await saveTextQuestion({
                        questionId: savedShortAnswer.questionId,
                        correctAnswer: question.data.correctAnswer,
                        checkingMethod: question.data.checkingMethod,
                        acceptedVariations: Array.isArray(question.data.acceptedVariations)
                            ? question.data.acceptedVariations
                            : null,
                    });
                    break;
                }
                case "DESCRIPTIVE": {
                    const savedDescriptive = await saveQuestion({
                        questionType: question.data.questionType,
                        difficultyLevel: question.data.difficulty,
                        questionText: question.data.question,
                        imageKey: question.data.imageKey ?? null,
                        lessonId: Number(lessonId),
                        certificationId,
                        totalPoints: 1,
                    });
                    await saveTextQuestion({
                        questionId: savedDescriptive.questionId,
                        correctAnswer: question.data.rubricBasedAnswer,
                        checkingMethod: question.data.checkingMethod,
                    });
                    break;
                }
                case "PROGRAMMING": {
                    const savedProgramming = await saveQuestion({
                        questionType: question.data.questionType,
                        difficultyLevel: question.data.difficulty,
                        questionText: question.data.question,
                        imageKey: question.data.imageKey ?? null,
                        lessonId: Number(lessonId),
                        certificationId,
                        totalPoints: 1,
                    });
                    await saveProgrammingQuestion({
                        questionId: savedProgramming.questionId,
                        starterCode: question.data.starterCode,
                        testCases: question.data.testCases.map((testCase) => ({
                            inputData: testCase.inputData,
                            expectedOutput: testCase.expectedOutput,
                        })),
                    });

                    for (const subQuestion of question.data.subQuestions ?? []) {
                        const savedSub = await saveQuestion({
                            parentQuestionId: savedProgramming.questionId,
                            questionType: question.data.questionType,
                            difficultyLevel: question.data.difficulty,
                            questionText: subQuestion.question,
                            lessonId: Number(lessonId),
                            totalPoints: 1,
                        });
                        await saveTextQuestion({
                            questionId: savedSub.questionId,
                            correctAnswer: subQuestion.correctAnswer,
                            checkingMethod: "AI_SEMANTIC",
                        });
                    }
                    break;
                }
                case "DIAGRAM": {
                    const savedDiagram = await saveQuestion({
                        questionType: question.data.questionType,
                        difficultyLevel: question.data.difficulty,
                        questionText: question.data.question,
                        imageKey: question.data.imageKey ?? null,
                        lessonId: Number(lessonId),
                        certificationId,
                        totalPoints: 1,
                    });
                    await saveDiagramQuestion({
                        questionId: savedDiagram.questionId,
                        diagramType: question.data.diagramType,
                        instructions: question.data.instructions,
                        referenceDiagramXml: question.data.referenceDiagramXml,
                        referenceDiagramJson: JSON.stringify({
                            nodes: question.data.referenceDiagramNodes,
                            edges: question.data.referenceDiagramEdges,
                        }),
                    });

                    for (const subQuestion of question.data.subQuestions ?? []) {
                        const savedSub = await saveQuestion({
                            parentQuestionId: savedDiagram.questionId,
                            questionType: question.data.questionType,
                            difficultyLevel: question.data.difficulty,
                            questionText: subQuestion.question,
                            lessonId: Number(lessonId),
                            totalPoints: 1,
                        });
                        await saveTextQuestion({
                            questionId: savedSub.questionId,
                            correctAnswer: subQuestion.correctAnswer,
                            checkingMethod: "AI_SEMANTIC",
                        });
                    }
                    break;
                }
            }
        }
    };

    async function handleGenerateQuestionsFromFiles(selectedDocuments, generationOptions) {
        if (!selectedCertification) {
            throw new Error(
                "Please select a certification before generating questions.",
            );
        }

        const certificationId =
            selectedCertification.certificationId ?? selectedCertification.id;

        try {
            setIsGeneratingQuestions(true);

            /*
             * The backend reads the uploaded documents, detects the topics, chooses
             * appropriate question types, and returns editable draft DTOs only.
             * It must not save any question to the database during generation.
             */
            const generationResponse = await generateQuestionsFromFiles(
                certificationId,
                selectedDocuments,
                generationOptions.questionType === "AUTO"
                    ? null
                    : { [generationOptions.questionType]: generationOptions.total },
                {
                    targetQuestionCount: generationOptions.total,
                    additionalInstructions: `
You are REBYU's Certification-Aware Question Bank Generation AI.

Before generating questions, analyze the selected certification and determine the correct exam style.

SELECTED CERTIFICATION:
- Name: ${getCertificationTitle(selectedCertification)}
- Description: ${selectedCertification?.description ?? "No description provided"}
- Industry: ${selectedCertification?.industry ?? "No industry provided"}

CERTIFICATION-AWARE RULES:
1. Identify what the certification is about.
2. Determine appropriate question types based on the certification style.
3. Do not blindly generate every question type.
4. Generate only question types that match the certification and are supported by the uploaded file, certification content, or lesson/module content.
5. Every question must be based only on the uploaded files, certification content, or lesson/module content.
6. Do not invent topics that are not found in the uploaded/source content.

PROFESSIONAL EXAM STYLE:
- Write concise, technical questions for IT professionals and aspiring IT professionals.
- Match official TOPCIT/PhilNITS-style wording: calculations, binary and logic operations, algorithms, code or SQL interpretation, data structures, databases, operating systems, networks, architecture, standards, and precise "Which of the following" questions.
- Do not force every item into a workplace scenario.
- Do not repeatedly start with "A company", "An institution", "An organization", "A team", "A developer", or a person's name.
- Do not add fictional clients, deadlines, incidents, or business stories unless those facts are necessary to solve the technical problem.
- Scenarios are allowed only when technically useful. Prefer direct, objective exam stems and mature professional language.
- Questions must test certification-level knowledge or reasoning, not childish trivia or high-school-style filler.

CERTIFICATION-SPECIFIC RULES:
- If the certification is TOPCIT:
  TOPCIT measures practical knowledge and real-world problem-solving ability.
  TOPCIT has 75 questions across these official categories:
  - Multiple Choice: 30%
  - Descriptive: 21%
  - Performance: 25%
  - Integrated Performance: 24%
  Do not generate SHORT_ANSWER for TOPCIT. TOPCIT written-response questions must use DESCRIPTIVE.
  Map TOPCIT Multiple Choice to MCQ.
  Map TOPCIT Descriptive to DESCRIPTIVE.
  Map TOPCIT Performance to PROGRAMMING and/or DIAGRAM only when the source supports coding, SQL, algorithms, activity diagrams, class diagrams, component diagrams, ER diagrams, flowcharts, sequence diagrams, UI design, use case diagrams, architecture, database design, system design, or implementation tasks.
  Map TOPCIT Integrated Performance to complex DESCRIPTIVE, PROGRAMMING, or DIAGRAM tasks only when the source supports cross-topic problem-solving.
  For TOPCIT, approximate the official distribution across the generated target. If a performance type is unsupported by the source, redistribute those questions to MCQ and DESCRIPTIVE rather than inventing unsupported performance tasks.

- If the certification is PhilNITS IT Passport, IT Passport, or IP:
  Generate MCQ questions only.
  Do not generate SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING, or DIAGRAM questions.

- If the certification is PhilNITS FE, FE Exam, or Fundamental Information Technology Engineer:
  Generate MCQ questions only.
  Even if the topic is programming-related, convert it into MCQ format unless the admin explicitly allows performance-based practice.

- For other certifications:
  Analyze the certification name, description, and uploaded/source content first.
  Then choose only the question types that match the certification style and source material.

QUESTION TYPE RULES:
- MCQ: Use for concepts, definitions, processes, laws, calculations, terminology, scenarios, and exam-style review questions. Return exactly 4 choices, exactly 1 correct choice, correctChoiceIndex, explanation, difficulty, and lesson.
- SHORT_ANSWER: Do not use for TOPCIT. Generate only when a non-TOPCIT certification explicitly allows exact one-answer factual questions. Use it for acronym expansions, terms, simple definitions, formulas, commands, standards, names, dates, single values, or one-phrase answers. Example: question "What does SQL stand for?" correctAnswer "Structured Query Language". Do not use SHORT_ANSWER for "explain", "describe", "compare", "why", "how", scenario analysis, or multi-sentence answers; use DESCRIPTIVE instead. Return a non-blank correctAnswer, checkingMethod EXACT_MATCH, explanation, difficulty, and lesson.
- DESCRIPTIVE: Generate only when the certification allows explanation-based answers. Return a non-blank rubricBasedAnswer, checkingMethod AI_SEMANTIC, difficulty, and lesson.
- PROGRAMMING: Generate only when BOTH conditions are true: the certification allows programming/performance-based questions, and the source contains code, algorithms, SQL/query writing, debugging, implementation tasks, or programming logic. Return starterCode when useful and testCases with expected outputs.
- DIAGRAM: Generate only when BOTH conditions are true: the certification allows diagram/performance-based questions, and the source contains workflows, activity diagrams, class diagrams, component diagrams, ER diagrams, flowcharts, sequence diagrams, UI designs, use case diagrams, database/schema design, architecture, network diagrams, or process modeling material. Return diagramType, instructions, authoringNotes, difficulty, and lesson.

QUANTITY RULES:
- Generate exactly ${generationOptions.total} high-quality draft questions when the source content can support it.
- Required difficulty distribution: ${generationOptions.easy} EASY, ${generationOptions.average} AVERAGE, and ${generationOptions.hard} HARD.
- Required question type: ${generationOptions.questionType === "AUTO" ? "Choose a suitable mix based on the certification and source." : generationOptions.questionType}.
- Do not stop after a small sample. Produce a full batch for each backend request.
- ${generationOptions.questionType === "AUTO" ? "Use varied supported question types when the certification style and source content support them." : `Generate only ${generationOptions.questionType} questions.`}
- If the certification is MCQ-only, generate MCQ questions only.
- If the source content is not enough to create ${generationOptions.total} high-quality questions, generate the maximum valid number and include a warning.
- Do not create duplicate or near-duplicate questions.

OUTPUT RULES:
- Follow the backend's canonical question draft fields exactly.
- Return valid JSON only.
- Do not include markdown.
- Do not include explanations outside JSON.
                    `.trim(),
                },
            );

            // Question generation now runs asynchronously in the background
            // (see the RabbitMQ-driven Python consumer) -- this response only
            // confirms the request was queued. Nothing above ever appears
            // directly in this response, so there are no drafts to add to
            // the builder yet; the notification bell announces completion,
            // and reviewed drafts land in a separate review step (backend
            // generated_question_drafts) once Phase 8+ wires that surface.
            setIsQuestionFileGeneratorOpen(false);

            showFeedbackDialog({
                type: "success",
                title: "Question generation started",
                description:
                    "Generating questions in the background — you'll get a notification here when they're ready to review.",
            });
        } finally {
            setIsGeneratingQuestions(false);
        }
    }

    async function handleSave() {
        if (isSavingQuestions) {
            return;
        }

        const nextValidationErrors = {};

        questions.forEach((question) => {
            const errors = validateQuestionData(question.typeId, question.data);

            if (Object.keys(errors).length > 0) {
                nextValidationErrors[question.id] = errors;
            }
        });

        setValidationErrors(nextValidationErrors);

        if (Object.keys(nextValidationErrors).length > 0) {
            window.setTimeout(() => {
                document
                    .querySelector('[data-question-invalid="true"]')
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
            }, 0);

            return;
        }

        try {
            setIsSavingQuestions(true);
            await submitQuestions();
            const savedCount = questions.length;
            await refetchQuestions();
            setQuestions([]);
            setValidationErrors({});
            showFeedbackDialog({
                type: "success",
                title: "Questions Saved",
                description: `${savedCount} question${
                    savedCount === 1 ? "" : "s"
                } saved successfully.`,
            });
        } catch (error) {
            showFeedbackDialog({
                type: "warning",
                title: "Save Failed",
                description:
                    "An error occurred while saving the questions. Please try again.",
            });
        } finally {
            setIsSavingQuestions(false);
        }
    }

    return (
        <section
            className={
                embedded
                    ? "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-muted/20 py-0 md:h-[calc(100dvh-12rem)]"
                    /* Fills whatever it is handed. It used to subtract a fixed
                       8rem for a portal header that is not there on its own
                       page, which left a strip of dead space under the table
                       and made the list shorter than the window. */
                    : "flex min-h-0 flex-1 flex-col bg-muted/20 py-0 md:overflow-hidden"
            }
        >
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex min-h-0 flex-1 flex-col"
            >
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 px-3 py-2 backdrop-blur sm:px-5">
                    <TabsList className="h-10 w-fit gap-1 rounded-lg bg-muted/70 p-1">
                        <TabsTrigger
                            value="all-questions"
                            className="h-8 rounded-md px-3 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                        >
                            <ListChecks className="mr-2 h-4 w-4" />
                            All Questions
                        </TabsTrigger>

                    </TabsList>

                    {/* The bank and the builder are one page: the questions
                        you are writing and the ones already written are the
                        same subject, and sending authoring to a route of its
                        own meant leaving the library to add to it, then
                        navigating back to see that you had. Both buttons swap
                        the area below in place. */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={
                                activeTab === "question-builder" &&
                                builderMode === "manual"
                                    ? "default"
                                    : "outline"
                            }
                            onClick={() => {
                                setActiveTab("question-builder");
                                setBuilderMode("manual");
                            }}
                        >
                            <BookOpen className="mr-2 h-4 w-4" />
                            Question Builder
                        </Button>

                        {/* Only inside the builder. Over the library it was an
                            action about a screen you were not on -- and the
                            library's own job is reviewing what already exists,
                            not adding to it. */}
                        {activeTab === "question-builder" ? (
                            <Button
                                type="button"
                                size="sm"
                                variant={
                                    builderMode === "generate" ? "default" : "outline"
                                }
                                onClick={() => {
                                    setActiveTab("question-builder");
                                    setBuilderMode("generate");
                                }}
                            >
                                Generate with AI
                            </Button>
                        ) : null}
                    </div>

                    {activeTab === "question-builder" && builderMode !== "" && (
                        <div className="flex shrink-0 items-center gap-2 py-1.5">
                            {builderMode === "generate" && (
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={
                                        !selectedCertification ||
                                        isSavingQuestions ||
                                        isGeneratingQuestions
                                    }
                                    onClick={() => setIsQuestionFileGeneratorOpen(true)}
                                >
                                    <UploadIcon className="mr-2 h-4 w-4" />
                                    Generate Questions
                                </Button>
                            )}

                            <Button
                                type="button"
                                size="sm"
                                disabled={
                                    isSavingQuestions || !selectedLesson || questions.length === 0
                                }
                                onClick={handleSave}
                            >
                                {isSavingQuestions ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    )}
                </div>

                <TabsContent
                    value="all-questions"
                    className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden py-3 data-[state=inactive]:hidden"
                >
                    {/* Capped only when embedded in a portal page. On its own
                        page the window is the container, and a 1800px cap just
                        reintroduced the inset the full-page move removed. */}
                    <div
                        className={
                            embedded
                                ? "mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-3 px-3 sm:px-5"
                                : "flex min-h-0 w-full flex-1 flex-col gap-3 px-4 sm:px-6"
                        }
                    >
                        {/* The filters were a card with a heading and a
                            paragraph explaining that a filter filters, wrapped
                            around a panel holding three dropdowns -- four
                            nested surfaces and roughly 180px of height spent
                            before the first question. They are a toolbar now:
                            the controls say what they do, and the height they
                            gave back goes to the list. */}
                        <div className="flex shrink-0 flex-col gap-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                    <div className="sr-only">
                                        <h3>Refine your library</h3>
                                    </div>

                                    {!isLockedToCertification && selectedFilterCertification && (
                                        <p className="max-w-full truncate text-xs text-muted-foreground sm:max-w-[280px]">
                                            Viewing:{" "}
                                            <span className="font-medium text-foreground">
                        {getCertificationTitle(selectedFilterCertification)}
                      </span>
                                        </p>
                                    )}
                                </div>

                                <div
                                    className={`grid gap-2 md:grid-cols-2 ${
                                        isLockedToCertification
                                            ? "xl:grid-cols-[minmax(230px,1.2fr)_minmax(185px,0.9fr)_minmax(165px,0.8fr)]"
                                            : "xl:grid-cols-[minmax(250px,1.35fr)_minmax(230px,1.2fr)_minmax(185px,0.9fr)_minmax(165px,0.8fr)]"
                                    }`}
                                >
                                    {!isLockedToCertification && (
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="question-filter-certification"
                                            className="text-xs font-medium text-muted-foreground"
                                        >
                                            Certification
                                        </Label>

                                        <Select
                                            value={filterCertificationId}
                                            onValueChange={setFilterCertificationId}
                                            disabled={isPending}
                                        >
                                            <SelectTrigger
                                                id="question-filter-certification"
                                                className="h-10 w-full min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate"
                                            >
                                                <SelectValue placeholder="Select certification" />
                                            </SelectTrigger>

                                            <SelectContent
                                                position="popper"
                                                align="start"
                                                sideOffset={6}
                                                className="max-h-72 w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
                                            >
                                                <SelectGroup>
                                                    {certifications.map((certification, index) => (
                                                        <SelectItem
                                                            key={
                                                                certification.certificationId ??
                                                                certification.id ??
                                                                index
                                                            }
                                                            value={getCertificationValue(certification)}
                                                            title={getCertificationTitle(certification)}
                                                            className="h-auto min-h-10 whitespace-normal py-2 pr-8 text-sm leading-5"
                                                        >
                                                            {getCertificationTitle(certification)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="question-filter-lesson"
                                            className="text-xs font-medium text-muted-foreground"
                                        >
                                            Lesson
                                        </Label>

                                        <Select
                                            value={filterLessonId}
                                            onValueChange={setFilterLessonId}
                                            disabled={
                                                !selectedFilterCertification ||
                                                filterLessons.length === 0
                                            }
                                        >
                                            <SelectTrigger
                                                id="question-filter-lesson"
                                                className="h-10 w-full min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate"
                                            >
                                                <SelectValue placeholder="All lessons" />
                                            </SelectTrigger>

                                            <SelectContent
                                                position="popper"
                                                align="start"
                                                sideOffset={6}
                                                className="max-h-72 w-[min(400px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
                                            >
                                                <SelectItem
                                                    value={ALL_FILTER_VALUE}
                                                    className="min-h-10"
                                                >
                                                    All lessons
                                                </SelectItem>

                                                {filterLessons.map((lesson) => (
                                                    <SelectItem
                                                        key={lesson.id}
                                                        value={String(lesson.numericId ?? lesson.id)}
                                                        title={lesson.name}
                                                        className="h-auto min-h-10 whitespace-normal py-2 pr-8 text-sm leading-5"
                                                    >
                                                        {lesson.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="question-filter-type"
                                            className="text-xs font-medium text-muted-foreground"
                                        >
                                            Question type
                                        </Label>

                                        <Select
                                            value={filterQuestionType}
                                            onValueChange={setFilterQuestionType}
                                            disabled={!selectedFilterCertification}
                                        >
                                            <SelectTrigger
                                                id="question-filter-type"
                                                className="h-10 w-full min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate"
                                            >
                                                <SelectValue placeholder="All types" />
                                            </SelectTrigger>

                                            <SelectContent
                                                position="popper"
                                                align="start"
                                                sideOffset={6}
                                                className="max-h-60 w-[min(280px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
                                            >
                                                <SelectItem
                                                    value={ALL_FILTER_VALUE}
                                                    className="min-h-10"
                                                >
                                                    All types
                                                </SelectItem>

                                                <SelectItem value="MCQ" className="min-h-10">
                                                    Multiple Choice
                                                </SelectItem>

                                                <SelectItem value="SHORT_ANSWER" className="min-h-10">
                                                    Short Answer
                                                </SelectItem>

                                                <SelectItem value="DESCRIPTIVE" className="min-h-10">
                                                    Descriptive
                                                </SelectItem>

                                                {/* Matches all three workspace
                                                    types, however they were
                                                    stored -- see
                                                    QUESTION_TYPE_FILTER_MATCHES. */}
                                                <SelectItem
                                                    value="CRITICAL_THINKING"
                                                    className="min-h-10"
                                                >
                                                    Critical Thinking (all)
                                                </SelectItem>

                                                <SelectItem value="PROGRAMMING" className="min-h-10">
                                                    Programming
                                                </SelectItem>

                                                <SelectItem value="DIAGRAM" className="min-h-10">
                                                    Diagram
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="question-filter-difficulty"
                                            className="text-xs font-medium text-muted-foreground"
                                        >
                                            Difficulty
                                        </Label>

                                        <Select
                                            value={filterDifficulty}
                                            onValueChange={setFilterDifficulty}
                                            disabled={!selectedFilterCertification}
                                        >
                                            <SelectTrigger
                                                id="question-filter-difficulty"
                                                className="h-10 w-full min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate"
                                            >
                                                <SelectValue placeholder="All difficulties" />
                                            </SelectTrigger>

                                            <SelectContent
                                                position="popper"
                                                align="start"
                                                sideOffset={6}
                                                className="max-h-60 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-1"
                                            >
                                                <SelectItem
                                                    value={ALL_FILTER_VALUE}
                                                    className="min-h-10"
                                                >
                                                    All difficulties
                                                </SelectItem>

                                                <SelectItem value="easy" className="min-h-10">
                                                    Easy
                                                </SelectItem>

                                                <SelectItem value="average" className="min-h-10">
                                                    Average
                                                </SelectItem>

                                                <SelectItem value="hard" className="min-h-10">
                                                    Hard
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {


























                                    }
                                </div>
                        </div>

                        {/* One bordered surface for the list, and the only
                            thing on the page that scrolls. The page itself no
                            longer does: the filters stay put at the top and
                            the rows move under a header that stays with
                            them. */}
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-background">
                            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-2">
                                <h3 className="text-sm font-semibold text-foreground">Question library</h3>

                                <Badge variant="secondary" className="w-fit rounded-md px-2 py-0.5 text-xs">
                                    {selectedFilterCertification
                                        ? `${filteredQuestions.length} total`
                                        : isLockedToCertification
                                            ? "Loading"
                                            : "Choose a certification"}
                                </Badge>
                            </div>
                            <div className="min-h-0 flex-1 overflow-auto">
                                <Table className="min-w-[880px] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/35">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-72">Question</TableHead>

                                            <TableHead>Type</TableHead>
                                            <TableHead>Lesson</TableHead>
                                            <TableHead>Difficulty</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Added by</TableHead>
                                            <TableHead>Updated</TableHead>

                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {!selectedFilterCertification ||
                                        isQuestionsPending ||
                                        isQuestionsError ||
                                        paginatedQuestions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-[390px]">
                                                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                                            <FileQuestion className="h-5 w-5 text-muted-foreground" />
                                                        </div>

                                                        <h3 className="mt-4 font-heading text-base font-bold text-foreground">
                                                            {isQuestionsError
                                                                ? "Questions could not be loaded"
                                                                : isQuestionsPending
                                                                    ? "Loading questions"
                                                                    : selectedFilterCertification
                                                                        ? "No questions found"
                                                                        : isLockedToCertification
                                                                            ? "Loading certification"
                                                                            : "Select a certification"}
                                                        </h3>

                                                        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                                                            {isQuestionsError
                                                                ? "Check the API connection and try again."
                                                                : isQuestionsPending
                                                                    ? "Fetching the latest question bank records."
                                                                    : selectedFilterCertification
                                                                        ? "Try a different lesson, question type, or difficulty."
                                                                        : isLockedToCertification
                                                                            ? "Fetching this certification's course structure."
                                                                            : "Choose a certification above to view its questions."}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedQuestions.map((question) => {
                                                const lesson = filterLessonMap.get(
                                                    String(question.lessonId ?? ""),
                                                );

                                                return (
                                                    <TableRow key={question.questionId}>
                                                        <TableCell className="max-w-[360px]">
                                                            <p
                                                                className="line-clamp-2 font-medium text-foreground"
                                                                title={question.questionText}
                                                            >
                                                                {question.questionText}
                                                            </p>
                                                        </TableCell>

                                                        <TableCell>
                                                            <Badge variant="secondary">
                                                                {getQuestionTypeLabel(question.questionType)}
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="max-w-[220px]">
                                                            <p
                                                                className="truncate text-sm text-foreground"
                                                                title={lesson?.name}
                                                            >
                                                                {lesson?.name ?? "Unknown lesson"}
                                                            </p>
                                                        </TableCell>

                                                        <TableCell>
                                                            {getDifficultyLabel(question.difficultyLevel)}
                                                        </TableCell>

                                                        <TableCell>
                                                            <Badge variant="outline">Saved</Badge>
                                                        </TableCell>

                                                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                                            {question.createdByEmail ?? "Platform"}
                                                        </TableCell>

                                                        <TableCell className="text-muted-foreground">
                                                            -
                                                        </TableCell>

                                                        <TableCell>
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="View question"
                                                                    onClick={() =>
                                                                        openQuestionDialog(question, "view")
                                                                    }
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>

                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="Edit question"
                                                                    onClick={() =>
                                                                        openQuestionDialog(question, "edit")
                                                                    }
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>

                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    aria-label="Delete question"
                                                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                    onClick={() =>
                                                                        handleDeleteSavedQuestion(question)
                                                                    }
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <Separator />

                            <div className="flex shrink-0 flex-col gap-2 bg-muted/20 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                                <p className="min-w-0 truncate text-sm text-muted-foreground">
                                    {selectedFilterCertification
                                        ? `${filteredQuestions.length} question${
                                            filteredQuestions.length === 1 ? "" : "s"
                                        } for ${getCertificationTitle(
                                            selectedFilterCertification,
                                        )}`
                                        : "No certification selected"}
                                </p>

                                <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="First page"
                                        disabled={questionPage === 1}
                                        onClick={() => setQuestionPage(1)}
                                    >
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Previous page"
                                        disabled={questionPage === 1}
                                        onClick={() =>
                                            setQuestionPage((currentPage) =>
                                                Math.max(1, currentPage - 1),
                                            )
                                        }
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    <Button type="button" variant="outline" size="sm" disabled>
                                        {questionPage} / {questionPageCount}
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Next page"
                                        disabled={questionPage >= questionPageCount}
                                        onClick={() =>
                                            setQuestionPage((currentPage) =>
                                                Math.min(questionPageCount, currentPage + 1),
                                            )
                                        }
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Last page"
                                        disabled={questionPage >= questionPageCount}
                                        onClick={() => setQuestionPage(questionPageCount)}
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent
                    value="question-builder"
                    className="m-0 min-h-0 flex-1 overflow-visible py-5 md:overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
                >
                    {builderMode === "" ? (
                        <div className="flex flex-1 items-center justify-center p-6">
                            <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-gradient-to-br from-background via-background to-primary/5 p-8 text-center shadow-lg shadow-primary/5">
                                <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                                    Question Builder
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Choose how you want to add questions to this
                                    certification.
                                </p>

                                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => setBuilderMode("manual")}
                                        className="group flex flex-col items-center gap-3 rounded-xl border border-border/80 bg-background/90 p-6 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:bg-primary/5 hover:shadow-md"
                                    >
                                        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                            <FileQuestion className="h-6 w-6" />
                                        </span>
                                        <span className="font-medium text-foreground">
                                            Create Manually
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Pick a lesson and build each question by hand.
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setBuilderMode("generate")}
                                        className="group flex flex-col items-center gap-3 rounded-xl border border-border/80 bg-background/90 p-6 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:bg-primary/5 hover:shadow-md"
                                    >
                                        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                            <UploadIcon className="h-6 w-6" />
                                        </span>
                                        <span className="font-medium text-foreground">
                                            Generate with AI
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Draft questions from certification knowledge or
                                            uploaded files.
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1 flex-col gap-3">
                            {/* The manual/AI switch lives in the toolbar above,
                                once. Repeating it here as a second pill row put
                                the same two choices on screen twice, one under
                                the other. */}
                            {builderMode === "generate" ? (
                                <div className="flex min-h-0 flex-1 flex-col gap-3">
                                    <div className="shrink-0 space-y-2">
                                        {isLockedToCertification ? (
                                            <p className="text-xs text-muted-foreground">
                                                Use “Generate Questions” to create draft questions
                                                for this certification, then review and save them.
                                            </p>
                                        ) : (
                                        <>
                                            <p className="text-sm font-medium text-foreground">
                                                Certification
                                            </p>
                                            <Select
                                                value={selectedCertificationId}
                                                onValueChange={handleBuilderCertificationChange}
                                                disabled={isPending}
                                            >
                                                <SelectTrigger className="h-10 w-full min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate">
                                                    <SelectValue placeholder="Select a certification" />
                                                </SelectTrigger>
                                                <SelectContent
                                                    position="popper"
                                                    align="start"
                                                    sideOffset={6}
                                                    className="max-h-72 w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
                                                >
                                                    <SelectGroup>
                                                        {certifications.map((certification, index) => (
                                                            <SelectItem
                                                                key={
                                                                    certification.certificationId ??
                                                                    certification.id ??
                                                                    index
                                                                }
                                                                value={getCertificationValue(certification)}
                                                                title={getCertificationTitle(certification)}
                                                                className="h-auto min-h-10 whitespace-normal py-2 pr-8 text-sm leading-5"
                                                            >
                                                                {getCertificationTitle(certification)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                Choose a certification, then use “Generate Questions” to
                                                create draft questions you can review and save.
                                            </p>
                                        </>
                                        )}
                                    </div>

                                    <div className="grid min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/80 bg-background shadow-sm md:grid-cols-[minmax(0,1fr)_240px] md:overflow-hidden">
                                        <main className="min-h-0 min-w-0 bg-muted/20 md:overflow-y-auto">
                                            <div className="mx-auto w-full max-w-4xl space-y-4 p-5 sm:p-6">
                                        {Object.keys(validationErrors).length > 0 && (
                                            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                <div>
                                                    <p className="font-semibold">
                                                        Some required question details are missing.
                                                    </p>
                                                    <p className="mt-1 text-xs leading-5">
                                                        Review the highlighted question cards, complete the
                                                        required fields, then save again.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {questions.length === 0 ? (
                                            <EmptyState
                                                icon={FileQuestion}
                                                title="No questions generated yet"
                                                description={
                                                    selectedCertification
                                                        ? "Click “Generate Questions” to create draft questions for this certification."
                                                        : "Select a certification to begin."
                                                }
                                            />
                                        ) : (
                                            <div className="space-y-4">
                                                {questions.map((question, index) => {
                                                    function handleRemove() {
                                                        removeQuestion(question.id);
                                                    }
                                                    function handleDataChange(updater) {
                                                        updateQuestionData(question.id, updater);
                                                    }
                                                    return (
                                                        <QuestionCardWrapper
                                                            key={question.id}
                                                            question={question}
                                                            index={index}
                                                            validationErrors={validationErrors}
                                                            onRemove={handleRemove}
                                                            onDataChange={handleDataChange}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                            </div>
                                        </main>
                                        <aside className="min-h-0 border-t border-border bg-background/95 md:overflow-y-auto md:border-l md:border-t-0">
                                            <div className="space-y-4 p-4">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        Add Question
                                                    </p>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {selectedLesson
                                                            ? `Add a question to ${selectedLesson.name}.`
                                                            : "Generate first, then add or edit questions here."}
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    {questionTypes.map((questionType) => (
                                                        <QuestionTypeButton
                                                            key={questionType.id}
                                                            questionType={questionType}
                                                            onAdd={addQuestion}
                                                            disabled={!selectedLesson}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </aside>
                                    </div>
                                </div>
                            ) : (
                            <div className="grid min-h-0 w-full flex-1 overflow-y-auto rounded-2xl border border-border/80 bg-background shadow-sm md:grid-cols-[220px_minmax(0,1fr)_240px] md:overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_260px]">
                        <aside className="min-h-0 border-b border-border bg-background/95 md:overflow-y-auto md:border-b-0 md:border-r">
                            <div className="space-y-4 p-4">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Course Structure
                                    </p>

                                    {!isLockedToCertification && (
                                    <Select
                                        value={selectedCertificationId}
                                        onValueChange={handleBuilderCertificationChange}
                                        disabled={isPending}
                                    >
                                        <SelectTrigger
                                            id="builder-certification"
                                            className="mt-3 h-10 w-full min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate"
                                        >
                                            <SelectValue placeholder="Select a certification" />
                                        </SelectTrigger>

                                        <SelectContent
                                            position="popper"
                                            align="start"
                                            sideOffset={6}
                                            className="max-h-72 w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
                                        >
                                            <SelectGroup>
                                                {certifications.map((certification, index) => (
                                                    <SelectItem
                                                        key={
                                                            certification.certificationId ??
                                                            certification.id ??
                                                            index
                                                        }
                                                        value={getCertificationValue(certification)}
                                                        title={getCertificationTitle(certification)}
                                                        className="h-auto min-h-10 whitespace-normal py-2 pr-8 text-sm leading-5"
                                                    >
                                                        {getCertificationTitle(certification)}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    )}
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                                    <Input
                                        value={lessonSearch}
                                        onChange={(event) => setLessonSearch(event.target.value)}
                                        placeholder="Search lessons..."
                                        className="pl-9"
                                        disabled={!selectedCertification}
                                    />
                                </div>

                                <Separator />

                                {isError ? (
                                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
                                        Certifications could not be loaded.
                                    </div>
                                ) : !selectedCertification ? (
                                    <EmptyState
                                        size="sm"
                                        title={
                                            isLockedToCertification
                                                ? "Loading course structure"
                                                : "No certification selected"
                                        }
                                        description={
                                            isLockedToCertification
                                                ? "Fetching the lessons for this certification."
                                                : "Select a certification to view its course structure."
                                        }
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        {visibleStructure.map((majorCategory) => (
                                            <section
                                                key={majorCategory.key}
                                                className="overflow-hidden rounded-lg border border-border bg-background"
                                            >
                                                <div className="border-b border-border bg-muted/40 px-3 py-2.5">
                                                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                        Major Category
                                                    </p>

                                                    <p
                                                        className="truncate text-sm font-semibold text-foreground"
                                                        title={majorCategory.title}
                                                    >
                                                        {majorCategory.title}
                                                    </p>
                                                </div>

                                                <div className="space-y-4 p-3">
                                                    {majorCategory.visibleMiddleCategories.map(
                                                        (middleCategory) => (
                                                            <div key={middleCategory.key} className="min-w-0">
                                                                <div className="mb-1.5 flex min-w-0 items-center gap-2 px-2">
                                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

                                                                    <p
                                                                        className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                                                        title={middleCategory.title}
                                                                    >
                                                                        {middleCategory.title}
                                                                    </p>

                                                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {middleCategory.visibleLessons.length}
                                  </span>
                                                                </div>

                                                                <div className="space-y-1">
                                                                    {middleCategory.visibleLessons.map(
                                                                        (lesson, lessonIndex) => {
                                                                            const lessonId = String(
                                                                                lesson.lessonId ??
                                                                                lesson.id ??
                                                                                `${middleCategory.key}-lesson-${lessonIndex}`,
                                                                            );

                                                                            const lessonName =
                                                                                lesson.name ??
                                                                                lesson.title ??
                                                                                "Untitled Lesson";

                                                                            const isSelected =
                                                                                selectedLesson?.id === lessonId;

                                                                            return (
                                                                                <button
                                                                                    key={lessonId}
                                                                                    type="button"
                                                                                    aria-pressed={isSelected}
                                                                                    title={lessonName}
                                                                                    onClick={() =>
                                                                                        handleLessonSelect({
                                                                                            lesson,
                                                                                            lessonId,
                                                                                            majorCategoryTitle:
                                                                                            majorCategory.title,
                                                                                            middleCategoryTitle:
                                                                                            middleCategory.title,
                                                                                        })
                                                                                    }
                                                                                    className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                                                                                        isSelected
                                                                                            ? "bg-primary text-primary-foreground"
                                                                                            : "text-foreground hover:bg-muted"
                                                                                    }`}
                                                                                >
                                                                                    <FileText
                                                                                        className={`h-4 w-4 shrink-0 ${
                                                                                            isSelected
                                                                                                ? "text-primary-foreground"
                                                                                                : "text-muted-foreground"
                                                                                        }`}
                                                                                    />

                                                                                    <span className="min-w-0 flex-1 truncate">
                                            {lessonName}
                                          </span>
                                                                                </button>
                                                                            );
                                                                        },
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </section>
                                        ))}

                                        {normalizedLessonSearch && !hasMatchingLesson && (
                                            <EmptyState
                                                size="sm"
                                                title="No lessons found"
                                                description="Try another lesson name."
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </aside>

                        <main className="min-h-0 min-w-0 bg-muted/30 md:overflow-y-auto">
                            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-5 sm:p-6">
                                {!selectedLesson ? (
                                    <EmptyState
                                        icon={BookOpen}
                                        title="Select a lesson first"
                                        description="Choose a lesson from the course structure to create questions."
                                    />
                                ) : (
                                    <>
                                        <div className="flex flex-wrap items-end justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    {selectedLesson.majorCategoryTitle} /{" "}
                                                    {selectedLesson.middleCategoryTitle}
                                                </p>

                                                <h2 className="mt-1 truncate text-lg font-bold text-foreground">
                                                    {selectedLesson.name}
                                                </h2>
                                            </div>

                                            <p className="shrink-0 text-sm text-muted-foreground">
                                                {questions.length}{" "}
                                                {questions.length === 1 ? "question" : "questions"}
                                            </p>
                                        </div>

                                        {Object.keys(validationErrors).length > 0 && (
                                            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                                                <div>
                                                    <p className="font-semibold">
                                                        Some required question details are missing.
                                                    </p>

                                                    <p className="mt-1 text-xs leading-5">
                                                        Review the highlighted question cards, complete the
                                                        required fields, then save again.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {questions.length === 0 ? (
                                            <EmptyState
                                                icon={FileQuestion}
                                                title="No questions added yet"
                                                description="Use the Add Question panel to add your first question."
                                            />
                                        ) : (
                                            questions.map((question, index) => {
                                                function handleRemove() {
                                                    removeQuestion(question.id);
                                                }
                                                function handleDataChange(updater) {
                                                    updateQuestionData(question.id, updater);
                                                }
                                                return (
                                                    <QuestionCardWrapper
                                                        key={question.id}
                                                        question={question}
                                                        index={index}
                                                        validationErrors={validationErrors}
                                                        onRemove={handleRemove}
                                                        onDataChange={handleDataChange}
                                                    />
                                                );
                                            })
                                        )}
                                    </>
                                )}
                            </div>
                        </main>

                        <aside className="min-h-0 border-t border-border bg-background/95 md:overflow-y-auto md:border-l md:border-t-0">
                            <div className="space-y-4 p-4">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Add Question
                                    </p>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {selectedLesson
                                            ? `Add a question to ${selectedLesson.name}.`
                                            : "Select a lesson to start adding questions."}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {questionTypes.map((questionType) => (
                                        <QuestionTypeButton
                                            key={questionType.id}
                                            questionType={questionType}
                                            onAdd={addQuestion}
                                            disabled={!selectedLesson}
                                        />
                                    ))}
                                </div>
                            </div>
                        </aside>
                            </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog
                open={questionDialog.open}
                onOpenChange={(open) => {
                    if (!open && !isUpdatingQuestion) {
                        closeQuestionDialog();
                    }
                }}
            >
                <DialogContent className="max-h-[calc(100dvh-4rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:w-[calc(100vw-4rem)] lg:w-[min(1180px,calc(100vw-4rem))]">
                    <DialogHeader>
                        <DialogTitle>
                            {questionDialog.mode === "edit"
                                ? "Edit Question"
                                : "View Question"}
                        </DialogTitle>

                        <DialogDescription>
                            {questionDialog.mode === "edit"
                                ? "Update the saved question details."
                                : "Review the saved question details."}
                        </DialogDescription>
                    </DialogHeader>

                    {questionForm && (
                        <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Question Type</Label>

                                    <Select value={questionForm.questionType} disabled>
                                        <SelectTrigger className="h-10 rounded-lg bg-muted/30 px-3 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent
                                            position="popper"
                                            align="start"
                                            sideOffset={6}
                                            className="max-h-60 w-[min(280px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
                                        >
                                            <SelectItem value="MCQ" className="min-h-10">
                                                Multiple Choice
                                            </SelectItem>
                                            <SelectItem value="SHORT_ANSWER" className="min-h-10">
                                                Short Answer
                                            </SelectItem>
                                            <SelectItem value="DESCRIPTIVE" className="min-h-10">
                                                Descriptive
                                            </SelectItem>
                                            <SelectItem
                                                value="CRITICAL_THINKING"
                                                className="min-h-10"
                                            >
                                                Critical Thinking
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Difficulty</Label>

                                    <Select
                                        value={questionForm.difficultyLevel}
                                        onValueChange={(value) =>
                                            setQuestionFormField("difficultyLevel", value)
                                        }
                                        disabled={questionDialog.mode !== "edit"}
                                    >
                                        <SelectTrigger className="h-10 rounded-lg bg-background px-3 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent
                                            position="popper"
                                            align="start"
                                            sideOffset={6}
                                            className="max-h-60 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-1"
                                        >
                                            <SelectItem value="easy" className="min-h-10">
                                                Easy
                                            </SelectItem>
                                            <SelectItem value="average" className="min-h-10">
                                                Average
                                            </SelectItem>
                                            <SelectItem value="hard" className="min-h-10">
                                                Hard
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Question Prompt</Label>

                                <Textarea
                                    value={questionForm.questionText}
                                    onChange={(event) =>
                                        setQuestionFormField("questionText", event.target.value)
                                    }
                                    readOnly={questionDialog.mode !== "edit"}
                                    className="min-h-32"
                                />
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label>Lesson</Label>

                                    <Select
                                        value={questionForm.lessonId}
                                        onValueChange={(value) =>
                                            setQuestionFormField("lessonId", value)
                                        }
                                        disabled={questionDialog.mode !== "edit"}
                                    >
                                        <SelectTrigger className="h-10 min-w-0 rounded-lg bg-background px-3 text-sm [&>span]:truncate">
                                            <SelectValue placeholder="Select lesson" />
                                        </SelectTrigger>

                                        <SelectContent
                                            position="popper"
                                            align="start"
                                            sideOffset={6}
                                            className="max-h-72 w-[min(400px,calc(100vw-2rem))] overflow-y-auto rounded-xl p-1"
                                        >
                                            {filterLessons.map((lesson) => (
                                                <SelectItem
                                                    key={lesson.id}
                                                    value={String(lesson.numericId ?? lesson.id)}
                                                    title={lesson.name}
                                                    className="h-auto min-h-10 whitespace-normal py-2 pr-8 text-sm leading-5"
                                                >
                                                    {lesson.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {questionDialog.question?.choices?.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Choices</Label>

                                    <div className="space-y-2 rounded-lg border border-border p-3">
                                        {questionDialog.question.choices.map((choice, index) => (
                                            <div
                                                key={choice.choiceId ?? index}
                                                className="flex gap-2 text-sm"
                                            >
                                                <Badge variant={choice.correct ? "default" : "outline"}>
                                                    {String.fromCharCode(65 + index)}
                                                </Badge>

                                                <p className="min-w-0 flex-1">{choice.choiceText}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 border-t border-border pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeQuestionDialog}
                                    disabled={isUpdatingQuestion}
                                >
                                    Close
                                </Button>

                                {questionDialog.mode === "edit" && (
                                    <Button
                                        type="button"
                                        onClick={handleUpdateSavedQuestion}
                                        disabled={isUpdatingQuestion}
                                        className="min-w-[128px]"
                                    >
                                        {isUpdatingQuestion
                                            ? "Saving..."
                                            : "Save Changes"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <QuestionFileGeneratorDialog
                open={isQuestionFileGeneratorOpen}
                onOpenChange={setIsQuestionFileGeneratorOpen}
                onGenerate={handleGenerateQuestionsFromFiles}
                selectedCertification={selectedCertification}
                isGenerating={isGeneratingQuestions}
            />

            <AiGenerationProgress
                open={isGeneratingQuestions}
                title="Starting question generation"
                description={getCertificationTitle(selectedCertification)}
                stepDurationMs={4000}
                steps={[
                    "Reading uploaded documents",
                    "Uploading source material",
                    "Queuing question generation",
                ]}
                sentences={[
                    "This part is quick — drafting the questions happens in the background.",
                    "You'll get a notification here once they're ready to review.",
                    "Feel free to keep working; no need to wait on this screen.",
                ]}
            />

            <FeedbackDialog
                open={feedbackDialog.open}
                type={feedbackDialog.type}
                title={feedbackDialog.title}
                description={feedbackDialog.description}
                onClose={closeFeedbackDialog}
            />
        </section>
    );
}

export { QuestionBank };

export default QuestionBank;
