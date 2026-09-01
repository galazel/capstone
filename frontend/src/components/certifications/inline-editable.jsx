import { useEffect, useRef, useState } from "react"

import { Check, Pencil, Plus, X } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/**
 * A value on the page that can be edited where it is shown.
 *
 * The certification page used to send every correction -- a typo in a module
 * title, a sharper description -- through the edit drawer, which reloads the
 * whole certification into a two-step form and saves the entire tree back. For
 * changing one word that is a long way round, and it puts the thing being
 * edited behind the panel doing the editing.
 *
 * Idle, this renders exactly what the page rendered before: `renderValue` owns
 * the typography, so a heading stays a heading.
 *
 * The pencil is dimmed rather than hidden. It used to be `opacity-0` until
 * hover, on the argument that always-on pencils turn a page into a form -- and
 * the result was that the page read as not editable at all, so corrections went
 * back through the edit drawer the in-place editing exists to replace. An
 * affordance nobody finds is not a quiet affordance, it is a missing one.
 * Dimmed keeps the page calm and still says the value can be changed; hover and
 * keyboard focus bring it to full strength.
 *
 * Editing is explicit at both ends: Escape or Cancel discards, Enter or Save
 * commits (Enter inserts a newline in a multiline field, where Save is the only
 * way out). Blur does NOT save -- clicking away from a half-typed title is how
 * you leave a field, not how you commit one.
 *
 * @param onSave  async; may throw. The field stays open and shows the message,
 *                so a rejected save does not silently drop what was typed.
 * @param tone    "dark" for controls sitting on the coloured header.
 */
export function InlineEditable({
  value,
  onSave,
  validate,
  renderValue,
  label,
  placeholder,
  multiline = false,
  tone = "light",
  className = "",
  editClassName = "",
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const fieldRef = useRef(null)

  /* The value can change under an open editor -- another save on the page
     rewrites the certification -- but only a closed one may follow it, or a
     background refresh would overwrite what is being typed. */
  useEffect(() => {
    if (!isEditing) setDraft(value ?? "")
  }, [value, isEditing])

  useEffect(() => {
    if (!isEditing) return
    const field = fieldRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [isEditing])

  const onDark = tone === "dark"

  function open() {
    setDraft(value ?? "")
    setError("")
    setIsEditing(true)
  }

  function cancel() {
    setDraft(value ?? "")
    setError("")
    setIsEditing(false)
  }

  async function commit() {
    if (isSaving) return

    const message = validate ? validate(draft) : ""
    if (message) {
      setError(message)
      return
    }

    const next = draft.trim()
    if (next === String(value ?? "").trim()) {
      setIsEditing(false)
      return
    }

    try {
      setIsSaving(true)
      await onSave(next)
      setIsEditing(false)
      setError("")
    } catch (saveError) {
      setError(
        saveError?.response?.data?.message ??
          saveError?.message ??
          "That change could not be saved."
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault()
      cancel()
      return
    }

    if (event.key === "Enter" && !multiline) {
      event.preventDefault()
      void commit()
    }
  }

  if (!isEditing) {
    return (
      <span className={`group/inline relative inline-flex max-w-full items-start gap-2 ${className}`}>
        {renderValue(value)}

        <button
          type="button"
          onClick={open}
          aria-label={`Edit ${label.toLowerCase()}`}
          title={`Edit ${label.toLowerCase()}`}
          className={`mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full opacity-50 transition focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 group-hover/inline:opacity-100 ${
            onDark
              ? "text-white/80 hover:bg-white/20 hover:text-white focus-visible:outline-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring"
          }`}
        >
          <Pencil className="size-3.5" />
        </button>
      </span>
    )
  }

  const Field = multiline ? Textarea : Input

  return (
    <span className={`flex w-full flex-col gap-2 ${className}`}>
      <span className="flex w-full items-start gap-2">
        <Field
          ref={fieldRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          aria-label={label}
          placeholder={placeholder}
          rows={multiline ? 4 : undefined}
          className={`${
            onDark
              ? "border-white/40 bg-white/15 text-white placeholder:text-white/60"
              : "bg-background"
          } ${editClassName}`}
        />

        <span className="flex shrink-0 gap-1 pt-1">
          <button
            type="button"
            onClick={commit}
            disabled={isSaving}
            aria-label={`Save ${label.toLowerCase()}`}
            className={`inline-flex size-8 items-center justify-center rounded-full transition disabled:opacity-50 ${
              onDark
                ? "bg-white text-rb-feather hover:bg-white/90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            <Check className="size-4" />
          </button>

          <button
            type="button"
            onClick={cancel}
            disabled={isSaving}
            aria-label={`Cancel editing ${label.toLowerCase()}`}
            className={`inline-flex size-8 items-center justify-center rounded-full transition disabled:opacity-50 ${
              onDark
                ? "text-white hover:bg-white/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <X className="size-4" />
          </button>
        </span>
      </span>

      {error ? (
        <span
          role="alert"
          className={`text-xs font-medium ${onDark ? "text-white" : "text-destructive"}`}
        >
          {error}
        </span>
      ) : null}
    </span>
  )
}

export default InlineEditable


/**
 * "Add a lesson" as one field rather than a row that appears already named.
 *
 * The alternative -- append something called "New lesson" and let the pencil
 * fix it -- writes a placeholder to the server the moment the button is
 * pressed, and every one an admin adds and then abandons stays in the
 * curriculum under that name. Naming it first means nothing is created until
 * there is something to call it.
 *
 * Deliberately the same shape as {@link InlineEditable}'s open state, down to
 * the check and cross: adding and renaming are the same gesture on this page
 * and should not look like two different features.
 *
 * @param onAdd async; may throw. The field stays open with the message.
 */
export function InlineAdd({ label, placeholder, validate, onAdd, className = "" }) {
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const fieldRef = useRef(null)

  useEffect(() => {
    if (isAdding) fieldRef.current?.focus()
  }, [isAdding])

  function close() {
    setIsAdding(false)
    setDraft("")
    setError("")
  }

  async function commit() {
    if (isSaving) return

    const message = validate ? validate(draft) : ""
    if (message) {
      setError(message)
      return
    }

    try {
      setIsSaving(true)
      await onAdd(draft.trim())
      close()
    } catch (addError) {
      setError(
        addError?.response?.data?.message ??
          addError?.message ??
          `That ${label.toLowerCase()} could not be added.`
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className={`inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
      >
        <Plus className="size-4" />
        Add {label.toLowerCase()}
      </button>
    )
  }

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      <div className="flex w-full items-start gap-2">
        <Input
          ref={fieldRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              close()
            }
            if (event.key === "Enter") {
              event.preventDefault()
              void commit()
            }
          }}
          disabled={isSaving}
          aria-label={`New ${label.toLowerCase()}`}
          placeholder={placeholder ?? `Name the new ${label.toLowerCase()}`}
          className="bg-background"
        />

        <div className="flex shrink-0 gap-1 pt-1">
          <button
            type="button"
            onClick={commit}
            disabled={isSaving}
            aria-label={`Add ${label.toLowerCase()}`}
            className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Check className="size-4" />
          </button>

          <button
            type="button"
            onClick={close}
            disabled={isSaving}
            aria-label={`Cancel adding ${label.toLowerCase()}`}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {error ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  )
}
