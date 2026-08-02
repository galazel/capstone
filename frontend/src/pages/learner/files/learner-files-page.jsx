import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpenCheck,
  BrainCircuit,
  Download,
  Eye,
  FileText,
  Layers3,
  LibraryBig,
  Loader2,
  Search,
  Share2,
  UsersRound,
  Plus,
  Trash2,
  Link,
  StickyNote,
  History,
} from "@/components/icons"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  addLibraryItem,
  deleteLibraryItem,
  getLibraryItems,
  uploadLibraryFile,
} from "@/services/learnerToolsService"
import { getFileDownloadUrl, getFileViewUrl } from "@/services/fileService"
import { getAllCertifications } from "@/services/certificationService"
import {
  LearnerEmptyState,
  LearnerPageHeader,
} from "@/components/learner/learner-ui.jsx"

const ALL_VALUE = "all"

const libraryTypeMeta = {
  quiz: {
    label: "Quiz",
    icon: BrainCircuit,
    badge:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  flashcard: {
    label: "Flashcards",
    icon: Layers3,
    badge:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  file: {
    label: "File",
    icon: FileText,
    badge:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  community: {
    label: "Community",
    icon: UsersRound,
    badge:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  link: {
    label: "Link",
    icon: Link,
    badge: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300",
  },
  note: {
    label: "Note",
    icon: StickyNote,
    badge: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  },
}

function formatDate(value) {
  if (!value) return "—"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

/** "file" items carry a raw S3 key in route/downloadUrl; everything else already has a usable URL/path. */
function resolveOpenUrl(item) {
  if (item.kind === "file" && item.route) {
    return getFileViewUrl(item.route)
  }
  return item.route
}

function resolveDownloadUrl(item) {
  if (item.kind === "file" && item.downloadUrl) {
    return getFileDownloadUrl(item.downloadUrl)
  }
  if (item.kind === "community" && item.downloadUrl) {
    return getFileDownloadUrl(item.downloadUrl)
  }
  return null
}

export default function LearnerFilesPage() {
  const navigate = useNavigate()

  const [localSearch, setLocalSearch] = useState("")
  const [certificationId, setCertificationId] = useState("")
  const [category, setCategory] = useState(ALL_VALUE)
  const [items, setItems] = useState([])
  const [certifications, setCertifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [newType, setNewType] = useState("link")
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [uploadedFile, setUploadedFile] = useState(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef(null)

  const [viewItem, setViewItem] = useState(null)

  useEffect(() => {
    Promise.all([getLibraryItems(), getAllCertifications()])
        .then(([libraryItems, allCertifications]) => {
          setItems(Array.isArray(libraryItems) ? libraryItems : [])
          setCertifications(Array.isArray(allCertifications) ? allCertifications : [])
        })
        .catch(() => toast.error("Your library could not be loaded."))
        .finally(() => setIsLoading(false))
  }, [])

  function resetAddForm() {
    setNewType("link")
    setNewTitle("")
    setNewDescription("")
    setNewUrl("")
    setUploadedFile(null)
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingFile(true)
    try {
      const { resourceUrl } = await uploadLibraryFile(file)
      setUploadedFile({ name: file.name, key: resourceUrl })
    } catch {
      toast.error("The file could not be uploaded.")
    } finally {
      setIsUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function saveResource() {
    if (!newTitle.trim()) {
      toast.error("Add a title.")
      return
    }
    if (newType === "file" && !uploadedFile) {
      toast.error("Upload a file first.")
      return
    }
    if (newType === "link" && !newUrl.trim()) {
      toast.error("Add a resource URL.")
      return
    }

    setIsSaving(true)
    try {
      const item = await addLibraryItem({
        itemType: newType,
        title: newTitle.trim(),
        description: newDescription.trim(),
        resourceUrl: newType === "file"
            ? uploadedFile.key
            : newType === "note"
                ? null
                : newUrl.trim(),
      })
      setItems((current) => [item, ...current])
      resetAddForm()
      setAddOpen(false)
      toast.success("Resource added to your library.")
    } catch {
      toast.error("The resource could not be saved.")
    } finally {
      setIsSaving(false)
    }
  }

  async function removeResource(item) {
    try {
      await deleteLibraryItem(item.id)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      toast.success("Resource removed.")
    } catch {
      toast.error("The resource could not be removed.")
    }
  }

  const counts = useMemo(() => {
    const result = { quiz: 0, flashcard: 0, file: 0, community: 0 }
    for (const item of items) {
      if (result[item.kind] != null) result[item.kind] += 1
    }
    return result
  }, [items])

  const query = localSearch.toLowerCase().trim()

  const visibleItems = useMemo(
      () =>
          items.filter((item) => {
            const matchesCategory = category === ALL_VALUE || item.kind === category

            const matchesCertification =
                !certificationId || String(item.certificationId ?? "") === certificationId

            const matchesSearch =
                !query ||
                (item.title || "").toLowerCase().includes(query) ||
                (item.description || "").toLowerCase().includes(query) ||
                (item.certificationTitle || "").toLowerCase().includes(query) ||
                (item.lessonTitle || "").toLowerCase().includes(query) ||
                (item.details || "").toLowerCase().includes(query)

            return matchesCategory && matchesCertification && matchesSearch
          }),
      [items, category, certificationId, query]
  )

  function openItem(item) {
    const url = resolveOpenUrl(item)

    if (!url) {
      setViewItem(item)
      return
    }

    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer")
      return
    }

    navigate(url)
  }

  return (
      <div className="space-y-6">
        <LearnerPageHeader title="Library" subtitle="Access your generated quizzes, flashcards, study files, and saved community resources.">
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => navigate("/learner/practice-history")}><History className="mr-2 h-4 w-4" />Practice history</Button><Button type="button" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add resource</Button></div>
        </LearnerPageHeader>

        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-4">
          {[
            { value: ALL_VALUE, label: `All (${items.length})` },
            { value: "quiz", label: `Quizzes (${counts.quiz})` },
            { value: "flashcard", label: `Flashcards (${counts.flashcard})` },
            { value: "file", label: `Files (${counts.file})` },
            { value: "community", label: `Community (${counts.community})` },
          ].map((tab) => (
              <Button
                  key={tab.value}
                  type="button"
                  variant={category === tab.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCategory(tab.value)}
              >
                {tab.label}
              </Button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

            <Input
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Search quizzes, flashcards, files, or community resources"
                className="pl-10"
            />
          </label>

          <Select value={certificationId || ALL_VALUE} onValueChange={(value) => setCertificationId(value === ALL_VALUE ? "" : value)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="All certifications" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All certifications</SelectItem>
              {certifications.map((certification) => (
                <SelectItem key={String(certification.certificationId)} value={String(certification.certificationId)}>{certification.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        ) : visibleItems.length === 0 ? (
            <LearnerEmptyState
                icon={LibraryBig}
                title="Your library is empty"
                description="Generated quizzes, flashcards, files, and saved community resources will appear here."
            />
        ) : (
            <div className="overflow-x-auto border-y border-zinc-200">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Certification
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Lesson
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Details
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Added
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Actions
                  </th>
                </tr>
                </thead>

                <tbody>
                {visibleItems.map((item) => {
                  const meta = libraryTypeMeta[item.kind] ?? libraryTypeMeta.note
                  const Icon = meta.icon
                  const downloadUrl = resolveDownloadUrl(item)

                  return (
                      <tr
                          key={`${item.kind}-${item.id}`}
                          className="border-b border-zinc-100 transition last:border-b-0 hover:bg-zinc-50/70"
                      >
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-950">
                                {item.title}
                              </p>

                              <p className="mt-1 line-clamp-1 max-w-md text-xs text-zinc-500">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <Badge variant="outline" className={meta.badge}>
                            {meta.label}
                          </Badge>
                        </td>

                        <td className="max-w-48 px-4 py-4 text-sm text-zinc-600">
                          <span className="block truncate">
                            {item.certificationTitle || "General library"}
                          </span>
                        </td>

                        <td className="max-w-48 px-4 py-4 text-sm text-zinc-600">
                          <span className="block truncate">
                            {item.lessonTitle || "Not linked"}
                          </span>
                        </td>

                        <td className="max-w-44 px-4 py-4 text-sm text-zinc-600">
                          <span className="block truncate">{item.details}</span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm text-zinc-500">
                          {formatDate(item.createdAt)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {item.kind === "quiz" ? (
                                <Button type="button" size="sm" onClick={() => openItem(item)}>
                                  <BrainCircuit className="mr-2 h-4 w-4" />
                                  Open
                                </Button>
                            ) : item.kind === "flashcard" ? (
                                <Button type="button" size="sm" onClick={() => openItem(item)}>
                                  <BookOpenCheck className="mr-2 h-4 w-4" />
                                  Study
                                </Button>
                            ) : (
                                <>
                                  <Button type="button" size="sm" variant="outline" onClick={() => openItem(item)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                  </Button>

                                  {downloadUrl ? (
                                      <Button asChild size="sm">
                                        <a href={downloadUrl}>
                                          <Download className="mr-2 h-4 w-4" />
                                          Download
                                        </a>
                                      </Button>
                                  ) : null}
                                </>
                            )}

                            {item.kind === "community" ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate("/learner/community")}
                                >
                                  <Share2 className="mr-2 h-4 w-4" />
                                  Source
                                </Button>
                            ) : null}
                            {item.ownedByMe ? (
                                <Button type="button" size="icon" variant="ghost" onClick={() => removeResource(item)} aria-label="Remove from library">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                  )
                })}
                </tbody>
              </table>
            </div>
        )}

        <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) resetAddForm()
            }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Add to library</DialogTitle><DialogDescription>Save a useful link, a real file, or a personal note.</DialogDescription></DialogHeader>
            <div className="grid gap-4">
              <Select value={newType} onValueChange={(value) => { setNewType(value); setUploadedFile(null) }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Resource type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="file">File upload</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
              <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Resource title" />

              {newType === "link" ? (
                  <Input type="url" value={newUrl} onChange={(event) => setNewUrl(event.target.value)} placeholder="https://..." />
              ) : null}

              {newType === "file" ? (
                  <div>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
                    {uploadedFile ? (
                        <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{uploadedFile.name}</span>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={isUploadingFile}
                            onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploadingFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {isUploadingFile ? "Uploading..." : "Choose a file"}
                        </Button>
                    )}
                  </div>
              ) : null}

              <Textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder={newType === "note" ? "Write your study note..." : "Why is this resource useful?"} className="min-h-28" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="button" onClick={saveResource} disabled={isSaving || isUploadingFile}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save resource
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(viewItem)} onOpenChange={(open) => !open && setViewItem(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{viewItem?.title}</DialogTitle><DialogDescription>{viewItem?.details || "Library resource"}</DialogDescription></DialogHeader>
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{viewItem?.description || "No description was added."}</p>
          </DialogContent>
        </Dialog>
      </div>
  )
}
