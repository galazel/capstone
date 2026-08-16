import { base } from "./base"

/**
 * The learner's study notes for one certification. The learner is resolved from
 * the JWT server-side, so no learnerId is ever sent from the browser.
 *
 * The exam countdown beside these on the analytics page reads the study plan's
 * target exam date instead of anything here -- that date has one home.
 */

export const STUDY_DESK_NOTES_KEY = "learner-study-notes"
export const DASHBOARD_LAYOUT_KEY = "learner-dashboard-layout"

/**
 * The learner's analytics board: `[{ id, col, row }]` — where each tile sits in
 * the order and how many grid columns and rows it takes. An empty list means
 * "use the page defaults".
 */
export function getDashboardLayout() {
  return base("study-desk/dashboard-layout")
}

export function saveDashboardLayout(tiles) {
  return base("study-desk/dashboard-layout", { method: "PUT", data: { tiles } })
}

export function getNotes(certificationId) {
  return base(`study-desk/notes?certificationId=${certificationId}`)
}

export function addNote(certificationId, body) {
  return base(`study-desk/notes?certificationId=${certificationId}`, {
    method: "POST",
    data: { body },
  })
}

/** Tick/untick, or edit the text. Omitted fields are left alone server-side. */
export function updateNote(noteId, changes) {
  return base(`study-desk/notes/${noteId}`, { method: "PATCH", data: changes })
}

export function deleteNote(noteId) {
  return base(`study-desk/notes/${noteId}`, { method: "DELETE" })
}

/** Clears the whole list, or only the ticked notes when `completedOnly`. */
export function clearNotes(certificationId, completedOnly = false) {
  return base(
    `study-desk/notes?certificationId=${certificationId}&completedOnly=${completedOnly}`,
    { method: "DELETE" }
  )
}
