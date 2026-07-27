import React, { useEffect, useState } from "react"
import {
    AlertCircleIcon,
    BookOpen,
    ChevronDown,
    ChevronRight,
    FileSpreadsheet,
    FileText,
    FolderTree,
    Plus,
    Sparkles,
    Trash2,
    UploadIcon,
    XIcon,
} from "lucide-react"

import { toast } from "sonner"

import { formatBytes, useFileUpload } from "@/hooks/use-file-upload"
import { Button } from "@/components/ui/button"
import { GenerationHandoffProgress } from "@/components/certifications/generation-handoff-progress.jsx"
import { generateCertificationStructure } from "@/services/certificationService"
import { mapCertificationToModuleStructure } from "@/utils/certification-structure"

const createId = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`

function getBackendErrorMessage(error, fallbackMessage) {
    const responseData = error?.response?.data

    return (
        (typeof responseData === "string" && responseData) ||
        responseData?.message ||
        error?.message ||
        fallbackMessage
    )
}

function IconButton({
                        children,
                        label,
                        onClick,
                        className = "",
                    }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${className}`}
        >
            {children}
        </button>
    )
}

function ExamBadges({ exams }) {
    if (!Array.isArray(exams) || exams.length === 0) {
        return null
    }

    return (
        <div className="mt-1 flex flex-wrap items-center gap-1">
            {exams.map((exam) => (
                <span
                    key={exam.examId}
                    title={`${exam.examType ?? "Exam"} · ${exam.status ?? "DRAFT"}`}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                >
                    <FileText size={11} className="text-zinc-400" />
                    {exam.title}
                    {exam.totalQuestions != null && (
                        <span className="text-zinc-400">· {exam.totalQuestions}Q</span>
                    )}
                </span>
            ))}
        </div>
    )
}

function getFileExtension(fileName = "") {
    return fileName.split(".").pop()?.toLowerCase() ?? ""
}

function getDocumentLabel(fileName) {
    const extension = getFileExtension(fileName)

    if (extension === "pdf") {
        return "PDF document"
    }

    if (extension === "doc" || extension === "docx") {
        return "Word document"
    }

    if (extension === "csv") {
        return "CSV spreadsheet"
    }

    return "Document"
}

function DocumentIcon({ fileName }) {
    const extension = getFileExtension(fileName)

    if (extension === "csv") {
        return (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <FileSpreadsheet size={19} />
            </div>
        )
    }

    if (extension === "pdf") {
        return (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <FileText size={19} />
            </div>
        )
    }

    return (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FileText size={19} />
        </div>
    )
}

