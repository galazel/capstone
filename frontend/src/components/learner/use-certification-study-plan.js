import { useQuery } from "@tanstack/react-query"

import {
  STUDY_PLAN_QUERY_KEY,
  getActiveStudyPlan,
  getOverallStudyPlan,
} from "@/services/studyPlanService.js"

/**
 * The plan that governs one certification, whichever kind that turns out to be.
 *
 * The analytics tiles are per-certification -- they are shown beside a picker
 * and report on whatever it is set to -- but a plan need not be. A learner can
 * build one overall plan covering several certifications, and before this those
 * tiles could not see it: they asked only for a plan belonging to this
 * certification, found none, and told a learner who had just built a plan that
 * they had no study plan.
 *
 * So: the certification's own plan when it has one, and otherwise the overall
 * plan, but only when that plan actually covers this certification. The cover
 * test matters -- an overall plan is built from a chosen subset, and a
 * certification the learner deliberately left out of it has no schedule, which
 * is not the same as one it includes.
 */
export function useCertificationStudyPlan(certificationId) {
  const scopedQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, String(certificationId ?? "")],
    queryFn: () => getActiveStudyPlan(certificationId),
    enabled: Boolean(certificationId),
    staleTime: 60_000,
  })

  /* Only asked once the certification is known to have no plan of its own, so
     the common case stays a single request. `isSuccess` rather than a plain
     data check: while the first request is in flight its data is undefined,
     which would otherwise read as "no plan" and fire this immediately. */
  const overallQuery = useQuery({
    queryKey: [STUDY_PLAN_QUERY_KEY, "overall"],
    queryFn: getOverallStudyPlan,
    enabled:
      Boolean(certificationId) && scopedQuery.isSuccess && !scopedQuery.data?.planId,
    staleTime: 60_000,
  })

  const overallPlan = overallQuery.data
  const covered =
    overallPlan?.planId != null && coversCertification(overallPlan, certificationId)

  return {
    plan: scopedQuery.data?.planId ? scopedQuery.data : covered ? overallPlan : null,
    /* Whether the learner has a plan AT ALL, coverage aside.
     *
     * `plan` above answers "what governs this certification", which is the
     * right question for a tile reporting on it. It is the wrong question for
     * a gate. Enrolling in a new certification leaves it outside an existing
     * overall plan, so the covered test says "no plan" and every gate asked the
     * learner to build a second one -- for a plan they had already made, from a
     * screen that only ever builds overall plans anyway. Building it would not
     * even have helped: the new plan replaces the old, and the next enrolment
     * asks again.
     *
     * So gates ask this instead, and a learner is asked for a plan exactly
     * once: when they have none. */
    hasAnyPlan: Boolean(scopedQuery.data?.planId || overallPlan?.planId),
    /* An overall plan is only fetched after the scoped one resolves, so the
       tile has to keep waiting through the second request rather than
       announcing "no study plan" in the gap between them. */
    isLoading: scopedQuery.isLoading || overallQuery.isLoading,
    /* Told apart from "no plan", because callers that *gate* on a plan must
       not lock someone out on a failed request: not knowing is not the same
       as knowing there is none. */
    isError: scopedQuery.isError || overallQuery.isError,
    isOverall: !scopedQuery.data?.planId && covered,
  }
}

/**
 * Whether an overall plan covers a certification.
 *
 * The chosen set is carried in the schedule as `certificationIds`, because the
 * row itself has one nullable certificationId and cannot hold a set. A plan
 * saved before that field existed spanned everything the learner was enrolled
 * in, so a missing list means "all" -- absent is not the same as empty here,
 * and reading it as empty would hide those plans entirely.
 */
export function coversCertification(plan, certificationId) {
  const ids = plan?.schedule?.certificationIds

  if (!Array.isArray(ids)) {
    return true
  }

  return ids.map(String).includes(String(certificationId))
}
