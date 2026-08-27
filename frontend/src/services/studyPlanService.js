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

/**
 * The active overall plan -- the one spanning several certifications -- or null.
 *
 * Distinct from calling the above with no argument, which returns the most
 * recent plan of any scope: a learner whose newest plan belongs to a single
 * certification would get that one back instead.
 */
export function getOverallStudyPlan() {
  return base("study-plans/me/active?scope=overall")
}

/**
 * Every plan the learner has, newest first, whatever its scope or status.
 *
 * The study calendar reads this rather than one "active" plan: a learner can be
 * following a plan per certification and an overall plan at once, and asking for
 * a single active plan shows one of them and silently drops the rest.
 */
export function getMyStudyPlans() {
  return base("study-plans/my-plans")
}

/** Saves a generated plan, retiring whatever was active for that certification. */
export function saveStudyPlan({ certificationId, goal, schedule }) {
  return base("study-plans", {
    method: "POST",
    data: { certificationId, goal, schedule },
  })
}

/**
 * What has become of each scheduled task, across every plan.
 *
 * All plans in one call: the scheduler watches them all at once, so per-plan
 * fetching would be a request per plan on every page load.
 */
export function getStudyPlanTaskStatuses() {
  return base("study-plans/me/tasks")
}

/** Records a task as started, finished, or passed over. */
export function setStudyPlanTaskStatus({ planId, eventId, status }) {
  return base(`study-plans/${planId}/tasks/${encodeURIComponent(eventId)}/status`, {
    method: "PUT",
    data: { status },
  })
}

export const STUDY_PLAN_QUERY_KEY = "learner-study-plan"

/** Task statuses are cached apart from the plans themselves; they change far more often. */
export const STUDY_PLAN_TASKS_QUERY_KEY = "learner-study-plan-tasks"
