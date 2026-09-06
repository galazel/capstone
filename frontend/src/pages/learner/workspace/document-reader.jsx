import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  Bookmark,
  ChevronDown,
  ChevronUpIcon,
  Download,
  FileText,
  Maximize,
  Minimize2Icon,
  Minus,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  X,
} from "@/components/icons"
import { TactileButton } from "@/components/rebyu/rebyu-ui.jsx"

/**
 * Upload & Learn — the reader half of the study workspace.
 *
 * <p>Modelled on a document-reader layout (Scribd's): a title bar carrying the
 * document's own actions, a slim control rail pinned down the left edge of the
 * page area for search / page stepping / zoom, and the pages themselves stacked
 * in a scroller. The AI is deliberately NOT in here — it lives in the panel to
 * the right, which is the whole point of the split.
 *
 * <p>How much of the chrome is live depends on what was uploaded, and the
 * component is explicit about that rather than showing dead controls:
 *
 * <ul>
 *   <li><b>TXT</b> — fully driven here. The text is paginated into real pages,
 *       so stepping, the page counter, zoom and in-document search all work.</li>
 *   <li><b>PDF</b> — handed to the browser's built-in viewer, which brings its
 *       own paging, zoom and search. Duplicating those in this rail would give
 *       the learner two sets of controls where only one set moved anything, so
 *       the rail's page and search controls step aside and say why. Driving
 *       them ourselves needs a PDF renderer (pdf.js) the project does not
 *       currently depend on.</li>
 *   <li><b>Word</b> — no browser-native viewer exists, so the pane describes
 *       the file rather than showing an empty frame.</li>
 * </ul>
 */

/** Characters per rendered page for text documents. */
const TEXT_PAGE_SIZE = 1800

const ZOOM_STEPS = [0.75, 0.9, 1, 1.15, 1.35, 1.6, 2]

function fileExtension(name) {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot).toLowerCase()
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Splits text into pages on paragraph boundaries.
 *
 * <p>Slicing at a fixed character count is simpler and reads badly — it cuts
 * sentences in half across a page break. Paragraphs are kept whole and packed
 * until the next one would overflow, so a page ends where the writing does. A
 * single paragraph longer than a page is its own page rather than being split.
 */
function paginateText(text) {
  if (!text) return [""]
  const paragraphs = text.split(/\n{2,}/)
  const pages = []
  let current = ""

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > TEXT_PAGE_SIZE) {
      pages.push(current)
      current = paragraph
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
  }
  if (current) pages.push(current)
  return pages.length > 0 ? pages : [""]
}

