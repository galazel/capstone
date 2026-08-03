import React, { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  AlignLeft,
  ArrowLeft,
  BetweenHorizontalEnd,
  CheckCircle2,
  CircleAlert,
  Download,
  FileIcon,
  FilePlay,
  FileSpreadsheet,
  FileText,
  FlipHorizontal,
  Heading as HeadingIcon,
  Image as ImageIcon,
  List,
  ListCollapse,
  ListOrdered,
  PanelLeft,
  PanelRight,
  PanelsTopLeft,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  UploadIcon,
} from "@/components/icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatBytes, useFileUpload } from "@/hooks/use-file-upload"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import Section from "../../components/certifications/section"
import AiGenerationProgress from "../../components/commons/ai-generation-progress.jsx"
import {
  generateLessonFromFiles,
  getLessonComponent,
  setLessonComponent,
} from "../../services/lessonService.js"
import {
  getGeneratedLessonWarnings,
  mapGeneratedLessonDraftsToSections,
} from "../../utils/generated-lesson-draft-mapper.js"
import { saveFile as MediaFileUpload } from "../../services/fileService.js"

function getBackendErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data

  return (
      (typeof responseData === "string" && responseData) ||
      responseData?.message ||
      error?.message ||
      fallbackMessage
  )
}

function createId() {
  return crypto.randomUUID()
}

const individualActions = [
  {
    type: "heading",
    name: "Heading",
    description: "Add a main lesson heading",
    icon: HeadingIcon,
    createData: () => ({
      text: "",
    }),
  },
  {
    type: "subheading",
    name: "Smaller Heading",
    description: "Add a supporting heading",
    icon: Type,
    createData: () => ({
      text: "",
    }),
  },
  {
    type: "description",
    name: "Description",
    description: "Add lesson text or explanation",
    icon: AlignLeft,
    createData: () => ({
      text: "",
    }),
  },
  {
    type: "unordered-list",
    name: "Bullet List",
    description: "Add unordered list items",
    icon: List,
    createData: () => ({
      items: [
        {
          id: createId(),
          text: "",
        },
      ],
    }),
  },
  {
    type: "ordered-list",
    name: "Numbered List",
    description: "Add ordered list items",
    icon: ListOrdered,
    createData: () => ({
      items: [
        {
          id: createId(),
          text: "",
        },
      ],
    }),
  },
  {
    type: "image-left-text",
    name: "Image Left + Text",
    description: "Place image beside written content",
    icon: PanelLeft,
    createData: () => ({
      file: null,
      imageKey: "",
      title: "",
      description: "",
    }),
  },
  {
    type: "image-right-text",
    name: "Text Left + Image",
    description: "Place written content beside image",
    icon: PanelRight,
    createData: () => ({
      file: null,
      imageKey: "",
      title: "",
      description: "",
    }),
  },
  {
    type: "tabs",
    name: "Tabs",
    description: "Organize content into tabs",
    icon: PanelsTopLeft,
    createData: () => ({
      items: [
        {
          id: createId(),
          label: "",
          title: "",
          description: "",
        },
      ],
    }),
  },
  {
    type: "accordion",
    name: "Accordion",
    description: "Create expandable content items",
    icon: ListCollapse,
    createData: () => ({
      items: [
        {
          id: createId(),
          title: "",
          content: "",
        },
      ],
    }),
  },
  {
    type: "flip-grid",
    name: "Flip Cards",
    description: "Create interactive review cards",
    icon: FlipHorizontal,
    createData: () => ({
      cards: [
        {
          id: createId(),
          frontTitle: "",
          backTitle: "",
          description: "",
        },
      ],
    }),
  },
  {
    type: "image",
    name: "Image",
    description: "Upload an image",
    icon: ImageIcon,
    createData: () => ({
      file: null,
      imageKey: "",
    }),
  },
  {
    type: "video",
    name: "Video",
    description: "Upload a lesson video",
    icon: FilePlay,
    createData: () => ({
      file: null,
      videoKey: "",
    }),
  },
]

const combinedActions = [
  {
    type: "intro-image-card",
    name: "Intro Image Card",
    description: "Small heading, description, and image",
    icon: ImageIcon,
    createData: () => ({
      smallHeader: "",
      description: "",
      file: null,
      imageKey: "",
    }),
  },
  {
    type: "header-description-grid",
    name: "Header Description Grid",
    description: "Small heading, description, and grid cards",
    icon: PanelsTopLeft,
    createData: () => ({
      smallHeader: "",
      description: "",
      gridItems: [
        {
          id: createId(),
          title: "",
          description: "",
        },
      ],
    }),
  },
  {
    type: "image-feature-grid",
    name: "Image Feature Grid",
    description: "Small heading, description, image, and feature grid",
    icon: PanelLeft,
    createData: () => ({
      smallHeader: "",
      description: "",
      file: null,
      imageKey: "",
      gridItems: [
        {
          id: createId(),
          title: "",
          description: "",
        },
      ],
    }),
  },
  {
    type: "review-card-grid",
    name: "Review Card Grid",
    description: "Small heading, description, and review cards",
    icon: FlipHorizontal,
    createData: () => ({
      smallHeader: "",
      description: "",
      cards: [
        {
          id: createId(),
          frontTitle: "",
          backTitle: "",
          description: "",
        },
      ],
    }),
  },
  {
    type: "content-accordion-block",
    name: "Accordion Content Block",
    description: "Small heading, description, and accordion items",
    icon: ListCollapse,
    createData: () => ({
      smallHeader: "",
      description: "",
      items: [
        {
          id: createId(),
          title: "",
          content: "",
        },
      ],
    }),
  },
  {
    type: "content-tabs-block",
    name: "Tabs Content Block",
    description: "Small heading, description, and tabs",
    icon: PanelsTopLeft,
    createData: () => ({
      smallHeader: "",
      description: "",
      items: [
        {
          id: createId(),
          label: "",
          title: "",
          description: "",
        },
      ],
    }),
  },
  {
    type: "media-text-block",
    name: "Media Text Block",
    description: "Small heading, description, media, and supporting text",
    icon: FilePlay,
    createData: () => ({
      smallHeader: "",
      description: "",
      mediaType: "image",
      file: null,
      imageKey: "",
      videoKey: "",
      supportingTitle: "",
      supportingDescription: "",
      layout: "image-left",
    }),
  },
]

