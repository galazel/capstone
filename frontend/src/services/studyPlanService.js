import { base } from "./base"

/**
 * The signed-in learner's study plan. The learner is always resolved from the
 * JWT server-side, so no learnerId is ever sent from the browser.
 *
 * The schedule is generated in the browser (the generator turns the diagnostic
 * priorities, the exam date, and the chosen study days into dated events) and
 * stored here whole -- which is what makes it survive a reload and lets the
 * calendar page show it.
 */

/** The plan being followed, or null. Omit certificationId for the latest overall. */
export function getActiveStudyPlan(certificationId) {
  return base(
    certificationId
      ? `study-plans/me/active?certificationId=${certificationId}`
      : "study-plans/me/active"
  )
}

/** Saves a generated plan, retiring whatever was active for that certification. */
export function saveStudyPlan({ certificationId, goal, schedule }) {
  return base("study-plans", {
    method: "POST",
    data: { certificationId, goal, schedule },
  })
}

export const STUDY_PLAN_QUERY_KEY = "learner-study-plan"
