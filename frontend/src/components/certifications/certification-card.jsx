import { useState } from "react"
import {
  ActivityIcon,
  Loader2,
  MoreVertical,
  SendIcon,
  Trash2Icon,
  TrashIcon,
  UploadCloudIcon
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { generationStatusOf } from "@/hooks/use-active-generations"
import { getFileViewUrl } from "@/services/fileService.js"
import { getCertificationFallbackImage, getCuratedCertificationCover } from "@/lib/certification-cover-images.js"
import {
  deleteCertification,
  publishCertification,
} from "@/services/certificationService.js"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { InlineGenerationMonitor } from "@/components/certifications/inline-generation-monitor.jsx"
import { Button } from "@/components/ui/button"

function getErrorMessage(error, fallback = "Something went wrong.") {
  const responseData = error?.response?.data

  return (
      (typeof responseData === "string" && responseData) ||
      responseData?.message ||
      responseData?.error ||
      error?.message ||
      fallback
  )
}

/**
 * `generationRun` is the live workflow run building this certification, or null.
 *
 * While one exists the certification is a shell: AI generation writes its
 * categories, lessons, and assessments only when the run finishes, so opening
 * it would show an empty structure and publishing it would ship one. The card
 * refuses both, instead of looking finished the moment the generation
 * workspace was closed.
 *
 * It does not become a dead end, though. Closing the workspace leaves the run
 * going, so the card carries the way back to it — otherwise the only view of a
 * generation in progress would be the modal that started it, and closing that
 * would lose sight of it until it finished.
 */
function CertificationCard({ item, certification, generationRun = null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showGeneration, setShowGeneration] = useState(false)

  const generationStatus = generationStatusOf(generationRun)
  const isGenerating = Boolean(generationStatus)
  const generationLabel =
      generationStatus === "AWAITING_REVIEW" ? "Waiting for review" : "Generating…"

  const currentCertification = certification ?? item

  const certificationId =
      currentCertification?.certificationId ??
      currentCertification?.id ??
      item?.certificationId ??
      item?.id

  const certificationTitle =
      currentCertification?.title ?? item?.title ?? "Untitled Certification"

  const certificationDescription =
      currentCertification?.description ??
      item?.description ??
      "No description available."

  const certificationIndustry =
      currentCertification?.industry ?? item?.industry ?? "Certification"

  const certificationStatus =
      currentCertification?.status ??
      currentCertification?.publicationStatus ??
      currentCertification?.certificationStatus ??
      item?.status ??
      item?.publicationStatus ??
      item?.certificationStatus

  const isPublished =
      currentCertification?.published === true ||
      currentCertification?.isPublished === true ||
      String(certificationStatus ?? "").toUpperCase() === "PUBLISHED" ||
      String(certificationStatus ?? "").toUpperCase() === "ACTIVE"

  const imageKey = currentCertification?.imageKey ?? item?.imageKey
  const fallbackImage = getCertificationFallbackImage(certificationTitle)
  const curatedCover = getCuratedCertificationCover(certificationTitle)
  const imageUrl = curatedCover ?? (imageKey ? getFileViewUrl(imageKey) : fallbackImage)

  const { mutate: removeCertification, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      if (!certificationId) {
        throw new Error("Certification ID is missing.")
      }

      const result = await deleteCertification(certificationId)

      if (result === false || result?.success === false) {
        throw new Error(
            result?.message || "The certification could not be deleted."
        )
      }

      return result
    },

    onSuccess: async () => {
      setShowDeleteDialog(false)

      await queryClient.invalidateQueries({
        queryKey: ["admin-certifications"],
      })

      toast.success("Certification deleted", {
        description: `"${certificationTitle}" has been removed.`,
      })
    },

    onError: (error) => {
      toast.error("Could not delete certification", {
        description: getErrorMessage(
            error,
            "Something went wrong while deleting the certification."
        ),
      })
    },
  })

  const { mutate: publishSelectedCertification, isPending: isPublishing } =
      useMutation({
        mutationFn: async () => {
          if (!certificationId) {
            throw new Error("Certification ID is missing.")
          }

          const result = await publishCertification(certificationId)

          if (result === false || result?.success === false) {
            throw new Error(
                result?.message || "The certification could not be published."
            )
          }

          return result
        },

        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: ["admin-certifications"],
          })

          await queryClient.invalidateQueries({
            queryKey: ["certification", certificationId],
          })

          toast.success("Certification published", {
            description: `"${certificationTitle}" is now published.`,
          })
        },

        onError: (error) => {
          toast.error("Could not publish certification", {
            description: getErrorMessage(
                error,
                "Something went wrong while publishing the certification."
            ),
          })
        },
      })

  /** Back to the live run this card is tracking. */
  function handleOpenGeneration(event) {
    event?.preventDefault()
    event?.stopPropagation()

    if (!generationRun?.run_id) {
      toast.error("Cannot open the generation", {
        description: "This run is no longer available.",
      })
      return
    }

    // Opened in place rather than navigated to. Watching a build is a glance,
    // not a destination: sending an admin to a full page meant losing the list
    // they were working in and having to navigate back once they had seen the
    // progress bar move. The workspace page still exists on its own route for
    // anyone who wants the full transcript.
    setShowGeneration(true)
  }

  function handleOpenCertification() {
    if (isGenerating) {
      toast.info("Still generating", {
        description: `"${certificationTitle}" is being built. Open the progress view to watch it.`,
      })

      return
    }

    if (!certificationId) {
      toast.error("Cannot open certification", {
        description: "Certification ID is missing.",
      })

      return
    }

    navigate(`certification/${certificationId}`, {
      state: {
        certification: currentCertification,
        imageUrl,
      },
    })
  }

  function handleOpenDeleteDialog(event) {
    event.preventDefault()
    event.stopPropagation()
    setShowDeleteDialog(true)
  }

  function handlePublishCertification(event) {
    event.preventDefault()
    event.stopPropagation()

    if (isGenerating) {
      toast.info("Still generating", {
        description: "Wait for generation to finish before publishing.",
      })
      return
    }

    if (isPublished) {
      toast.info("Already published", {
        description: `"${certificationTitle}" is already published.`,
      })
      return
    }

    publishSelectedCertification()
  }

  function handleDeleteDialogChange(nextOpen) {
    if (isDeleting) return
    setShowDeleteDialog(nextOpen)
  }

  function handleConfirmDelete() {
    removeCertification()
  }

  return (
      <>
        <div
            role={isGenerating ? undefined : "button"}
            tabIndex={isGenerating ? undefined : 0}
            aria-busy={isGenerating || undefined}
            onClick={isGenerating ? undefined : handleOpenCertification}
            onKeyDown={(event) => {
              if (isGenerating) return
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                handleOpenCertification()
              }
            }}
            className={cn(
                "group flex h-[380px] w-full flex-col overflow-hidden rounded-[32px] border border-border bg-card shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isGenerating
                    // Not merely dimmed: without the cursor and hover lift the
                    // card stops inviting a click it would only refuse.
                    ? "cursor-default border-dashed"
                    : "cursor-pointer hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md",
            )}
        >
          <figure className="relative h-48 shrink-0 overflow-hidden border-b border-border bg-muted/40">
            <img
                src={imageUrl}
                alt={certificationTitle}
                className={cn(
                    "h-full w-full object-cover transition-transform duration-300",
                    isGenerating ? "opacity-60 grayscale" : "group-hover:scale-105",
                )}
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src = fallbackImage
                }}
                loading="eager"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

            {isGenerating ? (
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  {generationLabel}
                </span>
            ) : null}
          </figure>

          <div className="flex min-h-0 flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex max-w-full truncate rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    {certificationIndustry}
                  </span>

                  {/* While generating, the pill on the cover image already says
                      so — repeating it here only crowds the industry pill. */}
                  {isGenerating ? null : isPublished ? (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                        Published
                      </span>
                  ) : (
                      <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600">
                        Draft
                      </span>
                  )}
                </div>

                {/* `text-md` is not a Tailwind utility and never was — the title
                    was silently inheriting the body size. */}
                <h2 className="font-heading mt-2.5 line-clamp-2 text-base leading-6 font-semibold text-foreground">
                  {certificationTitle}
                </h2>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      className="-mt-1 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label="Certification options"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    onClick={(event) => event.stopPropagation()}
                >
                  <DropdownMenuGroup>
                    {isGenerating ? (
                        <DropdownMenuItem onSelect={handleOpenGeneration}>
                          <ActivityIcon className="mr-2 h-4 w-4" />
                          {generationStatus === "AWAITING_REVIEW"
                              ? "Review now"
                              : "View progress"}
                        </DropdownMenuItem>
                    ) : null}

                    <DropdownMenuItem
                        disabled={isPublishing || isDeleting || isPublished || isGenerating}
                        onSelect={handlePublishCertification}
                    >
                      <SendIcon className="mr-2 h-4 w-4" />
                      {isGenerating
                          ? "Generating…"
                          : isPublishing
                              ? "Publishing..."
                              : isPublished
                                  ? "Published"
                                  : "Publish"}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        variant="destructive"
                        disabled={isDeleting || isPublishing}
                        onSelect={handleOpenDeleteDialog}
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {isGenerating
                  ? generationStatus === "AWAITING_REVIEW"
                      ? "Paused for your review in the generation workspace."
                      : "Building categories, lessons, and assessments. This can take several minutes."
                  : certificationDescription}
            </p>

            <div className="mt-auto pt-5">
              {isGenerating ? (
                  <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={handleOpenGeneration}
                  >
                    <ActivityIcon className="mr-2 h-4 w-4" />
                    {generationStatus === "AWAITING_REVIEW"
                        ? "Review now"
                        : "View progress"}
                  </Button>
              ) : (
                  <div className="h-1 w-10 shrink-0 rounded-full bg-primary" />
              )}
            </div>
          </div>
        </div>

        {/* Progress is watched in place. The monitor owns its own scrolling,
            header rule, and status bar, so it fills the body edge to edge --
            same arrangement the create drawer uses. Closing it never stops the
            run: generation continues in the Python consumer either way. */}
        <Dialog open={showGeneration} onOpenChange={setShowGeneration}>
          <DialogContent
              className="flex h-[82vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[92vw] sm:max-w-none lg:w-[80vw] xl:w-[70vw]"
              onClick={(event) => event.stopPropagation()}
          >
            <DialogHeader className="px-4 pt-4 pb-3 sm:px-6">
              <DialogTitle>Generating {certificationTitle}</DialogTitle>
              <DialogDescription>
                Watch it build, and review each item as it is produced.
              </DialogDescription>
            </DialogHeader>

            {showGeneration ? (
                <InlineGenerationMonitor
                    certificationId={certificationId}
                    onClose={() => setShowGeneration(false)}
                />
            ) : null}
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={handleDeleteDialogChange}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
                <Trash2Icon />
              </AlertDialogMedia>

              <AlertDialogTitle>Delete certification?</AlertDialogTitle>

              <AlertDialogDescription>
                Are you sure you want to delete "{certificationTitle}"? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel variant="outline" disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>

              <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
  )
}

export default CertificationCard
