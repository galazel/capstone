import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, XCircle } from "@/components/icons"
import { useNavigate, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getPracticeReview } from "@/services/practiceService"

export default function LearnerPracticeReviewPage() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ["practice-review", attemptId], queryFn: () => getPracticeReview(attemptId) })
  if (query.isLoading) return <main className="mx-auto max-w-4xl p-6"><Skeleton className="h-80 w-full" /></main>
  const data = query.data
  if (!data) return <main className="p-6">Unable to load this review.</main>
  return <main className="mx-auto max-w-4xl space-y-6 p-6"><div className="flex items-center justify-between gap-3"><div><Button variant="ghost" size="sm" onClick={() => navigate("/learner/practice-history")}><ArrowLeft className="mr-1 size-4" />History</Button><h1 className="mt-2 text-2xl font-bold">{data.attempt.title || "Practice review"}</h1><p className="mt-1 text-sm text-muted-foreground">{Math.round(data.attempt.percentage ?? 0)}% · {data.attempt.score}/{data.attempt.totalItems} correct</p></div><Badge variant="secondary">Completed</Badge></div><div className="space-y-4">{data.answers.map((answer, index) => <Card key={answer.itemId} className={answer.correct ? "border-rb-bee/30" : "border-rb-fox/30"}><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base">{answer.correct ? <CheckCircle2 className="size-5 text-rb-bee-lip" /> : <XCircle className="size-5 text-rb-fox-lip" />}Question {index + 1}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="font-medium leading-6">{answer.questionText}</p><div className="rounded-lg bg-muted/40 p-3 text-sm"><span className="font-semibold">Your answer: </span>{answer.learnerAnswer || "No answer"}</div>{answer.flashcardRating ? <Badge variant="outline">Recall: {answer.flashcardRating}</Badge> : null}{answer.explanation ? <p className="text-sm leading-6 text-muted-foreground">{answer.explanation}</p> : null}</CardContent></Card>)}</div></main>
}