function GenerateCertificationStructure({
                                            onCancel,
                                            onGenerate,
                                            isGenerating = false,
                                        }) {
    const maxSizeMB = 10
    const maxSize = maxSizeMB * 1024 * 1024
    const maxFiles = 10

    const [submitError, setSubmitError] = useState("")

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
    })

    useEffect(() => {
        if (files.length > 0 && submitError) {
            setSubmitError("")
        }
    }, [files.length, submitError])

    const handleGenerate = async () => {
        const selectedDocuments = files.map((item) => item.file)

        if (selectedDocuments.length === 0) {
            setSubmitError(
                "Upload at least one document before generating the certification structure."
            )
            return
        }

        if (errors.length > 0) {
            setSubmitError(
                "Fix the upload error before generating the certification structure."
            )
            return
        }

        setSubmitError("")

        try {
            await onGenerate?.(selectedDocuments)
        } catch (error) {


            setSubmitError(
                getBackendErrorMessage(
                    error,
                    "Structure generation failed. Please try again."
                )
            )
        }
    }

    const handleClearFiles = () => {
        clearFiles()
        setSubmitError("")
    }

    const hasUploadError = Boolean(submitError || errors.length > 0)

    return (
        <section className="w-full pb-28">
            <div className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white">
                        <Sparkles size={18} />
                    </div>

                    <div>
                        <h2 className="text-base font-semibold text-zinc-950">
                            Generate Certification Structure
                        </h2>

                        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                            Upload a syllabus, curriculum, topic outline, certification
                            guide, or CSV file. REBYU will use the document to generate
                            major categories, middle categories, and lessons.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2">
                    <div
                        className={`relative flex min-h-56 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors has-[input:focus]:ring-2 data-[dragging=true]:bg-zinc-50 ${
                            hasUploadError
                                ? "border-red-500 bg-red-50/40 has-[input:focus]:border-red-500 has-[input:focus]:ring-red-100"
                                : "border-zinc-300 has-[input:focus]:border-zinc-950 has-[input:focus]:ring-zinc-200"
                        }`}
                        data-dragging={isDragging || undefined}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <input
                            {...getInputProps()}
                            aria-label="Upload certification documents"
                            className="sr-only"
                        />

                        <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
                            <div className="mb-3 flex size-12 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600">
                                <FileText size={20} />
                            </div>

                            <p className="mb-1.5 text-sm font-medium text-zinc-900">
                                Drop your documents here
                            </p>

                            <p className="max-w-sm text-xs leading-5 text-zinc-500">
                                PDF, DOC, DOCX, or CSV files. Maximum {maxFiles} files and{" "}
                                {maxSizeMB} MB per file.
                            </p>

                            <Button
                                type="button"
                                className="mt-4"
                                onClick={openFileDialog}
                                variant="outline"
                            >
                                <UploadIcon
                                    aria-hidden="true"
                                    className="-ms-1 size-4 opacity-60"
                                />
                                Select documents
                            </Button>
                        </div>
                    </div>

                    {(submitError || errors.length > 0) && (
                        <div
                            className="flex items-start gap-1.5 text-xs leading-5 text-red-600"
                            role="alert"
                        >
                            <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
                            <span>{submitError || errors[0]}</span>
                        </div>
                    )}

                    {files.length > 0 && (
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-zinc-800">
                                    Uploaded documents
                                </p>

                                <p className="text-xs text-zinc-500">
                                    {files.length} of {maxFiles} selected
                                </p>
                            </div>

                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3"
                                >
                                    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                                        <DocumentIcon fileName={file.file.name} />

                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-zinc-900">
                                                {file.file.name}
                                            </p>

                                            <p className="mt-0.5 text-xs text-zinc-500">
                                                {getDocumentLabel(file.file.name)} ·{" "}
                                                {formatBytes(file.file.size)}
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        aria-label={`Remove ${file.file.name}`}
                                        className="size-8 shrink-0 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                                        onClick={() => removeFile(file.id)}
                                        size="icon"
                                        variant="ghost"
                                    >
                                        <XIcon aria-hidden="true" className="size-4" />
                                    </Button>
                                </div>
                            ))}

                            {files.length > 1 && (
                                <div className="pt-1">
                                    <Button
                                        type="button"
                                        onClick={handleClearFiles}
                                        size="sm"
                                        variant="outline"
                                    >
                                        Remove all files
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
                <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
                    <Button
                        type="button"
                        onClick={onCancel}
                        variant="outline"
                        disabled={isGenerating}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        onClick={handleGenerate}
                        className="gap-2"
                        disabled={isGenerating}
                    >
                        <Sparkles size={16} />
                        {isGenerating ? "Generating..." : "Generate"}
                    </Button>
                </div>
            </div>
        </section>
    )
}

