import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Crown, UsersRound } from "@/components/icons"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getLeaderboard } from "@/services/gamificationService"

export default function LearnerRankingsPage() {
  const [scope, setScope] = useState("overall")
  const [period, setPeriod] = useState("all")
  const query = useQuery({ queryKey: ["leaderboard", scope, period], queryFn: () => getLeaderboard(scope, period) })
  const entries = Array.isArray(query.data) ? query.data : []
  return <main className="mx-auto max-w-3xl space-y-6 p-6"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Crown className="size-6 text-amber-500" />Rankings</h1><p className="mt-1 text-sm text-muted-foreground">Earn XP through meaningful practice and Community quizzes.</p></div><div className="flex flex-wrap gap-3"><Tabs value={scope} onValueChange={setScope}><TabsList><TabsTrigger value="overall">Overall XP</TabsTrigger><TabsTrigger value="community">Community XP</TabsTrigger></TabsList></Tabs><Tabs value={period} onValueChange={setPeriod}><TabsList><TabsTrigger value="all">All-time</TabsTrigger><TabsTrigger value="month">Monthly</TabsTrigger><TabsTrigger value="week">Weekly</TabsTrigger></TabsList></Tabs></div><Card><CardHeader><CardTitle>{scope === "overall" ? "Overall ranking" : "Community ranking"}</CardTitle><CardDescription>{scope === "overall" ? "Permanent XP earned in REBYU." : "XP earned from completed shared Community quizzes."}</CardDescription></CardHeader><CardContent>{query.isLoading ? <Skeleton className="h-64 w-full" /> : <div className="space-y-2">{entries.map((entry) => <div key={entry.learnerId} className={`flex items-center gap-4 rounded-xl border p-4 ${entry.currentLearner ? "border-primary bg-primary/5" : ""}`}><div className="flex size-9 items-center justify-center rounded-full bg-muted font-bold">{entry.rank}</div><UsersRound className="size-4 text-muted-foreground" /><p className="min-w-0 flex-1 truncate font-semibold">{entry.learnerName}{entry.currentLearner ? " (You)" : ""}</p><p className="font-bold text-primary">{Number(entry.xp).toLocaleString()} XP</p></div>)}{entries.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No ranked activity yet. Complete practice to appear here.</p> : null}</div>}</CardContent></Card></main>
}
