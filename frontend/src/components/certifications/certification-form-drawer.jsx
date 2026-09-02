import { useCallback, useEffect, useState } from "react"
import { CircleAlert, Sparkles, X } from "@/components/icons"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import { addCertificationWithAi } from "@/services/certificationService"
import { formatLocalDateTime, validateCertificationDetails } from "@/utils/certification-edit"

import CertificationDetails from "@/components/certifications/certification-details"
import { DocumentUploadStep } from "@/components/certifications/document-upload-step.jsx"
import { QuestionTypeChoice } from "@/components/certifications/question-type-choice.jsx"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"

/* Creating only.
   This drawer used to do double duty: a one-page create form, and a two-step
   edit form carrying a whole category tree. Editing now happens on the
   certification page itself, where every name is edited where it is shown and
   each level adds and removes its own items -- so the second mode, its step
   navigation, and the tree editor behind it are gone rather than left as a
   second way to do the same thing. Two editors writing the same rows through
   two different payload builders is how one of them quietly starts wiping what
   the other remembered to send.

   What is left is what generation actually needs: what the certification is,
   and the documents to read. */

/* How closely the admin wants to supervise the build.

   The graph was written review-first: it pauses after the curriculum, after
   every category, after every lesson, and again for each exam and the question
   bank. That is right when someone intends to shape the material as it is
   written, and wrong the rest of the time â€” an unattended run stops at the
   first checkpoint and waits, so "start it and check back later" produced a
   certification that had generated one thing and then sat still.

   So it is a choice, made here, before anything starts. */
const REVIEW_MODES = [
    {
        value: "auto",
        title: "Generate everything",
        description:
            "Builds the whole certification without stopping â€” curriculum, lessons, quizzes, exams, and the question bank. Everything is saved as drafts for you to edit afterwards.",
    },
    {
        value: "guided",
        title: "Review each step",
        description:
            "Pauses after each part and waits for you to approve, edit, or regenerate it. The run holds until you come back to it.",
    },
]

function ReviewModeChoice({ value, onChange, disabled }) {
    return (
        <fieldset disabled={disabled} className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
                How should this run?
            </legend>

            <p className="text-sm text-muted-foreground">
                Either way the work happens on the server and keeps going if you
                close this.
            </p>

            <RadioGroup
                value={value}
                onValueChange={onChange}
                className="gap-3 pt-1"
            >
                {REVIEW_MODES.map((mode) => (
                    <label
                        key={mode.value}
                        htmlFor={`review-mode-${mode.value}`}
                        className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border p-4 transition",
                            value === mode.value
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                        )}
                    >
                        <RadioGroupItem
                            id={`review-mode-${mode.value}`}
                            value={mode.value}
                            className="mt-0.5"
                        />

                        <span className="space-y-1">
                            <span className="block text-sm font-medium text-foreground">
                                {mode.title}
                            </span>

                            <span className="block text-sm text-muted-foreground">
                                {mode.description}
                            </span>
                        </span>
                    </label>
                ))}
            </RadioGroup>
        </fieldset>
    )
}

function getEmptyDetails() {
    return {
        title: "",
        industry: "",
        description: "",
    }
}

function getErrorMessage(error) {
    const responseData = error?.response?.data

    return (
        (typeof responseData === "string" && responseData) ||
        responseData?.message ||
        responseData?.error ||
        error?.message ||
        "Unable to save the certification. Please try again."
    )
}

