import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
// stylesheet over its configuration message. Two config keys carry one: `css`
// is injected ahead of the app's own stylesheets, `customCss` is appended to
// the head after them. This sends the same sheet through both, because the
// first version of this theme went through `css` alone and lost most of its
// declarations to draw.io's own later rules -- the editor still came up in
// stock grey, which is what "it looks like draw.io bolted onto the page" was.
//
// Everything below is `!important` and states REBYU's surface tokens as
// literals (Google Sans, swan borders, snow panels, feather accent, polar
// hover), since var() has no meaning inside that document.
const DRAWIO_THEME_CSS = `
  .geEditor, .geEditor *, .geDialog, .geDialog *, .mxWindow, .mxWindow *,
  .geSidebarTooltip, .geSidebarTooltip * {
    font-family: "Google Sans", "Google Sans Flex", Arial, sans-serif !important;
  }

  /* Editor furniture an exam has no use for. The page tabs offer a second
     canvas nobody grades; .geSidebarFooter is the "+ More Shapes" button,
     which opens a dialog of eighty unrelated stencil libraries. */
  .geTabContainer, .geSidebarFooter { display: none !important; }

  .geToolbarContainer, .geMenubarContainer {
    background: #ffffff !important;
    border-bottom: 1px solid #e5e5e5 !important;
    box-shadow: none !important;
  }
  .geToolbarContainer .geButton, .geToolbarContainer a.geButton,
  .geToolbarContainer .geMenuItem {
    border-radius: 10px !important;
    color: #4b4b4b !important;
  }
  .geToolbarContainer .geButton:hover, .geToolbarContainer a.geButton:hover,
  .geToolbarContainer .geMenuItem:hover { background: #f7f7f7 !important; }

  .geSidebarContainer {
    background: #ffffff !important;
    border-right: 1px solid #e5e5e5 !important;
  }
  .geSidebarContainer input, .geSidebarContainer input[type="text"] {
    border: 2px solid #e5e5e5 !important;
    border-radius: 12px !important;
    padding: 7px 10px !important;
    background: #ffffff !important;
    color: #4b4b4b !important;
    box-shadow: none !important;
    outline: none !important;
  }
  .geSidebarContainer input:focus { border-color: #1b6ef3 !important; }
  .geTitle {
    color: #777777 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.08em !important;
    text-transform: uppercase !important;
    background: transparent !important;
  }
  .geSidebar .geItem:hover {
    background: #e8f1fe !important;
    border-radius: 10px !important;
  }
  .geSidebarTooltip {
    border: 1px solid #e5e5e5 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important;
  }

  .geFormatContainer {
    background: #ffffff !important;
    border-left: 1px solid #e5e5e5 !important;
    color: #4b4b4b !important;
  }
  .geFormatSection { color: #4b4b4b !important; }

  .geBtn, button.geBtn, .geFormatContainer button {
    border-radius: 10px !important;
    font-weight: 700 !important;
    color: #4b4b4b !important;
    border: 2px solid #e5e5e5 !important;
    background: #ffffff !important;
    box-shadow: none !important;
  }
  .geBtn:hover, button.geBtn:hover, .geFormatContainer button:hover {
    background: #f7f7f7 !important;
  }
  button.gePrimaryBtn, .gePrimaryBtn, .geBtn.gePrimaryBtn {
    background: #1b6ef3 !important;
    border: 2px solid #1553c4 !important;
    color: #ffffff !important;
  }

  .geDialog, .mxWindow {
    border-radius: 16px !important;
    border: 1px solid #e5e5e5 !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14) !important;
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

                            {/* The collapsed shape groups, and nothing else:
                                the Scratchpad and the "More Shapes" pill this
                                used to trace are both gone from the editor
                                now, and drawing furniture the learner will
                                never see is the same re-layout on load that
                                the skeleton exists to avoid. */}
                            {Array.from({ length: 3 }).map((_, item) => (
                                <div
                                    key={item}
                                    className="h-3 w-20 rounded bg-rb-swan motion-safe:animate-pulse"
                                />
                            ))}
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
                    // `libraries` is not the shape palette -- that is `sidebar`
                    // plus `libs`. It is draw.io's *custom* library machinery:
                    // the Scratchpad, "New Library", "Open Library". None of it
                    // survives an attempt, and the Scratchpad's "Drag elements
                    // here" drop zone sat at the top of the palette as the
                    // first thing a learner saw.
                    libraries: 0,
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
                    // Same sheet, appended after draw.io's own stylesheets
                    // instead of before them -- see DRAWIO_THEME_CSS.
                    customCss: DRAWIO_THEME_CSS,
                    // The Scratchpad, "New Library" and "Open Library". None of
                    // it survives an attempt, and the Scratchpad's "Drag
                    // elements here" drop zone sat at the top of the palette as
                    // the first thing a learner saw.
                    //
                    // draw.io caches the whole configuration in localStorage
                    // under `version`, so a browser that met an older build
                    // keeps whatever that build said until the string moves --
                    // which is why this reads v3 below and not v2.
                    enableCustomLibraries: false,
                    defaultGridEnabled: true,
                    defaultGridSize: 10,
                    defaultPageVisible: false,
                    override: true,
                    // draw.io caches a configuration under its version string,
                    // so this has to move whenever the theme does.
                    version: `rebyu-diagram-editor-v3-${toolPreset.libs}`,
                }}
            />

        </div>
    )
}
