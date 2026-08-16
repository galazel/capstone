import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Check, NotebookPenIcon, Plus, Trash2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BentoHeading, BentoSkeleton, BentoTile } from "@/components/commons/bento.jsx"
import {
  STUDY_DESK_NOTES_KEY,
  addNote,
  clearNotes,
  deleteNote,
  getNotes,
  updateNote,
} from "@/services/studyDeskService.js"

/**
 * The learner's revision checklist for the certification they are looking at.
 *
 * Ticking crosses a note out rather than removing it: what you have already
 * covered is as much a part of a revision list as what you have not, and a list
 * that empties itself as you work gives back no sense of progress. Clearing is
 * an explicit action, offered as "clear done" first -- the common case -- with
 * "clear all" beside it.
 */
export function StudyNotesTile({ certificationId }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")

  const notesQuery = useQuery({
    queryKey: [STUDY_DESK_NOTES_KEY, String(certificationId ?? "")],
    queryFn: () => getNotes(certificationId),
    enabled: Boolean(certificationId),
    staleTime: 30_000,
  })

  const notes = Array.isArray(notesQuery.data) ? notesQuery.data : []
  const doneCount = notes.filter((note) => note.done).length

  // A half-typed note belongs to the certification it was typed under.
  useEffect(() => setDraft(""), [certificationId])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [STUDY_DESK_NOTES_KEY] })

  const onError = (message) => (error) =>
    toast.error(message, {
      description: error?.response?.data?.message ?? error?.message ?? "Please try again.",
    })

  const addMutation = useMutation({
    mutationFn: (body) => addNote(certificationId, body),
    onSuccess: async () => {
      setDraft("")
      await invalidate()
    },
    onError: onError("Could not add that note"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ noteId, done }) => updateNote(noteId, { done }),
    onSuccess: invalidate,
    onError: onError("Could not update that note"),
  })

  const deleteMutation = useMutation({
    mutationFn: (noteId) => deleteNote(noteId),
    onSuccess: invalidate,
    onError: onError("Could not delete that note"),
  })

  const clearMutation = useMutation({
    mutationFn: (completedOnly) => clearNotes(certificationId, completedOnly),
    onSuccess: invalidate,
    onError: onError("Could not clear your notes"),
  })

  const submit = (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || addMutation.isPending) return
    addMutation.mutate(body)
  }

  return (
    // Half the band, with the countdown taking the other half. (On the
    // analytics board the span is set by the tile table there, and the learner
    // can resize it; this is the size when the tile is used on its own.)
    <BentoTile col={3} row={2}>
      <BentoHeading
        title="study notes"
        hint={
          notes.length
            ? `${doneCount} of ${notes.length} done`
            : "Your checklist for this certification."
        }
        action={
          notes.length ? (
            <div className="flex items-center gap-1">
              {doneCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={clearMutation.isPending}
                  onClick={() => clearMutation.mutate(true)}
                >
                  Clear done
                </Button>
              ) : null}

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                disabled={clearMutation.isPending}
                onClick={() => clearMutation.mutate(false)}
              >
                Clear all
              </Button>
            </div>
          ) : null
        }
      />

      <form onSubmit={submit} className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          placeholder="Add a note — a topic to revisit, a formula to memorize…"
          className="h-9 text-sm"
          aria-label="New note"
        />

        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          disabled={!draft.trim() || addMutation.isPending}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </form>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {notesQuery.isLoading ? (
          <BentoSkeleton rows={3} className="mt-0" />
        ) : notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <NotebookPenIcon className="size-5 text-muted-foreground/60" aria-hidden="true" />

            <p className="mt-2 text-sm font-medium text-foreground">No notes yet</p>

            <p className="mt-1 text-xs text-muted-foreground">
              Jot down what to come back to. Tick things off as you cover them.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note.noteId} className="group flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-muted/60">
                {/* A real checkbox, not a styled div: it is a checkbox to a
                    screen reader and to a keyboard either way. */}
                <input
                  type="checkbox"
                  checked={note.done}
                  onChange={(event) =>
                    toggleMutation.mutate({ noteId: note.noteId, done: event.target.checked })
                  }
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                  aria-label={note.body}
                />

                <span
                  className={`min-w-0 flex-1 break-words text-sm leading-6 ${
                    note.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {note.body}
                </span>

                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(note.noteId)}
                  aria-label={`Delete note: ${note.body}`}
                  className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {doneCount > 0 && doneCount === notes.length ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rb-feather-ink">
          <Check className="size-3.5" aria-hidden="true" />
          Everything on this list is covered.
        </p>
      ) : null}
    </BentoTile>
  )
}
