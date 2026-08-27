import { base } from "./base"

/**
 * The study plan's Spaced Repetition session.
 *
 * The learner's memory state lives server-side — which cards are due, and the
 * interval and ease behind each. The browser only reports how well a card was
 * recalled; when it comes back is decided by the scheduler, not here.
 */

/**
 * The cards due now.
 *
 * A POST rather than a GET because a short session tops itself up from the
 * learner's answering history, which creates review items — it writes.
 *
 * Returns `{ cards, dueCount, seeded }`: `dueCount` is the true size of the
 * backlog (which can exceed the session), and `seeded` says whether fresh
 * material was pulled in to fill the session out.
 */
export function getDueReviewCards({ certificationId, lessonId, size }) {
  return base("review-sessions/due", {
    method: "POST",
    data: { certificationId, lessonId, size },
  })
}

/**
 * Records how well a card was recalled.
 *
 * @param grade one of AGAIN, HARD, GOOD, EASY — SM-2's quality scale, as the
 *   flashcard player already collects it.
 */
export function gradeReviewCard({ questionId, grade }) {
  return base(`review-sessions/items/${questionId}/grade`, {
    method: "PUT",
    data: { grade },
  })
}

export const REVIEW_GRADES = [
  { id: "AGAIN", label: "Again", hint: "Forgot it" },
  { id: "HARD", label: "Hard", hint: "Struggled" },
  { id: "GOOD", label: "Good", hint: "Recalled it" },
  { id: "EASY", label: "Easy", hint: "Instant" },
]
