import { base } from "./base.js"

/**
 * The pop-up knowledge check served while a learner reads a lesson.
 *
 * Both calls are learner-scoped and resolve the learner from the JWT, so
 * nothing about who is being checked is sent from the browser -- only which
 * lesson they were reading when it fired.
 */

/**
 * Pre-flight. Returns `{ available, reason, itemCount, lessonNames }` without
 * minting anything, so the page can decide whether to interrupt before it
 * commits to showing a modal it might then have to take away.
 *
 * `reason` is "cooldown" when one was served recently, or
 * "not-enough-completed-lessons" when the learner has not finished enough
 * material to be tested on yet.
 */
export function getKnowledgeCheckOffer(lessonId) {
  return base(`learners/me/knowledge-checks/offer?lessonId=${lessonId}`)
}

/**
 * Mints the check and returns `{ examId, itemCount, lessonNames }`.
 *
 * The five questions themselves never come back through here -- the check is
 * sat on the ordinary attempt runner at `/learner/assessments/:examId`, which
 * is the only place in the product that knows how to render and grade all five
 * question types.
 */
export function createKnowledgeCheck(lessonId) {
  return base("learners/me/knowledge-checks", {
    method: "POST",
    data: { lessonId: Number(lessonId) },
  })
}
