import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"

import {
  ArrowLeft,
  Layers,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Target,
  Upload,
  X,
} from "@/components/icons"
import { RebyuCard, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { DocumentReader } from "./document-reader.jsx"

/**
 * Study Workspace -- UI only.
 *
 * The learner brings their own material (a lecture handout, a reviewer, notes)
 * instead of studying the platform's curriculum, and works on it the way they
 * already work on a lesson: the document on the left, the tutor pinned right.
 *
 * <p>Nothing here talks to a server, deliberately. The upload, the three
 * generators and the chat are all local state, so the screen can be reviewed
 * and reshaped before any endpoint is designed around it. Every point that
 * will need one is marked BACKEND:, so wiring it later is a search rather than
 * a re-read.
 *
 * <p>The file never leaves the browser -- it is held as an object URL for the
 * preview and revoked when it is replaced or the page unmounts. The tutor says
 * so plainly rather than miming a reply it cannot produce: a panel that
 * answered convincingly would be a demo of a feature that does not exist, and
 * whoever wired it up later would have no way to tell the mime from the real
 * thing.
 */

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"]
const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",")
const MAX_FILE_BYTES = 25 * 1024 * 1024

/*
 * What the workspace GENERATES from an uploaded document.
 *
 * Two, not three. Reading the document with the tutor -- Upload & Learn -- is
 * the third thing the workspace does, but it is not something that gets
 * generated: it is the reader on the left, running the moment a file is open.
 * Listing it here as a button would have offered the learner a control for the
 * screen they are already looking at.
 */
const STUDY_AIDS = [
  {
    kind: "flashcards",
    icon: Layers,
    title: "Flashcards",
    blurb: "Key terms and ideas, two-sided.",
  },
  {
    kind: "quiz",
    icon: Target,
    title: "Practice quiz",
    blurb: "Ten questions drawn from the document.",
  },
]

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

/* ------------------------------------------------------------------ */
/* Left column: the document                                           */
/* ------------------------------------------------------------------ */

