import { base } from "./base"

export function getExamTypes() {
  return base("exam-types")
}

export function createExamType(examTypeText) {
  return base("exam-types", { method: "POST", data: { examTypeText } })
}

export async function ensureExamType(examTypeText) {
  const types = await getExamTypes()
  const existing = (Array.isArray(types) ? types : []).find(
    (type) => type.examTypeText === examTypeText
  )
  if (existing) return existing
  return createExamType(examTypeText)
}

// Omit includeGroupId for official exams only (what every existing caller
// does). Pass a group id to also mix in that group's own exams -- the
// caller must be able to act on that group, enforced server-side.
export function getExams(includeGroupId) {
  const query = includeGroupId != null ? `?includeGroupId=${includeGroupId}` : ""
  return base(`exams${query}`)
}

export function getExamById(examId, includeGroupId) {
  const query = includeGroupId != null ? `?includeGroupId=${includeGroupId}` : ""
  return base(`exams/${examId}${query}`)
}

// ownerGroupId is required for an Enterprise Member creating their own
// exam; omitted, the backend requires ADMIN and creates an official exam.
export function createExam(exam, ownerGroupId) {
  const query = ownerGroupId != null ? `?ownerGroupId=${ownerGroupId}` : ""
  return base(`exams${query}`, { method: "POST", data: exam })
}

export function updateExam(examId, exam) {
  return base(`exams/${examId}`, { method: "PUT", data: exam })
}

export function deleteExam(examId) {
  return base(`exams/${examId}`, { method: "DELETE" })
}

export function publishExam(examId) {
  return base(`exams/${examId}/publish`, { method: "POST" })
}

export function archiveExam(examId) {
  return base(`exams/${examId}/archive`, { method: "POST" })
}

// Adds questions to an assessment with per-question points + display order.
// questions: [{ questionId, points, displayOrder }]
export function addExamQuestions(examId, questions) {
  return base(`exams/${examId}/questions`, {
    method: "POST",
    data: { questions },
  })
}

// Exam questions (join between exam and question bank)
export function getExamQuestions() {
  return base("exam-questions")
}

export function createExamQuestion(examQuestion) {
  return base("exam-questions", { method: "POST", data: examQuestion })
}

export function updateExamQuestion(examQuestionId, examQuestion) {
  return base(`exam-questions/${examQuestionId}`, {
    method: "PUT",
    data: examQuestion,
  })
}

export function deleteExamQuestion(examQuestionId) {
  return base(`exam-questions/${examQuestionId}`, { method: "DELETE" })
}

// Question configs used when rendering attempt workspaces
export function getTextQuestionConfig(questionId) {
  return base(`text-question-configs/by-question/${questionId}`)
}

export function getDiagramQuestionConfig(questionId) {
  return base(`diagram-question-configs/by-question/${questionId}`)
}

export function getProgrammingQuestionConfig(questionId) {
  return base(`programming-question-configs/by-question/${questionId}`)
}

// Results and attempt details
export function getExamResults() {
  return base("exam-results")
}

export function getExamResult(learnerId, examId, attemptNo) {
  return base(`exam-results/${learnerId}/${examId}/${attemptNo}`)
}

export function createExamResult(result) {
  return base("exam-results", { method: "POST", data: result })
}

export function createLearnerExamDetail(detail) {
  return base("learner-exam-details", { method: "POST", data: detail })
}

export function getLearnerExamDetailsByAttempt(learnerId, examId, attemptNo) {
  return base(`learner-exam-details/by-attempt/${learnerId}/${examId}/${attemptNo}`)
}

export function createMcqAnswer(answer) {
  return base("learner-mcq-answers", { method: "POST", data: answer })
}

export function createTextAnswer(answer) {
  return base("learner-text-answers", { method: "POST", data: answer })
}

export function createDiagramAnswer(answer) {
  return base("learner-diagram-answers", { method: "POST", data: answer })
}

export function createProgrammingAnswer(answer) {
  return base("learner-programming-answers", { method: "POST", data: answer })
}

// ---------------------------------------------------------------------------
// Learner-safe attempt transaction API (server-side snapshots and scoring)
// ---------------------------------------------------------------------------

export function getLearnerAssessment(assessmentId, learnerId) {
  return base(`learner/assessments/${assessmentId}?learnerId=${learnerId}`)
}

