import { base } from "./base"

// B2C entitlements + plans. The backend is the source of truth; the frontend
// never derives premium access from localStorage.
export function getLearnerEntitlements(learnerId, certificationId) {
  const params = new URLSearchParams({ learnerId })
  if (certificationId != null) params.set("certificationId", certificationId)
  return base(`learner/entitlements?${params.toString()}`)
}

export function getLearnerSubscription(learnerId) {
  return base(`learner/subscription?learnerId=${learnerId}`)
}

export function getIndividualPlans() {
  return base("subscription-plans/individual")
}

// Checkout lifecycle: initiate -> PayMongo hosted checkout -> redirect back
// to /subscription/success or /subscription/cancel -> verify.
export function initiateCheckout(planId) {
  return base(`subscription/checkout/${planId}`, { method: "POST" })
}

export function verifyCheckoutSession(sessionId) {
  return base(`subscription/verify/${encodeURIComponent(sessionId)}`)
}

export function cancelSubscription() {
  return base("subscription/cancel", { method: "POST" })
}

export function getInstitutionalPlans() {
  return base("subscription-plans/institutional")
}

// Institution (B2B) license reads
export function getInstitutionLicense(institutionId) {
  return base(`institution/license?institutionId=${institutionId}`)
}

export function getInstitutionLicenseUsage(institutionId) {
  return base(`institution/license/usage?institutionId=${institutionId}`)
}

// Well-known premium feature codes (must match backend Entitlements)
export const FEATURES = {
  DETAILED_PROGRESS: "DETAILED_PROGRESS",
  PROGRESS_ANALYTICS: "PROGRESS_ANALYTICS",
  MASTERY_ANALYTICS: "MASTERY_ANALYTICS",
  WEAKNESS_ANALYSIS: "WEAKNESS_ANALYSIS",
  PERSONALIZED_STUDY_PLAN: "PERSONALIZED_STUDY_PLAN",
  MOCK_EXAM_ACCESS: "MOCK_EXAM_ACCESS",
  BATTLES_ACCESS: "BATTLES_ACCESS",
  CHALLENGES_ACCESS: "CHALLENGES_ACCESS",
  READINESS_ANALYSIS: "READINESS_ANALYSIS",
  ADVANCED_RECOMMENDATIONS: "ADVANCED_RECOMMENDATIONS",
}
