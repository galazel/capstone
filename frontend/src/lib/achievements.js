import examReady from "@/assets/exam-ready.png"
import finisher from "@/assets/finisher.png"
import firstPerfectScore from "@/assets/first-perfect-score.png"
import firstQuiz from "@/assets/first-quiz.png"
import firstStep from "@/assets/first-step.png"
import knowledgeSeeker from "@/assets/knowledge-seeker.png"
import rebyuLegend from "@/assets/rebyu-legend.png"
import topAchiever from "@/assets/top-achiever.png"

/**
 * Badge artwork, keyed by the backend's `AchievementCatalog` slug.
 *
 * The images ship with the client rather than living behind a storage key,
 * which is why the achievement row carries no `image_key`: eight small PNGs
 * bundled here cost one build-time import each and can never 404 the way a
 * stale S3 key does. The slug is the contract -- `FIRST_PERFECT_SCORE` ->
 * `first-perfect-score` -> `first-perfect-score.png`.
 */
const BADGES = {
  "first-step": firstStep,
  "first-quiz": firstQuiz,
  "first-perfect-score": firstPerfectScore,
  "exam-ready": examReady,
  "knowledge-seeker": knowledgeSeeker,
  finisher,
  "top-achiever": topAchiever,
  "rebyu-legend": rebyuLegend,
}

/** `First Perfect Score` / `FIRST_PERFECT_SCORE` -> `first-perfect-score`. */
function toSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
}

/**
 * The badge image for an achievement, whichever shape it arrives in. Rows from
 * `/api/learner-achievements/me` carry `slug`; anything older only has a title,
 * so the title is slugified as a fallback rather than falling through to a
 * generic icon.
 */
export function achievementBadge(achievement) {
  const key = toSlug(achievement?.slug ?? achievement?.code ?? achievement?.title)
  return BADGES[key] ?? null
}

/** Stable identity for one achievement across renders and cache snapshots. */
export function achievementKey(achievement) {
  return (
    achievement?.code ??
    toSlug(achievement?.slug ?? achievement?.title) ??
    String(achievement?.achievementId ?? "")
  )
}

/** The codes the learner has already unlocked, for diffing before/after a completion. */
export function earnedAchievementKeys(achievements) {
  return new Set(
    (Array.isArray(achievements) ? achievements : [])
      .filter((achievement) => achievement?.earned)
      .map(achievementKey)
  )
}
