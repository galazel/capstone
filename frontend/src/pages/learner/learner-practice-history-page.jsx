import { useQuery } from "@tanstack/react-query"
import { History, Trophy } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getPracticeHistory } from "@/services/practiceService"

export default function LearnerPracticeHistoryPage() {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ["practice-history"], queryFn: getPracticeHistory })
  const attempts = Array.isArray(query.data) ? query.data : []
  return <main className="mx-auto max-w-4xl space-y-6 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><History className="size-6 text-primary" />Practice history</h1><p className="mt-1 text-sm text-muted-foreground">Your Tutor and Community practice attempts.</p></div><Button variant="outline" onClick={() => navigate("/learner/library")}>Open library</Button></div><Card><CardHeader><CardTitle>Recent attempts</CardTitle><CardDescription>Rewards are awarded only on the first completed attempt per study set.</CardDescription></CardHeader><CardContent>{query.isLoading ? <Skeleton className="h-48 w-full" /> : <div className="space-y-3">{attempts.map((attempt) => <div key={attempt.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Trophy className="size-4" /></div><div className="min-w-40 flex-1"><p className="font-semibold">{attempt.title || "Practice attempt"}</p><p className="text-xs text-muted-foreground">{attempt.sourceType.replaceAll("_", " ")} · {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : "In progress"}</p></div><Badge variant={attempt.status === "COMPLETED" ? "secondary" : "outline"}>{attempt.status}</Badge>{attempt.status === "COMPLETED" ? <div className="text-right text-sm"><p className="font-bold">{Math.round(attempt.percentage ?? 0)}%</p><p className="text-xs text-muted-foreground">+{attempt.xpEarned} XP · +{attempt.coinEarned} coins</p></div> : <Button size="sm" onClick={() => navigate(`/learner/practice/${attempt.studySetId}`)}>Resume</Button>}</div>)}{attempts.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Complete a practice set to see it here.</p> : null}</div>}</CardContent></Card></main>
}