export default function CertificationFormDrawer({
                                                    open,
                                                    onOpenChange,
                                                    onSaved,
                                                    trigger,
                                                }) {
    const [certificationDetails, setCertificationDetails] = useState(
        getEmptyDetails()
    )

    const [detailsErrors, setDetailsErrors] = useState({})
    const [submissionError, setSubmissionError] = useState("")

    const [sourceDocuments, setSourceDocuments] = useState([])
    const [uploadPercent, setUploadPercent] = useState(0)
    /* Unattended by default: it is what an admin wants nearly every time, and
       the supervised alternative is one click away and clearly labelled. */
    const [reviewMode, setReviewMode] = useState("auto")
    const [questionTypes, setQuestionTypes] = useState([])

    const {
        mutateAsync: createWithAi,
        isPending: isBusy,
    } = useMutation({
        mutationFn: ({ payload, documents, mode, questionTypes: chosenTypes }) =>
            addCertificationWithAi(
                payload,
                documents,
                (event) =>
                    setUploadPercent(
                        event.total
                            ? Math.round((event.loaded / event.total) * 100)
                            : 0
                    ),
                mode,
                chosenTypes
            ),
    })

    function resetForm() {
        setCertificationDetails(getEmptyDetails())
        setSourceDocuments([])
        setUploadPercent(0)
        setReviewMode("auto")
        setDetailsErrors({})
        setSubmissionError("")
    }

    useEffect(() => {
        if (open) {
            resetForm()
        }
    }, [open])

    function handleModalChange(nextOpen) {
        if (!nextOpen && isBusy) {
            return
        }

        onOpenChange(nextOpen)

        if (!nextOpen) {
            resetForm()
        }
    }

    function handleDetailsChange(nextDetails) {
        setCertificationDetails(nextDetails)
        setDetailsErrors({})
        setSubmissionError("")
    }

    // Identity-stable so the upload step's reporting effect does not re-fire on
    // every render of this modal.
    const handleDocumentsChange = useCallback((documents) => {
        setSourceDocuments(documents)
        setSubmissionError((current) =>
            documents.length > 0 ? "" : current
        )
    }, [])

    /**
     * Save the certification and hand its documents to AI generation in one
     * request.
     *
     * There is no manual alternative. A certification is a curriculum plus
     * twenty-odd lessons and their assessments; typing that structure by hand
     * produced empty shells that then had to be generated anyway, so the form
     * asks for the two things generation actually needs â€” what the
     * certification is, and the documents to read.
     */
    async function handleGenerate() {
        const detailsValidationErrors =
            validateCertificationDetails(certificationDetails)

        if (Object.keys(detailsValidationErrors).length > 0) {
            setDetailsErrors(detailsValidationErrors)
            return
        }

        if (sourceDocuments.length === 0) {
            setSubmissionError(
                "Upload at least one document for the AI to build the certification from."
            )
            return
        }

        try {
            setSubmissionError("")

            const payload = {
                title: certificationDetails.title.trim(),
                description: certificationDetails.description.trim(),
                industry: certificationDetails.industry.trim(),
                dateCreated: formatLocalDateTime(),
            }

            const savedCertification = await createWithAi({
                payload,
                documents: sourceDocuments,
                mode: reviewMode,
                questionTypes,
            })

            await onSaved?.(savedCertification)

            /* Queued, so this drawer's job is done: get out of the way.

               It used to swap the form for the live transcript and keep the
               admin here, on the theory that generation is a conversation they
               steer. In practice the first thing it shows is a single running
               step under a screenful of empty space, and it holds the whole
               panel hostage to a build that runs on the server whether anyone
               watches or not. The certification appears in the list marked
               "Generating" with its own View progress, which is where watching
               belongs -- and leaves the admin free to start the next one.

               Closed directly rather than through `handleModalChange`, whose
               guard refuses to close while a mutation is in flight: whether
               that guard sees the settled value depends on which render's
               closure is running, and this close must not be a coin toss. */
            onOpenChange(false)
            resetForm()

            toast.info("Generating the certification", {
                description:
                    reviewMode === "auto"
                        ? "It will build the whole thing without stopping. Open it from the list to watch its progress."
                        : "It will pause at each step for your approval. Open it from the list to review.",
            })
        } catch (error) {
            const message = getErrorMessage(error)

            setSubmissionError(message)

            toast.error("Could not start generation", { description: message })
        } finally {
            setUploadPercent(0)
        }
    }

    return (
        <Drawer
            open={open}
            onOpenChange={handleModalChange}
            // Right, not bottom: this panel is tall content -- a form that
            // scrolls -- and a bottom sheet caps itself at 80vh with a drag
            // handle eating the top of it.
            direction="right"
        >
            {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}

            {/* The `data-[vaul-drawer-direction=right]:` prefix is load-bearing:
                DrawerContent ships its right-hand width as
                `data-[vaul-drawer-direction=right]:sm:max-w-sm` (384px), and a
                plain `sm:max-w-none` does not override it -- tailwind-merge
                treats a different variant chain as a separate utility, so the
                panel stayed clamped no matter what width was set. Same trap the
                Dialog version hit with `sm:max-w-lg`.

                No explicit height: `direction="right"` pins the panel with
                `inset-y-0`, so it is already full-height. */}
            <DrawerContent
                className={cn(
                    "flex flex-col gap-0 overflow-hidden p-0",
                    /* Every width carries the direction prefix, for the
                       reason the note above gives: the primitive sets
                       `data-[vaul-drawer-direction=right]:w-3/4`, an attribute
                       selector, and a bare `lg:w-[50vw]` loses to it on
                       specificity rather than on order. Written unprefixed,
                       this drawer opened at three quarters of the window and
                       looked like nothing had changed. */
                    "data-[vaul-drawer-direction=right]:sm:max-w-none",
                    "data-[vaul-drawer-direction=right]:w-[96vw]",
                    "data-[vaul-drawer-direction=right]:sm:w-[92vw]",
                    "data-[vaul-drawer-direction=right]:lg:w-[50vw]",
                )}
            >
                {/* Unlike DialogContent, DrawerContent renders no close button
                    of its own, so the header carries one. It lives inside the
                    header rather than the panel because the panel's body is the
                    scroll container -- a key placed on the panel would scroll
                    away with the content.

                    `py-4` rather than `py-5`: the close button is absolutely
                    positioned at `top-4`, so anything else vertically centres
                    the title against it. */}
                <DrawerHeader className="relative gap-1 border-b border-border px-5 py-4 pr-14 text-left sm:px-6">
                    <DrawerTitle className="text-lg">
                        Create Certification
                    </DrawerTitle>

                    {/* Rendered even with nothing to show: vaul is Radix Dialog
                        underneath, which warns when a panel has no description,
                        and an unlabelled panel is a real gap for a screen reader
                        rather than just noise in the console. */}
                    <DrawerDescription className="sr-only">
                        Certification details and source documents.
                    </DrawerDescription>

                    <DrawerClose asChild>
                        <button
                            type="button"
                            aria-label="Close"
                            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    </DrawerClose>
                </DrawerHeader>

                {/* One column, one scroll: what the certification is, then the
                    documents to build it from, in the order you would say
                    them. */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
                    <div className="space-y-8">
                        <CertificationDetails
                            value={certificationDetails}
                            onChange={handleDetailsChange}
                            errors={detailsErrors}
                            disabled={isBusy}
                        />

                        <div className="border-t border-border pt-8">
                            <DocumentUploadStep
                                disabled={isBusy}
                                onFilesChange={handleDocumentsChange}
                            />
                        </div>

                        {/* Before the review-mode choice: this decides what
                            gets built, that decides whether you watch it. */}
                        <div className="border-t border-border pt-8">
                            <QuestionTypeChoice
                                value={questionTypes}
                                onChange={setQuestionTypes}
                                disabled={isBusy}
                            />
                        </div>

                        <div className="border-t border-border pt-8">
                            <ReviewModeChoice
                                value={reviewMode}
                                onChange={setReviewMode}
                                disabled={isBusy}
                            />
                        </div>
                    </div>
                </div>

                {/* A plain footer rather than `DialogFooter`: that primitive is
                    a right-aligned button row, and this needs an error alert
                    and an upload meter stacked above the action. */}
                <div className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4 sm:px-6">
                    {submissionError && (
                        <Alert variant="destructive" className="relative pr-12">
                            <CircleAlert className="h-4 w-4" />

                            <AlertTitle>Cannot create certification</AlertTitle>

                            <AlertDescription>
                                {submissionError}
                            </AlertDescription>

                            <button
                                type="button"
                                onClick={() => setSubmissionError("")}
                                aria-label="Dismiss error"
                                className="absolute top-3 right-3 rounded-md p-1 text-destructive transition hover:bg-destructive/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </Alert>
                    )}

                    {/* Real byte progress while the documents upload: ten 10 MB
                        PDFs is a slow request, and a button stuck on
                        "Startingâ€¦" cannot say whether anything is moving. */}
                    {isBusy && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span>
                                    {uploadPercent < 100
                                        ? `Uploading ${sourceDocuments.length} document${sourceDocuments.length === 1 ? "" : "s"}â€¦`
                                        : "Queuing generationâ€¦"}
                                </span>
                                <span className="font-mono tabular-nums">
                                    {uploadPercent}%
                                </span>
                            </div>

                            <Progress value={uploadPercent} className="h-1.5" />
                        </div>
                    )}

                    <div className="flex items-center justify-end">
                        <Button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isBusy}
                            className="min-w-[185px] gap-2"
                        >
                            {isBusy ? (
                                "Starting..."
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Generate Certification
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
