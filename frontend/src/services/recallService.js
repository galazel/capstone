import { base } from "./base"

/**
 * The study plan's Active Recall session.
 *
 * The paper is assembled server-side from the learner's own mistakes and weak
 * lessons, so nothing about the selection is sent from the browser -- only
 * which certification it is for and, when the plan scheduled one, the topic to
 * prefer. The learner is resolved from the JWT.
 *
 * Returns `{ examId, title, certificationId, itemCount, basis }`, where `basis`
 * is "history" when the paper was built from real mistakes and mastery, and
 * "coverage" when the learner had no history to draw on yet.
 */
export function createRecallSession({ certificationId, lessonId, size }) {
  return base("recall-sessions", {
    method: "POST",
    data: { certificationId, lessonId, size },
  })
}
