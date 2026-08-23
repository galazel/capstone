import { base } from "./base"

/**
 * Learning statistics for the caller's own organization.
 *
 * The enterprise is resolved from the JWT server-side, so no enterpriseId is
 * ever sent from the browser and a manager cannot read another tenant's roster.
 *
 * Shape: { summary, members: [{ learnerId, name, averageProgress,
 * lessonsCompleted, gradedAttempts, passRate, averageScore, lastActivityAt }] }
 */
export function getEnterpriseLearningStats() {
  return base("enterprise/me/learning-stats")
}

/**
 * Completion per learning group for the caller's own organization.
 *
 * Shape: [{ enterpriseGroupId, groupName, learners, averageProgress,
 * completedLearners }] — one row per active group with active assignees.
 */
export function getEnterpriseGroupStats() {
  return base("enterprise/me/group-stats")
}
