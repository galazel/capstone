import { useCallback, useEffect, useState } from "react"
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    CircleAlert,
<<<<<<< Updated upstream
    CircleChevronLeft,
=======
    Sparkles,
>>>>>>> Stashed changes
    X,
} from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import {
    addCertificationWithAi,
    updateCertification,
} from "@/services/certificationService"
import { savePhotoCertification } from "@/services/fileService"
import {
    getCertificationId,
    mapCertificationToModuleStructure,
} from "@/utils/certification-structure"

import CertificationDetails from "@/components/certifications/certification-details"
import CertificationModules from "@/components/certifications/certification-modules"
<<<<<<< Updated upstream
=======
import { DocumentUploadStep } from "@/components/certifications/document-upload-step.jsx"
import { InlineGenerationMonitor } from "@/components/certifications/inline-generation-monitor.jsx"
>>>>>>> Stashed changes

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
<<<<<<< Updated upstream
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
=======
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
>>>>>>> Stashed changes
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

const TOTAL_STEPS = 2

const STEP_LABELS = {
    create: ["Certification details", "Source documents"],
    edit: ["Certification details", "Categories and lessons"],
}


const MIN_TITLE_LENGTH = 3
const MAX_TITLE_LENGTH = 150

const MIN_DESCRIPTION_LENGTH = 20
const MAX_DESCRIPTION_LENGTH = 2000

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
]

const ALLOWED_IMAGE_NAME_PATTERN = /\.(jpg|jpeg|png|webp)$/i

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
        imageFile: null,
        existingImageKey: "",
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
        imageFile: null,
        existingImageKey: certification.imageKey ?? "",
    }
}

function validateCertificationDetails(details) {
    const errors = {}

    const title = normalizeText(details?.title)
    const description = normalizeText(details?.description)
    const industry = normalizeText(details?.industry)

    const imageFile = details?.imageFile
    const hasExistingImage = Boolean(
        String(details?.existingImageKey ?? "").trim()
    )




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







    if (!imageFile && !hasExistingImage) {
        errors.imageFile = "Please select a certification cover image."
    }

    if (imageFile) {
        const isValidFile =
            typeof File !== "undefined" && imageFile instanceof File

        const hasAllowedExtension = ALLOWED_IMAGE_NAME_PATTERN.test(
            imageFile?.name ?? ""
        )

        const hasAllowedType = ALLOWED_IMAGE_TYPES.includes(
            imageFile?.type ?? ""
        )

        if (!isValidFile) {
            errors.imageFile = "The selected image file is invalid."
        } else if (!imageFile.name?.trim()) {
            errors.imageFile = "The selected image has no file name."
        } else if (imageFile.size === 0) {
            errors.imageFile = "The selected image file is empty."
        } else if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
            errors.imageFile = "Image size must not exceed 5 MB."
        } else if (!hasAllowedExtension || !hasAllowedType) {
            errors.imageFile =
                "Only JPG, JPEG, PNG, and WEBP images are allowed."
        }
    }

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
<<<<<<< Updated upstream
=======
    // Set once generation is queued. The modal then shows the run's live
    // transcript in place of the form, so the admin never leaves the flow.
    const [generatingCertificationId, setGeneratingCertificationId] = useState(null)
