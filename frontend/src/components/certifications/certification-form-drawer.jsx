import { useCallback, useEffect, useState } from "react"
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    CircleAlert,
    Sparkles,
    X,
} from "@/components/icons"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import {
    addCertificationWithAi,
    updateCertification,
} from "@/services/certificationService"
import {
    getCertificationId,
    mapCertificationToModuleStructure,
} from "@/utils/certification-structure"
/* The rulebook lives in one place now: the certification page edits the same
   fields in place, and two copies of "a description must be 20 characters"
   drift the moment one of them is corrected. */
import {
    formatLocalDateTime,
    validateCertificationDetails,
} from "@/utils/certification-edit"

import CertificationDetails from "@/components/certifications/certification-details"
import CertificationModules from "@/components/certifications/certification-modules"
import { DocumentUploadStep } from "@/components/certifications/document-upload-step.jsx"

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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/* Creating is one page, editing is two.
   Generation needs two short things — what the certification is, and the
   documents to read — and splitting them across a wizard made the admin commit
   to a title before seeing whether their files were even accepted, then walk
   back a step to fix it. Editing keeps its second step because the category and
   lesson tree is a screenful on its own. */
const EDIT_STEP_LABELS = ["Certification details", "Categories and lessons"]

/* How closely the admin wants to supervise the build.

   The graph was written review-first: it pauses after the curriculum, after
   every category, after every lesson, and again for each exam and the question
   bank. That is right when someone intends to shape the material as it is
   written, and wrong the rest of the time — an unattended run stops at the
   first checkpoint and waits, so "start it and check back later" produced a
   certification that had generated one thing and then sat still.

   So it is a choice, made here, before anything starts. */