function CertificationModules({
                                  certificationId = null,
                                  value,
                                  onChange,
                                  onCreateMiddleExam,
                                  onGenerateForNewCertification,
                                  onGenerationComplete,
                                  onGenerationStarted,
                              }) {
    const [localCategories, setLocalCategories] = useState([])
    const [currentPage, setCurrentPage] = useState("default")
    const [isGeneratingStructure, setIsGeneratingStructure] = useState(false)
    // Real byte progress from axios, so the panel reports what is actually
    // happening instead of advancing on a timer.
    const [uploadPercent, setUploadPercent] = useState(0)
    const [pendingFileCount, setPendingFileCount] = useState(0)

    const categories = Array.isArray(value) ? value : localCategories

    const updateCategories = (updater) => {
        const nextCategories =
            typeof updater === "function" ? updater(categories) : updater

        if (!Array.isArray(value)) {
            setLocalCategories(nextCategories)
        }

        onChange?.(nextCategories)
    }

    const addMajorCategory = () => {
        updateCategories((previous) => [
            ...previous,
            {
                id: createId(),
                title: "",
                isOpen: true,
                middleCategories: [],
            },
        ])
    }

    const deleteMajorCategory = (majorId) => {
        updateCategories((previous) =>
            previous.filter((category) => category.id !== majorId)
        )
    }

    const toggleMajorCategory = (majorId) => {
        updateCategories((previous) =>
            previous.map((category) =>
                category.id === majorId
                    ? {
                        ...category,
                        isOpen: !category.isOpen,
                    }
                    : category
            )
        )
    }

    const updateMajorCategoryTitle = (majorId, title) => {
        updateCategories((previous) =>
            previous.map((category) =>
                category.id === majorId
                    ? {
                        ...category,
                        title,
                    }
                    : category
            )
        )
    }

    const addMiddleCategory = (majorId) => {
        updateCategories((previous) =>
            previous.map((category) => {
                if (category.id !== majorId) {
                    return category
                }

                return {
                    ...category,
                    isOpen: true,
                    middleCategories: [
                        ...category.middleCategories,
                        {
                            id: createId(),
                            title: "",
                            isOpen: true,
                            lessons: [],
                        },
                    ],
                }
            })
        )
    }

    const deleteMiddleCategory = (majorId, middleId) => {
        updateCategories((previous) =>
            previous.map((category) => {
                if (category.id !== majorId) {
                    return category
                }

                return {
                    ...category,
                    middleCategories: category.middleCategories.filter(
                        (middleCategory) => middleCategory.id !== middleId
                    ),
                }
            })
        )
    }

    const toggleMiddleCategory = (majorId, middleId) => {
        updateCategories((previous) =>
            previous.map((category) => {
                if (category.id !== majorId) {
                    return category
                }

                return {
                    ...category,
                    middleCategories: category.middleCategories.map(
                        (middleCategory) =>
                            middleCategory.id === middleId
                                ? {
                                    ...middleCategory,
                                    isOpen: !middleCategory.isOpen,
                                }
                                : middleCategory
                    ),
                }
            })
        )
    }

    const updateMiddleCategoryTitle = (majorId, middleId, title) => {
        updateCategories((previous) =>
            previous.map((category) => {
                if (category.id !== majorId) {
                    return category
                }

                return {
                    ...category,
                    middleCategories: category.middleCategories.map(
                        (middleCategory) =>
                            middleCategory.id === middleId
                                ? {
                                    ...middleCategory,
                                    title,
                                }
                                : middleCategory
                    ),
                }
            })
        )
    }

    const addLesson = (majorId, middleId) => {
        updateCategories((previous) =>
            previous.map((category) => {
                if (category.id !== majorId) {
                    return category
                }

                return {
                    ...category,
                    middleCategories: category.middleCategories.map(
                        (middleCategory) => {
                            if (middleCategory.id !== middleId) {
                                return middleCategory
                            }

                            return {
                                ...middleCategory,
                                isOpen: true,
                                lessons: [
                                    ...middleCategory.lessons,
                                    {
                                        id: createId(),
                                        name: "",
                                    },
                                ],
                            }
                        }
                    ),
                }
            })
        )
    }

    const deleteLesson = (majorId, middleId, lessonId) => {
        updateCategories((previous) =>
            previous.map((category) => {
                if (category.id !== majorId) {
                    return category
                }

                return {
                    ...category,
                    middleCategories: category.middleCategories.map(
                        (middleCategory) => {
                            if (middleCategory.id !== middleId) {
                                return middleCategory
                            }

                            return {
                                ...middleCategory,
                                lessons: middleCategory.lessons.filter(
                                    (lesson) => lesson.id !== lessonId
                                ),
                            }
                        }
                    ),
                }
            })
        )
    }

    const updateLessonName = (majorId, middleId, lessonId, name) => {
        updateCategories((previous) =>
            previous.map((category) => {
                if (category.id !== majorId) {
                    return category
                }

                return {
                    ...category,
                    middleCategories: category.middleCategories.map(
                        (middleCategory) => {
                            if (middleCategory.id !== middleId) {
                                return middleCategory
                            }

                            return {
                                ...middleCategory,
                                lessons: middleCategory.lessons.map((lesson) =>
                                    lesson.id === lessonId
                                        ? {
                                            ...lesson,
                                            name,
                                        }
                                        : lesson
                                ),
                            }
                        }
                    ),
                }
            })
        )
    }

    const handleCreateMiddleExam = (majorCategory, middleCategory) => {
        const examContext = {
            examType: "MIDDLE_EXAM",
            majorCategoryId: majorCategory.id,
            majorCategoryTitle: majorCategory.title,
            middleCategoryId: middleCategory.id,
            middleCategoryTitle: middleCategory.title,
            totalLessons: middleCategory.lessons.length,
        }

        onCreateMiddleExam?.(examContext)
    }

    const handleGenerateDocuments = async (selectedDocuments) => {
        try {
            setIsGeneratingStructure(true)
            setPendingFileCount(selectedDocuments.length)
            setUploadPercent(0)

            let savedCertification = null

            if (certificationId != null) {
                savedCertification = await generateCertificationStructure(
                    certificationId,
                    selectedDocuments,
                    (event) =>
                        setUploadPercent(
                            event.total
                                ? Math.round((event.loaded / event.total) * 100)
                                : 0
                        )
                )
            } else if (onGenerateForNewCertification) {
                savedCertification =
                    await onGenerateForNewCertification(selectedDocuments)
            } else {
                throw new Error(
                    "Save the certification first before generating its structure."
                )
            }

            // Curriculum generation now runs asynchronously in the background
            // (see the RabbitMQ-driven Python consumer) -- the response here
            // only confirms the request was queued, not that any categories
            // or lessons exist yet. Reflect whatever came back (an empty
            // structure) and let the notification bell announce completion.
            updateCategories(
                mapCertificationToModuleStructure(savedCertification)
            )
            setCurrentPage("default")

            // Hand the run to the monitor rendered in this same modal rather
            // than navigating away. Generation is a long conversation the admin
            // steers -- it pauses for their review repeatedly -- and sending
            // them to a different page mid-flow loses the thread of what they
            // were doing.
            const targetId = certificationId ?? savedCertification?.certificationId
            if (targetId != null) {
                onGenerationStarted?.(targetId)
                return
            }

            // No id to follow (a brand-new certification whose save did not
            // return one): announce it rather than opening a monitor that has
            // nothing to attach to.
            onGenerationComplete?.({
                title: "AI generation started",
                description:
                    "Building the curriculum in the background — you'll get a notification here when it's ready to review.",
            })
        } finally {
            setIsGeneratingStructure(false)
            setUploadPercent(0)
        }
    }

    const totalMiddleCategories = categories.reduce(
        (total, category) => total + category.middleCategories.length,
        0
    )

    const totalLessons = categories.reduce(
        (total, category) =>
            total +
            category.middleCategories.reduce(
                (middleTotal, middleCategory) =>
                    middleTotal + middleCategory.lessons.length,
                0
            ),
        0
    )

    if (currentPage === "generate") {
        return (
            <>
                <GenerateCertificationStructure
                    onCancel={() => setCurrentPage("default")}
                    onGenerate={handleGenerateDocuments}
                    isGenerating={isGeneratingStructure}
                />

                <GenerationHandoffProgress
                    phase={
                        !isGeneratingStructure
                            ? "idle"
                            : uploadPercent < 100
                                ? "uploading"
                                : "processing"
                    }
                    uploadPercent={uploadPercent}
                    fileCount={pendingFileCount}
                />
            </>
        )
    }

    return (
        <section className="w-full pb-28">
            <div className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
                <div className="mb-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => setCurrentPage("generate")}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 sm:w-auto"
                    >
                        <Sparkles size={16} />
                        Generate
                    </button>
                </div>

                <h2 className="text-base font-semibold text-zinc-950">
                    Categories and Lessons
                </h2>

                <p className="mt-1 max-w-xl text-sm text-zinc-500">
                    Build the certification structure by adding major categories,
                    middle categories, and lessons.
                </p>

                <p className="mt-3 text-xs font-medium text-zinc-400">
                    {categories.length} major categories · {totalMiddleCategories} middle
                    categories · {totalLessons} lessons
                </p>
            </div>

            {categories.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-900 shadow-sm">
                        <FolderTree size={24} />
                    </div>

                    <h3 className="mt-4 text-base font-semibold text-zinc-900">
                        Start building your certification
                    </h3>

                    <p className="mt-1 max-w-sm text-sm leading-6 text-zinc-500">
                        Use the black plus button in the lower-right corner to create your
                        first major category.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {categories.map((majorCategory, majorIndex) => {
                        const middleCount = majorCategory.middleCategories.length

                        return (
                            <div
                                key={majorCategory.id}
                                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                            >
                                <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                                    <button
                                        type="button"
                                        onClick={() => toggleMajorCategory(majorCategory.id)}
                                        aria-label="Show or hide middle categories"
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
                                    >
                                        {majorCategory.isOpen ? (
                                            <ChevronDown size={18} />
                                        ) : (
                                            <ChevronRight size={18} />
                                        )}
                                    </button>

                                    <span className="w-8 text-xl font-semibold tracking-tight text-zinc-400">
                    {String(majorIndex + 1).padStart(2, "0")}
                  </span>

                                    <div className="min-w-0 flex-1">
                                        <input
                                            value={majorCategory.title}
                                            onChange={(event) =>
                                                updateMajorCategoryTitle(
                                                    majorCategory.id,
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Major category title"
                                            className="w-full bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400"
                                        />

                                        <p className="mt-0.5 text-xs text-zinc-400">
                                            {middleCount}{" "}
                                            {middleCount === 1
                                                ? "middle category"
                                                : "middle categories"}
                                        </p>
                                        <ExamBadges exams={majorCategory.exams} />
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <IconButton
                                            label="Add middle category"
                                            onClick={() => addMiddleCategory(majorCategory.id)}
                                            className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                                        >
                                            <Plus size={17} />
                                        </IconButton>

                                        <IconButton
                                            label="Delete major category"
                                            onClick={() => deleteMajorCategory(majorCategory.id)}
                                            className="text-zinc-400 hover:bg-red-50 hover:text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </IconButton>
                                    </div>
                                </div>

                                {majorCategory.isOpen && (
                                    <div className="border-t border-zinc-100 bg-zinc-50/70 px-4 py-4 sm:px-5">
                                        {majorCategory.middleCategories.length === 0 ? (
                                            <button
                                                type="button"
                                                onClick={() => addMiddleCategory(majorCategory.id)}
                                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-sm font-medium text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-950"
                                            >
                                                <Plus size={16} />
                                                Add middle category
                                            </button>
                                        ) : (
                                            <div className="space-y-3">
                                                {majorCategory.middleCategories.map(
                                                    (middleCategory) => (
                                                        <div
                                                            key={middleCategory.id}
                                                            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                                                        >
                                                            <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleMiddleCategory(
                                                                            majorCategory.id,
                                                                            middleCategory.id
                                                                        )
                                                                    }
                                                                    aria-label="Show or hide lessons"
                                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
                                                                >
                                                                    {middleCategory.isOpen ? (
                                                                        <ChevronDown size={17} />
                                                                    ) : (
                                                                        <ChevronRight size={17} />
                                                                    )}
                                                                </button>

                                                                <FolderTree
                                                                    size={16}
                                                                    className="shrink-0 text-zinc-500"
                                                                />

                                                                <div className="min-w-0 flex-1">
                                                                    <input
                                                                        value={middleCategory.title}
                                                                        onChange={(event) =>
                                                                            updateMiddleCategoryTitle(
                                                                                majorCategory.id,
                                                                                middleCategory.id,
                                                                                event.target.value
                                                                            )
                                                                        }
                                                                        placeholder="Middle category title"
                                                                        className="w-full bg-transparent text-sm font-medium text-zinc-800 outline-none placeholder:text-zinc-400"
                                                                    />

                                                                    <p className="mt-0.5 text-xs text-zinc-400">
                                                                        {middleCategory.lessons.length}{" "}
                                                                        {middleCategory.lessons.length === 1
                                                                            ? "lesson"
                                                                            : "lessons"}
                                                                    </p>
                                                                    <ExamBadges exams={middleCategory.exams} />
                                                                </div>

                                                                <div className="flex items-center gap-1">
                                                                    <IconButton
                                                                        label="Create middle exam"
                                                                        onClick={() =>
                                                                            handleCreateMiddleExam(
                                                                                majorCategory,
                                                                                middleCategory
                                                                            )
                                                                        }
                                                                        className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                                                                    >
                                                                        <FileText size={16} />
                                                                    </IconButton>

                                                                    <IconButton
                                                                        label="Add lesson"
                                                                        onClick={() =>
                                                                            addLesson(
                                                                                majorCategory.id,
                                                                                middleCategory.id
                                                                            )
                                                                        }
                                                                        className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                                                                    >
                                                                        <Plus size={16} />
                                                                    </IconButton>

                                                                    <IconButton
                                                                        label="Delete middle category"
                                                                        onClick={() =>
                                                                            deleteMiddleCategory(
                                                                                majorCategory.id,
                                                                                middleCategory.id
                                                                            )
                                                                        }
                                                                        className="text-zinc-400 hover:bg-red-50 hover:text-red-500"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </IconButton>
                                                                </div>
                                                            </div>

                                                            {middleCategory.isOpen && (
                                                                <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-3 sm:px-4">
                                                                    {middleCategory.lessons.length === 0 ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                addLesson(
                                                                                    majorCategory.id,
                                                                                    middleCategory.id
                                                                                )
                                                                            }
                                                                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-950"
                                                                        >
                                                                            <Plus size={15} />
                                                                            Add first lesson
                                                                        </button>
                                                                    ) : (
                                                                        <>
                                                                            <div className="space-y-2">
                                                                                {middleCategory.lessons.map(
                                                                                    (lesson, lessonIndex) => (
                                                                                        <div
                                                                                            key={lesson.id}
                                                                                            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
                                                                                        >
                                              <span className="w-5 text-xs font-semibold text-zinc-400">
                                                {String(
                                                    lessonIndex + 1
                                                ).padStart(2, "0")}
                                              </span>

                                                                                            <BookOpen
                                                                                                size={15}
                                                                                                className="shrink-0 text-zinc-500"
                                                                                            />

                                                                                            <div className="min-w-0 flex-1">
                                                                                                <input
                                                                                                    value={lesson.name}
                                                                                                    onChange={(event) =>
                                                                                                        updateLessonName(
                                                                                                            majorCategory.id,
                                                                                                            middleCategory.id,
                                                                                                            lesson.id,
                                                                                                            event.target.value
                                                                                                        )
                                                                                                    }
                                                                                                    placeholder="Lesson name"
                                                                                                    className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
                                                                                                />
                                                                                                <ExamBadges exams={lesson.exams} />
                                                                                            </div>

                                                                                            <IconButton
                                                                                                label="Delete lesson"
                                                                                                onClick={() =>
                                                                                                    deleteLesson(
                                                                                                        majorCategory.id,
                                                                                                        middleCategory.id,
                                                                                                        lesson.id
                                                                                                    )
                                                                                                }
                                                                                                className="text-zinc-400 hover:bg-red-50 hover:text-red-500"
                                                                                            >
                                                                                                <Trash2 size={15} />
                                                                                            </IconButton>
                                                                                        </div>
                                                                                    )
                                                                                )}
                                                                            </div>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    addLesson(
                                                                                        majorCategory.id,
                                                                                        middleCategory.id
                                                                                    )
                                                                                }
                                                                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-950"
                                                                            >
                                                                                <Plus size={15} />
                                                                                Add another lesson
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => addMiddleCategory(majorCategory.id)}
                                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-950"
                                                >
                                                    <Plus size={16} />
                                                    Add another middle category
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <button
                type="button"
                onClick={addMajorCategory}
                title="Add major category"
                aria-label="Add major category"
                className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg transition duration-200 hover:scale-105 hover:bg-zinc-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-4 sm:right-6"
            >
                <Plus size={24} strokeWidth={2.5} />
            </button>
        </section>
    )
}

export default CertificationModules