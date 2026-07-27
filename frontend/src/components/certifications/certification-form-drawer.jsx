import { useEffect, useState } from "react"
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    CircleAlert,
    X,
} from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import {
    addCertification,
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
import { InlineGenerationMonitor } from "@/components/certifications/inline-generation-monitor.jsx"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
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
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const TOTAL_STEPS = 2


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
    // Set once generation is queued. The modal then shows the run's live
    // timeline in place of the form, so the admin never leaves the flow.
    const [generatingCertificationId, setGeneratingCertificationId] = useState(null)
    const [submissionDialog, setSubmissionDialog] = useState(
        emptySubmissionDialog
    )

    const {
        mutateAsync: saveCertification,
        isPending: isSavingCertification,
    } = useMutation({
        mutationFn: async (payload) => {
            if (isEditing) {
                return await updateCertification(certificationId, payload)
            }

            return await addCertification(payload)
        },
    })

    const {
        mutateAsync: uploadCoverImage,
        isPending: isUploadingImage,
    } = useMutation({
        mutationFn: savePhotoCertification,
    })

    const isBusy = isSavingCertification || isUploadingImage
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

        if (isEditing && !certificationId) {
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







    async function handleGenerateForNewCertification(selectedDocuments) {
        const errors = validateCertificationDetails(certificationDetails)

        if (Object.keys(errors).length > 0) {
            setDetailsErrors(errors)
            setPage(1)

            throw new Error(
                "Complete the certification details on step 1 before generating with AI."
            )
        }

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

        const savedCertification = await addCertificationWithAi(
            payload,
            selectedDocuments
        )

        await onSaved?.(savedCertification)

        // Module categories and the "created" dialog are handled by the
        // caller (CertificationModules) -- curriculum generation itself now
        // runs asynchronously in the background, see handleGenerateDocuments.
        return savedCertification
    }

    function handleNewCertificationGenerationComplete() {
        setSubmissionDialog({
            open: true,
            title: "Certification created successfully",
            description:
                "The certification was saved and its curriculum is now being generated in the " +
                "background. You'll get a notification here when it's ready to review.",
        })
    }

    function handleMainAction() {
        if (isLastStep) {
            handleSubmit()
            return
        }

        handleNext()
    }

    function handleCloseAfterSuccess() {
        setSubmissionDialog(emptySubmissionDialog)
        handleModalChange(false)
    }

    return (
        <Dialog
            open={open}
            onOpenChange={handleModalChange}
        >
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

            {/* `sm:max-w-none` is load-bearing: DialogContent ships with
                `sm:max-w-lg` (512px), and an unprefixed `max-w-none` does not
                override it -- tailwind-merge treats the two breakpoints as
                separate utilities, so the modal stayed clamped to 512px no
                matter what width was set. */}
            <DialogContent className="flex h-[88vh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none sm:w-[92vw] lg:w-[86vw] xl:w-[76vw] 2xl:w-[68vw]">
                {/* DialogContent renders its own close button, so the drawer's
                    back-chevron is gone -- two close affordances in one header
                    is worse than one, and a left-chevron reads as "back" in a
                    centered modal that has nothing to go back to. */}
                <DialogHeader className="flex flex-row items-center gap-3 border-b px-4 py-5 pr-12 text-left sm:px-6 sm:pr-12">
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-lg font-semibold text-foreground">
                            {generatingCertificationId
                                ? "Generating certification"
                                : isEditing
                                    ? "Edit Certification"
                                    : "Create Certification"}
                        </DialogTitle>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {generatingCertificationId
                                ? "Watch it build, and review each item as it is produced"
                                : `Step ${page} of ${TOTAL_STEPS}`}
                        </p>
                    </div>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <div className="flex min-h-0 w-full flex-1 flex-col px-4 py-5 sm:px-6">
                        {generatingCertificationId ? (
                            <InlineGenerationMonitor
                                certificationId={generatingCertificationId}
                                onClose={() => {
                                    setGeneratingCertificationId(null)
                                    handleModalChange(false)
                                    // Closing does not stop the run — it keeps
                                    // going in the Python consumer. Refreshing
                                    // the list is what puts the certification
                                    // on screen with its "Generating" label
                                    // instead of leaving it absent until the
                                    // list happens to go stale.
                                    onSaved?.()
                                }}
                            />
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
                                onGenerateForNewCertification={
                                    isEditing
                                        ? undefined
                                        : handleGenerateForNewCertification
                                }
                                onGenerationComplete={
                                    isEditing ? undefined : handleNewCertificationGenerationComplete
                                }
                                onGenerationStarted={setGeneratingCertificationId}
                            />
                        )}
                    </div>
                </div>

                {generatingCertificationId ? null : (
                <DialogFooter className="border-t bg-background px-4 py-4 sm:px-6">
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
                </DialogFooter>
                )}
            </DialogContent>

            <AlertDialog
                open={submissionDialog.open}
                onOpenChange={(nextOpen) => {
                    setSubmissionDialog((current) => ({
                        ...current,
                        open: nextOpen,
                    }))
                }}
            >
                <AlertDialogContent className="max-w-md rounded-2xl">
                    <AlertDialogHeader>
                        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>

                        <AlertDialogTitle>
                            {submissionDialog.title}
                        </AlertDialogTitle>

                        <AlertDialogDescription className="leading-6">
                            {submissionDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="mt-3">
                        <AlertDialogAction
                            onClick={handleCloseAfterSuccess}
                            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            Close
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    )
}