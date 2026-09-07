import { useState } from "react"

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "@/components/icons"
import { RebyuCard, TactileButton } from "@/components/rebyu/rebyu-ui.jsx"
import {
  FeatureHeader,
  NotConnectedNote,
  UploadDropzone,
  formatBytes,
  useUploadedFile,
} from "./workspace-shared.jsx"

/**
 * Flashcard Builder — a document in, a deck out, editable before it is kept.
 *
 * <p>Cards come from the uploaded document, never from a blank form. This is an
 * AI workspace: the learner's job is to hand over material and correct what
 * comes back, not to type a deck out themselves — they could do that anywhere.
 * So there is no "add a card" here and no empty-deck authoring path; the only
 * way to a deck is a file.
 *
 * <p>What stays editable is the result. The learner is expected to disagree
 * with some of it, and the deck is only saved when they say so — generation
 * that filed straight to the Library would make a bad card their problem to
 * find later, in a deck they never read.
 *
 * <p>UI only. Nothing below came from a document; the cards are labelled as
 * examples so the editor can be reviewed without anyone mistaking them for
 * output. See BACKEND: for where extraction plugs in.
 */

/*
 * Stand-in cards, shown once "generation" finishes so the editor has something
 * to hold. Filled in and openly labelled as examples on screen: blank cards
 * would leave the editor untestable, and realistic-looking ones with no label
 * would read as real output from the learner's file.
 */
const EXAMPLE_CARDS = [
  {
    id: 1,
    front: "What is coupling?",
    back: "How dependent one module is on another. Low coupling is the goal.",
  },
  {
    id: 2,
    front: "What is cohesion?",
    back: "How focused a module is on a single job. High cohesion is the goal.",
  },
  {
    id: 3,
    front: "Name the four levels of testing.",
    back: "Unit, integration, system, acceptance.",
  },
]

