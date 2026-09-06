import { base } from "./base"

// Omit includeGroupId for the official curriculum only (what every existing
// caller does). Pass a group id to also mix in that group's own
// Institution-Member-authored content -- the caller must be able to act on
// that group (its leader, or the institution owner), enforced server-side.
export async function getAllCertifications(includeGroupId) {
    /* Only a real id is forwarded.
     *
     * React Query calls `queryFn` with a context object, so `queryFn:
     * getAllCertifications` -- rather than `queryFn: () =>
     * getAllCertifications()` -- hands that object in as the group id. It
     * interpolated as the literal string "[object Object]", which the server
     * cannot bind to a Long, and the certifications read 500ed. That is what
     * emptied the learner Library page: the bare form is used at twenty-odd
     * call sites and is only a bug at the one place this function is passed
     * by reference, so it went unnoticed until a page that needed both queries
     * failed on one of them.
     *
     * Guarding here rather than only at that call site: the mistake is
     * invisible at the call site (it looks like every other queryFn) and the
     * blast radius is a 500 on a page that then shows nothing.
     */
    const groupId = Number(includeGroupId)
    const query = Number.isFinite(groupId) && includeGroupId != null
        ? `?includeGroupId=${groupId}`
        : ""
    return await base(`certifications${query}`)
}

export async function addCertification(data) {
    return await base("certifications", {
        data,
        method: "POST",
    })
}

export async function updateCertification(id, data) {
    return await base(`certifications/${id}`, {
        data,
        method: "PUT",
    })
}

export async function deleteCertification(id) {
    return await base(`certifications/${id}`, {
        method: "DELETE",
    })
}

/*
 * Curriculum nodes, one at a time.
 *
 * The whole-tree `PUT /certifications/{id}` is how a rename is saved, because a
 * rename is one field on a certification the client already holds in full. Adds
 * and deletes go through these instead: they are the operations where the
 * server has to do work the client cannot describe -- minting an id, or
 * clearing the exams and questions that hang off a node before the node itself
 * can go -- and sending a tree with one branch missing to an endpoint that
 * rebuilds from what it is sent is a delete by omission, which is exactly the
 * shape that used to fail on a foreign key.
 */

export async function addMajorCategory({ certificationId, title }) {
    return await base("major-categories", {
        data: { certificationId, title },
        method: "POST",
    })
}

export async function deleteMajorCategory(id) {
    return await base(`major-categories/${id}`, { method: "DELETE" })
}

export async function addMiddleCategory({ majorCategoryId, title }) {
    return await base("middle-categories", {
        data: { majorCategoryId, title },
        method: "POST",
    })
}

export async function deleteMiddleCategory(id) {
    return await base(`middle-categories/${id}`, { method: "DELETE" })
}

export async function addLesson({ middleCategoryId, name }) {
    return await base("lessons", {
        // The column is NOT NULL and the server defaults an empty body, but
        // sending it keeps the shape the same as every other lesson write.
        data: { middleCategoryId, name, lessonComponentStructure: "[]" },
        method: "POST",
    })
}

export async function deleteLesson(id) {
    return await base(`lessons/${id}`, { method: "DELETE" })
}

export async function publishCertification(id) {
    return await base(`certifications/publish/${id}`, {
        method: "PUT",
    })
}

/**
 * Structured publishing readiness: { publishable, missingRequirements,
 * invalidRequirements }. Drives the publishing checklist and gates the
 * Publish Certification button.
 */
export async function getCertificationPublishingRequirements(id) {
    return await base(`certifications/${id}/publishing-requirements`, {
        method: "GET",
    })
}




export async function generateCertificationStructure(certificationId, files, onUploadProgress) {
    const formData = new FormData()

    formData.append("certificationId", String(certificationId))

    files.forEach((file) => {
        formData.append("files", file)
    })

    return await base("ai/curriculum/generate", {
        method: "POST",
        data: formData,
        onUploadProgress,
    })
}

/**
 * Queues an AI build of a new certification.
 *
 * `reviewMode` is the admin's answer to "do you want to approve each step?":
 * "guided" stops at every checkpoint and waits, "auto" generates the whole
 * certification — curriculum, lessons, quizzes, exams, question bank —
 * without pausing. It rides on the request rather than being a server default
 * because the same admin wants different answers on different days.
 */
export async function addCertificationWithAi(
    data,
    files,
    onUploadProgress,
    reviewMode = "guided",
    questionTypes = []
) {
    const formData = new FormData()

    formData.append(
        "data",
        new Blob([JSON.stringify(data)], { type: "application/json" })
    )

    files.forEach((file) => {
        formData.append("files", file)
    })

    const params = new URLSearchParams({ reviewMode })
    // Repeated key so Spring binds it as List<String>; see the append call.
    ;(questionTypes ?? []).forEach((type) => params.append("questionTypes", type))

    return await base(`certifications/generate?${params.toString()}`, {
        method: "POST",
        data: formData,
        // Ten 50 MB documents is a slow upload on a bad connection. Reporting
        // real byte progress beats a spinner that cannot say whether anything
        // is moving.
        onUploadProgress,
    })
}

/**
 * Queues an AI run that ADDS to an existing certification.
 *
 * Distinct from `addCertificationWithAi` and from the replace path: nothing is
 * deleted, and the planner is given the current curriculum and asked only for
 * what these documents add. A major category whose name already exists is
 * matched rather than duplicated, so new lessons can be attached under it.
 *
 * Use when a domain was missed -- a handbook that failed to upload, a syllabus
 * that grew -- rather than rebuilding a certification whose lessons, questions
 * and assessments are already correct.
 */
export async function appendToCertificationWithAi(
    certificationId,
    files,
    {
        additionalInstructions = "",
        reviewMode = "guided",
        questionTypes = [],
        onUploadProgress,
    } = {}
) {
    const formData = new FormData()

    ;(files ?? []).forEach((file) => {
        formData.append("files", file)
    })

    const params = new URLSearchParams({ reviewMode })
    if (additionalInstructions.trim()) {
        params.set("additionalInstructions", additionalInstructions.trim())
    }
    // Repeated key, not a comma-joined string: Spring binds List<String> from
    // repeated params, and a joined one would arrive as a single malformed
    // entry that the consumer then discards as unrecognised.
    questionTypes.forEach((type) => params.append("questionTypes", type))

    return await base(
        `certifications/${certificationId}/generate/append?${params.toString()}`,
        { method: "POST", data: formData, onUploadProgress }
    )
}