/** Wraps every case-insensitive hit in <mark>, without touching the rest. */
function highlight(text, term) {
  if (!term.trim()) return text
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={index} className="rounded-sm bg-rb-bee/60 px-0.5 text-rb-eel">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export function DocumentReader({ file, onReplace, onRemove }) {
  const extension = fileExtension(file.name)
  const isPdf = extension === ".pdf"
  const isText = extension === ".txt"

  const [text, setText] = useState(null)
  const [page, setPage] = useState(1)
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1))
  const [searchOpen, setSearchOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [fullscreen, setFullscreen] = useState(false)
  const frameRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!isText) return undefined
    let cancelled = false
    file.text().then(
      (content) => !cancelled && setText(content),
      () => !cancelled && setText(null)
    )
    return () => {
      cancelled = true
    }
  }, [file, isText])

  const pages = useMemo(() => (isText ? paginateText(text) : []), [isText, text])
  const pageCount = isText ? pages.length : null
  const zoom = ZOOM_STEPS[zoomIndex]

  // Only text documents are paged by this component; see the class note.
  const paged = isText && pageCount > 0

  const goTo = useCallback(
    (next) => {
      if (!paged) return
      const clamped = Math.min(Math.max(next, 1), pageCount)
      setPage(clamped)
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    },
    [paged, pageCount]
  )

  // The Fullscreen API can also be exited with Escape or the browser's own
  // chrome, so the button's label follows the document rather than our state.
  useEffect(() => {
    function sync() {
      setFullscreen(document.fullscreenElement === frameRef.current)
    }
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()
    } else {
      frameRef.current?.requestFullscreen?.()
    }
  }

  const matchCount = useMemo(() => {
    if (!paged || !term.trim()) return 0
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return (pages.join("\n").match(new RegExp(escaped, "gi")) ?? []).length
  }, [paged, pages, term])

  return (
    <div ref={frameRef} className="flex h-full min-h-0 flex-col bg-rb-snow">
      {/* Title bar: what this document is, and what you can do with it. */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-rb-tile bg-rb-macaw-wash text-rb-macaw-lip">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-rb-eel">{file.name}</p>
            <p className="text-xs font-bold text-rb-hare">
              {extension.replace(".", "").toUpperCase()} · {formatBytes(file.size)}
              {paged ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* Reading actions. Download and print are genuinely local -- the
              file is already in the browser -- so they work; save and share
              need a server and are left out rather than mimed. */}
          <a
            href={file.previewUrl}
            download={file.name}
            className="inline-flex h-9 items-center gap-1.5 rounded-rb-control border-2 border-border bg-white px-3 text-xs font-extrabold text-rb-wolf transition-colors hover:border-rb-beetle hover:text-rb-beetle-lip"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download
          </a>
          <TactileButton
            variant="ghost"
            size="sm"
            className="rb-btn-icon"
            onClick={() => window.print()}
            aria-label="Print this document"
          >
            <Printer className="size-4" aria-hidden="true" />
          </TactileButton>
          <TactileButton
            variant="ghost"
            size="sm"
            className="rb-btn-icon"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit full screen" : "Read full screen"}
          >
            {fullscreen ? (
              <Minimize2Icon className="size-4" aria-hidden="true" />
            ) : (
              <Maximize className="size-4" aria-hidden="true" />
            )}
          </TactileButton>
          <TactileButton variant="ghost" size="sm" onClick={onReplace}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Replace
          </TactileButton>
          <TactileButton
            variant="ghost"
            size="sm"
            className="rb-btn-icon"
            onClick={onRemove}
            aria-label="Remove this file"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </TactileButton>
        </div>
      </header>

      {/* Search opens as a strip rather than a floating box, so it never
          covers the line the learner is reading. */}
      {searchOpen && paged ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-white px-4 py-2">
          <Search className="size-4 shrink-0 text-rb-hare" aria-hidden="true" />
          <input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search in this document…"
            aria-label="Search in this document"
            className="h-9 min-w-0 flex-1 rounded-rb-control border-2 border-border bg-white px-3 text-sm font-medium text-rb-eel outline-none placeholder:text-rb-hare focus-visible:border-rb-macaw"
          />
          <span className="shrink-0 text-xs font-bold text-rb-hare">
            {term.trim()
              ? `${matchCount} match${matchCount === 1 ? "" : "es"}`
              : "Type to search"}
          </span>
          <TactileButton
            variant="ghost"
            size="sm"
            className="rb-btn-icon shrink-0"
            onClick={() => {
              setSearchOpen(false)
              setTerm("")
            }}
            aria-label="Close search"
          >
            <X className="size-4" aria-hidden="true" />
          </TactileButton>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Control rail, pinned down the left edge of the page area. */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3">
          <RailButton
            label="Search in document"
            onClick={() => setSearchOpen((open) => !open)}
            disabled={!paged}
            active={searchOpen}
          >
            <Search className="size-4" aria-hidden="true" />
          </RailButton>
          <RailButton label="Bookmark" disabled>
            <Bookmark className="size-4" aria-hidden="true" />
          </RailButton>
          <RailButton label="Share" disabled>
            <Share2 className="size-4" aria-hidden="true" />
          </RailButton>

          <span className="my-1 h-px w-6 bg-border" aria-hidden="true" />

          <RailButton
            label="Previous page"
            onClick={() => goTo(page - 1)}
            disabled={!paged || page <= 1}
          >
            <ChevronUpIcon className="size-4" aria-hidden="true" />
          </RailButton>

          {/* The page indicator doubles as a jump box. */}
          <div className="flex flex-col items-center gap-0.5 py-0.5">
            <input
              value={paged ? page : "–"}
              onChange={(event) => {
                const next = Number(event.target.value.replace(/\D/g, ""))
                if (Number.isFinite(next) && next > 0) goTo(next)
              }}
              disabled={!paged}
              aria-label="Page number"
              className="h-7 w-8 rounded-rb-control border-2 border-border bg-white text-center text-xs font-extrabold text-rb-eel outline-none focus-visible:border-rb-macaw disabled:opacity-50"
            />
            <span className="text-[10px] font-bold text-rb-hare">
              {paged ? pageCount : "–"}
            </span>
          </div>

          <RailButton
            label="Next page"
            onClick={() => goTo(page + 1)}
            disabled={!paged || page >= pageCount}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </RailButton>

          <span className="my-1 h-px w-6 bg-border" aria-hidden="true" />

          <RailButton
            label="Zoom out"
            onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
            disabled={zoomIndex === 0}
          >
            <Minus className="size-4" aria-hidden="true" />
          </RailButton>
          <span className="text-[10px] font-bold text-rb-hare">
            {Math.round(zoom * 100)}%
          </span>
          <RailButton
            label="Zoom in"
            onClick={() =>
              setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))
            }
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
          >
            <Plus className="size-4" aria-hidden="true" />
          </RailButton>

          <span className="my-1 h-px w-6 bg-border" aria-hidden="true" />

          <RailButton label="More options" disabled>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </RailButton>
        </div>

        {/* The pages. */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-4">
          {isPdf ? (
            <div className="flex h-full min-h-[28rem] flex-col gap-2">
              <p className="shrink-0 rounded-rb-tile border-2 border-rb-macaw/30 bg-rb-macaw-wash px-3 py-2 text-xs font-bold text-rb-macaw-lip">
                PDFs use the browser's own viewer, which brings its own page and
                zoom controls — the rail's are for text documents.
              </p>
              <object
                data={file.previewUrl}
                type="application/pdf"
                className="min-h-0 w-full flex-1 rounded-rb-card border-2 border-border bg-white"
              >
                <div className="grid h-full place-items-center p-8 text-center">
                  <div>
                    <p className="text-sm font-bold text-rb-eel">
                      This browser cannot preview PDFs inline.
                    </p>
                    <a
                      href={file.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-rb-macaw-lip underline"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      Open it in a new tab
                    </a>
                  </div>
                </div>
              </object>
            </div>
          ) : paged ? (
            /* One page, sized and centred like a sheet of paper. Zoom scales
               the sheet from its top edge so the text does not drift off the
               left as it grows. */
            <div className="flex justify-center">
              <article
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                  width: "min(46rem, 100%)",
                }}
                className="rounded-rb-card border-2 border-border bg-white p-8 shadow-[0_2px_0_var(--color-border)]"
              >
                <p className="rb-nav-label mb-4 text-rb-hare">
                  Page {page} of {pageCount}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-rb-eel">
                  {highlight(pages[page - 1] ?? "", term)}
                </pre>
              </article>
            </div>
          ) : isText ? (
            <p className="p-8 text-center text-sm font-bold text-rb-hare">
              Reading your file…
            </p>
          ) : (
            /* Word: no browser-native viewer exists. */
            <div className="grid h-full min-h-[24rem] place-items-center rounded-rb-card border-2 border-border bg-white p-8 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-rb-macaw-wash text-rb-macaw-lip">
                  <FileText className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-5 font-rb-display text-lg font-extrabold text-rb-eel">
                  {file.name}
                </p>
                <p className="mx-auto mt-2 max-w-xs text-sm font-medium leading-6 text-rb-wolf">
                  Word documents have no preview in the browser. The tutor can
                  still work from this file once generation is connected.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** One square control in the left rail. */
function RailButton({ label, children, onClick, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active ? true : undefined}
      className={`grid size-9 place-items-center rounded-rb-control border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "border-rb-beetle bg-rb-beetle text-white"
          : "border-transparent text-rb-wolf hover:border-border hover:bg-rb-snow enabled:hover:text-rb-beetle-lip"
      }`}
    >
      {children}
    </button>
  )
}
