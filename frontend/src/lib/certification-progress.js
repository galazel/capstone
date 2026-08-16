/**
 * How far through a certification a learner is, as one number.
 *
 * One formula, one home. The analytics board computed this from its own counts
 * while the My Learning cards divided completed lessons by total lessons in
 * their own `useMemo` -- so the same learner, on the same day, was 100% done on
 * the cards and 20% done on the board, because the cards did not know the
 * quizzes and exams existed.
 *
 * Lessons read, quizzes passed and exams passed are each one unit, and the
 * result is the share of those units done. Weighted evenly on purpose: a lesson
 * and a mock exam are obviously not the same amount of work, but any other
 * weighting would have to be invented here -- nothing in the payload says what
 * an assessment is worth relative to a lesson -- and an invented weight that
 * makes the bar move faster or slower than the work is worse than an even one
 * the learner can predict.
 *
 * Each side is clamped before it is added, so a stale count (more passes
 * recorded than assessments currently published, which happens when an exam is
 * unpublished after being passed) cannot push the bar past 100%.
 *
 * The counts themselves come from the server, which owns the harder question of
 * what counts -- official curriculum only, published, no tutor practice sets,
 * no diagnostic (see ProgressAnalyticsService.progressFor).
 */
export function certificationProgressPercent({
  completedLessons = 0,
  totalLessons = 0,
  passedAssessments = 0,
  totalAssessments = 0,
} = {}) {
  const lessonUnits = Math.max(0, totalLessons)
  const assessmentUnits = Math.max(0, totalAssessments)
  const totalUnits = lessonUnits + assessmentUnits

  if (totalUnits === 0) return 0

  const doneUnits =
    Math.min(Math.max(0, completedLessons), lessonUnits) +
    Math.min(Math.max(0, passedAssessments), assessmentUnits)

  return Math.round((doneUnits / totalUnits) * 100)
}

/**
 * The server's progress row for one certification, or null.
 *
 * Null rather than a zeroed row on purpose: "no row" means the portal has not
 * counted this certification (it is not an active enrollment), which is not the
 * same claim as "nothing done", and a caller showing 0% for it would be stating
 * something the payload never said.
 */
export function findCertificationProgress(rows, certificationId) {
  if (!Array.isArray(rows) || certificationId == null) return null
  return (
    rows.find((row) => String(row.certificationId) === String(certificationId)) ?? null
  )
}
