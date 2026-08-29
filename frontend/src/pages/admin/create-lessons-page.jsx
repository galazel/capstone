import React, { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  AlignLeft,
  ArrowLeft,
  BetweenHorizontalEnd,
  CheckCircle2,
  CircleAlert,
  FilePlay,
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
  Target,
  Trash2,
  Type,
} from "@/components/icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import Section from "../../components/certifications/section"
import {
  getLessonComponent,
  setLessonComponent,
} from "../../services/lessonService.js"
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
  {
    // Admin-authored only -- the lesson generator has no counterpart for this
    // block, by design. See `ImageHotspotTool` in tools.jsx for why.
    type: "image-hotspot",
    name: "Image with Hotspots",
    description: "Pin labelled points on an image",
    icon: Target,
    createData: () => ({
      file: null,
      imageKey: "",
      hotspots: [],
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


/**
 * The third pane: what is selected, and its properties.
 *
 * <p>The editor had tools on the left and the lesson in the middle, so every
 * property of a section -- its name, what it holds, the order of it -- had to
 * be edited on the canvas itself, between the blocks it describes. Pulling
 * them out here leaves the middle as the lesson and nothing else, which is the
 * point of the layout: the thing being made stays legible while it is made.
 */
function LessonInspectorPanel({
  section,
  sectionNumber,
  sectionCount,
  onSectionChange,
  onDeleteSection,
  onRemoveTool,
}) {
  return (
      <aside className="flex h-full max-h-full w-[320px] shrink-0 flex-col overflow-hidden border-l bg-background">
        <div className="shrink-0 border-b px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Inspector
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {section ? `Section ${sectionNumber} of ${sectionCount}` : "Nothing selected"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!section ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Select a section in the lesson to edit its name and see what it
                holds.
              </p>
          ) : (
              <div className="space-y-5">
                <div>
                  <Label htmlFor="inspector-section-name" className="text-xs font-bold">
                    Section name
                  </Label>
                  <Input
                      id="inspector-section-name"
                      value={section.sectionName ?? ""}
                      placeholder="Untitled section"
                      className="mt-1.5"
                      onChange={(event) =>
                          onSectionChange(section.id, "sectionName", event.target.value)
                      }
                  />
                </div>

                <div>
                  <p className="text-xs font-bold">Content</p>

                  {(section.content ?? []).length === 0 ? (
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        Nothing in this section yet. Add a tool from the left.
                      </p>
                  ) : (
                      <ul className="mt-1.5 space-y-1.5">
                        {(section.content ?? []).map((block, blockIndex) => {
                          const tool = actions.find((action) => action.type === block.type)

                          return (
                              <li
                                  key={block.id}
                                  className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
                              >
                                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                  {tool?.name ?? block.type}
                                </span>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    aria-label={`Remove ${tool?.name ?? block.type}`}
                                    onClick={() => onRemoveTool(blockIndex)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </li>
                          )
                        })}
                      </ul>
                  )}
                </div>

                <div className="border-t pt-4">
                  <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2 text-destructive hover:text-destructive"
                      onClick={() => onDeleteSection(section.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete section
                  </Button>
                </div>
              </div>
          )}
        </div>
      </aside>
  )
}

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
  "image-hotspot": {
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

/**
 * Not built on `normalizeArrayItems`: that helper seeds one blank entry when
 * the list is empty, which is right for tabs and cards but wrong here. A
 * hotspot tool legitimately starts with zero pins -- the admin adds them by
 * clicking the image -- and a phantom pin at 0,0 would sit in the corner of
 * every freshly placed block.
 */
function normalizeHotspots(hotspots) {
  if (!Array.isArray(hotspots)) {
    return []
  }

  return hotspots.map((hotspot) => ({
    id: hotspot?.id || createId(),
    x: clampPercentage(hotspot?.x),
    y: clampPercentage(hotspot?.y),
    title: hotspot?.title ?? "",
    description: hotspot?.description ?? "",
  }))
}

function clampPercentage(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.min(100, Math.max(0, numeric))
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

  if (type === "image-hotspot") {
    normalizedData.hotspots = normalizeHotspots(normalizedData.hotspots)
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
      type === "image-hotspot" ||
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

  /* Sections that came back with nothing in them are dropped on load.
     Generation opens a lesson with a title-only cover section, and it arrived
     here as a full-height empty page the admin had to scroll past to reach the
     content -- and then delete by hand on every lesson. A section with no
     content carries nothing a learner could read, so there is nothing to lose
     by leaving it out. Only load is filtered: a section added in the editor is
     empty until a tool goes in it, and dropping those would make adding one
     impossible. */
  function withoutEmptySections(parsedSections) {
    return parsedSections.filter(
        (section) => (section.content ?? []).length > 0
    )
  }

  function parseLessonComponent(response) {
    const responseData = response?.data ?? response ?? {}

    const structure = responseData.lessonComponentStructure ?? "[]"
    const imageKeys = responseData.imageKeys ?? {}
    const videoKeys = responseData.videoKeys ?? {}

    if (Array.isArray(structure)) {
      return withoutEmptySections(normalizeSections(structure, imageKeys, videoKeys))
    }

    if (typeof structure !== "string" || structure.trim().length === 0) {
      return []
    }

    try {
      const parsedStructure = JSON.parse(structure)

      return withoutEmptySections(
          normalizeSections(parsedStructure, imageKeys, videoKeys)
      )
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

    // `backTitle` is deliberately not required. A flip card's back now shows
    // the card's own front title, so whatever is typed here never reaches the
    // page -- blocking a save on it made admins fill a field with no effect.
    // The key is still read and stored, so existing content keeps its value.
    const hasInvalidCard = data.cards.some(
        (card) => isBlank(card.frontTitle) || isBlank(card.description)
    )

    if (hasInvalidCard) {
      return `${toolLabel}: every review card needs front text and a description.`
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

    if (tool.type === "image-hotspot") {
      if (!hasMediaFileOrKey(data, "imageKey")) {
        return `${toolLabel}: upload an image first.`
      }

      const hotspots = Array.isArray(data.hotspots) ? data.hotspots : []

      if (hotspots.length === 0) {
        return `${toolLabel}: click the image to place at least one hotspot.`
      }

      // A pin with no title is invisible to a learner in the list beside the
      // image and opens an empty panel when clicked, so it is a save-blocker
      // rather than something to quietly drop. The description is optional --
      // some pins only need to name the part they point at.
      const untitledIndex = hotspots.findIndex((hotspot) => isBlank(hotspot?.title))

      if (untitledIndex !== -1) {
        return `${toolLabel}: hotspot ${untitledIndex + 1} needs a title.`
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
            <div className="mx-auto h-full min-h-0 w-full max-w-[1280px] overflow-hidden rounded-lg border bg-background">
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

          <LessonInspectorPanel
              section={sections[sectionIndex] ?? null}
              sectionNumber={sectionIndex + 1}
              sectionCount={sections.length}
              onSectionChange={handleSectionChange}
              onDeleteSection={handleDeleteSection}
              onRemoveTool={(toolIndex) => handleRemoveTool(sectionIndex, toolIndex)}
          />
        </div>
      </section>
  )
}

export default CreateLessons