function UploadDropzone({ onFile, error }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer?.files?.[0]
    if (dropped) onFile(dropped)
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-rb-card border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragging ? "border-rb-beetle bg-rb-beetle-wash" : "border-border bg-card"
          }`}
        >
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-rb-beetle text-white shadow-[0_4px_0_var(--color-rb-beetle-lip)] ring-2 ring-white">
            <Upload className="size-7" aria-hidden="true" />
          </span>

          <p className="mt-6 font-rb-display text-xl font-extrabold text-rb-eel">
            Bring your own material
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-rb-wolf">
            Drop a lecture handout, reviewer or set of notes here. It opens on
            the left, and the tutor works from it on the right.
          </p>

          <TactileButton className="mt-7" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Choose a file
          </TactileButton>

          <p className="mt-4 text-xs font-bold text-rb-hare">
            PDF, Word or TXT · up to {formatBytes(MAX_FILE_BYTES)}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="hidden"
            onChange={(event) => {
              const chosen = event.target.files?.[0]
              if (chosen) onFile(chosen)
              // Cleared so choosing the same file twice still fires onChange.
              event.target.value = ""
            }}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-rb-tile border-2 border-rb-cardinal/40 bg-rb-cardinal-wash px-4 py-3 text-sm font-bold text-rb-cardinal-lip"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Right column: the tutor                                             */
/* ------------------------------------------------------------------ */

function TutorPanel({ fileName, onClose }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [generating, setGenerating] = useState(null)
  const scrollRef = useRef(null)
  const ready = Boolean(fileName)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, pending])

  const say = useCallback((role, text) => {
    setMessages((current) => [
      ...current,
      { id: `${role}-${Date.now()}-${current.length}`, role, text },
    ])
  }, [])

  function send(text) {
    const trimmed = text.trim()
    if (!trimmed || pending || !ready) return
    say("user", trimmed)
    setDraft("")
    setPending(true)
    // BACKEND: send this message plus the uploaded document to the tutor and
    // stream the reply back.
    window.setTimeout(() => {
      say(
        "assistant",
        "I cannot answer from your document yet — this workspace is the screen only, and nothing has been sent anywhere. Your file has stayed in this browser."
      )
      setPending(false)
    }, 600)
  }

  function generate(kind) {
    if (generating || !ready) return
    const aid = STUDY_AIDS.find((entry) => entry.kind === kind)
    // "flashcards" is plural and takes no article; "practice quiz" does.
    const label = aid.title.toLowerCase()
    const phrase = kind === "flashcards" ? label : `a ${label}`
    say("user", `Make ${phrase} from this file.`)
    setGenerating(kind)
    // BACKEND: generate the aid from the uploaded document, save it to the
    // learner's Library, and reply with a card that opens it.
    window.setTimeout(() => {
      say(
        "assistant",
        `${aid.title} generation is not connected yet. When it is, your ${label} will appear here and be saved to your Library.`
      )
      setGenerating(null)
    }, 700)
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-rb-snow">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 bg-rb-beetle px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-2 ring-white/30">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-rb-display text-sm font-extrabold leading-tight text-white">
              REBYU AI Tutor
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs font-bold text-white/80">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  ready ? "bg-rb-feather" : "bg-white/40"
                }`}
                aria-hidden="true"
              />
              {fileName ?? "No file yet"}
            </p>
          </div>
        </div>

        {onClose ? (
          <TactileButton
            variant="ghost"
            size="sm"
            className="rb-btn-icon shrink-0 !border-transparent hover:!bg-white/15"
            // The ghost variant is a light face with dark ink, which on the
            // violet header renders white-on-white. Overriding the vars the
            // button reads its colours from beats fighting them with utilities.
            style={{ "--rb-btn-face": "transparent", "--rb-btn-ink": "#ffffff" }}
            onClick={onClose}
            aria-label="Close AI Tutor"
          >
            <X className="size-4" aria-hidden="true" />
          </TactileButton>
        ) : null}
      </header>

      {/* Generators sit above the thread: they are the reason to open this
          page, and burying them under a conversation would hide the feature. */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <p className="rb-nav-label text-rb-hare">Generate from this file</p>
        <div className="mt-2.5 grid gap-2">
          {STUDY_AIDS.map((aid) => {
            const Icon = aid.icon
            const busy = generating === aid.kind
            return (
              <button
                key={aid.kind}
                type="button"
                disabled={!ready || Boolean(generating)}
                onClick={() => generate(aid.kind)}
                className="flex items-center gap-3 rounded-rb-tile border-2 border-border bg-white px-3 py-2.5 text-left transition-colors hover:border-rb-beetle hover:bg-rb-beetle-wash disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-white"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-rb-tile bg-rb-beetle-wash text-rb-beetle-lip">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Icon className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-rb-eel">
                    {aid.title}
                  </span>
                  <span className="block truncate text-xs font-medium text-rb-wolf">
                    {aid.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <motion.span
              className="grid size-14 place-items-center rounded-3xl bg-rb-beetle text-white shadow-[0_4px_0_var(--color-rb-beetle-lip)] ring-2 ring-white"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="size-6" aria-hidden="true" />
            </motion.span>
            <p className="mt-5 font-rb-display text-lg font-extrabold text-rb-eel">
              {ready ? "Ask about your file" : "Upload a file to begin"}
            </p>
            <p className="mt-2 max-w-[17rem] text-sm font-medium leading-6 text-rb-wolf">
              {ready
                ? "Ask a question, or generate a study aid from the buttons above."
                : "Drop a PDF, Word file or TXT on the left and the tutor will work from it."}
            </p>

            {ready ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {["Summarise this", "What are the key terms?", "Quiz me on it"].map(
                  (suggestion) => (
                    <TactileButton
                      key={suggestion}
                      variant="snow"
                      size="sm"
                      className="!h-auto !gap-1.5 !border-2 !border-rb-beetle/30 !bg-white !px-3.5 !py-2 !text-rb-beetle-lip hover:!border-rb-beetle hover:!bg-rb-beetle-wash"
                      onClick={() => send(suggestion)}
                    >
                      <MessageCircle className="size-3.5" aria-hidden="true" />
                      <span className="text-xs font-bold">{suggestion}</span>
                    </TactileButton>
                  )
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={`max-w-[85%] rounded-rb-card border-2 px-3.5 py-2.5 text-sm font-medium leading-6 ${
                    message.role === "user"
                      ? "border-rb-beetle bg-rb-beetle text-white"
                      : "border-border bg-white text-rb-eel"
                  }`}
                >
                  {message.text}
                </div>
              </li>
            ))}
            {pending ? (
              <li className="flex justify-start">
                <div className="flex items-center gap-2 rounded-rb-card border-2 border-border bg-white px-3.5 py-2.5">
                  <Loader2
                    className="size-4 animate-spin text-rb-beetle-lip"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-rb-hare">Thinking…</span>
                </div>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault()
          send(draft)
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!ready || pending}
          placeholder={ready ? "Ask about your file…" : "Upload a file first"}
          aria-label="Message the AI tutor"
          className="h-11 min-w-0 flex-1 rounded-rb-control border-2 border-border bg-white px-3.5 text-sm font-medium text-rb-eel outline-none placeholder:text-rb-hare focus-visible:border-rb-macaw disabled:opacity-60"
        />
        <TactileButton
          type="submit"
          size="sm"
          className="rb-btn-icon shrink-0"
          disabled={!ready || pending || !draft.trim()}
          aria-label="Send message"
        >
          <Send className="size-4" aria-hidden="true" />
        </TactileButton>
      </form>
    </section>
  )
}

/* ------------------------------------------------------------------ */

export default function LearnerWorkspacePage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [tutorOpen, setTutorOpen] = useState(true)

  // The object URL backs the PDF preview and has to be released by hand, or
  // every replaced file leaks its blob for the life of the tab.
  useEffect(() => {
    const url = file?.previewUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  const accept = useCallback((chosen) => {
    if (!ACCEPTED_EXTENSIONS.includes(fileExtension(chosen.name))) {
      setError("That file type is not supported. Use a PDF, Word document or TXT file.")
      return
    }
    if (chosen.size > MAX_FILE_BYTES) {
      setError(
        `That file is ${formatBytes(chosen.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`
      )
      return
    }
    setError(null)
    setFile(Object.assign(chosen, { previewUrl: URL.createObjectURL(chosen) }))
    setTutorOpen(true)
  }, [])

  const splitView = Boolean(file) && tutorOpen

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <TactileButton
            variant="ghost"
            size="sm"
            className="rb-btn-icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </TactileButton>
          <div className="min-w-0">
            <h1 className="rb-display rb-display-sm truncate">Study workspace</h1>
            <p className="text-sm font-medium text-rb-wolf">
              Upload your own material and study it with the tutor.
            </p>
          </div>
        </div>

        {file && !tutorOpen ? (
          <TactileButton size="sm" onClick={() => setTutorOpen(true)}>
            <Sparkles className="size-4" aria-hidden="true" />
            Open AI tutor
          </TactileButton>
        ) : null}
      </header>

      {/* The same split a lesson uses: material left, tutor pinned right.
          Below xl the tutor drops beneath the document rather than squeezing
          two columns onto a phone. */}
      <div
        className={`grid min-h-0 flex-1 border-t border-border ${
          splitView ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"
        }`}
      >
        <div className="min-h-0 min-w-0">
          {file ? (
            <DocumentReader
              file={file}
              onReplace={() => setFile(null)}
              onRemove={() => setFile(null)}
            />
          ) : (
            <UploadDropzone onFile={accept} error={error} />
          )}
        </div>

        {splitView ? (
          <aside className="min-h-0 border-t border-border xl:border-l xl:border-t-0">
            <div className="h-[36rem] xl:sticky xl:top-0 xl:h-[calc(100dvh-8rem)]">
              <TutorPanel fileName={file.name} onClose={() => setTutorOpen(false)} />
            </div>
          </aside>
        ) : null}
      </div>

      {!file ? (
        <RebyuCard className="mx-4 mb-6 mt-4 p-4 lg:mx-6">
          <p className="text-sm font-medium leading-6 text-rb-wolf">
            <span className="font-extrabold text-rb-eel">Not connected yet.</span> This
            workspace is the screen only — your file stays in this browser, and nothing
            is uploaded or generated.
          </p>
        </RebyuCard>
      ) : null}
    </div>
  )
}