>>>>>>> Stashed changes
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
        mutateAsync: uploadCoverImage,
        isPending: isUploadingImage,
    } = useMutation({
        mutationFn: savePhotoCertification,
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

    const isBusy =
        isSavingCertification || isUploadingImage || isQueueingGeneration
    const isFirstStep = page === 1
    const isLastStep = page === TOTAL_STEPS

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

    function handleDrawerChange(nextOpen) {
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

            let imageKey = certificationDetails.existingImageKey

            if (certificationDetails.imageFile) {
                imageKey = await uploadCoverImage(
                    certificationDetails.imageFile
                )
            }

            if (!imageKey) {
                throw new Error("Certification cover image is required.")
            }

            const payload = {
                title: certificationDetails.title.trim(),
                description: certificationDetails.description.trim(),
                industry: certificationDetails.industry.trim(),
                imageKey,

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
                    ? "Your certification details, modules, lessons, and cover image were updated."
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

            let imageKey = certificationDetails.existingImageKey

            if (certificationDetails.imageFile) {
                imageKey = await uploadCoverImage(certificationDetails.imageFile)
            }

            if (!imageKey) {
                throw new Error("Certification cover image is required.")
            }

            const payload = {
                title: certificationDetails.title.trim(),
                description: certificationDetails.description.trim(),
                industry: certificationDetails.industry.trim(),
                imageKey,
                dateCreated: formatLocalDateTime(),
            }

            const savedCertification = await createWithAi({
                payload,
                documents: sourceDocuments,
            })

            await onSaved?.(savedCertification)

            const newId = getCertificationId(savedCertification)

            // Hand the run to the monitor in this same modal rather than
            // navigating away. Generation is a long conversation the admin
            // steers — it pauses for their review repeatedly — and sending them
            // to another page mid-flow loses the thread of what they were doing.
            if (newId != null) {
                setGeneratingCertificationId(newId)
                return
            }

            // No id to follow: announce it rather than opening a monitor with
            // nothing to attach to.
            setSubmissionDialog({
                open: true,
                title: "Generation started",
                description:
                    "The certification was saved and its curriculum is being generated in the " +
                    "background. You'll get a notification here when it's ready to review.",
            })
        } catch (error) {
            const message = getErrorMessage(error)

            setSubmissionError(message)

            toast.error("Could not start generation", { description: message })
        } finally {
            setUploadPercent(0)
        }
<<<<<<< Updated upstream

        if (!imageKey) {
            throw new Error("Certification cover image is required.")
        }

        const payload = {
            title: certificationDetails.title.trim(),
            description: certificationDetails.description.trim(),
            industry: certificationDetails.industry.trim(),
            imageKey,
            dateCreated: formatLocalDateTime(),
        }

        const savedCertification = await addCertificationWithAi(
            payload,
            selectedDocuments
        )

        await onSaved?.(savedCertification)

        setModuleCategories(
            mapCertificationToModuleStructure(savedCertification)
        )

        setSubmissionDialog({
            open: true,
            title: "Certification created successfully",
            description:
                "The certification and its AI-generated categories, modules, and lessons were saved.",
        })
=======
>>>>>>> Stashed changes
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
        handleDrawerChange(false)
    }

    return (
        <Drawer
            direction="right"
            open={open}
            onOpenChange={handleDrawerChange}
        >
            {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}

            <DrawerContent className="fixed top-0 right-0 bottom-auto left-auto flex h-dvh !w-full !max-w-none flex-col rounded-l-3xl rounded-r-none border-l bg-background p-0 sm:!w-[680px] xl:!w-[50vw]">
                <DrawerHeader className="flex flex-row items-center gap-3 border-b px-4 py-5 text-left sm:px-6">
                    <DrawerClose asChild>
                        <button
                            type="button"
                            aria-label="Close certification form"
                            disabled={isBusy}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <CircleChevronLeft className="h-7 w-7" />
                        </button>
                    </DrawerClose>

<<<<<<< Updated upstream
                    <div className="min-w-0 flex-1">
                        <DrawerTitle className="text-lg font-semibold text-foreground">
                            {isEditing
                                ? "Edit Certification"
                                : "Create Certification"}
                        </DrawerTitle>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Step {page} of {TOTAL_STEPS}
                        </p>
                    </div>
                </DrawerHeader>

                <div className="flex-1 overflow-y-auto">
                    <div className="w-full px-4 py-5 sm:px-6">
                        {page === 1 ? (
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
                                onGenerateForNewCertification={
                                    isEditing
                                        ? undefined
                                        : handleGenerateForNewCertification
                                }
                            />
                        )}
                    </div>
                </div>

                <DrawerFooter className="border-t bg-background px-4 py-4 sm:px-6">
                    <div className="w-full">
                        {submissionError && (
                            <Alert
                                variant="destructive"
                                className="relative mb-3 pr-12"
                            >
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

                        <div className="flex items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePrevious}
                                disabled={isFirstStep || isBusy}
                                className="min-w-[118px] gap-2 rounded-xl"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Previous
                            </Button>

                            <Button
                                type="button"
                                onClick={handleMainAction}
                                disabled={isBusy}
                                className="min-w-[165px] gap-2 rounded-xl"
                            >
                                {isBusy
                                    ? isEditing
                                        ? "Saving..."
                                        : "Creating..."
                                    : isLastStep
                                        ? isEditing
                                            ? "Save Changes"
                                            : "Create Certification"
                                        : (
                                            <>
                                                Next
                                                <ArrowRight className="h-4 w-4" />
                                            </>
                                        )}
                            </Button>
                        </div>
                    </div>
                </DrawerFooter>
            </DrawerContent>
=======
            {/* `sm:max-w-none` is load-bearing: DialogContent ships with
                `sm:max-w-lg` (512px), and an unprefixed `max-w-none` does not
                override it -- tailwind-merge treats the two breakpoints as
                separate utilities, so the modal stayed clamped to 512px no
                matter what width was set. */}
            <DialogContent className="flex h-[88vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[92vw] sm:max-w-none lg:w-[86vw] xl:w-[76vw] 2xl:w-[68vw]">
                {/* DialogContent renders its own close button, so the drawer's
                    back-chevron is gone -- two close affordances in one header
                    is worse than one, and a left-chevron reads as "back" in a
                    centered modal that has nothing to go back to.

                    `py-4` rather than `py-5`: the close button is absolutely
                    positioned at `top-4`, so anything else vertically centres
                    the title against it. */}
                <DialogHeader className="gap-1 border-b border-border px-5 py-4 pr-14 text-left sm:px-6">
                    <DialogTitle className="text-lg">
                        {generatingCertificationId
                            ? "Generating certification"
                            : isEditing
                                ? "Edit Certification"
                                : "Create Certification"}
                    </DialogTitle>

                    <p className="text-xs text-muted-foreground">
                        {generatingCertificationId
                            ? "Watch it build, and review each item as it is produced"
                            : `${STEP_LABELS[isEditing ? "edit" : "create"][page - 1]} · step ${page} of ${TOTAL_STEPS}`}
                    </p>
                </DialogHeader>

                {/* The generation transcript owns its own scrolling, header rule,
                    and status bar, so it fills the body edge to edge. The form
                    steps get the padded, scrollable body instead -- one wrapper
                    each rather than the nested pair that used to double up the
                    scroll containers. */}
                {generatingCertificationId ? (
                    <InlineGenerationMonitor
                        certificationId={generatingCertificationId}
                        onClose={() => {
                            setGeneratingCertificationId(null)
                            handleModalChange(false)
                            // Closing does not stop the run — it keeps going in
                            // the Python consumer. Refreshing the list is what
                            // puts the certification on screen with its
                            // "Generating" label instead of leaving it absent
                            // until the list happens to go stale.
                            onSaved?.()
                        }}
                    />
                ) : (
                    <>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
                            {page === 1 ? (
                                <CertificationDetails
                                    value={certificationDetails}
                                    onChange={handleDetailsChange}
                                    errors={detailsErrors}
                                    mode={mode}
                                />
                            ) : isEditing ? (
                                <CertificationModules
                                    certificationId={certificationId}
                                    value={moduleCategories}
                                    onChange={handleModulesChange}
                                    onCreateMiddleExam={() => {}}
                                    onGenerationStarted={setGeneratingCertificationId}
                                />
                            ) : (
                                <DocumentUploadStep
                                    disabled={isBusy}
                                    onFilesChange={handleDocumentsChange}
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
                    </>
                )}
            </DialogContent>
>>>>>>> Stashed changes

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