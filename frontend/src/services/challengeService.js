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

// ---------------------------------------------------------------------------
// Arenas. An arena's problems are a CHALLENGE exam, so configuring one is
// admin work and running one is an ordinary attempt.
// ---------------------------------------------------------------------------

export const CHALLENGE_ARENAS_KEY = "challenge-arenas"

/**
 * Every arena and whether it is ready to run.
 *
 * `configured` is what the learner's cards lock against: an arena with no
 * problems opens onto nothing, and finding that out after clicking in is worse
 * than being told on the card.
 */
export async function getChallengeArenas() {
  return base("challenge-arenas")
}

/**
 * Replaces an arena's problem set (admin).
 *
 * The questions are saved to the bank first, through the same endpoints the
 * question bank uses -- this only records which of them the arena runs.
 */
export async function saveArenaProblems(arenaId, { certificationId, timeLimitMinutes, problems }) {
  return base(`challenge-arenas/${arenaId}/problems`, {
    method: "PUT",
    data: { certificationId, timeLimitMinutes, problems },
  })
}

/** Empties an arena, locking it again for learners (admin). */
export async function clearArenaProblems(arenaId) {
  return base(`challenge-arenas/${arenaId}/problems`, { method: "DELETE" })
}

/** Replaces the industries allowed into an arena (admin). */
export async function saveArenaIndustries(arenaId, industries) {
  return base(`challenge-arenas/${arenaId}/industries`, {
    method: "PUT",
    data: { industries },
  })
}
