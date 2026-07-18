import { base } from "./base"

export const getLibraryItems = () => base("learner-tools/library")
export const addLibraryItem = (payload) => base("learner-tools/library", { method: "POST", data: payload })
export const deleteLibraryItem = (id) => base(`learner-tools/library/${id}`, { method: "DELETE" })
export const getMistakes = () => base("learner-tools/mistakes")
export const setMistakeReviewed = (questionId, reviewed = true) => base(`learner-tools/mistakes/${questionId}/reviewed`, { method: "PUT", data: { reviewed } })
export const generateStudyAid = (type, lessonName, lessonId) => base("learner-tools/library/generate", { method: "POST", data: { type, lessonName, lessonId, requestId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` } })

/** Uploads a real file for a "file"-type library item; returns { resourceUrl: s3Key }. */
export async function uploadLibraryFile(file) {
  const formData = new FormData()
  formData.append("file", file)
  return base("learner-tools/library/upload", { method: "POST", data: formData })
}
