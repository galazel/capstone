import { base } from "./base"

export const DEFAULT_GENERATION_TARGET = 100

// Pass ownerGroupId to author a question that belongs to one Institution group
// (only that group sees/uses it). Omit it for official, platform-wide questions.
export async function saveQuestion(question, ownerGroupId) {
    const query = ownerGroupId != null ? `?ownerGroupId=${ownerGroupId}` : ""
    return await base(`questions${query}`, {
        method: "POST",
        data: question,
    })
}

export async function updateQuestion(questionId, question) {
    return await base(`questions/${questionId}`, {
        method: "PUT",
        data: question,
    })
}

export async function deleteQuestion(questionId) {
    return await base(`questions/${questionId}`, {
        method: "DELETE",
    })
}

export async function getQuestionsByLesson(lessonId, includeGroupId) {
    const group = includeGroupId != null ? `&includeGroupId=${includeGroupId}` : ""
    return await base(`questions?lessonId=${lessonId}${group}`, {
        method: "GET",
    })
}

// Omit includeGroupId for official questions only (what every existing caller
// does). Pass a group id to also include that group's own questions -- the
// caller must be able to act on that group, enforced server-side.
//
// certificationId narrows the read to one certification's lessons. Omitted,
// this is the whole-bank read every existing caller makes; passed, the server
// does the narrowing the caller would otherwise do over every question on the
// platform.
export async function getQuestions(includeGroupId, certificationId) {
    const params = new URLSearchParams()
    if (includeGroupId != null) params.set("includeGroupId", includeGroupId)
    if (certificationId != null) params.set("certificationId", certificationId)
    const query = params.toString()
    return await base(`questions${query ? `?${query}` : ""}`, {
        method: "GET",
    })
}

/**
 * Scope-derived eligible questions for an assessment, excluding any already
 * assigned to `examId`. Pass only the scope ids relevant to the assessment
 * type (lesson > middle > major > certification); the backend resolves scope.
 */
export async function getEligibleQuestions({
    certificationId,
    majorId,
    middleId,
    lessonId,
    examId,
    includeGroupId,
} = {}) {
    const params = new URLSearchParams()
    if (certificationId != null) params.set("certificationId", certificationId)
    if (majorId != null) params.set("majorId", majorId)
    if (middleId != null) params.set("middleId", middleId)
    if (lessonId != null) params.set("lessonId", lessonId)
    if (examId != null) params.set("examId", examId)
    if (includeGroupId != null) params.set("includeGroupId", includeGroupId)
    return await base(`questions/eligible?${params.toString()}`, { method: "GET" })
}

/**
 * Generates editable question drafts (never saved automatically).
 * Returns { questions, analysis, warnings }.
 *
 * Options:
 * - sourceMode: CERTIFICATION_KNOWLEDGE | UPLOADED_FILES | COMBINED
 *   (omitted → the backend resolves a sensible default)
 * - questionCounts: legacy explicit per-type counts; when omitted the AI
 *   chooses suitable question types from the grounded source material.
 * - targetQuestionCount: soft target when no explicit counts are given.
 */
export async function generateQuestionsFromFiles(
    certificationId,
    files,
    questionCounts,
    options = {}
) {
    const formData = new FormData()

    formData.append("certificationId", String(certificationId))

    if (questionCounts && typeof questionCounts === "object") {
        formData.append("questionCountsJson", JSON.stringify(questionCounts))
    }
    if (options.sourceMode) {
        formData.append("sourceMode", options.sourceMode)
    }
    if (options.targetQuestionCount) {
        formData.append(
            "targetQuestionCount",
            String(options.targetQuestionCount)
        )
    }
    if (options.additionalInstructions) {
        formData.append(
            "additionalInstructions",
            options.additionalInstructions
        )
    }

    ;(files ?? []).forEach((file) => {
        formData.append("files", file)
    })

    return await base("ai/questions/generate", {
        method: "POST",
        data: formData,
    })
}

export function generateQuestionDrafts({
    certificationId,
    sourceMode,
    files = [],
    targetQuestionCount,
    additionalInstructions,
}) {
    return generateQuestionsFromFiles(certificationId, files, null, {
        sourceMode,
        targetQuestionCount,
        additionalInstructions,
    })
}

export async function saveChoices(choices) {
    return await base("choices", {
        method: "POST",
        data: choices,
    })
}

export async function saveTextQuestion(textQuestion) {
    return await base("text-question-configs", {
        method: "POST",
        data: textQuestion,
    })
}

export async function saveDiagramQuestion(diagramQuestion) {
    return await base("diagram-question-configs", {
        method: "POST",
        data: diagramQuestion,
    })
}

export async function saveProgrammingQuestion(programmingQuestion) {
    return await base("programming-question-configs", {
        method: "POST",
        data: programmingQuestion,
    })
}
