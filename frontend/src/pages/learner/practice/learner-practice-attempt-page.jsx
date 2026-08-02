import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Layers3, Sparkles, Trophy } from "@/components/icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { completePracticeAttempt, getStudySet, startPracticeAttempt, submitPracticeAnswer } from "@/services/practiceService"

function choicesOf(item) {
  try { return typeof item.choicesJson === "string" ? JSON.parse(item.choicesJson) : (item.choicesJson ?? []) } catch { return [] }
}

export default function LearnerPracticeAttemptPage() {
  const { studySetId } = useParams()
  const navigate = useNavigate()
  const [studySet, setStudySet] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState({})
  const [revealed, setRevealed] = useState(false)
  const [flashcardRating, setFlashcardRating] = useState("GOOD")
  const [isSaving, setIsSaving] = useState(false)
  const [completion, setCompletion] = useState(null)

  useEffect(() => {
    let live = true
    Promise.all([getStudySet(studySetId), startPracticeAttempt(studySetId)])
      .then(([set, nextAttempt]) => { if (live) { setStudySet(set); setAttempt(nextAttempt) } })
      .catch(() => toast.error("This practice set could not be opened."))
    return () => { live = false }
  }, [studySetId])

  const item = studySet?.items?.[index]
  const isFlashcard = studySet?.type === "FLASHCARD"
  const progress = studySet ? ((index + 1) / studySet.items.length) * 100 : 0
  const answer = item ? (answers[item.id] ?? "") : ""
  const hasAnswer = Boolean(String(answer).trim())
  const isLast = studySet && index === studySet.items.length - 1
  const choices = useMemo(() => item ? choicesOf(item) : [], [item])

  async function saveCurrent() {
    if (!item || !attempt || !hasAnswer || results[item.id]) return true
    setIsSaving(true)
    try {
      const result = await submitPracticeAnswer(attempt.id, {
        studyItemId: item.id,
        answer,
        flashcardRating: isFlashcard ? flashcardRating : null,
      })
      setResults((current) => ({ ...current, [item.id]: result }))
      return true
    } catch {
      toast.error("Your answer could not be saved.")
      return false
    } finally { setIsSaving(false) }
  }

  async function goNext() {
    if (!hasAnswer) { toast.error(isFlashcard ? "Type the answer you recalled first." : "Choose an answer first."); return }
    if (!await saveCurrent()) return
    if (!isLast) { setIndex((value) => value + 1); setRevealed(false); setFlashcardRating("GOOD"); return }
    try { setCompletion(await completePracticeAttempt(attempt.id)) } catch (error) { toast.error("Finish every item before completing.") }
  }

  async function rateFlashcard(value) {
    setFlashcardRating(value)
    if (!item || !attempt || !results[item.id]) return
    try {
      const result = await submitPracticeAnswer(attempt.id, { studyItemId: item.id, answer, flashcardRating: value })
      setResults((current) => ({ ...current, [item.id]: result }))
    } catch { toast.error("Your flashcard rating could not be saved.") }
  }

  if (!studySet || !attempt) return <div className="mx-auto max-w-4xl p-6"><Skeleton className="h-10 w-44" /><Skeleton className="mt-6 h-[440px] w-full" /></div>
  if (completion) return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_transparent_45%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-5 py-12">
      <section className="mx-auto max-w-xl rounded-3xl border bg-background p-8 text-center shadow-xl">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Trophy className="size-10" /></div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Practice complete</p>
        <h1 className="mt-2 text-4xl font-bold">{Math.round(completion.percentage)}%</h1>
        <p className="mt-3 text-muted-foreground">You got {completion.score} of {completion.totalItems} correct.</p>
        {completion.xpEarned > 0 || completion.coinEarned > 0 ? <p className="mt-4 text-sm font-semibold text-violet-700">+{completion.xpEarned} XP {completion.coinEarned > 0 ? `· +${completion.coinEarned} coins` : ""}</p> : null}
        <div className="mt-7 flex justify-center gap-3"><Button variant="outline" onClick={() => navigate(`/learner/practice-review/${completion.id}`)}>Review answers</Button><Button onClick={() => navigate("/learner/library")}>Back to library</Button></div>
      </section>
    </main>
  )

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_transparent_40%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-5 sm:px-6">
      <section className="mx-auto max-w-4xl">
        <header className="flex items-center gap-4 rounded-2xl border bg-background/85 p-4 shadow-sm backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Leave practice"><ArrowLeft className="size-5" /></Button>
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{studySet.title}</p><p className="text-xs text-muted-foreground">{isFlashcard ? "Recall practice" : "Quiz challenge"}</p></div>
          <Badge variant="secondary">{index + 1} / {studySet.items.length}</Badge>
        </header>
        <Progress value={progress} className="mt-4 h-2" />

        <article className="mt-6 rounded-3xl border bg-background p-6 shadow-xl sm:p-10">
          <div className="flex items-center gap-2"><Badge variant="outline">{item.type === "MCQ" ? "Multiple choice" : "Flashcard recall"}</Badge>{item.difficulty && <span className="text-xs font-medium text-muted-foreground">{item.difficulty.toLowerCase()}</span>}</div>
          <h1 className="mt-6 text-2xl font-bold leading-tight sm:text-3xl">{item.questionText}</h1>
          {isFlashcard ? (
            <div className="mt-8 rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><Layers3 className="size-4" />Recall the answer</div>
              <Input className="mt-4 h-12 bg-background" value={answer} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Type what you remember" />
              {!revealed ? <Button type="button" variant="outline" className="mt-4" disabled={!hasAnswer || isSaving} onClick={async () => { if (await saveCurrent()) setRevealed(true) }}>Reveal answer</Button> : <div className="mt-4 rounded-xl border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recall result</p><p className="mt-1 font-medium leading-6">{results[item.id]?.correct ? "You recalled it correctly." : "Review the explanation below, then rate your recall."}</p><p className="mt-3 text-xs font-semibold text-muted-foreground">How well did you remember it?</p><div className="mt-2 grid grid-cols-4 gap-2">{[["AGAIN", "Again"], ["HARD", "Hard"], ["GOOD", "Good"], ["EASY", "Easy"]].map(([value, label]) => <Button key={value} type="button" size="sm" variant={flashcardRating === value ? "default" : "outline"} onClick={() => rateFlashcard(value)}>{label}</Button>)}</div></div>}
            </div>
          ) : (
            <RadioGroup value={answer} onValueChange={(value) => setAnswers((current) => ({ ...current, [item.id]: value }))} className="mt-8 gap-3">
              {choices.map((choice, choiceIndex) => <label key={`${choice.text}-${choiceIndex}`} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition hover:border-primary/50 ${answer === choice.text ? "border-primary bg-primary/5" : "bg-background"}`}><RadioGroupItem value={choice.text} /><span className="font-medium">{choice.text}</span></label>)}
            </RadioGroup>
          )}
          {results[item.id] && <div className={`mt-6 rounded-xl p-4 text-sm ${results[item.id].correct ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" />{results[item.id].correct ? "Correct" : "Saved — review this one later"}</div>{results[item.id].explanation && <p className="mt-2 leading-6">{results[item.id].explanation}</p>}</div>}
          <div className="mt-10 flex justify-between gap-3"><Button variant="outline" disabled={index === 0 || isSaving} onClick={() => { setIndex((value) => value - 1); setRevealed(false); setFlashcardRating("GOOD") }}><ChevronLeft className="mr-1 size-4" />Back</Button><Button disabled={!hasAnswer || isSaving || (isFlashcard && !revealed)} onClick={goNext}>{isLast ? <><Sparkles className="mr-2 size-4" />Finish</> : <>Continue<ChevronRight className="ml-1 size-4" /></>}</Button></div>
        </article>
      </section>
    </main>
  )
}