export default function FlashcardBuilderPage() {
  const { file, error, accept, clear } = useUploadedFile()
  const [cards, setCards] = useState([])
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(0)
  const [flipped, setFlipped] = useState(false)

  function generate() {
    setGenerating(true)
    // BACKEND: send the uploaded document for card extraction, then replace the
    // deck with what comes back.
    window.setTimeout(() => {
      setCards(EXAMPLE_CARDS.map((card) => ({ ...card })))
      setGenerating(false)
    }, 800)
  }

  function updateCard(id, field, value) {
    setCards((current) =>
      current.map((card) => (card.id === id ? { ...card, [field]: value } : card))
    )
  }

  function removeCard(id) {
    setCards((current) => current.filter((card) => card.id !== id))
    setPreview(0)
  }

  const complete = cards.filter((card) => card.front.trim() && card.back.trim())
  const previewCard = complete[preview] ?? null

  if (!file) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
        <FeatureHeader
          title="Flashcard Builder"
          subtitle="Turn a document into a deck you can edit."
        />
        <div className="min-h-0 flex-1 border-t border-border">
          <UploadDropzone
            onFile={accept}
            error={error}
            icon={Layers}
            title="Build a deck from your notes"
            subtitle="Drop a handout or reviewer here. Its key terms and ideas become two-sided cards you can edit before saving."
          />
        </div>
        <div className="mt-4">
          <NotConnectedNote>
            Card extraction is not wired up yet, so generating shows example cards
            rather than anything read from your file.
          </NotConnectedNote>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <FeatureHeader
        title="Flashcard Builder"
        subtitle="Turn a document into a deck you can edit."
      >
        <div className="flex flex-wrap items-center gap-2">
          <TactileButton variant="ghost" size="sm" onClick={clear}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Change file
          </TactileButton>
          <TactileButton
            size="sm"
            disabled={complete.length === 0}
            // BACKEND: persist the deck to the learner's Library.
            onClick={() => {}}
          >
            <Save className="size-4" aria-hidden="true" />
            Save deck
          </TactileButton>
        </div>
      </FeatureHeader>

      <div className="grid min-h-0 flex-1 gap-4 border-t border-border p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
        {/* The deck, as an editable list. */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-rb-tile bg-rb-beetle-wash text-rb-beetle-lip">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-rb-eel">{file.name}</p>
                <p className="text-xs font-bold text-rb-hare">
                  {formatBytes(file.size)} · {cards.length} card
                  {cards.length === 1 ? "" : "s"} · {complete.length} ready
                </p>
              </div>
            </div>

            <TactileButton size="sm" onClick={generate} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {generating ? "Reading…" : "Generate cards"}
            </TactileButton>
          </div>

          {cards.length > 0 ? (
            <p className="mt-4 rounded-rb-tile border-2 border-rb-bee/50 bg-rb-bee-wash px-3 py-2 text-xs font-bold text-rb-fox-lip">
              Example cards — extraction is not connected, so these did not come
              from your file.
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {cards.length === 0 ? (
              <RebyuCard className="p-8 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-rb-beetle-wash text-rb-beetle-lip">
                  <Sparkles className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-5 font-rb-display text-lg font-extrabold text-rb-eel">
                  Ready when you are
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-rb-wolf">
                  Generate the deck from {file.name}. You can correct any card
                  afterwards, and nothing is saved until you say so.
                </p>
              </RebyuCard>
            ) : (
              cards.map((card, index) => (
                <RebyuCard key={card.id} className="overflow-hidden p-0">
                  {/* Head in the deck's own colour, so a row in the editor
                      reads as the same object the learner will study. */}
                  <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-rb-beetle-wash px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-rb-control border-2 border-rb-beetle-lip/40 font-rb-display text-xs font-extrabold text-rb-beetle-lip">
                        {index + 1}
                      </span>
                      <span className="font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-rb-beetle-lip">
                        Card
                      </span>
                    </span>
                    <TactileButton
                      variant="ghost"
                      size="sm"
                      className="rb-btn-icon"
                      onClick={() => removeCard(card.id)}
                      aria-label={`Remove card ${index + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </TactileButton>
                  </div>

                  {/* The two faces, side by side and labelled the way the study
                      screen labels them: Question in feather on white, Answer
                      white-on-feather. Editing a card should look like the card. */}
                  <div className="grid gap-px bg-border sm:grid-cols-2">
                    <label className="block bg-white p-4">
                      <span className="mb-2 flex items-center gap-1.5 font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-rb-feather-lip">
                        <Layers className="size-3.5" aria-hidden="true" />
                        Question
                      </span>
                      <textarea
                        rows={3}
                        value={card.front}
                        onChange={(event) => updateCard(card.id, "front", event.target.value)}
                        placeholder="What is coupling?"
                        className="w-full resize-y border-0 bg-transparent p-0 font-rb-display text-base font-extrabold leading-7 text-rb-eel outline-none placeholder:font-medium placeholder:text-rb-hare"
                      />
                    </label>

                    <label className="block bg-rb-feather p-4">
                      <span className="mb-2 block font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/75">
                        Answer
                      </span>
                      <textarea
                        rows={3}
                        value={card.back}
                        onChange={(event) => updateCard(card.id, "back", event.target.value)}
                        placeholder="How dependent one module is on another."
                        className="w-full resize-y border-0 bg-transparent p-0 font-rb-display text-base font-extrabold leading-7 text-white outline-none placeholder:font-medium placeholder:text-white/60"
                      />
                    </label>
                  </div>
                </RebyuCard>
              ))
            )}

          </div>
        </div>

        {/* What the learner will actually see when they study it. */}
        <aside className="min-w-0">
          <div className="lg:sticky lg:top-4">
            <p className="rb-nav-label mb-2 text-rb-hare">Preview</p>
            {previewCard ? (
              <>
                {/* The card the study screen actually shows: 2rem radius,
                    white front, feather back, flipped in 3D. A preview that did
                    not look like the real thing would not be a preview. */}
                <button
                  type="button"
                  onClick={() => setFlipped((value) => !value)}
                  className="block w-full [perspective:1400px]"
                  aria-label={flipped ? "Show the question" : "Reveal the answer"}
                >
                  <div
                    className={`relative min-h-[15rem] w-full transition-transform duration-500 [transform-style:preserve-3d] ${
                      flipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[2rem] border-2 border-border bg-white p-6 text-center shadow-lg [backface-visibility:hidden]">
                      <Layers className="size-7 text-rb-feather" aria-hidden="true" />
                      <p className="mt-4 font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-rb-feather-lip">
                        Question
                      </p>
                      <p className="mt-3 font-rb-display text-lg font-extrabold leading-snug text-rb-eel">
                        {previewCard.front}
                      </p>
                      <p className="mt-5 text-xs font-medium text-rb-hare">
                        Tap the card to reveal the answer
                      </p>
                    </div>

                    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[2rem] bg-rb-feather p-6 text-center text-white shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <p className="font-rb-display text-xs font-extrabold uppercase tracking-[0.2em] text-white/75">
                        Answer
                      </p>
                      <p className="mt-3 font-rb-display text-lg font-extrabold leading-snug">
                        {previewCard.back}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <TactileButton
                    variant="ghost"
                    size="sm"
                    className="rb-btn-icon"
                    disabled={preview === 0}
                    onClick={() => {
                      setPreview((index) => Math.max(0, index - 1))
                      setFlipped(false)
                    }}
                    aria-label="Previous card"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </TactileButton>
                  <span className="text-xs font-bold text-rb-hare">
                    {preview + 1} of {complete.length}
                  </span>
                  <TactileButton
                    variant="ghost"
                    size="sm"
                    className="rb-btn-icon"
                    disabled={preview >= complete.length - 1}
                    onClick={() => {
                      setPreview((index) => Math.min(complete.length - 1, index + 1))
                      setFlipped(false)
                    }}
                    aria-label="Next card"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </TactileButton>
                </div>
              </>
            ) : (
              <RebyuCard className="grid min-h-[13rem] place-items-center p-6 text-center">
                <p className="text-sm font-medium leading-6 text-rb-wolf">
                  A card appears here once it has both a front and a back.
                </p>
              </RebyuCard>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