const actionGroups = [
  {
    label: "Individual tools",
    items: individualActions,
  },
  {
    label: "Combined tools",
    items: combinedActions,
  },
]

const actions = actionGroups.flatMap((group) => group.items)

const STATIC_MEDIA_TOOL_CONFIG = {
  image: {
    folderName: "photo",
    keyField: "imageKey",
  },
  "image-left-text": {
    folderName: "photo",
    keyField: "imageKey",
  },
  "image-right-text": {
    folderName: "photo",
    keyField: "imageKey",
  },
  video: {
    folderName: "video",
    keyField: "videoKey",
  },
  "intro-image-card": {
    folderName: "photo",
    keyField: "imageKey",
  },
  "image-feature-grid": {
    folderName: "photo",
    keyField: "imageKey",
  },
}

const MEDIA_TOOL_TYPES = new Set([
  ...Object.keys(STATIC_MEDIA_TOOL_CONFIG),
  "media-text-block",
])

function getMediaToolConfig(tool) {
  if (tool.type === "media-text-block") {
    const mediaType = tool.data?.mediaType === "video" ? "video" : "image"

    return mediaType === "video"
        ? {
          folderName: "video",
          keyField: "videoKey",
          oppositeKeyField: "imageKey",
        }
        : {
          folderName: "photo",
          keyField: "imageKey",
          oppositeKeyField: "videoKey",
        }
  }

  return STATIC_MEDIA_TOOL_CONFIG[tool.type]
}

function LessonToolCard({ action, onClick, disabled }) {
  const Icon = action.icon

  return (
      <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          // The tool's description is a hover tooltip rather than a second line
          // of visible text: with nineteen tools stacked in a narrow panel, a
          // grey subtitle under every one of them was more noise than help.
          title={action.description}
          className="group flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
      >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground transition group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="h-4 w-4" />
      </span>

        <span className="min-w-0 truncate text-sm font-medium leading-5 text-foreground">
          {action.name}
        </span>
      </button>
  )
}

/**
 * Persistent left tools panel — always visible (no collapse-to-icon-rail),
 * matching the community feed's left navigation aside: a bordered card with
 * a muted header, sticky within its scroll container, sitting beside a
 * scrollable center area.
 */
function LessonToolsPanel({ isLoadingLesson, onAddTool }) {
  return (
      <aside className="flex h-full max-h-full w-[300px] shrink-0 flex-col overflow-hidden border-r bg-background">
        <div className="shrink-0 border-b bg-muted/40 px-5 py-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Lesson Tools
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Add tools to the selected lesson section.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="space-y-6 pb-6">
            {actionGroups.map((group) => (
                <section key={group.label} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </h3>

                  <div className="grid gap-1.5">
                    {group.items.map((action) => (
                        <LessonToolCard
                            key={action.type}
                            action={action}
                            disabled={isLoadingLesson}
                            onClick={() => onAddTool(action.type)}
                        />
                    ))}
                  </div>
                </section>
            ))}
          </div>
        </div>
      </aside>
  )
}


function LessonFeedbackDialog({
                                open,
                                type = "success",
                                title,
                                description,
                                onClose,
                              }) {
  const isSuccess = type === "success"

  return (
      <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              onClose()
            }
          }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <div
                className={`mb-2 flex h-11 w-11 items-center justify-center rounded-xl ${
                    isSuccess
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                }`}
            >
              {isSuccess ? (
                  <CheckCircle2 className="h-5 w-5" />
              ) : (
                  <CircleAlert className="h-5 w-5" />
              )}
            </div>

            <DialogTitle className="pr-8 text-lg">{title}</DialogTitle>

            <DialogDescription className="leading-6">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end pt-2">
            <Button type="button" onClick={onClose} className="min-w-20 rounded-lg">
              Okay
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  )
}

function getLessonGenerationFileIcon(file) {
  const fileType = file.file?.type ?? ""
  const fileName = (file.file?.name ?? "").toLowerCase()

  if (
      fileType.includes("pdf") ||
      fileName.endsWith(".pdf") ||
      fileType.includes("word") ||
      fileName.endsWith(".doc") ||
      fileName.endsWith(".docx")
  ) {
    return <FileText className="h-4 w-4 opacity-60" />
  }

  if (
      fileType.includes("csv") ||
      fileType.includes("excel") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".xls") ||
      fileName.endsWith(".xlsx")
  ) {
    return <FileSpreadsheet className="h-4 w-4 opacity-60" />
  }

  return <FileIcon className="h-4 w-4 opacity-60" />
}

