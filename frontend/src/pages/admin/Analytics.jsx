import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, Building2, ClipboardCheck, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { base } from "@/services/base"

const list = (key, endpoint) => useQuery({ queryKey: ["admin-analytics", key], queryFn: () => base(endpoint), retry: 1 })
const array = (value) => Array.isArray(value) ? value : []

export default function Analytics() {
  const learners = list("learners", "learners")
  const enterprises = list("enterprises", "enterprises")
  const enrollments = list("enrollments", "learner-certifications")
  const results = list("results", "exam-results")
  const loading = [learners, enterprises, enrollments, results].some((query) => query.isLoading)
  const metrics = useMemo(() => {
    const learnerRows = array(learners.data), enrollmentRows = array(enrollments.data), resultRows = array(results.data)
    const scored = resultRows.filter((row) => Number.isFinite(Number(row.score ?? row.percentage)))
    const avgScore = scored.length ? Math.round(scored.reduce((sum, row) => sum + Number(row.score ?? row.percentage), 0) / scored.length) : 0
    const active = enrollmentRows.filter((row) => String(row.status).toLowerCase() === "active").length
    return { learners: learnerRows.length, enterprises: array(enterprises.data).length, active, attempts: resultRows.length, avgScore }
  }, [learners.data, enterprises.data, enrollments.data, results.data])
  if (loading) return <div className="p-6"><Skeleton className="h-72 w-full" /></div>
  return <div className="mx-auto max-w-6xl space-y-6 p-6"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 className="size-6 text-primary" />Platform analytics</h1><p className="mt-1 text-sm text-muted-foreground">Live overview of learner activity, organizations, and assessment outcomes.</p></div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Users} label="Learners" value={metrics.learners} /><Metric icon={Building2} label="Organizations" value={metrics.enterprises} /><Metric icon={ClipboardCheck} label="Active enrollments" value={metrics.active} /><Metric icon={BarChart3} label="Assessment attempts" value={metrics.attempts} /></section><Card><CardHeader><CardTitle>Assessment outcome</CardTitle><CardDescription>Average score across recorded assessment results.</CardDescription></CardHeader><CardContent><p className="text-5xl font-bold">{metrics.avgScore}%</p><p className="mt-2 text-sm text-muted-foreground">This page reads current platform data; detailed certification analytics remain available from the certification and learner views.</p></CardContent></Card></div>
}

function Metric({ icon: Icon, label, value }) { return <Card><CardContent className="p-5"><Icon className="size-5 text-primary" /><p className="mt-4 text-3xl font-bold">{Number(value).toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card> }
