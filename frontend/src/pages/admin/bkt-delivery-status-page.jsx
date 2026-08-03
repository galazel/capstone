import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Send, ServerCog } from "@/components/icons"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getBktOutbox, getBktOutboxStats, reconcileBkt, retryBktOutboxEvent } from "@/services/adminBktService"

export default function BktDeliveryStatus() {
  const [status, setStatus] = useState("PENDING")
  const client = useQueryClient()
  const stats = useQuery({ queryKey: ["bkt-stats"], queryFn: getBktOutboxStats })
  const events = useQuery({ queryKey: ["bkt-outbox", status], queryFn: () => getBktOutbox(status) })
  const refresh = () => { client.invalidateQueries({ queryKey: ["bkt-stats"] }); client.invalidateQueries({ queryKey: ["bkt-outbox"] }) }
  const retry = useMutation({ mutationFn: retryBktOutboxEvent, onSuccess: () => { refresh(); toast.success("Event queued for retry.") } })
  const reconcile = useMutation({ mutationFn: reconcileBkt, onSuccess: () => { refresh(); toast.success("BKT reconciliation completed.") } })
  const rows = Array.isArray(events.data) ? events.data : []
  return <div className="mx-auto max-w-6xl space-y-6 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><ServerCog className="size-6 text-primary" />BKT delivery status</h1><p className="mt-1 text-sm text-muted-foreground">Monitor mastery events sent to the Python BKT service.</p></div><div className="flex gap-2"><Button variant="outline" disabled={reconcile.isPending} onClick={() => reconcile.mutate()}><RefreshCw className="mr-2 size-4" />Reconcile</Button><Button variant="outline" onClick={refresh}>Refresh</Button></div></div><section className="grid gap-3 sm:grid-cols-5">{["PENDING", "PROCESSING", "PROCESSED", "FAILED", "DEAD_LETTER"].map((key) => <Card key={key}><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">{key.replace("_", " ")}</p><p className="mt-1 text-2xl font-bold">{stats.data?.[key] ?? 0}</p></CardContent></Card>)}</section><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Outbox events</CardTitle><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{["PENDING", "PROCESSING", "PROCESSED", "FAILED", "DEAD_LETTER"].map((value) => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Learner</TableHead><TableHead>Status</TableHead><TableHead>Retries</TableHead><TableHead>Error</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="max-w-52 truncate font-mono text-xs">{row.eventId}</TableCell><TableCell>{row.learnerId}</TableCell><TableCell><Badge variant={row.status === "PROCESSED" ? "secondary" : "outline"}>{row.status}</Badge></TableCell><TableCell>{row.retryCount}</TableCell><TableCell className="max-w-52 truncate text-xs text-muted-foreground">{row.lastError || "—"}</TableCell><TableCell>{["FAILED", "DEAD_LETTER"].includes(row.status) ? <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(row.id)}><Send className="mr-1 size-3" />Retry</Button> : null}</TableCell></TableRow>)}{rows.length === 0 ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No events in this status.</TableCell></TableRow> : null}</TableBody></Table></CardContent></Card></div>
}
