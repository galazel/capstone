import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronLeft, ChevronRight, Layers3, Sparkles, Trophy } from "@/components/icons"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { completePracticeAttempt, getStudySet, startPracticeAttempt, submitPracticeAnswer } from "@/services/practiceService"

const RATINGS = [["AGAIN", "Again"], ["HARD", "Hard"], ["GOOD", "Good"], ["EASY", "Easy"]]

export default function LearnerFlashcardAttemptPage() {
  const { studySetId } = useParams()
  const navigate = useNavigate()
  const [studySet, setStudySet] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [rating, setRating] = useState("GOOD")
  const [saving, setSaving] = useState(false)
  const [completion, setCompletion] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all([getStudySet(studySetId), startPracticeAttempt(studySetId)])
      .then(([set, nextAttempt]) => {
        if (live) { setStudySet(set); setAttempt(nextAttempt) }
      })
      .catch(() => toast.error("This flashcard set could not be opened."))
    return () => { live = false }
  }, [studySetId])

  if (!studySet || !attempt) {
    return <div className="mx-auto max-w-3xl space-y-5 p-6"><Skeleton className="h-10 w-44" /><Skeleton className="h-[500px] w-full" /></div>
  }

  const item = studySet.items[index]
  const isLast = index === studySet.items.length - 1
  const progress = ((index + 1) / studySet.items.length) * 100

  async function finishCard() {
    setSaving(true)
    try {
      await submitPracticeAnswer(attempt.id, {
        studyItemId: item.id,
        answer: item.correctAnswer ?? "",
        flashcardRating: rating,
      })
      if (isLast) setCompletion(await completePracticeAttempt(attempt.id))
      else {
        setIndex((value) => value + 1)
        setFlipped(false)
        setRating("GOOD")
      }
    } catch {
      toast.error("This flashcard could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  if (completion) {
    return (
      <main className="min-h-screen bg-rb-polar px-5 py-12">
        <section className="mx-auto max-w-xl rounded-3xl border bg-background p-8 text-center shadow-xl">
          <Trophy className="mx-auto size-14 text-rb-fox-lip" />
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Flashcards complete</p>
          <h1 className="mt-2 text-4xl font-bold">{Math.round(completion.percentage)}%</h1>
          <p className="mt-3 text-muted-foreground">You reviewed {completion.totalItems} cards.</p>
          <Button className="mt-7" onClick={() => navigate("/learner/library")}>Back to library</Button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,var(--color-rb-feather-wash),transparent_45%),linear-gradient(135deg,var(--color-rb-polar),var(--color-rb-feather-wash))] px-4 py-5 sm:px-6">
      <section className="mx-auto max-w-3xl">
        <header className="flex items-center gap-3 rounded-2xl border bg-background/85 p-4 shadow-sm backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Leave flashcards"><ArrowLeft className="size-5" /></Button>
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{studySet.title}</p><p className="text-xs text-muted-foreground">Flip-card review</p></div>
          <Badge variant="secondary">{index + 1} / {studySet.items.length}</Badge>
        </header>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-rb-swan"><div className="h-full bg-rb-beetle transition-all" style={{ width: `${progress}%` }} /></div>

        <button type="button" className="group mt-8 block h-[430px] w-full [perspective:1200px]" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Show question" : "Reveal answer"}>
          <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] border-2 border-rb-beetle/30 bg-rb-beetle-wash p-8 text-center shadow-xl [backface-visibility:hidden]">
              <Layers3 className="size-10 text-rb-beetle-lip" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-rb-beetle-lip">Question</p>
              <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">{item.questionText}</h1>
              <p className="mt-8 text-sm font-medium text-muted-foreground">Click the card to reveal the answer</p>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] border-2 border-rb-macaw/30 bg-rb-macaw-wash p-8 text-center shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rb-macaw-lip">Answer</p>
              <p className="mt-5 text-2xl font-semibold leading-relaxed sm:text-3xl">{item.correctAnswer || "Review this concept in the lesson."}</p>
              {item.explanation ? <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">{item.explanation}</p> : null}
            </div>
          </div>
        </button>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {RATINGS.map(([value, label]) => <Button key={value} size="sm" variant={rating === value ? "default" : "outline"} disabled={!flipped || saving} onClick={() => setRating(value)}>{label}</Button>)}
        </div>
        <div className="mt-6 flex justify-between gap-3">
          <Button variant="outline" disabled={index === 0 || saving} onClick={() => { setIndex((value) => value - 1); setFlipped(false) }}><ChevronLeft className="mr-1 size-4" />Back</Button>
          <Button disabled={!flipped || saving} onClick={finishCard}>{isLast ? <><Sparkles className="mr-2 size-4" />Finish</> : <>Next<ChevronRight className="ml-1 size-4" /></>}</Button>
        </div>
      </section>
    </main>
  )
}