const REVIEW_MODES = [
    {
        value: "auto",
        title: "Generate everything",
        description:
            "Builds the whole certification without stopping — curriculum, lessons, quizzes, exams, and the question bank. Everything is saved as drafts for you to edit afterwards.",
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
                                : "border-border hover:bg-muted/50",
                            disabled && "cursor-not-allowed opacity-60"
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


const emptySubmissionDialog = {
    open: false,
    title: "",
    description: "",
}

function getEmptyDetails() {
    return {
        title: "",
        industry: "",
        description: "",
    }
}

function toDetails(certification) {
    if (!certification) {
        return getEmptyDetails()
    }

    return {
        title: certification.title ?? "",
        industry: certification.industry ?? "",
        description: certification.description ?? "",
    }
}

function isModuleStructureValid(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
        return false
    }

    return categories.every((majorCategory) => {
        const hasMajorTitle = majorCategory.title?.trim().length > 0

        const middleCategories = majorCategory.middleCategories ?? []

        const hasMiddleCategories = middleCategories.length > 0

        const hasValidMiddleCategories = middleCategories.every(
            (middleCategory) => {
                const hasMiddleTitle = middleCategory.title?.trim().length > 0

                const lessons = middleCategory.lessons ?? []

                const hasLessons = lessons.length > 0

                const hasValidLessons = lessons.every(
                    (lesson) => lesson.name?.trim().length > 0
                )

                return hasMiddleTitle && hasLessons && hasValidLessons
            }
        )

        return hasMajorTitle && hasMiddleCategories && hasValidMiddleCategories
    })
}

function removeModuleUiFields(categories, includeExistingIds = false) {
    return categories.map((majorCategory) => {
        const majorPayload = {
            title: majorCategory.title.trim(),

            middleCategory: (majorCategory.middleCategories ?? []).map(
                (middleCategory) => {
                    const middlePayload = {
                        title: middleCategory.title.trim(),

                        lessons: (middleCategory.lessons ?? []).map((lesson) => {
                            const lessonPayload = {
                                name: lesson.name.trim(),
                                lessonComponentStructure:
                                    lesson.lessonComponentStructure ?? "[]",
                            }

                            if (includeExistingIds && lesson.lessonId != null) {
                                lessonPayload.lessonId = lesson.lessonId
                            }

                            return lessonPayload
                        }),
                    }

                    if (
                        includeExistingIds &&
                        middleCategory.middleCategoryId != null
                    ) {
                        middlePayload.middleCategoryId =
                            middleCategory.middleCategoryId
                    }

                    return middlePayload
                }
            ),
        }

        if (includeExistingIds && majorCategory.majorCategoryId != null) {
            majorPayload.majorCategoryId = majorCategory.majorCategoryId
        }

        return majorPayload
    })
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

function getCertificationFromResponse(result) {
    if (!result || typeof result !== "object") {
        return null
    }

    if (result.certification && typeof result.certification === "object") {
        return result.certification
    }

    if (result.data && typeof result.data === "object") {
        return result.data
    }

    if (
        result.certificationId != null ||
        result.id != null ||
        result.title != null
    ) {
        return result
    }

    return null
}

export default function CertificationFormDrawer({
                                                    mode = "create",
                                                    certification = null,
                                                    open,
                                                    onOpenChange,
                                                    onSaved,
                                                    trigger,
                                                    image,
                                                }) {
    const isEditing = mode === "edit"
    const certificationId = getCertificationId(certification)

    const [page, setPage] = useState(1)

    const [certificationDetails, setCertificationDetails] = useState(
        getEmptyDetails()
    )

    const [moduleCategories, setModuleCategories] = useState([])
    const [detailsErrors, setDetailsErrors] = useState({})
    const [submissionError, setSubmissionError] = useState("")
    const [submissionDialog, setSubmissionDialog] = useState(
        emptySubmissionDialog
    )

    // Create is AI-only: step 2 collects the source documents rather than a
    // hand-built category tree. Editing keeps the manual structure editor, which
    // is how a generated certification gets corrected afterwards.
    const [sourceDocuments, setSourceDocuments] = useState([])
    const [uploadPercent, setUploadPercent] = useState(0)
    /* Unattended by default: it is what an admin wants nearly every time, and
       the supervised alternative is one click away and clearly labelled. */
    const [reviewMode, setReviewMode] = useState("auto")

    // Update only. The create branch this used to carry called `addCertification`
    // to save a hand-built structure; creating now always goes through
    // generation, so that path — and the plain POST behind it — is gone.
    const {
        mutateAsync: saveCertification,
        isPending: isSavingCertification,
    } = useMutation({
        mutationFn: (payload) => updateCertification(certificationId, payload),
    })

    const {
        mutateAsync: createWithAi,
        isPending: isQueueingGeneration,
    } = useMutation({
        mutationFn: ({ payload, documents, mode }) =>
            addCertificationWithAi(
                payload,
                documents,
                (event) =>
                    setUploadPercent(
                        event.total
                            ? Math.round((event.loaded / event.total) * 100)
                            : 0
                    ),
                mode
            ),
    })

    const isBusy = isSavingCertification || isQueueingGeneration
    const totalSteps = isEditing ? EDIT_STEP_LABELS.length : 1
    const isFirstStep = page === 1
    const isLastStep = page === totalSteps

    function resetForm() {
        setPage(1)

        setCertificationDetails(
            toDetails(isEditing ? certification : null)
        )

        setModuleCategories(
            isEditing ? mapCertificationToModuleStructure(certification) : []
        )

        setSourceDocuments([])
        setUploadPercent(0)
        setReviewMode("auto")
        setDetailsErrors({})
        setSubmissionError("")
        setSubmissionDialog(emptySubmissionDialog)
    }

    useEffect(() => {
        if (open) {
            resetForm()
        }
    }, [open, certificationId])

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

    function handleModulesChange(nextCategories) {
        setModuleCategories(nextCategories)
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

    function handlePrevious() {
        if (isFirstStep || isBusy) {
            return
        }

        setPage(1)
        setSubmissionError("")
    }

    function handleNext() {
        const errors = validateCertificationDetails(certificationDetails)

        if (Object.keys(errors).length > 0) {
            setDetailsErrors(errors)
            return
        }

        setDetailsErrors({})
        setSubmissionError("")
        setPage(2)
    }

    /** Editing only — a new certification is always built by generation. */
    async function handleSubmit() {
        const detailsValidationErrors =
            validateCertificationDetails(certificationDetails)

        if (Object.keys(detailsValidationErrors).length > 0) {
            setDetailsErrors(detailsValidationErrors)
            setPage(1)
            return
        }

        if (!isModuleStructureValid(moduleCategories)) {
            setSubmissionError(
                "Add at least one complete major category, middle category, and lesson."
            )
            return
        }

        if (!certificationId) {
            setSubmissionError(
                "Cannot update this certification because its ID is missing."
            )
            return
        }

        try {
            setSubmissionError("")

            const payload = {
                title: certificationDetails.title.trim(),
                description: certificationDetails.description.trim(),
                industry: certificationDetails.industry.trim(),

                majorCategory: removeModuleUiFields(
                    moduleCategories,
                    isEditing
                ),
            }

            if (isEditing) {
                payload.certificationId = certificationId

                payload.dateCreated =
                    certification?.dateCreated ?? formatLocalDateTime()

                payload.dateUpdated = formatLocalDateTime()
            } else {
                payload.dateCreated = formatLocalDateTime()
            }

            const result = await saveCertification(payload)

            if (result === false || result?.success === false) {
                throw new Error(
                    result?.message ||
                    "The server could not save the certification."
                )
            }

            const serverCertification = getCertificationFromResponse(result)

            const savedCertification = {
                ...(certification ?? {}),
                ...payload,
                ...(serverCertification ?? {}),
            }

            if (isEditing && certificationId != null) {
                savedCertification.certificationId =
                    serverCertification?.certificationId ?? certificationId
            }

            await onSaved?.(savedCertification)

            setSubmissionDialog({
                open: true,
                title: isEditing
                    ? "Certification updated successfully"
                    : "Certification created successfully",
                description: isEditing
                    ? "Your certification details, modules, and lessons were updated."
                    : "The certification details, categories, modules, and lessons were saved successfully.",
            })
        } catch (error) {
            const message = getErrorMessage(error)

            setSubmissionError(message)

            toast.error(
                isEditing
                    ? "Could not update certification"
                    : "Could not create certification",
                {
                    description: message,
                }
            )
        }
    }







    /**
     * The create path: save the certification and hand its documents to AI
     * generation in one request.
     *
     * There is no manual alternative. A certification is a curriculum plus
     * twenty-odd lessons and their assessments; typing that structure by hand
     * produced empty shells that then had to be generated anyway, so the form
     * now asks for the two things generation actually needs — what the
     * certification is, and the documents to read.
     */
    async function handleGenerate() {
        const detailsValidationErrors =
            validateCertificationDetails(certificationDetails)

        if (Object.keys(detailsValidationErrors).length > 0) {
            setDetailsErrors(detailsValidationErrors)
            setPage(1)
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

    function handleMainAction() {
        if (!isLastStep) {
            handleNext()
            return
        }

        if (isEditing) {
            handleSubmit()
            return
        }

        handleGenerate()
    }

    function handleCloseAfterSuccess() {
        setSubmissionDialog(emptySubmissionDialog)
        handleModalChange(false)
    }

    return (
        <Drawer
            open={open}
            onOpenChange={handleModalChange}
            // Right, not bottom: this panel is tall content -- a form that
            // scrolls, or a generation transcript that streams -- and a bottom
            // sheet caps itself at 80vh with a drag handle eating the top of it.
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
                    /* Half the window, both modes. Editing holds a whole
                       category tree and creating is three fields and a drop
                       zone, so they used to be sized apart -- 76vw against a
                       680px measure. Two drawers of the same name opening at
                       two different widths read as two different surfaces, and
                       the wide one covered the page it was opened from. Half
                       is room for the tree and still a panel over a page.

                       Below `lg` the panel keeps the window: at that size half
                       of it is a column too narrow for either form. */
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
                    away with the content. `pr-14` reserves its column.

                    `py-4` rather than `py-5`: the close button is absolutely
                    positioned at `top-4`, so anything else vertically centres
                    the title against it. */}
                <DrawerHeader className="relative gap-1 border-b border-border px-5 py-4 pr-14 text-left sm:px-6">
                    <DrawerTitle className="text-lg">
                        {isEditing ? "Edit Certification" : "Create Certification"}
                    </DrawerTitle>

                    {/* Rendered either way, sr-only when there is nothing to
                        show: vaul is Radix Dialog underneath, which warns when
                        a panel has no description, and an unlabelled panel is
                        a real gap for a screen reader rather than just noise
                        in the console. */}
                    {isEditing ? (
                        <DrawerDescription className="text-xs">
                            {`${EDIT_STEP_LABELS[page - 1]} · step ${page} of ${totalSteps}`}
                        </DrawerDescription>
                    ) : (
                        <DrawerDescription className="sr-only">
                            Certification details and source documents.
                        </DrawerDescription>
                    )}

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

                {/* The generation transcript owns its own scrolling, header rule,
                    and status bar, so it fills the body edge to edge. The form
                    steps get the padded, scrollable body instead -- one wrapper
                    each rather than the nested pair that used to double up the
                    scroll containers. */}
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
                        {!isEditing ? (
                            /* One column, one scroll: what the
                               certification is, then the documents to build
                               it from, in the order you would say them. */
                            <div className="space-y-8">
                                <CertificationDetails
                                    value={certificationDetails}
                                    onChange={handleDetailsChange}
                                    errors={detailsErrors}
                                    mode={mode}
                                    disabled={isBusy}
                                />

                                <div className="border-t border-border pt-8">
                                    <DocumentUploadStep
                                        disabled={isBusy}
                                        onFilesChange={handleDocumentsChange}
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
                        ) : page === 1 ? (
                            <CertificationDetails
                                value={certificationDetails}
                                onChange={handleDetailsChange}
                                errors={detailsErrors}
                                mode={mode}
                                disabled={isBusy}
                            />
                        ) : (
                            <CertificationModules
                                certificationId={certificationId}
                                value={moduleCategories}
                                onChange={handleModulesChange}
                                onCreateMiddleExam={() => {}}
                                onGenerationStarted={setGeneratingCertificationId}
                            />
                        )}
                    </div>

                    {/* A plain footer rather than `DialogFooter`: that
                        primitive is a right-aligned button row, and this
                        needs an error alert stacked above split Previous /
                        Next controls. Using it meant overriding its
                        direction at two breakpoints to get there. */}
                    <div className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4 sm:px-6">
                        {submissionError && (
                            <Alert variant="destructive" className="relative pr-12">
                                <CircleAlert className="h-4 w-4" />

                                <AlertTitle>
                                    Cannot{" "}
                                    {isEditing ? "update" : "create"}{" "}
                                    certification
                                </AlertTitle>

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

                        {/* Real byte progress while the documents upload:
                            ten 10 MB PDFs is a slow request, and a button
                            stuck on "Starting…" cannot say whether anything
                            is moving. */}
                        {isQueueingGeneration && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                    <span>
                                        {uploadPercent < 100
                                            ? `Uploading ${sourceDocuments.length} document${sourceDocuments.length === 1 ? "" : "s"}…`
                                            : "Queuing generation…"}
                                    </span>
                                    <span className="font-mono tabular-nums">
                                        {uploadPercent}%
                                    </span>
                                </div>

                                <Progress value={uploadPercent} className="h-1.5" />
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3">
                            {/* Only where there is a step to go back to.
                                A permanently disabled Previous on a
                                one-page form is furniture. */}
                            {totalSteps > 1 ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handlePrevious}
                                    disabled={isFirstStep || isBusy}
                                    className="min-w-[118px] gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                            ) : (
                                <span />
                            )}

                            <Button
                                type="button"
                                onClick={handleMainAction}
                                disabled={isBusy}
                                className="min-w-[185px] gap-2"
                            >
                                {isBusy ? (
                                    isEditing ? "Saving..." : "Starting..."
                                ) : !isLastStep ? (
                                    <>
                                        Next
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                ) : isEditing ? (
                                    "Save Changes"
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

            <AlertDialog
                open={submissionDialog.open}
                onOpenChange={(nextOpen) => {
                    setSubmissionDialog((current) => ({
                        ...current,
                        open: nextOpen,
                    }))
                }}
            >
                {/* Sized, spaced, and rounded by the primitive: the ad-hoc
                    `rounded-2xl`, media circle, and `mt-3` this used to carry
                    made it the one dialog in the app that did not match the
                    others. */}
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-primary/10 text-primary">
                            <CheckCircle2 />
                        </AlertDialogMedia>

                        <AlertDialogTitle>
                            {submissionDialog.title}
                        </AlertDialogTitle>

                        <AlertDialogDescription>
                            {submissionDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogAction
                            onClick={handleCloseAfterSuccess}
                            className="col-span-2"
                        >
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Drawer>
    )
}