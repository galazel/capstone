import { base } from "./base"

/**
 * Learning statistics for the caller's own organization.
 *
 * The institution is resolved from the JWT server-side, so no institutionId is
 * ever sent from the browser and a manager cannot read another tenant's roster.
 *
 * Shape: { summary, members: [{ learnerId, name, averageProgress,
 * lessonsCompleted, gradedAttempts, passRate, averageScore, lastActivityAt }] }
 */
export function getInstitutionLearningStats() {
  return base("institution/me/learning-stats")
}

/**
 * Completion per learning group for the caller's own organization.
 *
 * Shape: [{ institutionGroupId, groupName, learners, averageProgress,
 * completedLearners }] — one row per active group with active assignees.
 */
export function getInstitutionGroupStats() {
  return base("institution/me/group-stats")
}
