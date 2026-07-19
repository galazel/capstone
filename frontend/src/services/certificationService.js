import { base } from "./base"

// Omit includeGroupId for the official curriculum only (what every existing
// caller does). Pass a group id to also mix in that group's own
// Enterprise-Member-authored content -- the caller must be able to act on
// that group (its leader, or the institution owner), enforced server-side.
export async function getAllCertifications(includeGroupId) {
    const query = includeGroupId != null ? `?includeGroupId=${includeGroupId}` : ""
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




export async function generateCertificationStructure(certificationId, files) {
    const formData = new FormData()

    formData.append("certificationId", String(certificationId))

    files.forEach((file) => {
        formData.append("files", file)
    })

    return await base("ai/curriculum/generate", {
        method: "POST",
        data: formData,
    })
}

export async function addCertificationWithAi(data, files) {
    const formData = new FormData()

    formData.append(
        "data",
        new Blob([JSON.stringify(data)], { type: "application/json" })
    )

    files.forEach((file) => {
        formData.append("files", file)
    })

    return await base("certifications/generate", {
        method: "POST",
        data: formData,
    })
}