import { base } from "./base"

export const getStudySet = (studySetId) => base(`learner-practice/study-sets/${studySetId}`)
export const startPracticeAttempt = (studySetId) => base(`learner-practice/study-sets/${studySetId}/attempts`, { method: "POST" })
export const submitPracticeAnswer = (attemptId, payload) =>
  base(`learner-practice/attempts/${attemptId}/answers`, { method: "POST", data: payload })
export const completePracticeAttempt = (attemptId) =>
  base(`learner-practice/attempts/${attemptId}/complete`, { method: "POST" })
export const getPracticeHistory = () => base("learner-practice/attempts")
export const getPracticeReview = (attemptId) => base(`learner-practice/attempts/${attemptId}`)
