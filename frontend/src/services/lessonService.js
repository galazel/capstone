import { base } from "./base.js"

export function setLessonComponent(id, lessonComponent) {
  return base(`lessons/lesson/${id}`, {
    method: "PUT",
    data: {
      lessonComponentStructure: JSON.stringify(lessonComponent),
    },
  })
}

export function getLessonComponent(id) {
  return base(`lessons/lesson/${id}`, {
    method: "GET",
  })
}

export async function getAllLessons(){
  return await base(`lessons`,{
    method: "GET",
  })
}

// ownerGroupId is resolved server-side from the lesson's ancestor
// MajorCategory -- this call itself only needs middleCategoryId.
export async function createLesson(data) {
  return await base("lessons", {
    method: "POST",
    data,
  })
}

export async function generateLessonFromFiles(lessonId, files) {
  const formData = new FormData()

  formData.append("lessonId", String(lessonId))

  files.forEach((file) => {
    formData.append("files", file)
  })

  return await base("ai/lessons/generate", {
    method: "POST",
    data: formData,
  })
}

