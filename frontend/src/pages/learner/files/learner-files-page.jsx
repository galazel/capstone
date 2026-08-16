import React, { useEffect, useMemo, useState } from "react"
import {
  BookOpenCheck,
  BrainCircuit,
  Layers3,
  LibraryBig,
  Loader2,
  Search,
  Trash2,
  Link,
  StickyNote,
} from "@/components/icons"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { deleteLibraryItem, getLibraryItems } from "@/services/learnerToolsService"
import { getAllCertifications } from "@/services/certificationService"
import {
  LearnerEmptyState,
  LearnerPageHeader,
} from "@/components/learner/learner-ui.jsx"

const ALL_VALUE = "all"

/** What the library is: the study aids the tutor generated for this learner. */
const LIBRARY_KINDS = new Set(["quiz", "flashcard"])

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

/* Every kind the library still carries holds a usable URL or in-app path
   already. The S3-key resolution that used to live here existed only for
   uploaded files and saved community attachments, neither of which the
   library shows any more. */
function resolveOpenUrl(item) {
  return item.route
}

export default function LearnerFilesPage() {
  const navigate = useNavigate()

  const [localSearch, setLocalSearch] = useState("")
  const [certificationId, setCertificationId] = useState("")
  const [category, setCategory] = useState(ALL_VALUE)
  const [items, setItems] = useState([])
  const [certifications, setCertifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)


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
    const result = { quiz: 0, flashcard: 0 }
    for (const item of items) {
      if (result[item.kind] != null) result[item.kind] += 1
    }
    return result
  }, [items])

  const query = localSearch.toLowerCase().trim()

  const visibleItems = useMemo(
      () =>
          items.filter((item) => {
            /* Uploaded files and saved community posts are still returned by
               the endpoint and still belong to the learner -- they are simply
               not what this page is for any more, so they are filtered here
               rather than deleted server-side. */
            if (!LIBRARY_KINDS.has(item.kind)) {
              return false
            }

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
        <LearnerPageHeader title="Library" subtitle="Every quiz and flashcard deck the tutor has generated for you.">
        </LearnerPageHeader>

        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-4">
          {[
            { value: ALL_VALUE, label: `All (${items.length})` },
            { value: "quiz", label: `Quizzes (${counts.quiz})` },
            { value: "flashcard", label: `Flashcards (${counts.flashcard})` },
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
                placeholder="Search your quizzes and flashcards"
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
                            {/* Only two kinds reach this table, so the verb is
                                the kind: a quiz is opened, a deck is studied. */}
                            <Button type="button" size="sm" onClick={() => openItem(item)}>
                              {item.kind === "quiz" ? (
                                  <BrainCircuit className="mr-2 h-4 w-4" />
                              ) : (
                                  <BookOpenCheck className="mr-2 h-4 w-4" />
                              )}
                              {item.kind === "quiz" ? "Open" : "Study"}
                            </Button>

                            {/* Where this came from. A generated deck is built
                                from one lesson, and until now the page could
                                name that lesson but not open it. */}
                            {item.lessonId ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/learner/lessons/${item.lessonId}`)}
                                >
                                  <BookOpenCheck className="mr-2 h-4 w-4" />
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

        <Dialog open={Boolean(viewItem)} onOpenChange={(open) => !open && setViewItem(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{viewItem?.title}</DialogTitle><DialogDescription>{viewItem?.details || "Library resource"}</DialogDescription></DialogHeader>
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{viewItem?.description || "No description was added."}</p>
          </DialogContent>
        </Dialog>
      </div>
  )
}
