import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

import { BookOpen, Loader2, MessageCircle, Send, Sparkles, X } from "@/components/icons"
import { TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import { DocumentReader } from "./document-reader.jsx"
import {
  FeatureHeader,
  NotConnectedNote,
  UploadDropzone,
  useUploadedFile,
} from "./workspace-shared.jsx"

/**
 * Upload & Learn — read your own document with the tutor beside it.
 *
 * <p>The same split a lesson uses: material on the left, tutor pinned right.
 * Neither builder shares this screen; a learner here is reading, not
 * assembling, and the two jobs want different room.
 *
 * <p>UI only. The tutor says plainly that it is not connected rather than
 * miming a reply — a convincing fake would be a demo of a feature that does not
 * exist, and whoever wires this up later would have no way to tell the mime
 * from the real thing.
 */

function TutorPanel({ fileName, onClose }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
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
        "I cannot answer from your document yet — this screen is the interface only, and nothing has been sent anywhere. Your file has stayed in this browser."
      )
      setPending(false)
    }, 600)
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
              Ask about your file
            </p>
            <p className="mt-2 max-w-[17rem] text-sm font-medium leading-6 text-rb-wolf">
              Ask a question about what you are reading and the tutor answers from
              this document.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Summarise this", "What are the key terms?", "Explain this simply"].map(
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
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
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
          placeholder="Ask about your file…"
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

export default function UploadAndLearnPage() {
  const { file, error, accept, clear } = useUploadedFile()
  const [tutorOpen, setTutorOpen] = useState(true)
  const splitView = Boolean(file) && tutorOpen

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <FeatureHeader
        title="Upload & Learn"
        subtitle="Read your document with the tutor beside it."
      >
        {file && !tutorOpen ? (
          <TactileButton size="sm" onClick={() => setTutorOpen(true)}>
            <Sparkles className="size-4" aria-hidden="true" />
            Open AI tutor
          </TactileButton>
        ) : null}
      </FeatureHeader>

      {/* Below xl the tutor drops beneath the document rather than squeezing
          two columns onto a phone. */}
      <div
        className={`grid min-h-0 flex-1 border-t border-border ${
          splitView ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"
        }`}
      >
        <div className="min-h-0 min-w-0">
          {file ? (
            <DocumentReader file={file} onReplace={clear} onRemove={clear} />
          ) : (
            <UploadDropzone
              onFile={accept}
              error={error}
              icon={BookOpen}
              title="Read it with the tutor"
              subtitle="Drop a handout, reviewer or set of notes here. It opens on the left, and the tutor works from it on the right."
            />
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
        <div className="mt-4">
          <NotConnectedNote>
            The reader works on what you upload, but the tutor cannot answer from it
            yet — nothing is sent anywhere.
          </NotConnectedNote>
        </div>
      ) : null}
    </div>
  )
}
