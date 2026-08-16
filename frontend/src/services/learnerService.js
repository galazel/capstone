import { base } from "./base.js"
import { getFileDownloadUrl, getFileViewUrl } from "./fileService.js"

export function getCurrentLearnerIdentity() {
  const read = (...keys) => {
    for (const key of keys) {
      const value = localStorage.getItem(key)
      if (value !== null && value !== undefined && value !== "") {
        return value
      }
    }
    return null
  }

  const learnerId = Number(read("learnerId", "learner_id"))
  const userId = Number(read("userId", "user_id"))

  return {
    learnerId: Number.isFinite(learnerId) ? learnerId : null,
    userId: Number.isFinite(userId) ? userId : null,
    role: read("role") ?? "",
    name: read("name", "fullName", "username") ?? "",
    email: read("email") ?? "",
  }
}

export function updateLearner(id, data) {
  return base(`learners/${id}`, {
    method: "PUT",
    data,
  })
}

export function updateUser(id, data) {
  return base(`users/${id}`, {
    method: "PUT",
    data,
  })
}

export function markLessonComplete(data) {
  return base("learner-completed-lessons", {
    method: "POST",
    data,
  })
}
/**
 * The signed-in learner's badge wall: the whole catalog, with the earned ones
 * flagged. Read-only by design -- achievements are decided and written
 * server-side as they are earned (see AchievementAwardService), so there is no
 * "award me this" call from the browser to make.
 */
export function getMyAchievements() {
  return base("learner-achievements/me")
}

// Section-level lesson-read progress for the signed-in learner (learnerId is
// resolved server-side from the JWT, so it survives a refresh).
export function getReadSections(lessonId) {
  return base(`learners/me/read-sections?lessonId=${encodeURIComponent(lessonId)}`)
}

export function markSectionRead(lessonId, sectionKey) {
  return base("learners/me/read-sections", {
    method: "POST",
    data: { lessonId: Number(lessonId), sectionKey },
  })
}

export function markSectionUnread(lessonId, sectionKey) {
  return base(`learners/me/read-sections/${lessonId}/${encodeURIComponent(sectionKey)}`, {
    method: "DELETE",
  })
}

export function getAllExams() {
  return base("exams")
}

// Tenant-scoped learner snapshot: the caller's own learner/user record, enrollments,
// completed lessons, activity logs, exam results, and org allocations (learnerId/userId
// resolved from the JWT). Replaces fetching global lists and filtering in the browser.
export function getLearnerPortalScoped() {
  return base("learners/me/portal")
}

// The caller's own learner record (JWT-derived) -- use instead of fetching all learners.
export function getCurrentLearner() {
  return base("learners/me")
}

