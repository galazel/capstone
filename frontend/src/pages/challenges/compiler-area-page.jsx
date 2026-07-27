import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { cpp } from "@codemirror/lang-cpp"
import { java } from "@codemirror/lang-java"
import { python } from "@codemirror/lang-python"
import {
    CheckCircle2,
    CirclePlay,
    Code2,
    Copy,
    GripHorizontal,
    LoaderCircle,
    RotateCcw,
    Terminal,
    Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const LANGUAGE_OPTIONS = [
    { id: "c", label: "C", extension: "c" },
    { id: "cpp", label: "C++", extension: "cpp" },
    { id: "java", label: "Java", extension: "java" },
    { id: "python", label: "Python", extension: "py" },
]

const STARTER_CODES = {
    c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, REBYU!\\n");\n    return 0;\n}\n`,
    cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, REBYU!" << endl;\n    return 0;\n}\n`,
    java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, REBYU!");\n    }\n}\n`,
    python: `print("Hello, REBYU!")\n`,
}

function getLanguageExtension(language) {
    if (language === "c" || language === "cpp") return cpp()
    if (language === "java") return java()
    if (language === "python") return python()
    return python()
}

function getLanguageLabel(language) {
    return LANGUAGE_OPTIONS.find((item) => item.id === language)?.label ?? "Python"
}

function getFileName(language) {
    if (language === "java") return "Main.java"
    if (language === "python") return "script.py"
    if (language === "c") return "main.c"
    return "main.cpp"
}

function isStarterCode(value) {
    return Object.values(STARTER_CODES).some(
        (starterCode) => starterCode.trim() === String(value ?? "").trim()
    )
}

function normalizeRunResult(result) {
    if (typeof result === "string") {
        return {
            status: "success",
            stdout: result,
            stderr: "",
            compileOutput: "",
            message: "",
            exitCode: 0,
            time: null,
            memory: null,
        }
    }

    return {
        status: result?.status ?? result?.result ?? "success",
        stdout: result?.stdout ?? result?.output ?? "",
        stderr: result?.stderr ?? result?.errorOutput ?? "",
        compileOutput: result?.compileOutput ?? result?.compile_output ?? "",
        message: result?.message ?? "",
        exitCode: result?.exitCode ?? result?.exit_code ?? null,
        time: result?.time ?? null,
        memory: result?.memory ?? null,
    }
}

function getOutputText(result) {
    if (!result) return "Run your code to see the program result here."

    const sections = []

    if (result.stdout) sections.push(result.stdout)
    if (result.stderr) sections.push(`Error:\n${result.stderr}`)
    if (result.compileOutput) sections.push(`Compiler:\n${result.compileOutput}`)
    if (result.message) sections.push(result.message)

    return sections.length > 0
        ? sections.join("\n\n")
        : "Program finished with no output."
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
}

export default function CompilerArea({
                                         initialLanguage = "python",
                                         initialCode,
                                         initialInput = "",
                                         onChange,
                                         onRun,
                                         readOnly = false,
                                         className = "",
                                     }) {
    const safeInitialLanguage = LANGUAGE_OPTIONS.some(
        (item) => item.id === initialLanguage
    )
        ? initialLanguage
        : "python"

    const [language, setLanguage] = useState(safeInitialLanguage)
    const [code, setCode] = useState(
        typeof initialCode === "string" && initialCode.trim()
            ? initialCode
            : STARTER_CODES[safeInitialLanguage]
    )
    const [stdin] = useState(initialInput)
    const [runResult, setRunResult] = useState(null)
    const [isRunning, setIsRunning] = useState(false)
    const [copied, setCopied] = useState(false)
    const [outputHeight, setOutputHeight] = useState(150)
    const [isResizing, setIsResizing] = useState(false)

    const containerRef = useRef(null)
    const onChangeRef = useRef(onChange)
    const autosaveTimerRef = useRef(null)
    const lastSavedRef = useRef({
        language: safeInitialLanguage,
        code:
            typeof initialCode === "string" && initialCode.trim()
                ? initialCode
                : STARTER_CODES[safeInitialLanguage],
        stdin: initialInput,
    })

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
        }
    }, [])

    useEffect(() => {
        function handleMouseMove(event) {
            if (!isResizing || !containerRef.current) return

            const rect = containerRef.current.getBoundingClientRect()
            const nextOutputHeight = rect.bottom - event.clientY
            const maxOutputHeight = Math.max(220, rect.height - 230)

            setOutputHeight(clamp(nextOutputHeight, 110, maxOutputHeight))
        }

        function handleMouseUp() {
            setIsResizing(false)
        }

        if (isResizing) {
            document.body.style.cursor = "row-resize"
            document.body.style.userSelect = "none"
            window.addEventListener("mousemove", handleMouseMove)
            window.addEventListener("mouseup", handleMouseUp)
        }

        return () => {
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mouseup", handleMouseUp)
        }
    }, [isResizing])

    const editorExtensions = useMemo(() => [getLanguageExtension(language)], [language])
    const outputText = useMemo(() => getOutputText(runResult), [runResult])
    const selectedLanguageLabel = getLanguageLabel(language)

    const handleAutoSave = useCallback((nextState) => {
        const previousState = lastSavedRef.current

        const hasChanged =
            previousState.language !== nextState.language ||
            previousState.code !== nextState.code ||
            previousState.stdin !== nextState.stdin

        if (!hasChanged) return

        lastSavedRef.current = nextState

        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)

        autosaveTimerRef.current = setTimeout(() => {
            onChangeRef.current?.(nextState)
        }, 750)
    }, [])

    function updateCompilerState(nextValues) {
        const nextState = { language, code, stdin, ...nextValues }

        if (Object.prototype.hasOwnProperty.call(nextValues, "language")) {
            setLanguage(nextValues.language)
        }

        if (Object.prototype.hasOwnProperty.call(nextValues, "code")) {
            setCode(nextValues.code)
        }

        handleAutoSave(nextState)
    }

    function handleLanguageChange(nextLanguage) {
        const shouldReplaceCode = !code.trim() || isStarterCode(code)

        updateCompilerState({
            language: nextLanguage,
            code: shouldReplaceCode ? STARTER_CODES[nextLanguage] : code,
        })

        setRunResult(null)
    }

    async function handleRunCode() {
        if (readOnly || isRunning) return

        setIsRunning(true)
        setRunResult(null)

        try {
            if (typeof onRun !== "function") {
                setRunResult({
                    status: "idle",
                    stdout:
                        "Compiler backend is not connected yet.\n\nPass an onRun function to CompilerArea to execute C, C++, Java, or Python code.",
                    stderr: "",
                    compileOutput: "",
                    message: "",
                    exitCode: null,
                    time: null,
                    memory: null,
                })
                return
            }

            const result = await onRun({ language, sourceCode: code, code, stdin })
            setRunResult(normalizeRunResult(result))
        } catch (error) {
            setRunResult({
                status: "error",
                stdout: "",
                stderr:
                    error?.response?.data?.message ??
                    error?.message ??
                    "Code execution failed. Please try again.",
                compileOutput: "",
                message: "",
                exitCode: null,
                time: null,
                memory: null,
            })
        } finally {
            setIsRunning(false)
        }
    }

    function resetStarterCode() {
        updateCompilerState({ code: STARTER_CODES[language] })
        setRunResult(null)
    }

    function clearOutput() {
        setRunResult(null)
    }

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
        } catch {
            setCopied(false)
        }
    }

    return (
        <div
            ref={containerRef}
            className={`flex h-full min-h-[620px] w-full flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm ${className}`}
        >
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-sky-100 bg-white px-3">
                <div className="flex min-w-0 items-center gap-2">
                    <div className="rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {getFileName(language)}
                    </div>

                    <Badge
                        variant="outline"
                        className="hidden rounded-full border-sky-200 bg-sky-50 text-[11px] text-sky-600 sm:inline-flex"
                    >
                        <Code2 className="mr-1 size-3" />
                        {selectedLanguageLabel}
                    </Badge>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={copyCode}
                        className="size-8 text-slate-500"
                        aria-label="Copy code"
                    >
                        {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={resetStarterCode}
                        disabled={readOnly || isRunning}
                        className="size-8 text-slate-500"
                        aria-label="Reset code"
                    >
                        <RotateCcw className="size-4" />
                    </Button>

                    <Select
                        value={language}
                        onValueChange={handleLanguageChange}
                        disabled={readOnly || isRunning}
                    >
                        <SelectTrigger className="h-8 w-[116px] rounded-md border-sky-100 bg-sky-50 px-2 text-xs">
                            <SelectValue placeholder="Language" />
                        </SelectTrigger>

                        <SelectContent>
                            {LANGUAGE_OPTIONS.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        type="button"
                        onClick={handleRunCode}
                        disabled={readOnly || isRunning}
                        className="h-8 rounded-md bg-sky-500 px-3 text-xs font-semibold hover:bg-sky-600"
                    >
                        {isRunning ? (
                            <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                            <CirclePlay className="mr-1.5 size-3.5" />
                        )}
                        {isRunning ? "Running..." : "Run code"}
                    </Button>
                </div>
            </div>

            <section className="min-h-0 flex-1 overflow-hidden bg-white">
                <CodeMirror
                    value={code}
                    height="100%"
                    minHeight="260px"
                    extensions={editorExtensions}
                    editable={!readOnly}
                    basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        highlightActiveLine: true,
                        highlightSelectionMatches: true,
                        autocompletion: true,
                        bracketMatching: true,
                        closeBrackets: true,
                    }}
                    onChange={(value) => updateCompilerState({ code: value })}
                    className="h-full text-sm [&_.cm-activeLine]:bg-sky-50 [&_.cm-editor]:h-full [&_.cm-focused]:outline-none [&_.cm-gutters]:border-sky-100 [&_.cm-gutters]:bg-sky-50/50"
                />
            </section>

            <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize program result panel"
                onMouseDown={() => setIsResizing(true)}
                className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center border-y border-sky-100 bg-sky-50/70 transition hover:bg-sky-100"
            >
                <GripHorizontal className="size-4 text-sky-300 transition group-hover:text-sky-500" />
            </div>

            <aside
                className="shrink-0 bg-[#eef9fd]"
                style={{ height: `${outputHeight}px` }}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-sky-100 bg-white px-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
                                <Terminal className="size-3.5" />
                            </div>

                            <div className="min-w-0">
                                <h3 className="truncate text-xs font-bold text-slate-700">
                                    Program Result
                                </h3>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {runResult?.exitCode !== null && runResult?.exitCode !== undefined ? (
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-sky-100 bg-sky-50 text-[10px] text-sky-600"
                                >
                                    Exit: {runResult.exitCode}
                                </Badge>
                            ) : null}

                            {runResult?.time ? (
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-sky-100 bg-sky-50 text-[10px] text-sky-600"
                                >
                                    Time: {runResult.time}
                                </Badge>
                            ) : null}

                            {runResult?.memory ? (
                                <Badge
                                    variant="outline"
                                    className="rounded-full border-sky-100 bg-sky-50 text-[10px] text-sky-600"
                                >
                                    Memory: {runResult.memory}
                                </Badge>
                            ) : null}

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={clearOutput}
                                disabled={!runResult}
                                className="h-7 px-2 text-[11px] text-slate-400"
                            >
                                <Trash2 className="mr-1 size-3" />
                                Clear
                            </Button>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-3 text-xs leading-6 text-slate-100">
            <pre className="whitespace-pre-wrap break-words font-mono">
              {outputText}
            </pre>
                    </div>
                </div>
            </aside>
        </div>
    )
}
