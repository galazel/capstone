import { base, API } from "./base.js"

export function saveFile(lessonId, sectionName, toolId, folderName, file) {
  const formData = new FormData()

  formData.append("lessonId", lessonId)
  formData.append("sectionName", sectionName)
  formData.append("toolId", toolId)
  formData.append("folderName", folderName)
  formData.append("file", file)

  return base("files/upload", {
    method: "POST",
    data: formData,
  })
}

export function savePhotoCertification(file) {
  const formData = new FormData()

  formData.append("file", file)

  return base("files/upload/certification", {
    method: "POST",
    data: formData,
  })
}

export function getFileViewUrl(key) {
  return `${API}/files/view?key=${encodeURIComponent(key)}`
}

/**
 * Fetches a stored file as a Blob, for callers that need to *render* it.
 *
 * `/files/view` and `/files/download` both call requireAuth, and a browser
 * attaches no Authorization header to an <iframe src>, <img src> or <a href> --
 * so those URLs cannot load a protected file however correct they look. Going
 * through base() sends the bearer token; wrap the result in URL.createObjectURL
 * and point the element at that instead (and revoke it when done).
 */
export function fetchFileBlob(key) {
  return base(`files/view?key=${encodeURIComponent(key)}`, { responseType: "blob" })
}

export function getFileDownloadUrl(key) {
  return `${API}/files/download?key=${encodeURIComponent(key)}`
}
