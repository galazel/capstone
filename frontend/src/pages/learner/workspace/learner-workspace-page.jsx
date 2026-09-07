import { useNavigate } from "react-router-dom"

import { BookOpen, ChevronRight, Layers, Target } from "@/components/icons"
import { RebyuCard } from "@/components/rebyu/rebyu-ui.jsx"
import { NotConnectedNote } from "./workspace-shared.jsx"

/**
 * Study Workspace — the hub.
 *
 * <p>Three separate features, each with its own screen and its own route. They
 * share an upload step and nothing else: a learner building a deck of cards,
 * writing a quiz, and reading a document with the tutor are doing three
 * different jobs. Folding two of them into buttons inside the third made the
 * smaller two read as afterthoughts of the reader rather than features in their
 * own right, which is not what they are.
 *
 * <p>UI only — see the note at the foot of this page, and the BACKEND: markers
 * on each feature screen.
 */

const FEATURES = [
  {
    to: "/learner/workspace/flashcards",
    icon: Layers,
    title: "Flashcard Builder",
    blurb: "Turn a document into a deck, then edit every card before you save it.",
    tone: "beetle",
  },
  {
    to: "/learner/workspace/quiz",
    icon: Target,
    title: "Quiz Builder",
    blurb: "Draft questions from a document, fix the wording and set the answers.",
    tone: "macaw",
  },
  {
    to: "/learner/workspace/learn",
    icon: BookOpen,
    title: "Upload & Learn",
    blurb: "Read your document with the tutor beside it, page by page.",
    tone: "feather",
  },
]

/* Tailwind cannot see `bg-rb-${tone}-wash`, so the classes are written out. */
const TONE_CLASSES = {
  beetle: "bg-rb-beetle-wash text-rb-beetle-lip",
  macaw: "bg-rb-macaw-wash text-rb-macaw-lip",
  feather: "bg-rb-feather-wash text-rb-feather-lip",
}

export default function LearnerWorkspacePage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="px-4 py-6 lg:px-6">
        <h1 className="rb-display rb-display-sm">Study workspace</h1>
        <p className="mt-1 text-sm font-medium text-rb-wolf">
          Bring your own material — a handout, a reviewer, your notes — and turn it
          into something to study.
        </p>
      </header>

      <div className="grid gap-3 px-4 lg:px-6">
        {FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <RebyuCard
              key={feature.to}
              press
              role="button"
              tabIndex={0}
              onClick={() => navigate(feature.to)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  navigate(feature.to)
                }
              }}
              className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:border-rb-beetle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rb-macaw"
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-rb-tile ${
                  TONE_CLASSES[feature.tone]
                }`}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-rb-display text-lg font-extrabold text-rb-eel">
                  {feature.title}
                </span>
                <span className="block text-sm font-medium leading-6 text-rb-wolf">
                  {feature.blurb}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-rb-hare" aria-hidden="true" />
            </RebyuCard>
          )
        })}
      </div>

      <div className="mt-5">
        <NotConnectedNote>
          These three screens are the interface only. A file you choose stays in this
          browser — nothing is uploaded, generated or saved.
        </NotConnectedNote>
      </div>
    </div>
  )
}
