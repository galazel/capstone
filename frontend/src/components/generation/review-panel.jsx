import { useState } from "react"
import {
  Check,
  CheckCheck,
  Pencil,
  RotateCw,
  SkipForward,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ValidationReport } from "./validation-report"
import { stageLabel } from "./task-status"

/**
 * The human-in-the-loop checkpoint, rendered inline next to the artifact rather
 * than in a modal — the reviewer needs to read the generated content and decide
 * at the same time, and a dialog would cover the thing being judged.
 *
 * Six actions, matching what the graph supports:
 *
 *   Approve            accept and move on
 *   Approve remaining  accept this and everything left in the phase, unattended
 *   Edit manually      submit the reviewer's own version
 *   Improve with AI    regenerate, guided by written feedback
 *   Regenerate         regenerate from scratch, no guidance
 *   Skip               leave this item out and move on
 *
 * "Skip" is the graph's `reject`. The UI word describes the effect — the item
 * is left out and the walk continues — where "reject" reads like a failure.
 */
export function ReviewPanel({ review, onSubmit, submitting, disabled }) {
  const [mode, setMode] = useState(null) // null | "improve" | "edit"
  const [instructions, setInstructions] = useState("")
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState(null)

  if (!review) return null

  const { stage, item_label: label, item_index: index, item_total: total, payload, validation_report: report } = review

  const submit = (action, extra = {}) => {
    onSubmit?.({ action, ...extra })
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

  const busy = submitting || disabled

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{stageLabel(stage)}</Badge>
        {label ? <span className="text-sm font-medium">{label}</span> : null}
        {total ? (
          <span className="text-xs text-muted-foreground">
            item {(index ?? 0) + 1} of {total}
          </span>
        ) : null}
      </div>

      {report ? <ValidationReport report={report} /> : null}

      {mode === "improve" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="improve-instructions">
            What should the AI change?
          </label>
          <Textarea
            id="improve-instructions"
            autoFocus
            rows={4}
            placeholder="e.g. the distractors are too obvious — make them plausible misconceptions a learner would actually hold"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !instructions.trim()}
              onClick={() => submit("improve", { instructions: instructions.trim() })}
            >
              <Sparkles className="mr-2 size-4" />
              Regenerate with this feedback
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="edit-payload">
            Edit this item
          </label>
          <Textarea
            id="edit-payload"
            autoFocus
            rows={16}
            spellCheck={false}
            className="font-mono text-xs"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setDraftError(null)
            }}
          />
          {draftError ? <p className="text-xs text-destructive">{draftError}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={submitEdit}>
              <Check className="mr-2 size-4" />
              Save and continue
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => submit("approve")}>
            <Check className="mr-2 size-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={startEdit}>
            <Pencil className="mr-2 size-4" />
            Edit manually
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode("improve")}>
            <Sparkles className="mr-2 size-4" />
            Improve with AI
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => submit("regenerate")}>
            <RotateCw className="mr-2 size-4" />
            Regenerate
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => submit("skip")}>
            <SkipForward className="mr-2 size-4" />
            Skip
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
        </div>
      ) : null}
    </div>
  )
}
