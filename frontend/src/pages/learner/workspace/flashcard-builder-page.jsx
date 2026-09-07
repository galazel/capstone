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
                <RebyuCard key={card.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rb-nav-label text-rb-hare">Card {index + 1}</span>
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

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-rb-hare">
                        Front — the prompt
                      </span>
                      <textarea
                        rows={3}
                        value={card.front}
                        onChange={(event) => updateCard(card.id, "front", event.target.value)}
                        placeholder="What is coupling?"
                        className="w-full resize-y rounded-rb-control border-2 border-border bg-white p-3 text-sm font-medium leading-6 text-rb-eel outline-none placeholder:text-rb-hare focus-visible:border-rb-macaw"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-rb-hare">
                        Back — the answer
                      </span>
                      <textarea
                        rows={3}
                        value={card.back}
                        onChange={(event) => updateCard(card.id, "back", event.target.value)}
                        placeholder="How dependent one module is on another."
                        className="w-full resize-y rounded-rb-control border-2 border-border bg-white p-3 text-sm font-medium leading-6 text-rb-eel outline-none placeholder:text-rb-hare focus-visible:border-rb-macaw"
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
                <button
                  type="button"
                  onClick={() => setFlipped((value) => !value)}
                  className="grid min-h-[13rem] w-full place-items-center rounded-rb-card border-2 border-border bg-white p-6 text-center transition-colors hover:border-rb-beetle"
                >
                  <span>
                    <span className="rb-nav-label block text-rb-hare">
                      {flipped ? "Back" : "Front"}
                    </span>
                    <span className="mt-3 block text-base font-bold leading-7 text-rb-eel">
                      {flipped ? previewCard.back : previewCard.front}
                    </span>
                    <span className="mt-4 block text-xs font-bold text-rb-hare">
                      Tap to flip
                    </span>
                  </span>
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
