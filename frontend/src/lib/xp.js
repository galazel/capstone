/**
 * The XP awards the backend pays for one-off milestones.
 *
 * These mirror `LearnerCompletedLessonService.LESSON_COMPLETION_XP` and the
 * assessment tiers in `AssessmentAttemptService`. They are display-only: the
 * server is authoritative and awards from the reward ledger, so a value that
 * drifts from the backend's misreports the reward, it does not change it.
 * Keep the two in step when either side changes.
 */
export const LESSON_COMPLETION_XP = 100

/**
 * Assessment XP is outcome-based, not flat: finishing pays 30, passing pays
 * 100, and a perfect score pays 200. The backend tops these up across
 * retakes, so a learner's total always reflects their best result.
 */
export const ASSESSMENT_XP = {
  attempted: 30,
  passed: 100,
  perfect: 200,
}

/** What an unattempted assessment can be advertised as being worth. */
export const ASSESSMENT_MAX_XP = ASSESSMENT_XP.perfect
