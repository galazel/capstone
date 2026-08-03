import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ShieldAlert, XCircle } from "@/components/icons"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCommunityReports, hideCommunityPost, reviewCommunityReport } from "@/services/adminCommunityService"

export default function CommunityModeration() {
  const [status, setStatus] = useState("OPEN")
  const client = useQueryClient()
  const reportsQuery = useQuery({ queryKey: ["community-reports", status], queryFn: () => getCommunityReports(status) })
  const refresh = () => client.invalidateQueries({ queryKey: ["community-reports"] })
  const review = useMutation({ mutationFn: ({ id, action }) => reviewCommunityReport(id, action), onSuccess: () => { refresh(); toast.success("Report updated.") }, onError: () => toast.error("Could not update the report.") })
  const hidePost = useMutation({ mutationFn: hideCommunityPost, onSuccess: () => { refresh(); toast.success("Post hidden from the community feed.") }, onError: () => toast.error("Could not hide the post.") })
  const reports = Array.isArray(reportsQuery.data) ? reportsQuery.data : []

  return <div className="mx-auto max-w-6xl space-y-6 p-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldAlert className="size-6 text-amber-600" />Community moderation</h1><p className="mt-1 text-sm text-muted-foreground">Review learner reports and remove content when necessary.</p></div>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem><SelectItem value="DISMISSED">Dismissed</SelectItem></SelectContent></Select>
    </div>
    <Card><CardHeader><CardTitle>{status[0] + status.slice(1).toLowerCase()} reports</CardTitle><CardDescription>{reports.length} report{reports.length === 1 ? "" : "s"} in this view.</CardDescription></CardHeader><CardContent>
      {reportsQuery.isLoading ? <Skeleton className="h-48 w-full" /> : <Table><TableHeader><TableRow><TableHead>Post</TableHead><TableHead>Reporter</TableHead><TableHead>Reason</TableHead><TableHead>Details</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
        {reports.map((report) => <TableRow key={report.reportId}><TableCell><p className="font-medium">{report.postTitle}</p><p className="text-xs text-muted-foreground">by {report.authorName}</p></TableCell><TableCell>{report.reporterName}</TableCell><TableCell><Badge variant="outline">{report.reason.replaceAll("_", " ")}</Badge></TableCell><TableCell className="max-w-48 truncate">{report.details || "—"}</TableCell><TableCell><Badge variant={report.status === "OPEN" ? "secondary" : "outline"}>{report.status}</Badge></TableCell><TableCell className="text-right">{report.status === "OPEN" ? <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: report.reportId, action: "DISMISSED" })}><XCircle className="mr-1 size-3" />Dismiss</Button><Button size="sm" variant="destructive" disabled={hidePost.isPending} onClick={() => hidePost.mutate(report.postId)}>Hide post</Button><Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: report.reportId, action: "RESOLVED" })}><CheckCircle2 className="mr-1 size-3" />Resolve</Button></div> : "—"}</TableCell></TableRow>)}
        {reports.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No {status.toLowerCase()} reports.</TableCell></TableRow> : null}
      </TableBody></Table>}
    </CardContent></Card>
  </div>
}