export function startAssessmentAttempt(assessmentId, learnerId, idempotencyKey) {
  return base(`learner/assessments/${assessmentId}/attempts`, {
    method: "POST",
    data: { learnerId, idempotencyKey },
  })
}

export function autosaveAttemptAnswers(attemptId, learnerId, answers) {
  return base(`learner/assessment-attempts/${attemptId}/answers`, {
    method: "PUT",
    data: { learnerId, answers },
  })
}

export function setAttemptFlag(attemptId, attemptQuestionId, learnerId, flagged) {
  return base(`learner/assessment-attempts/${attemptId}/flags/${attemptQuestionId}`, {
    method: "PUT",
    data: { learnerId, flagged },
  })
}

export function setAttemptSkip(attemptId, attemptQuestionId, learnerId, skipped) {
  return base(`learner/assessment-attempts/${attemptId}/skip/${attemptQuestionId}`, {
    method: "PUT",
    data: { learnerId, skipped },
  })
}

export function setAttemptCurrentItem(attemptId, attemptQuestionId, learnerId) {
  return base(`learner/assessment-attempts/${attemptId}/current-item`, {
    method: "PUT",
    data: { learnerId, attemptQuestionId },
  })
}

export function runAttemptProgramming(attemptId, attemptQuestionId, learnerId, code, language) {
  return base(
    `learner/assessment-attempts/${attemptId}/programming/${attemptQuestionId}/run`,
    { method: "POST", data: { learnerId, code, language } }
  )
}

export function checkAttemptProgramming(attemptId, attemptQuestionId, learnerId, code, language) {
  return base(
    `learner/assessment-attempts/${attemptId}/programming/${attemptQuestionId}/check`,
    { method: "POST", data: { learnerId, code, language } }
  )
}

export function getAttemptExecutions(attemptId, attemptQuestionId, learnerId) {
  return base(
    `learner/assessment-attempts/${attemptId}/programming/${attemptQuestionId}/executions?learnerId=${learnerId}`
  )
}

export function checkAttemptDiagram(attemptId, attemptQuestionId, learnerId, diagramData, diagramType) {
  return base(
    `learner/assessment-attempts/${attemptId}/diagram/${attemptQuestionId}/check`,
    { method: "POST", data: { learnerId, diagramData, diagramType } }
  )
}

export function submitAssessmentAttempt(attemptId, learnerId, answers) {
  return base(`learner/assessment-attempts/${attemptId}/submit`, {
    method: "POST",
    data: { learnerId, answers },
  })
}

export function getAttemptResult(attemptId, learnerId) {
  return base(`learner/assessment-attempts/${attemptId}/result?learnerId=${learnerId}`)
}

export function getLearnerAttempts(learnerId) {
  return base(`learner/assessment-attempts?learnerId=${learnerId}`)
}

// Full attempt history for one assessment — every retake, newest first.
export function getAssessmentAttempts(assessmentId, learnerId) {
  return base(`learner/assessments/${assessmentId}/attempts?learnerId=${learnerId}`)
}

// ---------------------------------------------------------------------------
// Enrollment / purchase transaction API
// ---------------------------------------------------------------------------

export function purchaseCertification(certificationId, learnerId, idempotencyKey) {
  return base(`learner/certifications/${certificationId}/purchase`, {
    method: "POST",
    data: { learnerId, idempotencyKey },
  })
}

export function confirmPurchase(transactionId, learnerId, paymentReference) {
  return base(`learner/purchases/${transactionId}/confirm`, {
    method: "POST",
    data: { learnerId, paymentReference },
  })
}

export function getLearnerEnrollments(learnerId) {
  return base(`learner/enrollments?learnerId=${learnerId}`)
}

// Well-known assessment type labels stored in exam_types.exam_type_text.
export const ASSESSMENT_TYPES = [
  { value: "DIAGNOSTIC", label: "Diagnostic" },
  { value: "QUIZ", label: "Lesson Quiz" },
  { value: "MODULE_EXAM", label: "Module Exam" },
  { value: "MOCK_EXAM", label: "Mock Exam" },
]

export function getAssessmentTypeLabel(examTypeText) {
  return (
    ASSESSMENT_TYPES.find((type) => type.value === examTypeText)?.label ??
    examTypeText ??
    "Assessment"
  )
}