function getLessonGenerationFileType(file) {
  const fileType = file.file?.type ?? ""
  const fileName = (file.file?.name ?? "").toLowerCase()

  if (fileType.includes("pdf") || fileName.endsWith(".pdf")) {
    return "PDF"
  }

  if (
      fileType.includes("word") ||
      fileName.endsWith(".doc") ||
      fileName.endsWith(".docx")
  ) {
    return "WORD"
  }

  if (fileType.includes("csv") || fileName.endsWith(".csv")) {
    return "CSV"
  }

  return fileType.split("/")[1]?.toUpperCase() || "UNKNOWN"
}

function GenerateLessonFromFileDialog({
                                        open,
                                        onOpenChange,
                                        onGenerate,
                                        lessonName,
                                        isGenerating = false,
                                      }) {
  const maxFiles = 10
  const maxSizeMB = 10
  const maxSize = maxSizeMB * 1024 * 1024

  const [submitError, setSubmitError] = useState("")
  const [mode, setMode] = useState("append")

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

  function resetForm() {
    clearFiles()
    setSubmitError("")
    setMode("append")
  }

  function handleOpenChange(nextOpen) {
    if (isGenerating) {
      return
    }

    if (!nextOpen) {
      resetForm()
    }

    onOpenChange(nextOpen)
  }

  function handleCancel() {
    if (isGenerating) {
      return
    }

    resetForm()
    onOpenChange(false)
  }

  async function handleGenerate() {
    const selectedDocuments = files.map((item) => item.file)

    if (selectedDocuments.length === 0) {
      setSubmitError("Upload at least one source file before generating the lesson.")
      return
    }

    if (errors.length > 0) {
      setSubmitError("Fix the upload error before generating the lesson.")
      return
    }

    setSubmitError("")

    try {
      await onGenerate?.(selectedDocuments, mode)
      resetForm()
    } catch (error) {
      setSubmitError(
          getBackendErrorMessage(
              error,
              "Lesson generation failed. Please try again."
          )
      )
    }
  }

  const hasUploadError = Boolean(submitError || errors.length > 0)

  return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generate Lesson from File</DialogTitle>

            <DialogDescription className="leading-6">
              Upload source material for{" "}
              <span className="font-medium text-foreground">{lessonName}</span>.
              REBYU will generate and save editable lesson content.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <div
                className={`flex min-h-56 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px] data-[files]:hidden data-[dragging=true]:bg-accent/50 ${
                    hasUploadError
                        ? "border-destructive bg-destructive/5 has-[input:focus]:border-destructive has-[input:focus]:ring-destructive/20"
                        : "border-input has-[input:focus]:border-ring has-[input:focus]:ring-ring/50"
                }`}
                data-dragging={isDragging || undefined}
                data-files={files.length > 0 || undefined}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
              <input
                  {...getInputProps()}
                  aria-label="Upload source documents for lesson generation"
                  className="sr-only"
              />

              <div className="flex flex-col items-center justify-center text-center">
                <div
                    aria-hidden="true"
                    className="mb-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-background"
                >
                  <FileIcon className="h-4 w-4 opacity-60" />
                </div>

                <p className="mb-1.5 text-sm font-medium">Upload files</p>

                <p className="text-xs text-muted-foreground">
                  PDF, DOC, DOCX, or CSV · Max {maxFiles} files · Up to{" "}
                  {formatBytes(maxSize)}
                </p>

                <Button
                    type="button"
                    className="mt-4"
                    onClick={openFileDialog}
                    variant="outline"
                >
                  <UploadIcon aria-hidden="true" className="mr-2 h-4 w-4 opacity-60" />
                  Select files
                </Button>
              </div>
            </div>

            {(submitError || errors.length > 0) && (
                <div
                    className="flex items-start gap-1.5 text-xs leading-5 text-destructive"
                    role="alert"
                >
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{submitError || errors[0]}</span>
                </div>
            )}

            {files.length > 0 && (
                <>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">
                      Files ({files.length} of {maxFiles})
                    </h3>

                    <div className="flex gap-2">
                      <Button
                          type="button"
                          onClick={openFileDialog}
                          size="sm"
                          variant="outline"
                      >
                        <UploadCloud className="mr-1.5 h-3.5 w-3.5 opacity-60" />
                        Add files
                      </Button>

                      <Button
                          type="button"
                          onClick={resetForm}
                          size="sm"
                          variant="outline"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5 opacity-60" />
                        Remove all
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                      <TableHeader className="text-xs">
                        <TableRow className="bg-muted/50">
                          <TableHead className="h-9 py-2">Name</TableHead>
                          <TableHead className="h-9 py-2">Type</TableHead>
                          <TableHead className="h-9 py-2">Size</TableHead>
                          <TableHead className="h-9 w-0 py-2 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody className="text-[13px]">
                        {files.map((file) => (
                            <TableRow key={file.id}>
                              <TableCell className="max-w-48 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <span className="shrink-0">
                              {getLessonGenerationFileIcon(file)}
                            </span>

                            <span className="truncate">{file.file.name}</span>
                          </span>
                              </TableCell>

                              <TableCell className="py-2 text-muted-foreground">
                                {getLessonGenerationFileType(file)}
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
                                            "noopener,noreferrer"
                                        )
                                    }
                                    size="icon"
                                    variant="ghost"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>

                                <Button
                                    type="button"
                                    aria-label={`Remove ${file.file.name}`}
                                    className="h-8 w-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
                                    onClick={() => removeFile(file.id)}
                                    size="icon"
                                    variant="ghost"
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
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <span className="text-sm font-medium">When generation finishes</span>

            <div className="grid grid-cols-2 gap-2">
              <Button
                  type="button"
                  variant={mode === "append" ? "default" : "outline"}
                  onClick={() => setMode("append")}
                  disabled={isGenerating}
                  className="h-auto flex-col items-start gap-0.5 py-2 text-left"
              >
                <span className="text-sm font-medium">Add to lesson</span>
                <span className="text-xs font-normal opacity-80">
                  Keep existing sections, append new ones
                </span>
              </Button>

              <Button
                  type="button"
                  variant={mode === "replace" ? "default" : "outline"}
                  onClick={() => setMode("replace")}
                  disabled={isGenerating}
                  className="h-auto flex-col items-start gap-0.5 py-2 text-left"
              >
                <span className="text-sm font-medium">Replace lesson</span>
                <span className="text-xs font-normal opacity-80">
                  Discard existing sections and start fresh
                </span>
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isGenerating}
            >
              Cancel
            </Button>

            <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
              <Sparkles className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate & Save Lesson"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  )
}

function normalizeArrayItems(items, createDefaultItem, normalizeItem) {
  const sourceItems = Array.isArray(items) && items.length > 0 ? items : [createDefaultItem()]

  return sourceItems.map((item) => normalizeItem(item ?? {}))
}

function normalizeListItems(items) {
  return normalizeArrayItems(
      items,
      () => ({ id: createId(), text: "" }),
      (item) => ({
        id: item.id || createId(),
        text: item.text ?? "",
      })
  )
}

function normalizeGridItems(items) {
  return normalizeArrayItems(
      items,
      () => ({ id: createId(), title: "", description: "" }),
      (item) => ({
        id: item.id || createId(),
        title: item.title ?? "",
        description: item.description ?? "",
      })
  )
}

function normalizeCards(cards) {
  return normalizeArrayItems(
      cards,
      () => ({ id: createId(), frontTitle: "", backTitle: "", description: "" }),
      (card) => ({
        id: card.id || createId(),
        frontTitle: card.frontTitle ?? "",
        backTitle: card.backTitle ?? "",
        description: card.description ?? "",
      })
  )
}

function normalizeAccordionItems(items) {
  return normalizeArrayItems(
      items,
      () => ({ id: createId(), title: "", content: "" }),
      (item) => ({
        id: item.id || createId(),
        title: item.title ?? "",
        content: item.content ?? "",
      })
  )
}

function normalizeTabItems(items) {
  return normalizeArrayItems(
      items,
      () => ({ id: createId(), label: "", title: "", description: "" }),
      (item) => ({
        id: item.id || createId(),
        label: item.label ?? "",
        title: item.title ?? "",
        description: item.description ?? "",
      })
  )
}

function normalizeToolData(type, data = {}, toolId, imageKeys = {}, videoKeys = {}) {
  const normalizedData = {
    ...data,
  }

  if (type === "heading" || type === "subheading" || type === "description") {
    normalizedData.text = normalizedData.text ?? ""
  }

  if (type === "unordered-list" || type === "ordered-list") {
    normalizedData.items = normalizeListItems(normalizedData.items)
  }

  if (type === "tabs" || type === "content-tabs-block") {
    normalizedData.items = normalizeTabItems(normalizedData.items)
  }

  if (type === "accordion" || type === "content-accordion-block") {
    normalizedData.items = normalizeAccordionItems(normalizedData.items)
  }

  if (type === "flip-grid" || type === "review-card-grid") {
    normalizedData.cards = normalizeCards(normalizedData.cards)
  }

  if (type === "header-description-grid" || type === "image-feature-grid") {
    normalizedData.gridItems = normalizeGridItems(normalizedData.gridItems)
  }

  if (
      type === "intro-image-card" ||
      type === "header-description-grid" ||
      type === "image-feature-grid" ||
      type === "review-card-grid" ||
      type === "content-accordion-block" ||
      type === "content-tabs-block" ||
      type === "media-text-block"
  ) {
    normalizedData.smallHeader = normalizedData.smallHeader ?? ""
    normalizedData.description = normalizedData.description ?? ""
  }

  if (type === "image-left-text" || type === "image-right-text") {
    normalizedData.title = normalizedData.title ?? ""
    normalizedData.description = normalizedData.description ?? ""
  }

  if (type === "media-text-block") {
    normalizedData.mediaType = normalizedData.mediaType === "video" ? "video" : "image"
    normalizedData.supportingTitle = normalizedData.supportingTitle ?? ""
    normalizedData.supportingDescription = normalizedData.supportingDescription ?? ""
    normalizedData.layout =
        normalizedData.layout === "image-right" ? "image-right" : "image-left"
  }

  if (MEDIA_TOOL_TYPES.has(type)) {
    normalizedData.file = null
  }

  if (
      type === "image" ||
      type === "image-left-text" ||
      type === "image-right-text" ||
      type === "intro-image-card" ||
      type === "image-feature-grid" ||
      type === "media-text-block"
  ) {
    normalizedData.imageKey = imageKeys[toolId] ?? normalizedData.imageKey ?? ""
  }

  if (type === "video" || type === "media-text-block") {
    normalizedData.videoKey = videoKeys[toolId] ?? normalizedData.videoKey ?? ""
  }

  return normalizedData
}

function isBrowserFile(value) {
  return typeof File !== "undefined" && value instanceof File
}

function removeBrowserFiles(value) {
  if (isBrowserFile(value)) {
    return null
  }

  if (Array.isArray(value)) {
    return value.map((item) => removeBrowserFiles(item))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, removeBrowserFiles(item)])
    )
  }

  return value
}