export function getLessonById(id) {
  return base(`lessons/${id}`)
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isPublishedCertification(certification) {
  return String(certification?.status ?? "").toUpperCase() === "PUBLISHED"
}

function getCertificationLessons(certification) {
  return asArray(certification?.majorCategory).flatMap((major) =>
    asArray(major.middleCategory).flatMap((middle) =>
      asArray(middle.lessons).map((lesson) => ({
        ...lesson,
        certificationId: certification.certificationId,
        certificationTitle: certification.title,
        majorCategoryId: major.majorCategoryId,
        majorCategoryTitle: major.title,
        middleCategoryId: middle.middleCategoryId,
        middleCategoryTitle: middle.title,
      }))
    )
  )
}

export function flattenCertificationLessons(certifications = []) {
  return certifications.flatMap(getCertificationLessons)
}

export function getCertificationModules(certification) {
  return asArray(certification?.majorCategory).map((major) => ({
    ...major,
    middleCategory: asArray(major.middleCategory).map((middle) => ({
      ...middle,
      lessons: asArray(middle.lessons).map((lesson) => ({
        ...lesson,
        certificationId: certification.certificationId,
        certificationTitle: certification.title,
        majorCategoryId: major.majorCategoryId,
        majorCategoryTitle: major.title,
        middleCategoryId: middle.middleCategoryId,
        middleCategoryTitle: middle.title,
      })),
    })),
  }))
}

function isSameId(a, b) {
  return String(a ?? "") === String(b ?? "")
}

function completionKey(item) {
  return `${item.learnerId}:${item.lessonId}`
}

function getScoreNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function computeStudyStreak(activityLogs) {
  const days = new Set(
    activityLogs
      .map((log) => log.dateTime)
      .filter(Boolean)
      .map((date) => new Date(date).toISOString().slice(0, 10))
  )

  if (days.size === 0) {
    return null
  }

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export async function getLearnerPortalData() {
  const identity = getCurrentLearnerIdentity()

  // All learner-private data comes pre-scoped from the backend (learnerId/userId
  // resolved from the JWT); only the certification/exam catalogs are public.
  const [portal, certifications, exams] = await Promise.all([
    getLearnerPortalScoped(),
    base("certifications"),
    getAllExams(),
  ])

  const learnerCertifications = asArray(portal.learnerCertifications)
  const completedLessons = asArray(portal.completedLessons)
  const activityLogs = asArray(portal.activityLogs)
  const examResults = asArray(portal.examResults)
  const orgCertLearners = asArray(portal.orgCertLearners)
  const orgCertificates = asArray(portal.orgCertificates)

  // The learners table is authoritative. Never fall back to a stale legacy
  // localStorage value when no learner profile exists for the signed-in user.
  const learner = portal.learner ?? null
  const learnerId = learner?.learnerId ?? null
  const userId = learner?.userId ?? identity.userId
  const user = portal.user ?? null

  // Expired/revoked rows are not access. The backend only ever honours an
  // `active` enrollment, so counting the others here just produced UI that
  // offered a certification every scoped endpoint would then 404 on.
  const purchaseEnrollments = asArray(learnerCertifications).filter(
    (item) =>
      isSameId(item.learnerId, learnerId) &&
      String(item.status ?? "active").toLowerCase() === "active"
  )

  // Enterprise-assigned access: map this learner's active
  // organization_certification_learners rows to their certificationId via the
  // organization_certificates allocation, then treat them as enrollments.
  const orgCertIdToCertificationId = new Map(
    asArray(orgCertificates).map((orgCert) => [
      String(orgCert.orgCertId),
      orgCert.certificationId,
    ])
  )
  const enterpriseEnrollments = asArray(orgCertLearners)
    .filter(
      (item) =>
        isSameId(item.learnerId, learnerId) && item.status === "active"
    )
    .map((item) => ({
      certificationId: orgCertIdToCertificationId.get(String(item.orgCertId)),
      learnerId,
      status: "active",
      source: "enterprise",
      assignedAt: item.assignedAt,
    }))
    .filter((item) => item.certificationId != null)

  const enrollments = [...purchaseEnrollments, ...enterpriseEnrollments]

  const enrolledCertificationIds = new Set(
    enrollments.map((item) => String(item.certificationId))
  )

  const publishedCertifications = asArray(certifications).filter(
    isPublishedCertification
  )

  const enrolledCertifications = publishedCertifications.filter((certification) =>
    enrolledCertificationIds.has(String(certification.certificationId))
  )

  const lessonList = flattenCertificationLessons(publishedCertifications)
  const allLessons = lessonList

  const completedForLearner = asArray(completedLessons).filter((item) =>
    isSameId(item.learnerId, learnerId)
  )
  const completedSet = new Set(completedForLearner.map(completionKey))

  const activityLogsForUser = asArray(activityLogs).filter((item) =>
    isSameId(item.userId, userId)
  )

  const examById = new Map(asArray(exams).map((exam) => [String(exam.examId), exam]))
  const examResultsForLearner = asArray(examResults)
    .filter((item) => isSameId(item.learnerId, learnerId))
    .map((result) => {
      const exam = examById.get(String(result.examId))
      return {
        ...result,
        certificationId:
          result.certificationId ?? exam?.certificationId ?? exam?.certification?.certificationId,
        assessmentType:
          result.assessmentType ?? exam?.examTypeText ?? exam?.examType?.examTypeText,
        assessmentTitle: result.assessmentTitle ?? exam?.title,
      }
    })

  const lessonsWithProgress = lessonList.map((lesson) => {
    const complete = completedSet.has(`${learnerId}:${lesson.lessonId}`)

    return {
      ...lesson,
      completed: complete,
      status: complete ? "Completed" : "Not Started",
    }
  })

  const completedCount = lessonsWithProgress.filter((lesson) => lesson.completed).length
  const totalLessons = lessonsWithProgress.length
  const overallProgress =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : null

  const performancePoints = examResultsForLearner
    .map((result) => {
      const exam = examById.get(String(result.examId))
      return {
        id: `${result.examId}-${result.attemptNo}`,
        label: result.takenAt
          ? new Date(result.takenAt).toLocaleDateString()
          : `Attempt ${result.attemptNo}`,
        score: getScoreNumber(result.score),
        kind: exam?.title?.toLowerCase().includes("quiz") ? "Quiz" : "Exam",
        title: exam?.title ?? `Exam ${result.examId}`,
        takenAt: result.takenAt,
      }
    })
    .filter((point) => point.score !== null)
    .sort((a, b) => new Date(a.takenAt ?? 0) - new Date(b.takenAt ?? 0))

  const recentExamResults = performancePoints.slice(-5).reverse()

  const resources = []
  for (const certification of asArray(certifications)) {
    if (certification.imageKey) {
      resources.push({
        id: `cert-${certification.certificationId}`,
        name: `${certification.title} cover image`,
        key: certification.imageKey,
        type: "Image",
        certificationId: certification.certificationId,
        certificationTitle: certification.title,
        lessonTitle: "",
        viewUrl: getFileViewUrl(certification.imageKey),
        downloadUrl: getFileDownloadUrl(certification.imageKey),
      })
    }
  }

  for (const lesson of allLessons) {
    const parsed = parseLessonStructure(lesson.lessonComponentStructure)
    for (const section of parsed) {
      for (const tool of asArray(section.content)) {
        const key = tool?.data?.imageKey ?? tool?.data?.videoKey
        if (key) {
          resources.push({
            id: `${lesson.lessonId}-${tool.id}`,
            name: tool?.data?.title || tool?.type || key.split("/").pop(),
            key,
            type: tool?.data?.videoKey ? "Video" : "Image",
            certificationId: lesson.certificationId,
            certificationTitle: lesson.certificationTitle,
            lessonId: lesson.lessonId,
            lessonTitle: lesson.name,
            viewUrl: getFileViewUrl(key),
            downloadUrl: getFileDownloadUrl(key),
          })
        }
      }
    }
  }

  return {
    identity,
    learnerId,
    userId,
    learner,
    user,
    certifications: publishedCertifications,
    enrollments,
    enrolledCertifications,
    lessons: lessonsWithProgress,
    completedLessons: completedForLearner,
    activityLogs: activityLogsForUser,
    exams: asArray(exams),
    examResults: examResultsForLearner,
    performancePoints,
    recentExamResults,
    resources,
    // Server-authoritative gamification balances, passed straight through from
    // `learners/me/portal`. Dropping them here is why the header's XP counter
    // read 0 no matter how much XP the ledger had actually awarded.
    // The full achievement catalog with this learner's earned ones flagged.
    // Server-decided: the browser only ever reads it (and diffs it to notice a
    // new one), never writes it.
    achievements: asArray(portal.achievements),
    totalXp: Number(portal.totalXp) || 0,
    coinBalance: Number(portal.coinBalance) || 0,
    aiCreditsRemaining: Number(portal.aiCreditsRemaining) || 0,
    stats: {
      totalLessons,
      completedCount,
      overallProgress,
      confidenceLevel: learner?.confidenceLevel ?? null,
      readinessScore: learner?.readinessScore ?? null,
      studyStreak: computeStudyStreak(activityLogsForUser),
    },
  }
}

export function parseLessonStructure(value) {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
