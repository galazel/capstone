import { base } from "./base"

// Kept for existing importers.
export {
  getLearnerPortalData,
  readLearnerPortalSnapshot,
  writeLearnerPortalSnapshot,
} from "./learnerService.js"

/**
 * Certification-scoped progress analytics for the authenticated learner.
 * The learner is always resolved server-side from the JWT -- no learnerId
 * is ever sent from the browser.
 */
export async function getProgressAnalytics(certificationId) {
  return base(`learners/me/certifications/${certificationId}/progress-analytics`)
}

/**
 * Query-string parameter carrying the certification the analytics board is
 * showing. Read by the learner shell before its own portal request resolves,
 * so the board's data can be fetched in parallel with it rather than after.
 */
export const PROGRESS_ANALYTICS_PARAM = "certification"

/**
 * Set to "1" to open the study-plan generator on arrival.
 *
 * The analytics board is the one place a plan is built, so everywhere that
 * offers to build one links here with this parameter rather than owning its
 * own copy of the flow.
 */
export const NEW_STUDY_PLAN_PARAM = "plan"

/**
 * The one definition of the analytics query key.
 *
 * <p>Shared because the shell prefetches under this key and the board reads
 * under it, and React Query only joins the two into a single request when the
 * keys match exactly -- if these ever drifted apart the prefetch would silently
 * become a second, wasted request instead of a head start.
 */
export function progressAnalyticsQueryKey(certificationId) {
  return ["learner-progress-analytics", certificationId]
}

/** How long an analytics response stays fresh, for both readers above. */
export const PROGRESS_ANALYTICS_STALE_TIME = 30_000

// ---------------------------------------------------------------------------
// BKT analytics. The browser only ever calls Spring Boot; Spring Boot proxies
// the internal FastAPI BKT service.
// ---------------------------------------------------------------------------

/** All lesson mastery for a learner, optionally filtered to specific lessons. */
export async function getLearnerMastery(learnerId, lessonIds) {
  const params = new URLSearchParams({ learnerId: String(learnerId) })
  for (const lessonId of lessonIds ?? []) {
    params.append("lessonId", String(lessonId))
  }
  return base(`learner/analytics/mastery?${params.toString()}`)
}

/** Lesson → middle → major priority hierarchy for a certification. */
export async function getCertificationPriorities(learnerId, certificationId) {
  return base(
    `learner/analytics/priorities/certifications/${certificationId}?learnerId=${learnerId}`
  )
}

/** Certification confidence summary. */
export async function getCertificationConfidence(learnerId, certificationId) {
  return base(
    `learner/analytics/confidence/certifications/${certificationId}?learnerId=${learnerId}`
  )
}

/** Weighted certification readiness. */
export async function getReadiness(payload) {
  return base("learner/analytics/readiness", { method: "POST", data: payload })
}

/** Get mastery history for a learner-certification pair. */
export async function getMasteryHistory(certificationId) {
  return base(`bkt/me/history/${certificationId}`)
}

/** Get mastery for current learner (JWT-derived). */
export async function getMyMastery(lessonIds) {
  const params = new URLSearchParams()
  if (lessonIds?.length) {
    for (const lessonId of lessonIds) {
      params.append("lessonId", String(lessonId))
    }
    return base(`bkt/me/mastery?${params.toString()}`)
  }
  return base("bkt/me/mastery")
}

/** Get priorities for current learner. */
export async function getMyPriorities(certificationId) {
  return base(`bkt/me/lessons/${certificationId}`)
}

/** Get confidence for current learner. */
export async function getMyConfidence(certificationId) {
  return base(`bkt/me/confidence/${certificationId}`)
}

// ---------------------------------------------------------------------------
// Shared priority-tag presentation metadata. Text labels are always shown, so
// meaning never depends on color alone (accessibility).
// ---------------------------------------------------------------------------

export const PRIORITY_META = {
  CRITICAL_PRIORITY: { label: "Critical Priority", tone: "critical", rank: 7 },
  HIGH_PRIORITY: { label: "High Priority", tone: "high", rank: 6 },
  MEDIUM_PRIORITY: { label: "Medium Priority", tone: "medium", rank: 5 },
  LOW_PRIORITY: { label: "Low Priority", tone: "low", rank: 4 },
  NEEDS_REASSESSMENT: { label: "Needs Reassessment", tone: "reassess", rank: 3 },
  NOT_ENOUGH_DATA: { label: "Not Enough Data", tone: "muted", rank: 2 },
  ON_TRACK: { label: "On Track", tone: "ontrack", rank: 1 },
  STRONG: { label: "Strong Area", tone: "strong", rank: 0 },
}

/** Default learner ordering: most urgent first. */
export function comparePriority(a, b) {
  const ra = PRIORITY_META[a?.priorityTag]?.rank ?? -1
  const rb = PRIORITY_META[b?.priorityTag]?.rank ?? -1
  if (ra !== rb) return rb - ra
  return (b?.priorityScore ?? 0) - (a?.priorityScore ?? 0)
}

/** Flattens the hierarchy response into a single ranked list of areas. */
export function flattenPriorityAreas(hierarchy) {
  const areas = []
  for (const major of hierarchy?.majorCategories ?? []) {
    areas.push({
      categoryType: "MAJOR",
      categoryId: major.majorCategoryId,
      title: major.title,
      priorityTag: major.priorityTag,
      priorityScore: major.priorityScore,
      primaryReason: major.primaryReason,
    })
    for (const middle of major.middleCategories ?? []) {
      areas.push({
        categoryType: "MIDDLE",
        categoryId: middle.middleCategoryId,
        title: middle.title,
        priorityTag: middle.priorityTag,
        priorityScore: middle.priorityScore,
        primaryReason: middle.primaryReason,
      })
      for (const lesson of middle.lessons ?? []) {
        areas.push({
          categoryType: "LESSON",
          categoryId: lesson.lessonId,
          title: lesson.lessonTitle,
          priorityTag: lesson.priorityTag,
          priorityScore: lesson.priorityScore,
          primaryReason: lesson.primaryReason,
          masteryProbability: lesson.masteryProbability,
          recommendedAction: lesson.recommendedAction,
        })
      }
    }
  }
  return areas
}
