import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Check, NotebookPenIcon, Plus, Trash2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BentoSkeleton, BentoTile } from "@/components/commons/bento.jsx"
import {
  STUDY_DESK_NOTES_KEY,
  addNote,
  clearNotes,
  deleteNote,
  getNotes,
  updateNote,
} from "@/services/studyDeskService.js"

/* The ruling pitch, and everything vertical on the paper is a multiple of it --
   the line-height of a note, the box of its checkbox, the gradient stop that
   draws the rule. The moment those disagree the writing drifts off the lines
   and the whole conceit falls apart. Wrapped notes stay on the rules for free:
   a second line is exactly one more 28px band. */
const RULED_PAPER =
  "bg-[length:100%_28px] bg-[linear-gradient(to_bottom,transparent_27px,rgba(203,58,44,0.22)_27px,rgba(203,58,44,0.22)_28px)] dark:bg-[linear-gradient(to_bottom,transparent_27px,rgba(255,122,107,0.20)_27px,rgba(255,122,107,0.20)_28px)]"

/**
 * The learner's revision checklist for the certification they are looking at,
 * drawn as the thing it actually is: a sheet of ruled paper.
 *
 * The paper is not decoration. Red rules and a margin line say "scribble here"
 * the way no bordered card does, and a list you are meant to jot at should not
 * look like a form you are meant to fill in correctly.
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

  // Ids for notes that exist on the page but not yet in the database. Negative
  // and counted down, so they can never collide with a real server id.
  const pendingId = useRef(0)

  const notesKey = [STUDY_DESK_NOTES_KEY, String(certificationId ?? "")]

  const notesQuery = useQuery({
    queryKey: notesKey,
    queryFn: () => getNotes(certificationId),
    enabled: Boolean(certificationId),
    staleTime: 30_000,
  })

  const notes = Array.isArray(notesQuery.data) ? notesQuery.data : []
  const doneCount = notes.filter((note) => note.done).length

  // A half-typed note belongs to the certification it was typed under.
  useEffect(() => setDraft(""), [certificationId])

  const cached = () => {
    const current = queryClient.getQueryData(notesKey)
    return Array.isArray(current) ? current : []
  }

  /**
   * Writing to a pad is instant, so the tile behaves that way: every edit lands
   * in the cache before the request is sent, and the request only confirms it.
   *
   * Waiting on the server was costing two round trips per keystroke-sized
   * action -- the write itself, and then the refetch that a blanket
   * `invalidateQueries` kicked off -- with nothing on screen changing until
   * both had returned. Since each endpoint hands back the row it just wrote,
   * there is nothing the refetch could tell us that the response has not
   * already: `settle` swaps the optimistic row for the server's copy in place.
   *
   * `cancelQueries` first, or an in-flight GET issued before the edit can land
   * afterwards and overwrite it with a list that predates the change.
   */
  const optimistic = ({ message, apply, settle }) => ({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: notesKey })
      const previous = cached()
      queryClient.setQueryData(notesKey, apply(previous, variables))
      return { previous }
    },
    onSuccess: settle
      ? (result, variables) =>
          queryClient.setQueryData(notesKey, (current) =>
            settle(Array.isArray(current) ? current : [], result, variables)
          )
      : undefined,
    onError: (error, _variables, context) => {
      // Put the pad back the way it was, then resync in case the failure was
      // partial -- a "clear done" that deleted some rows before it threw.
      if (context?.previous) queryClient.setQueryData(notesKey, context.previous)
      queryClient.invalidateQueries({ queryKey: notesKey })
      toast.error(message, {
        description: error?.response?.data?.message ?? error?.message ?? "Please try again.",
      })
    },
  })

  const addMutation = useMutation({
    mutationFn: ({ body }) => addNote(certificationId, body),
    // Appended, because the server orders these by creation time ascending --
    // an optimistic row at the top would visibly jump on confirmation.
    ...optimistic({
      message: "Could not add that note",
      apply: (notes, { body, tempId }) => [
        ...notes,
        { noteId: tempId, body, done: false, pending: true },
      ],
      settle: (notes, created, { tempId }) =>
        notes.map((note) => (note.noteId === tempId ? created : note)),
    }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ noteId, done }) => updateNote(noteId, { done }),
    ...optimistic({
      message: "Could not update that note",
      apply: (notes, { noteId, done }) =>
        notes.map((note) => (note.noteId === noteId ? { ...note, done } : note)),
      settle: (notes, updated) =>
        notes.map((note) => (note.noteId === updated.noteId ? updated : note)),
    }),
  })

  const deleteMutation = useMutation({
    mutationFn: (noteId) => deleteNote(noteId),
    ...optimistic({
      message: "Could not delete that note",
      apply: (notes, noteId) => notes.filter((note) => note.noteId !== noteId),
    }),
  })

  const clearMutation = useMutation({
    mutationFn: (completedOnly) => clearNotes(certificationId, completedOnly),
    ...optimistic({
      message: "Could not clear your notes",
      apply: (notes, completedOnly) => (completedOnly ? notes.filter((note) => !note.done) : []),
    }),
  })

  const submit = (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return

    // Cleared here rather than in `onSuccess`: the learner has finished with
    // this note the moment they hit Add, and a field that stays full until the
    // server answers reads as a click that did not register. No `isPending`
    // guard either -- two notes in quick succession are two notes.
    setDraft("")
    pendingId.current -= 1
    addMutation.mutate({ body, tempId: pendingId.current })
  }

  return (
    // Half the band, with the countdown taking the other half. (On the
    // analytics board the span is set by the tile table there, and the learner
    // can resize it; this is the size when the tile is used on its own.)
    //
    // The tile's own padding is stripped: paper runs edge to edge, and the
    // parts that need insetting inset themselves.
    <BentoTile
      col={3}
      row={2}
      className="relative overflow-hidden border-[#e6ddcf] bg-[#fffdf9] p-0 sm:p-0 dark:border-[#332f29] dark:bg-[#1c1a17]"
    >
      <div className="relative shrink-0 px-5 pb-1.5">
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h2 className="font-rb-display text-sm font-extrabold lowercase text-[#2f2a22] dark:text-[#eae4d8]">
              study notes
            </h2>

            <p className="mt-0.5 text-xs text-[#7c7367] dark:text-[#a49b8d]">
              {notes.length
                ? `${doneCount} of ${notes.length} done`
                : "Your checklist for this certification."}
            </p>
          </div>

          {notes.length ? (
            <div className="-mb-0.5 flex items-center gap-1">
              {doneCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-[#7c7367] hover:bg-black/5 hover:text-[#2f2a22] dark:text-[#a49b8d] dark:hover:bg-white/10 dark:hover:text-[#eae4d8]"
                  disabled={clearMutation.isPending}
                  onClick={() => clearMutation.mutate(true)}
                >
                  Clear done
                </Button>
              ) : null}

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#7c7367] dark:text-[#a49b8d] hover:bg-rb-cardinal/10 hover:text-rb-cardinal"
                disabled={clearMutation.isPending}
                onClick={() => clearMutation.mutate(false)}
              >
                Clear all
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* The paper. The margin rule is painted on the scroll container so it
          runs the whole height, but the ruling itself rides on the content
          inside it -- lines that stayed put while the notes scrolled past would
          read as a background texture rather than as paper. */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          className="pointer-events-none absolute inset-y-0 left-10 w-px bg-[#cb3a2c]/45 dark:bg-[#ff7a6b]/40"
          aria-hidden="true"
        />

        {notesQuery.isLoading ? (
          <BentoSkeleton rows={3} className="mt-3 px-5" />
        ) : notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-6 text-center">
            <NotebookPenIcon className="size-5 text-[#b3aa9c] dark:text-[#6f6759]" aria-hidden="true" />

            <p className="mt-2 text-sm font-semibold text-[#2f2a22] dark:text-[#eae4d8]">
              Nothing written down yet
            </p>

            <p className="mt-1 text-xs text-[#7c7367] dark:text-[#a49b8d]">
              Jot down what to come back to. Tick things off as you cover them.
            </p>
          </div>
        ) : (
          <ul className={`min-h-full pl-12 pr-3 ${RULED_PAPER}`}>
            {notes.map((note) => (
              // A note still being saved has no server id yet, so it cannot be
              // ticked or deleted -- both address it by that id. It is written
              // in full ink regardless: it is on the pad, and the only thing
              // the round trip can still change is whether it stays.
              <li key={note.noteId} className="group flex items-start gap-2.5">
                {/* A real checkbox, not a styled div: it is a checkbox to a
                    screen reader and to a keyboard either way. The vertical
                    margin centres a 16px box inside the 28px ruled band. */}
                <input
                  type="checkbox"
                  checked={note.done}
                  disabled={note.pending}
                  onChange={(event) =>
                    toggleMutation.mutate({ noteId: note.noteId, done: event.target.checked })
                  }
                  className="my-1.5 size-4 shrink-0 cursor-pointer accent-[#cb3a2c] disabled:cursor-default disabled:opacity-40"
                  aria-label={note.body}
                />

                {/* Crossed out in red pen, not greyed into the paper: a covered
                    topic is still something you wrote down. */}
                <span
                  className={`min-w-0 flex-1 break-words text-sm leading-7 ${
                    note.done
                      ? "text-[#a49b8d] line-through decoration-[#cb3a2c]/70 decoration-2 dark:text-[#7d7566]"
                      : "text-[#2b2620] dark:text-[#eae4d8]"
                  }`}
                >
                  {note.body}
                </span>

                <button
                  type="button"
                  disabled={note.pending}
                  onClick={() => deleteMutation.mutate(note.noteId)}
                  aria-label={`Delete note: ${note.body}`}
                  className="my-1 shrink-0 rounded-md p-1 text-[#a49b8d] opacity-0 transition hover:bg-rb-cardinal/10 hover:text-rb-cardinal focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {doneCount > 0 && doneCount === notes.length ? (
        <p className="flex shrink-0 items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-[#2f2a22] dark:text-[#eae4d8]">
          <Check className="size-3.5" aria-hidden="true" />
          Everything on this list is covered.
        </p>
      ) : null}

      {/* Writing happens at the pad's bottom edge rather than in a boxed field
          above the list -- an input with its own border would lay a second
          sheet of UI on top of the paper. */}
      <form
        onSubmit={submit}
        className="flex shrink-0 items-center gap-2 border-t border-[#e6ddcf] bg-[#fbf7ef] px-3 py-1.5 dark:border-[#332f29] dark:bg-[#221f1b]"
      >
        <NotebookPenIcon className="size-4 shrink-0 text-[#b3aa9c] dark:text-[#6f6759]" aria-hidden="true" />

        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          placeholder="Write a note — a topic to revisit, a formula to memorize…"
          aria-label="New note"
          className="h-8 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#2b2620] outline-none placeholder:text-[#b3aa9c] focus:ring-0 dark:text-[#eae4d8] dark:placeholder:text-[#6f6759]"
        />

        <Button
          type="submit"
          size="sm"
          className="h-8 shrink-0 gap-1.5"
          disabled={!draft.trim()}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </form>
    </BentoTile>
  )
}
