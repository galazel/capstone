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

import CertificationDetails from "@/components/certifications/certification-details"
import CertificationModules from "@/components/certifications/certification-modules"
import { DocumentUploadStep } from "@/components/certifications/document-upload-step.jsx"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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


const MIN_TITLE_LENGTH = 3
const MAX_TITLE_LENGTH = 150

const MIN_DESCRIPTION_LENGTH = 20
const MAX_DESCRIPTION_LENGTH = 2000

const INVALID_INDUSTRY_VALUES = new Set([
    "",
    "all",
    "none",
    "select",
    "select industry",
    "undefined",
    "null",
])

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

function formatLocalDateTime(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0")

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds()
    )}`
}

function normalizeText(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
}

function hasMeaningfulText(value) {
    return /[\p{L}\p{N}]/u.test(value)
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

function validateCertificationDetails(details) {
    const errors = {}

    const title = normalizeText(details?.title)
    const description = normalizeText(details?.description)
    const industry = normalizeText(details?.industry)

    if (!title) {
        errors.title = "Certification name is required."
    } else if (title.length < MIN_TITLE_LENGTH) {
        errors.title = `Certification name must be at least ${MIN_TITLE_LENGTH} characters.`
    } else if (title.length > MAX_TITLE_LENGTH) {
        errors.title = `Certification name must not exceed ${MAX_TITLE_LENGTH} characters.`
    } else if (!hasMeaningfulText(title)) {
        errors.title =
            "Certification name must contain letters or numbers, not symbols only."
    }















    if (INVALID_INDUSTRY_VALUES.has(industry.toLowerCase())) {
        errors.industry = "Please select an industry."
    } else if (industry.length > 100) {
        errors.industry = "Industry must not exceed 100 characters."
    }




    if (!description) {
        errors.description = "Description is required."
    } else if (description.length < MIN_DESCRIPTION_LENGTH) {
        errors.description =
            `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.description =
            `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`
    } else if (!hasMeaningfulText(description)) {
        errors.description =
            "Description must contain meaningful text, not symbols only."
    }







    // No cover-image rule any more: the cover is drawn from the title, so
    // there is no file to validate and nothing that can block a save.

    return errors
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
        mutationFn: ({ payload, documents }) =>
            addCertificationWithAi(payload, documents, (event) =>
                setUploadPercent(
                    event.total ? Math.round((event.loaded / event.total) * 100) : 0
                )
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
                    "This runs on the server and keeps going if you leave. " +
                    "Open it from the list to watch its progress.",
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
                    "flex w-[96vw] flex-col gap-0 overflow-hidden p-0",
                    // Editing holds a whole category tree and wants the room.
                    // Creating is a form: three fields and a drop zone, read top
                    // to bottom in one scroll. Sized to a comfortable measure
                    // rather than a share of the screen — at 76vw the name field
                    // was a metre of empty input.
                    isEditing
                        ? "data-[vaul-drawer-direction=right]:sm:max-w-none sm:w-[92vw] lg:w-[86vw] xl:w-[76vw] 2xl:w-[68vw]"
                        : "data-[vaul-drawer-direction=right]:sm:max-w-[680px] sm:w-[92vw]",
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
                                />

                                <div className="border-t border-border pt-8">
                                    <DocumentUploadStep
                                        disabled={isBusy}
                                        onFilesChange={handleDocumentsChange}
                                    />
                                </div>
                            </div>
                        ) : page === 1 ? (
                            <CertificationDetails
                                value={certificationDetails}
                                onChange={handleDetailsChange}
                                errors={detailsErrors}
                                mode={mode}
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