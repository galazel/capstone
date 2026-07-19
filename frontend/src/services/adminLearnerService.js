import { base } from "./base"

/**
 * Admin endpoint: retrieve all learners across all enterprises.
 * Learners read their own record via /api/learners/me/portal.
 */
export const getAllLearners = () => base("learners")
