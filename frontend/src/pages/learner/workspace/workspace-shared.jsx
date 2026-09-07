import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { ArrowLeft, Upload } from "@/components/icons"
import { TactileButton } from "@/components/rebyu/rebyu-ui.jsx"

/**
 * The parts all three workspace features share.
 *
 * <p>Flashcard Builder, Quiz Builder and Upload & Learn are separate features
 * with separate screens, but every one of them starts the same way: the learner
 * hands over a document. Keeping one dropzone, one set of accepted formats and
 * one size limit here means the three cannot drift into accepting different
 * things, which is the kind of difference nobody notices until a file works on
 * one screen and is refused on another.
 */

export const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"]
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",")
export const MAX_FILE_BYTES = 25 * 1024 * 1024

export function fileExtension(name) {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot).toLowerCase()
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Holds the uploaded file for one feature, with validation and cleanup.
 *
 * <p>The object URL backs the reader's preview and has to be released by hand,
 * or every replaced file leaks its blob for the life of the tab.
 */
export function useUploadedFile() {
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const url = file?.previewUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  const accept = useCallback((chosen) => {
    if (!chosen) return
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
  }, [])

  const clear = useCallback(() => {
    setFile(null)
    setError(null)
  }, [])

  return { file, error, accept, clear }
}

/**
 * The drop target every feature opens on.
 *
 * @param title    what this particular feature will do with the file
 * @param subtitle one line under it, in the feature's own words
 */
export function UploadDropzone({ onFile, error, icon: Icon = Upload, title, subtitle }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  return (
    <div className="flex h-full min-h-0 items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const dropped = event.dataTransfer?.files?.[0]
            if (dropped) onFile(dropped)
          }}
          className={`rounded-rb-card border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragging ? "border-rb-beetle bg-rb-beetle-wash" : "border-border bg-card"
          }`}
        >
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-rb-beetle text-white shadow-[0_4px_0_var(--color-rb-beetle-lip)] ring-2 ring-white">
            <Icon className="size-7" aria-hidden="true" />
          </span>

          <p className="mt-6 font-rb-display text-xl font-extrabold text-rb-eel">{title}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-rb-wolf">
            {subtitle}
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

/** The heading every feature screen carries, with a way back to the hub. */
export function FeatureHeader({ title, subtitle, backTo = "/learner/workspace", children }) {
  const navigate = useNavigate()
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <TactileButton
          variant="ghost"
          size="sm"
          className="rb-btn-icon"
          onClick={() => navigate(backTo)}
          aria-label="Back to the workspace"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </TactileButton>
        <div className="min-w-0">
          <h1 className="rb-display rb-display-sm truncate">{title}</h1>
          <p className="text-sm font-medium text-rb-wolf">{subtitle}</p>
        </div>
      </div>
      {children}
    </header>
  )
}

/**
 * The standing note that none of this reaches a server yet.
 *
 * <p>Said once per screen, plainly. A workspace that looked finished but
 * quietly did nothing would waste the time of whoever tested it next.
 */
export function NotConnectedNote({ children }) {
  return (
    <p className="mx-4 mb-6 rounded-rb-card border-2 border-border bg-card p-4 text-sm font-medium leading-6 text-rb-wolf lg:mx-6">
      <span className="font-extrabold text-rb-eel">Not connected yet.</span> {children}
    </p>
  )
}
