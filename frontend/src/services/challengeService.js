import { base } from "./base.js"

/**
 * The challenge leaderboard, ranked and named server-side.
 *
 * Replaces `getChallengeGamificationData`, which fetched every challenge
 * session on the platform plus every learner record just to render ten rows --
 * and, when the learner list refused the request, left the page showing
 * invented names. Each row is already ranked, already named, and already knows
 * whether it is the caller.
 */
export async function getChallengeLeaderboard(limit = 10) {
  const rows = await base(`challenges/leaderboard?limit=${limit}`)
  return Array.isArray(rows) ? rows : []
}

/** The caller's own rank, totals, streak and recent sessions. */
export async function getMyChallengeRecord() {
  return base("challenges/me/record")
}
