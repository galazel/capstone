import { base } from "./base"

/**
 * Admin endpoint: retrieve all learners across all institutions.
 * Learners read their own record via /api/learners/me/portal.
 */
export const getAllLearners = () => base("learners")

/**
 * Admin endpoint: erase a learner and everything of theirs -- enrolments,
 * attempts, achievements, posts, uploaded files, BKT mastery, the user account
 * and its Cognito sign-in. See AccountDeletionService on the backend; there is
 * no undo.
 */
export const deleteLearner = (learnerId) =>
  base(`learners/${learnerId}`, { method: "DELETE" })
