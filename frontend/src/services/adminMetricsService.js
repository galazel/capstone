import { base } from "./base"

/**
 * Every counter on the admin dashboard, in one payload.
 *
 * Replaces the six global list fetches the page used to make (/learners,
 * /institutions, /certifications, /partnership-requests, /learner-certifications,
 * /exam-results) purely to call `.length` on each — which shipped the whole
 * platform to one browser to produce six numbers, and grew without bound.
 *
 * Shape: { people, catalog, assessments, sales } — see AdminMetricsService.
 */
export function getPlatformMetrics() {
  return base("admin/metrics")
}