function CreateLessons() {
  const navigate = useNavigate()
  const location = useLocation()

  const state = location.state ?? {}

  const lessonName = state.lessonName ?? "Untitled Lesson"
  const lessonId = state.lessonId ?? 0

  const [sections, setSections] = useState([])
  const [sectionIndex, setSectionIndex] = useState(0)

  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingLesson, setIsLoadingLesson] = useState(true)
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false)
  const [isLessonFileGeneratorOpen, setIsLessonFileGeneratorOpen] =
      useState(false)

  const [isErrorAddingToolWithoutSection, setIsErrorAddingToolWithoutSection] =
      useState(false)

  const [validationError, setValidationError] = useState("")

  function normalizeSections(savedSections, imageKeys = {}, videoKeys = {}) {
    if (!Array.isArray(savedSections)) {
      return []
    }

    return savedSections.map((section) => ({
      id: section.id || createId(),
      sectionName: section.sectionName ?? "",
      content: Array.isArray(section.content)
          ? section.content.map((tool) => {
            const toolId = tool.id || createId()
            const toolType = tool.type ?? ""

            return {
              id: toolId,
              type: toolType,
              data: normalizeToolData(
                  toolType,
                  tool.data ?? {},
                  toolId,
                  imageKeys,
                  videoKeys
              ),
            }
          })
          : [],
    }))
  }

  function parseLessonComponent(response) {
    const responseData = response?.data ?? response ?? {}

    const structure = responseData.lessonComponentStructure ?? "[]"
    const imageKeys = responseData.imageKeys ?? {}
    const videoKeys = responseData.videoKeys ?? {}

    if (Array.isArray(structure)) {
      return normalizeSections(structure, imageKeys, videoKeys)
    }

    if (typeof structure !== "string" || structure.trim().length === 0) {
      return []
    }

    try {
      const parsedStructure = JSON.parse(structure)

      return normalizeSections(parsedStructure, imageKeys, videoKeys)
    } catch (error) {
      toast.error("Could not read saved lesson", {
        description:
            error?.message || "The saved lesson component JSON is invalid.",
      })

      return []
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadSavedLesson() {
      if (!lessonId) {
        if (isMounted) {
          setSections([])
          setIsLoadingLesson(false)
        }

        return
      }

      try {
        setIsLoadingLesson(true)

        const response = await getLessonComponent(lessonId)
        const savedSections = parseLessonComponent(response)

        if (!isMounted) {
          return
        }

        setSections(savedSections)
        setSectionIndex(0)
      } catch (error) {
        if (isMounted) {
          setSections([])

          const errorMessage = "Could not load the saved lesson content."

          setValidationError(errorMessage)

          toast.error("Could not load lesson", {
            description: error?.message || errorMessage,
          })
        }
      } finally {
        if (isMounted) {
          setIsLoadingLesson(false)
        }
      }
    }

    loadSavedLesson()

    return () => {
      isMounted = false
    }
  }, [lessonId])

  function handleCancel() {
    navigate(-1)
  }

  function handleGenerateLesson() {
    if (isLoadingLesson || isGeneratingLesson) {
      return
    }

    setIsLessonFileGeneratorOpen(true)
  }

  async function handleGenerateLessonFromFiles(selectedDocuments, mode = "append") {
    if (!lessonId) {
      throw new Error(
          "This lesson has no saved ID yet. Open the lesson from its certification page first."
      )
    }

    try {
      setIsGeneratingLesson(true)

      const response = await generateLessonFromFiles(lessonId, selectedDocuments)

      const generatedSections = normalizeSections(
          mapGeneratedLessonDraftsToSections(response)
      )
      const generationWarnings = getGeneratedLessonWarnings(response)

      const savedGeneratedSections = await buildSavedLessonStructure(
          generatedSections
      )

      // Default behavior is to append generated sections to whatever the admin
      // has already authored; only "replace" discards the existing structure.
      const existingSections = mode === "replace" ? [] : sections
      const mergedSections = [...existingSections, ...savedGeneratedSections]

      await setLessonComponent(lessonId, mergedSections)

      setSections(mergedSections)
      setSectionIndex(
          mode === "replace" ? 0 : Math.max(existingSections.length, 0)
      )
      setIsLessonFileGeneratorOpen(false)

      toast.success("Lesson generated and saved", {
        description:
            mode === "replace"
                ? "Existing sections were replaced with the generated content and saved."
                : "Generated sections were appended to your lesson and saved.",
      })

      generationWarnings.forEach((warning) => {
        toast.warning("Generation warning", {
          description: warning,
        })
      })
    } finally {
      setIsGeneratingLesson(false)
    }
  }

  function handleAddSection() {
    const newSection = {
      id: createId(),
      sectionName: "",
      content: [],
    }

    setSections((previousSections) => {
      setSectionIndex(previousSections.length)

      return [...previousSections, newSection]
    })
  }

  function handleSectionChange(sectionId, field, value) {
    setSections((previousSections) =>
        previousSections.map((section) =>
            section.id === sectionId
                ? {
                  ...section,
                  [field]: value,
                }
                : section
        )
    )
  }

  function handleDeleteSection(sectionId) {
    setSections((previousSections) => {
      const updatedSections = previousSections.filter(
          (section) => section.id !== sectionId
      )

      setSectionIndex(
          updatedSections.length === 0
              ? 0
              : Math.min(sectionIndex, updatedSections.length - 1)
      )

      return updatedSections
    })
  }

  function handleAddTool(toolType) {
    const selectedTool = actions.find((action) => action.type === toolType)

    if (!selectedTool) {
      return
    }

    if (!sections[sectionIndex]) {
      setIsErrorAddingToolWithoutSection(true)
      return
    }

    const newTool = {
      id: createId(),
      type: selectedTool.type,
      data: selectedTool.createData(),
    }

    setSections((previousSections) =>
        previousSections.map((section, currentSectionIndex) => {
          if (currentSectionIndex !== sectionIndex) {
            return section
          }

          return {
            ...section,
            content: [...section.content, newTool],
          }
        })
    )
  }

  function handleRemoveTool(targetSectionIndex, targetToolIndex) {
    setSections((previousSections) =>
        previousSections.map((section, currentSectionIndex) => {
          if (currentSectionIndex !== targetSectionIndex) {
            return section
          }

          return {
            ...section,
            content: section.content.filter(
                (_, currentToolIndex) => currentToolIndex !== targetToolIndex
            ),
          }
        })
    )
  }

  function handleToolDataChange(targetSectionIndex, targetToolIndex, newData) {
    setSections((previousSections) =>
        previousSections.map((section, currentSectionIndex) => {
          if (currentSectionIndex !== targetSectionIndex) {
            return section
          }

          return {
            ...section,
            content: section.content.map((tool, currentToolIndex) => {
              if (currentToolIndex !== targetToolIndex) {
                return tool
              }

              return {
                ...tool,
                data: newData,
              }
            }),
          }
        })
    )
  }

  function isBlank(value) {
    return typeof value !== "string" || value.trim().length === 0
  }

  function hasMediaFileOrKey(data, keyField) {
    return Boolean(data.file || !isBlank(data[keyField]))
  }

  function validateGridItems(data, toolLabel) {
    if (!Array.isArray(data.gridItems) || data.gridItems.length === 0) {
      return `${toolLabel}: add at least one grid item.`
    }

    const hasInvalidGridItem = data.gridItems.some(
        (item) => isBlank(item.title) || isBlank(item.description)
    )

    if (hasInvalidGridItem) {
      return `${toolLabel}: every grid item needs a title and description.`
    }

    return null
  }

  function validateCards(data, toolLabel) {
    if (!Array.isArray(data.cards) || data.cards.length === 0) {
      return `${toolLabel}: add at least one review card.`
    }

    const hasInvalidCard = data.cards.some(
        (card) =>
            isBlank(card.frontTitle) ||
            isBlank(card.backTitle) ||
            isBlank(card.description)
    )

    if (hasInvalidCard) {
      return `${toolLabel}: every review card needs front text, back text, and a description.`
    }

    return null
  }

  function validateAccordionItems(data, toolLabel) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return `${toolLabel}: add at least one accordion item.`
    }

    const hasInvalidItem = data.items.some(
        (item) => isBlank(item.title) || isBlank(item.content)
    )

    if (hasInvalidItem) {
      return `${toolLabel}: every accordion item needs a title and content.`
    }

    return null
  }

  function validateTabItems(data, toolLabel) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return `${toolLabel}: add at least one tab.`
    }

    const hasInvalidTab = data.items.some(
        (item) =>
            isBlank(item.label) || isBlank(item.title) || isBlank(item.description)
    )

    if (hasInvalidTab) {
      return `${toolLabel}: every tab needs a label, title, and description.`
    }

    return null
  }

  function validateSmallHeaderAndDescription(data, toolLabel) {
    if (isBlank(data.smallHeader)) {
      return `${toolLabel}: small heading is required.`
    }

    if (isBlank(data.description)) {
      return `${toolLabel}: description is required.`
    }

    return null
  }

  function validateTool(tool, sectionNumber, toolNumber) {
    const data = tool.data ?? {}
    const toolLabel = `Section ${sectionNumber}, tool ${toolNumber}`

    if (tool.type === "heading" || tool.type === "subheading") {
      if (isBlank(data.text)) {
        return `${toolLabel}: heading text is required.`
      }
    }

    if (tool.type === "description") {
      if (isBlank(data.text)) {
        return `${toolLabel}: description text is required.`
      }
    }

    if (tool.type === "unordered-list" || tool.type === "ordered-list") {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        return `${toolLabel}: add at least one list item.`
      }

      const hasEmptyItem = data.items.some((item) => isBlank(item.text))

      if (hasEmptyItem) {
        return `${toolLabel}: all list items must have text.`
      }
    }

    if (tool.type === "tabs") {
      const error = validateTabItems(data, toolLabel)

      if (error) {
        return error
      }
    }

    if (tool.type === "accordion") {
      const error = validateAccordionItems(data, toolLabel)

      if (error) {
        return error
      }
    }

    if (tool.type === "flip-grid") {
      const error = validateCards(data, toolLabel)

      if (error) {
        return error
      }
    }

    if (tool.type === "image") {
      if (!hasMediaFileOrKey(data, "imageKey")) {
        return `${toolLabel}: upload an image first.`
      }
    }

    if (tool.type === "video") {
      if (!hasMediaFileOrKey(data, "videoKey")) {
        return `${toolLabel}: upload a video first.`
      }
    }

    if (tool.type === "image-left-text" || tool.type === "image-right-text") {
      if (!hasMediaFileOrKey(data, "imageKey")) {
        return `${toolLabel}: upload an image first.`
      }

      if (isBlank(data.title)) {
        return `${toolLabel}: image text title is required.`
      }

      if (isBlank(data.description)) {
        return `${toolLabel}: image text description is required.`
      }
    }

    if (tool.type === "intro-image-card") {
      const error = validateSmallHeaderAndDescription(data, toolLabel)

      if (error) {
        return error
      }

      if (!hasMediaFileOrKey(data, "imageKey")) {
        return `${toolLabel}: upload an image first.`
      }
    }

    if (tool.type === "header-description-grid") {
      const headerError = validateSmallHeaderAndDescription(data, toolLabel)
      const gridError = validateGridItems(data, toolLabel)

      return headerError || gridError
    }

    if (tool.type === "image-feature-grid") {
      const headerError = validateSmallHeaderAndDescription(data, toolLabel)
      const gridError = validateGridItems(data, toolLabel)

      if (headerError || gridError) {
        return headerError || gridError
      }

      if (!hasMediaFileOrKey(data, "imageKey")) {
        return `${toolLabel}: upload an image first.`
      }
    }

    if (tool.type === "review-card-grid") {
      const headerError = validateSmallHeaderAndDescription(data, toolLabel)
      const cardError = validateCards(data, toolLabel)

      return headerError || cardError
    }

    if (tool.type === "content-accordion-block") {
      const headerError = validateSmallHeaderAndDescription(data, toolLabel)
      const accordionError = validateAccordionItems(data, toolLabel)

      return headerError || accordionError
    }

    if (tool.type === "content-tabs-block") {
      const headerError = validateSmallHeaderAndDescription(data, toolLabel)
      const tabError = validateTabItems(data, toolLabel)

      return headerError || tabError
    }

    if (tool.type === "media-text-block") {
      const headerError = validateSmallHeaderAndDescription(data, toolLabel)

      if (headerError) {
        return headerError
      }

      if (data.mediaType !== "image" && data.mediaType !== "video") {
        return `${toolLabel}: media type is required.`
      }

      if (data.layout !== "image-left" && data.layout !== "image-right") {
        return `${toolLabel}: media layout is required.`
      }

      if (isBlank(data.supportingTitle)) {
        return `${toolLabel}: supporting title is required.`
      }

      if (isBlank(data.supportingDescription)) {
        return `${toolLabel}: supporting description is required.`
      }

      if (data.mediaType === "image" && !hasMediaFileOrKey(data, "imageKey")) {
        return `${toolLabel}: upload an image first.`
      }

      if (data.mediaType === "video" && !hasMediaFileOrKey(data, "videoKey")) {
        return `${toolLabel}: upload a video first.`
      }
    }

    return null
  }

  function validateLesson() {
    if (isBlank(lessonName) || lessonName === "Untitled Lesson") {
      return "Lesson name is required."
    }

    if (sections.length === 0) {
      return "Add at least one section before saving."
    }

    for (
        let currentSectionIndex = 0;
        currentSectionIndex < sections.length;
        currentSectionIndex++
    ) {
      const section = sections[currentSectionIndex]
      const sectionNumber = currentSectionIndex + 1

      if (isBlank(section.sectionName)) {
        return `Section ${sectionNumber} needs a section name.`
      }

      if (!section.content || section.content.length === 0) {
        return `Section ${sectionNumber} needs at least one tool.`
      }

      for (
          let currentToolIndex = 0;
          currentToolIndex < section.content.length;
          currentToolIndex++
      ) {
        const tool = section.content[currentToolIndex]

        const toolError = validateTool(tool, sectionNumber, currentToolIndex + 1)

        if (toolError) {
          return toolError
        }
      }
    }

    return null
  }

  function getUploadedFileKey(uploadResponse) {
    const responseData = uploadResponse?.data ?? uploadResponse

    if (typeof responseData === "string") {
      return responseData.trim().replace(/^"/, "").replace(/"$/, "")
    }

    return (
        responseData?.fileKey ??
        responseData?.key ??
        responseData?.imageKey ??
        responseData?.videoKey ??
        ""
    )
  }

  async function uploadToolMedia(tool, sectionName) {
    const mediaConfig = getMediaToolConfig(tool)

    const currentData = {
      ...(tool.data ?? {}),
    }

    if (!mediaConfig) {
      return {
        ...tool,
        data: removeBrowserFiles(currentData),
      }
    }

    const selectedFile = currentData.file

    if (!isBrowserFile(selectedFile)) {
      return {
        ...tool,
        data: removeBrowserFiles({
          ...currentData,
          file: null,
          [mediaConfig.keyField]: currentData[mediaConfig.keyField] ?? "",
        }),
      }
    }

    const uploadResponse = await MediaFileUpload(
        lessonId,
        sectionName,
        tool.id,
        mediaConfig.folderName,
        selectedFile
    )

    const uploadedFileKey = getUploadedFileKey(uploadResponse)

    if (!uploadedFileKey) {
      throw new Error(`No file key was returned while uploading ${tool.type}.`)
    }

    return {
      ...tool,
      data: removeBrowserFiles({
        ...currentData,
        file: null,
        [mediaConfig.keyField]: uploadedFileKey,
        ...(mediaConfig.oppositeKeyField
            ? {
              [mediaConfig.oppositeKeyField]: "",
            }
            : {}),
      }),
    }
  }

  async function buildSavedLessonStructure(sourceSections = sections) {
    return Promise.all(
        sourceSections.map(async (section) => {
          const savedTools = await Promise.all(
              section.content.map((tool) => uploadToolMedia(tool, section.sectionName))
          )

          return removeBrowserFiles({
            ...section,
            id: section.id || createId(),
            sectionName: section.sectionName ?? "",
            content: savedTools,
          })
        })
    )
  }

  async function handleSaveLesson() {
    if (isLoadingLesson) {
      return
    }

    const error = validateLesson()

    if (error) {
      setValidationError(error)
      return
    }

    try {
      setIsSaving(true)

      const savedLessonStructure = await buildSavedLessonStructure()

      await setLessonComponent(lessonId, savedLessonStructure)

      setSections(savedLessonStructure)
      setIsSuccessDialogOpen(true)

      toast.success("Lesson saved", {
        description: `${lessonName} was saved successfully.`,
      })
    } catch (error) {
      const errorMessage = "Could not save the lesson. Please try again."

      setValidationError(errorMessage)

      toast.error("Could not save lesson", {
        description: error?.message || errorMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
      <section className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background">
        <header className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Lesson editor</p>

              <h1 className="truncate text-lg font-semibold tracking-tight">
                {lessonName}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="hidden sm:inline-flex"
            >
              Cancel
            </Button>

            <Button
                type="button"
                variant="outline"
                onClick={handleGenerateLesson}
                disabled={isLoadingLesson || isGeneratingLesson}
                className="hidden gap-2 sm:inline-flex"
            >
              <Sparkles className="h-4 w-4" />
              {isGeneratingLesson ? "Generating..." : "Generate"}
            </Button>

            <Button
                type="button"
                onClick={handleSaveLesson}
                disabled={isSaving || isLoadingLesson}
                className="gap-2"
            >
              <Save className="h-4 w-4" />

              <span className="hidden sm:inline">
                {isLoadingLesson
                    ? "Loading..."
                    : isSaving
                        ? "Saving..."
                        : "Save Lesson"}
              </span>

              <span className="sm:hidden">
                {isLoadingLesson ? "Loading..." : isSaving ? "Saving..." : "Save"}
              </span>
            </Button>
          </div>
        </header>

        <GenerateLessonFromFileDialog
            open={isLessonFileGeneratorOpen}
            onOpenChange={setIsLessonFileGeneratorOpen}
            onGenerate={handleGenerateLessonFromFiles}
            lessonName={lessonName}
            isGenerating={isGeneratingLesson}
        />

        <AiGenerationProgress
            open={isGeneratingLesson}
            title="Generating and saving your lesson"
            description={lessonName}
            stepDurationMs={5000}
            steps={[
              "Reading your documents",
              "Extracting the key topics",
              "Writing lesson sections",
              "Building lists and review activities",
              "Saving generated content",
            ]}
        />

        <LessonFeedbackDialog
            open={isSuccessDialogOpen}
            type="success"
            title="Lesson Saved"
            description={`${lessonName} was saved successfully.`}
            onClose={() => setIsSuccessDialogOpen(false)}
        />

        <LessonFeedbackDialog
            open={Boolean(validationError)}
            type="error"
            title="Cannot Save Lesson"
            description={validationError}
            onClose={() => setValidationError("")}
        />

        <LessonFeedbackDialog
            open={isErrorAddingToolWithoutSection}
            type="error"
            title="Create a Section First"
            description="Add a section before adding lesson content."
            onClose={() => setIsErrorAddingToolWithoutSection(false)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <LessonToolsPanel
              isLoadingLesson={isLoadingLesson}
              onAddTool={handleAddTool}
          />

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-4 sm:p-6">
            <div className="mx-auto h-full min-h-0 w-full max-w-[1600px] overflow-hidden rounded-lg border bg-background">
              <main className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain">
                <div className="mx-auto w-full max-w-[1280px] p-5 sm:p-6">
                  {isLoadingLesson ? (
                      <Card className="mt-6 shadow-none">
                        <CardContent className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
                          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />

                          <h3 className="mt-5 text-base font-semibold">
                            Loading lesson content
                          </h3>

                          <p className="mt-2 text-sm text-muted-foreground">
                            Loading sections, blocks, images, and videos.
                          </p>
                        </CardContent>
                      </Card>
                  ) : sections.length === 0 ? (
                      <Card className="mt-6 shadow-none">
                        <CardContent className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <BetweenHorizontalEnd className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <h3 className="mt-4 text-base font-semibold">
                            Start building your lesson
                          </h3>

                          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                            Add your first section, then click the left Tools tab
                            to slide open the tools panel and add lesson blocks.
                          </p>

                          <Button
                              type="button"
                              onClick={handleAddSection}
                              className="mt-5 gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add first section
                          </Button>
                        </CardContent>
                      </Card>
                  ) : (
                      <div className="mt-6 space-y-6 pb-8">
                        {sections.map((section, index) => {
                          const isSelected = sectionIndex === index

                          return (
                              <div
                                  key={section.id}
                                  className={`rounded-xl transition ${
                                      isSelected ? "ring-2 ring-primary/15" : ""
                                  }`}
                                  onMouseDown={() => setSectionIndex(index)}
                                  onFocusCapture={() => setSectionIndex(index)}
                              >
                                <Section
                                    section={section}
                                    sectionIndex={index}
                                    onChange={handleSectionChange}
                                    onDelete={handleDeleteSection}
                                    handleRemovalTool={handleRemoveTool}
                                    handleToolDataChange={handleToolDataChange}
                                    onClick={() => setSectionIndex(index)}
                                />
                              </div>
                          )
                        })}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddSection}
                            className="h-12 w-full border-dashed text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add another section
                        </Button>
                      </div>
                  )}
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>
  )
}

export default CreateLessons
