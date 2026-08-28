import { useState } from "react"
import { Check, CheckCheck, FastForward, Pencil, RotateCw, SkipForward, Sparkles, X } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * The decision controls for a human-in-the-loop checkpoint.
 *
 * Seven actions, matching what the graph supports:
 *
 *   Approve            accept and move on
 *   Approve remaining  accept this and everything left in the phase, unattended
 *   Finish without me  accept this and every checkpoint after it, to the end
 *   Edit manually      submit the reviewer's own version
 *   Improve with AI    regenerate, guided by written feedback
 *   Regenerate         regenerate from scratch, no guidance
 *   Skip               leave this item out and move on
 *
 * "Skip" is the graph's `reject`. The UI word describes the effect — the item is
 * left out and the walk continues — where "reject" reads like a failure.
 *
 * "Finish without me" is the wider version of "Approve remaining": that one
 * only drains the phase in front of it, so a reviewer who was done reviewing
 * still got stopped at the next phase, and again for the mock exam, the
 * diagnostic, and the question bank. This one switches the whole run to
 * unattended.
 *
 * Actions only: the artifact, the automated checks, and the version history are
 * the checkpoint card's job (see `ReviewCheckpoint`). Splitting them keeps this
 * component about the decision, which is the part with state in it.
 */
export function ReviewActions({ payload, total, onSubmit, submitting, disabled }) {
  const [mode, setMode] = useState(null) // null | "improve" | "edit"
  const [instructions, setInstructions] = useState("")
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState(null)

  const busy = submitting || disabled

  const submit = (action, extra = {}) => {
    onSubmit?.({ action, ...extra })
    reset()
  }

  function reset() {
    setMode(null)
    setInstructions("")
    setDraft("")
    setDraftError(null)
  }

  const startEdit = () => {
    setDraft(JSON.stringify(payload, null, 2))
    setDraftError(null)
    setMode("edit")
  }

  const submitEdit = () => {
    let parsed
    try {
      parsed = JSON.parse(draft)
    } catch (error) {
      // Caught here rather than sent: an unparseable payload would be stored as
      // a version and reach the database as the reviewer's "approved" content.
      setDraftError(`That is not valid JSON — ${error.message}`)
      return
    }
    submit("edit", { payload: parsed })
  }

  if (mode === "improve") {
    return (
      <Composer
        label="What should the AI change?"
        onCancel={reset}
        confirm={
          <Button
            size="sm"
            disabled={busy || !instructions.trim()}
            onClick={() => submit("improve", { instructions: instructions.trim() })}
          >
            <Sparkles className="mr-2 size-4" />
            Regenerate with this feedback
          </Button>
        }
      >
        <Textarea
          id="review-improve-instructions"
          autoFocus
          rows={3}
          placeholder="e.g. the distractors are too obvious — make them plausible misconceptions a learner would actually hold"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          className="resize-y"
        />
      </Composer>
    )
  }

  if (mode === "edit") {
    return (
      <Composer
        label="Edit this item"
        error={draftError}
        onCancel={reset}
        confirm={
          <Button size="sm" disabled={busy} onClick={submitEdit}>
            <Check className="mr-2 size-4" />
            Save and continue
          </Button>
        }
      >
        <Textarea
          id="review-edit-payload"
          autoFocus
          rows={16}
          spellCheck={false}
          className="resize-y font-mono text-xs leading-relaxed"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setDraftError(null)
          }}
        />
      </Composer>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={busy} onClick={() => submit("approve")}>
        <Check className="mr-2 size-4" />
        Approve
      </Button>

      {total > 1 ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          title="Approve this item and every remaining item in this phase without pausing again"
          onClick={() => submit("approve_remaining")}
        >
          <CheckCheck className="mr-2 size-4" />
          Approve remaining
        </Button>
      ) : null}

      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        title="Approve this and every remaining checkpoint — the run generates the rest on its own"
        onClick={() => submit("approve_all")}
      >
        <FastForward className="mr-2 size-4" />
        Finish without me
      </Button>

      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("improve")}>
        <Sparkles className="mr-2 size-4" />
        Improve with AI
      </Button>

      <Button size="sm" variant="ghost" disabled={busy} onClick={startEdit}>
        <Pencil className="mr-2 size-4" />
        Edit manually
      </Button>

      <Button size="sm" variant="ghost" disabled={busy} onClick={() => submit("regenerate")}>
        <RotateCw className="mr-2 size-4" />
        Regenerate
      </Button>

      <Button size="sm" variant="ghost" disabled={busy} onClick={() => submit("skip")}>
        <SkipForward className="mr-2 size-4" />
        Skip
      </Button>
    </div>
  )
}

/** Shared frame for the two actions that need input before they can be sent. */
function Composer({ label, error, children, confirm, onCancel }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Button size="icon-sm" variant="ghost" onClick={onCancel} aria-label="Cancel">
          <X className="size-4" />
        </Button>
      </div>

      {children}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2">{confirm}</div>
    </div>
  )
}
