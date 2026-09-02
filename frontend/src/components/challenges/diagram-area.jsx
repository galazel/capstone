import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "@/components/icons"
import { DrawIoEmbed } from "react-drawio"

import { getDiagramToolPreset } from "./diagram-tool-presets.js"

const EMPTY_GRID_DIAGRAM = `
<mxGraphModel
  dx="1200"
  dy="800"
  grid="1"
  gridSize="10"
  guides="1"
  tooltips="1"
  connect="1"
  arrows="1"
  fold="1"
  page="0"
  pageScale="1"
  background="#ffffff"
  math="0"
  shadow="0"
>
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
  </root>
</mxGraphModel>
`

function normalizeXml(xml) {
    return typeof xml === "string" && xml.trim() ? xml : EMPTY_GRID_DIAGRAM
}

// The editor is a remote iframe (embed.diagrams.net), so its first paint costs
// a full app download. Warming DNS/TLS for that origin as soon as any diagram
// screen imports this module takes a chunk off that first load; the browser
// HTTP cache covers every load after it.
const DRAWIO_ORIGIN = "https://embed.diagrams.net"

if (
    typeof document !== "undefined" &&
    !document.querySelector("link[data-drawio-preconnect]")
) {
    for (const rel of ["preconnect", "dns-prefetch"]) {
        const link = document.createElement("link")
        link.rel = rel
        link.href = DRAWIO_ORIGIN
        link.crossOrigin = "anonymous"
        link.dataset.drawioPreconnect = "true"
        document.head.appendChild(link)
    }
}

// draw.io renders inside an iframe Tailwind can't reach, but it does accept a
// CSS blob over its configuration message. This restates the REBYU surface
// tokens (Google Sans, swan borders, polar chrome, feather accent) as literals
// so the embedded editor stops reading as a third-party tool bolted onto the
// page.
const DRAWIO_THEME_CSS = `
  .geEditor, .geSidebarContainer, .geFormatContainer, .geToolbarContainer,
  .geMenubarContainer, .geDialog, .mxWindow {
    font-family: "Google Sans", "Google Sans Flex", Arial, sans-serif !important;
  }
  .geTabContainer { display: none !important; }
  .geSidebarContainer, .geFormatContainer { background: #f7f7f7 !important; }
  .geSidebarContainer { border-right: 1px solid #e5e5e5 !important; }
  .geFormatContainer { border-left: 1px solid #e5e5e5 !important; }
  .geToolbarContainer, .geMenubarContainer {
    background: #ffffff !important;
    border-bottom: 1px solid #e5e5e5 !important;
    box-shadow: none !important;
  }
  .geTitle, .geFormatSection { color: #4b4b4b !important; }
  .geSidebar .geItem:hover { background: #e8f1fe !important; }
  .geBtn, button.geBtn {
    border-radius: 10px !important;
    font-weight: 700 !important;
  }
  .gePrimaryBtn, button.gePrimaryBtn {
    background: #1b6ef3 !important;
    border-color: #1553c4 !important;
    border-radius: 10px !important;
    font-weight: 700 !important;
  }
`

/**
 * `documentId` identifies the diagram being edited (e.g. an attempt question
 * id). Changing it swaps the canvas contents *in place* through the embed's
 * load action instead of tearing the iframe down — moving between diagram
 * questions used to re-download the whole draw.io app every time.
 */
