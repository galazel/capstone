/**
 * One rulebook and one payload shape for editing a certification.
 *
 * The edit drawer used to own both. It is no longer the only editor -- the
 * certification page renames its own headings, categories and lessons in place
 * -- and two editors writing the same row through two different payload
 * builders is how a rename starts wiping fields the other one remembered to
 * send. Both import from here.
 */

import { mapCertificationToModuleStructure } from "@/utils/certification-structure"

export const MIN_TITLE_LENGTH = 3
export const MAX_TITLE_LENGTH = 150

export const MIN_DESCRIPTION_LENGTH = 20
export const MAX_DESCRIPTION_LENGTH = 2000

/* Placeholders a select can hand back looking like a real answer. */
export const INVALID_INDUSTRY_VALUES = new Set([
  "",
  "all",
  "none",
  "select",
  "select industry",
  "undefined",
  "null",
])

/** The shape Spring's LocalDateTime binder accepts -- no zone, no Z. */
export function formatLocalDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0")

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

export function hasMeaningfulText(value) {
  return /[\p{L}\p{N}]/u.test(value)
}

/** @returns an error string, or "" when the value is acceptable. */
export function validateCertificationTitle(value) {
  const title = normalizeText(value)

  if (!title) return "Certification name is required."
  if (title.length < MIN_TITLE_LENGTH)
    return `Certification name must be at least ${MIN_TITLE_LENGTH} characters.`
  if (title.length > MAX_TITLE_LENGTH)
    return `Certification name must not exceed ${MAX_TITLE_LENGTH} characters.`
  if (!hasMeaningfulText(title))
    return "Certification name must contain letters or numbers, not symbols only."

  return ""
}

export function validateCertificationDescription(value) {
  const description = normalizeText(value)

  if (!description) return "Description is required."
  if (description.length < MIN_DESCRIPTION_LENGTH)
    return `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`
  if (description.length > MAX_DESCRIPTION_LENGTH)
    return `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`
  if (!hasMeaningfulText(description))
    return "Description must contain meaningful text, not symbols only."

  return ""
}

export function validateCertificationIndustry(value) {
  const industry = normalizeText(value)

  if (INVALID_INDUSTRY_VALUES.has(industry.toLowerCase()))
    return "Please select an industry."
  if (industry.length > 100) return "Industry must not exceed 100 characters."

  return ""
}

/** A category or lesson name. The tree rejects blanks; nothing else. */
export function validateStructureName(value, label = "Name") {
  const name = normalizeText(value)

  if (!name) return `${label} is required.`
  if (name.length > MAX_TITLE_LENGTH)
    return `${label} must not exceed ${MAX_TITLE_LENGTH} characters.`
  if (!hasMeaningfulText(name))
    return `${label} must contain letters or numbers, not symbols only.`

  return ""
}

export function validateCertificationDetails(details) {
  const errors = {}

  const title = validateCertificationTitle(details?.title)
  const description = validateCertificationDescription(details?.description)
  const industry = validateCertificationIndustry(details?.industry)

  if (title) errors.title = title
  if (description) errors.description = description
  if (industry) errors.industry = industry

  return errors
}

/**
 * The category tree as `PUT /certifications/{id}` wants it.
 *
 * Ids are kept so the server updates rows rather than replacing them, and
 * `lessonComponentStructure` is carried through untouched: the endpoint
 * rebuilds the whole tree from what it is sent, and a lesson sent without its
 * content is a lesson whose content is gone.
 */
export function toCategoryPayload(certification) {
  return mapCertificationToModuleStructure(certification).map((major) => {
    const majorPayload = {
      title: normalizeText(major.title),

      middleCategory: (major.middleCategories ?? []).map((middle) => {
        const middlePayload = {
          title: normalizeText(middle.title),

          lessons: (middle.lessons ?? []).map((lesson) => {
            const lessonPayload = {
              name: normalizeText(lesson.name),
              lessonComponentStructure: lesson.lessonComponentStructure ?? "[]",
            }

            if (lesson.lessonId != null) lessonPayload.lessonId = lesson.lessonId

            return lessonPayload
          }),
        }

        if (middle.middleCategoryId != null)
          middlePayload.middleCategoryId = middle.middleCategoryId

        return middlePayload
      }),
    }

    if (major.majorCategoryId != null)
      majorPayload.majorCategoryId = major.majorCategoryId

    return majorPayload
  })
}

/**
 * The whole body for an update, built from the certification as the client
 * holds it. Pass the already-edited object -- this does not merge changes, it
 * serialises what it is given.
 */
export function toCertificationUpdatePayload(certification) {
  return {
    certificationId: certification.certificationId ?? certification.id,
    title: normalizeText(certification.title),
    description: String(certification.description ?? "").trim(),
    industry: normalizeText(certification.industry),
    dateCreated: certification.dateCreated ?? formatLocalDateTime(),
    dateUpdated: formatLocalDateTime(),
    majorCategory: toCategoryPayload(certification),
  }
}
