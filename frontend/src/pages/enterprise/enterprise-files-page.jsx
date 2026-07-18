import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, FolderOpenIcon, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { deleteEnterpriseFile, getEnterpriseFileDownloadUrl, getEnterpriseFiles, uploadEnterpriseFile } from "@/services/enterpriseService"
import { EnterpriseEmptyState, EnterprisePageHeader } from "@/components/enterprise/enterprise-ui.jsx"

export default function EnterpriseFilesPage() {
  const input = useRef(null), client = useQueryClient()
  const files = useQuery({ queryKey: ["enterprise-files"], queryFn: getEnterpriseFiles })
  const refresh = () => client.invalidateQueries({ queryKey: ["enterprise-files"] })
  const upload = useMutation({ mutationFn: uploadEnterpriseFile, onSuccess: () => { refresh(); toast.success("File uploaded.") }, onError: () => toast.error("File upload failed.") })
  const remove = useMutation({ mutationFn: deleteEnterpriseFile, onSuccess: () => { refresh(); toast.success("File deleted.") }, onError: () => toast.error("Could not delete file.") })
  const download = useMutation({ mutationFn: getEnterpriseFileDownloadUrl, onSuccess: (data) => { if (data?.url) window.open(data.url, "_blank", "noopener") }, onError: () => toast.error("Could not open this file.") })
  const rows = Array.isArray(files.data) ? files.data : []
  return <div className="space-y-6"><EnterprisePageHeader title="Files" subtitle="Documents shared between your organization and REBYU." actions={<><input ref={input} className="hidden" type="file" onChange={(e)=>{const file=e.target.files?.[0]; if(file) upload.mutate(file); e.target.value=""}}/><Button disabled={upload.isPending} onClick={()=>input.current?.click()}>{upload.isPending?<Loader2 className="mr-2 size-4 animate-spin"/>:<Upload className="mr-2 size-4"/>}Upload file</Button></>}/>{rows.length===0&&!files.isLoading?<EnterpriseEmptyState icon={FolderOpenIcon} title="No organization files yet" description="Upload verification documents, agreements, or shared files for your organization."/>:<div className="grid gap-3">{rows.map((file)=><Card key={file.id}><CardContent className="flex items-center gap-3 p-4"><FolderOpenIcon className="size-5 text-primary"/><div className="min-w-0 flex-1"><p className="truncate font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.contentType||"File"} · {Math.ceil((file.size||0)/1024)} KB</p></div><Button size="icon" variant="outline" disabled={download.isPending} onClick={()=>download.mutate(file.id)}><Download className="size-4"/></Button><Button size="icon" variant="ghost" disabled={remove.isPending} onClick={()=>remove.mutate(file.id)}><Trash2 className="size-4 text-destructive"/></Button></CardContent></Card>)}</div>}</div>
}