export default function DiagramArea({
                                        diagramType = "ERD",
                                        initialXml,
                                        documentId = null,
                                        onChange,
                                        className = "",
                                    }) {
    const [isLoading, setIsLoading] = useState(true)
    // Collapsed to start: the palette is a menu, and a menu should not be the
    // first thing between the learner and a blank canvas.
    const [shapesOpen, setShapesOpen] = useState(false)
    const onChangeRef = useRef(onChange)
    const autosaveTimerRef = useRef(null)
    const embedRef = useRef(null)

    const toolPreset = useMemo(
        () => getDiagramToolPreset(diagramType),
        [diagramType]
    )

    const startingXmlRef = useRef(normalizeXml(initialXml))
    const lastSavedXmlRef = useRef(startingXmlRef.current)
    const documentIdRef = useRef(documentId)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current)
            }
        }
    }, [])

    // Only a change of shape libraries needs a new iframe URL, and several
    // diagram types share one preset — switching UML class -> use case is free.
    useEffect(() => {
        setIsLoading(true)
    }, [toolPreset.libs])

    // Same iframe, different document.
    useEffect(() => {
        if (documentId === documentIdRef.current) {
            return
        }
        documentIdRef.current = documentId

        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current)
            autosaveTimerRef.current = null
        }

        const nextXml = normalizeXml(initialXml)
        startingXmlRef.current = nextXml
        lastSavedXmlRef.current = nextXml
        embedRef.current?.load({ xml: nextXml, autosave: true })
    }, [documentId, initialXml])

    const handleAutoSave = useCallback((data) => {
        const nextXml = typeof data?.xml === "string" ? data.xml : ""

        if (!nextXml || nextXml === lastSavedXmlRef.current) {
            return
        }

        lastSavedXmlRef.current = nextXml

        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current)
        }

        autosaveTimerRef.current = setTimeout(() => {
            onChangeRef.current?.(lastSavedXmlRef.current)
        }, 750)
    }, [])

    return (
        <div
            className={`rb-diagram-shell h-full min-h-[420px] w-full bg-card ${className}`}
            data-shapes={shapesOpen ? "open" : "closed"}
        >
            {isLoading && (
                <div
                    className="absolute inset-0 z-10 flex flex-col bg-card"
                    aria-live="polite"
                >
                    {/* Traces the editor's real furniture, so the swap when it
                        loads is a fill-in rather than a re-layout: a toolbar
                        across the top, the shape library down the left with
                        its search field and collapsed groups, and the grid
                        canvas filling the rest.

                        The previous skeleton drew a right-hand panel the
                        editor does not have and a plain white canvas, so the
                        page visibly rearranged itself at the moment the
                        editor appeared. */}
                    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-rb-swan bg-rb-polar px-3">
                        {/* Left cluster: panel, page, then the undo/redo/delete group. */}
                        <div className="h-5 w-5 rounded bg-rb-swan motion-safe:animate-pulse" />
                        <div className="h-5 w-5 rounded bg-rb-swan motion-safe:animate-pulse" />
                        <div className="mx-1 h-5 w-px bg-rb-swan" />
                        {Array.from({ length: 3 }).map((_, item) => (
                            <div
                                key={item}
                                className="h-5 w-5 rounded bg-rb-swan motion-safe:animate-pulse"
                            />
                        ))}
                        <div className="flex-1" />
                        {/* Right cluster: comment and zoom, then the two
                            trailing icons. */}
                        <div className="h-5 w-5 rounded bg-rb-swan motion-safe:animate-pulse" />
                        <div className="h-5 w-5 rounded bg-rb-swan motion-safe:animate-pulse" />
                    </div>

                    <div className="flex min-h-0 flex-1">
                        <div className="hidden w-56 shrink-0 flex-col gap-3 border-r border-rb-swan bg-rb-polar p-3 sm:flex">
                            {/* Search field. */}
                            <div className="h-8 rounded-lg border border-rb-swan bg-card" />

                            {/* Scratchpad: a titled group with a dashed drop
                                area, which is the tallest thing in the panel
                                and the one whose absence was most obvious. */}
                            <div className="space-y-2">
                                <div className="h-3 w-24 rounded bg-rb-swan motion-safe:animate-pulse" />
                                <div className="h-11 rounded-lg border border-dashed border-rb-swan" />
                            </div>

                            {/* The collapsed shape groups. */}
                            {Array.from({ length: 2 }).map((_, item) => (
                                <div
                                    key={item}
                                    className="h-3 w-20 rounded bg-rb-swan motion-safe:animate-pulse"
                                />
                            ))}

                            <div className="mx-auto mt-1 h-8 w-32 rounded-full bg-rb-swan motion-safe:animate-pulse" />
                        </div>

                        {/* Canvas. The grid is drawn rather than left blank so
                            the drawing area reads as a drawing area while it
                            is still empty. */}
                        <div
                            className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
                            style={{
                                backgroundImage:
                                    "linear-gradient(to right, var(--color-rb-swan) 1px, transparent 1px)," +
                                    "linear-gradient(to bottom, var(--color-rb-swan) 1px, transparent 1px)",
                                backgroundSize: "24px 24px",
                            }}
                        >
                            <div className="h-10 w-10 rounded-full border-4 border-rb-swan border-t-rb-feather motion-safe:animate-spin" />

                            <p className="text-sm font-bold text-rb-eel">
                                Loading {toolPreset.label} editor
                            </p>

                            <p className="text-xs font-medium text-rb-wolf">
                                Preparing your diagram workspace...
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <DrawIoEmbed
                ref={embedRef}
                key={toolPreset.libs}
                xml={startingXmlRef.current}
                autosave
                onLoad={() => setIsLoading(false)}
                onAutoSave={handleAutoSave}
                urlParameters={{
                    ui: "simple",
                    sidebar: 1,
                    libraries: 1,
                    libs: toolPreset.libs,
                    format: 0,
                    noSaveBtn: 1,
                    noExitBtn: 1,
                    saveAndExit: 0,
                    splash: 0,
                }}
                configuration={{
                    compressXml: false,
                    compact: true,
                    hideMenus: ["file", "edit", "view", "arrange", "extras", "help"],
                    hideMenuItems: [
                        "importFrom",
                        "exportAs",
                        "embed",
                        "newLibrary",
                        "openLibrary",
                        "pageSetup",
                        "print",
                        "settings",
                        "help",
                        "exit",
                    ],
                    css: DRAWIO_THEME_CSS,
                    defaultGridEnabled: true,
                    defaultGridSize: 10,
                    defaultPageVisible: false,
                    override: true,
                    version: `rebyu-diagram-editor-${toolPreset.libs}`,
                }}
            />

            {/* The handle that pulls the shape library out. It rides the
                sidebar's right edge, so it reads as the edge of the drawer
                rather than a button parked on the canvas. Hidden while the
                editor is still loading -- there is nothing to pull out yet. */}
            {!isLoading && (
                <button
                    type="button"
                    onClick={() => setShapesOpen((open) => !open)}
                    aria-expanded={shapesOpen}
                    aria-label={shapesOpen ? "Hide shapes" : "Show shapes"}
                    title={shapesOpen ? "Hide shapes" : "Show shapes"}
                    style={{ left: shapesOpen ? "var(--rb-shapes-w)" : 0 }}
                    className="absolute top-1/2 z-20 flex h-28 w-7 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-r-lg border border-l-0 border-rb-swan bg-card text-rb-wolf transition-colors hover:bg-rb-polar hover:text-rb-eel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rb-feather"
                >
                    {shapesOpen ? (
                        <ChevronLeft className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                    )}

                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] [writing-mode:vertical-rl]">
                        Shapes
                    </span>
                </button>
            )}
        </div>
    )
}
