import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { getAllCertifications } from "@/services/certificationService"
import { getEnterprisePortalOverview } from "@/services/enterpriseService.js"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

// Shared tenant-scoped data for the organization portal. All org-scoped lists come
// pre-filtered from the backend (/api/enterprise/me/overview resolves the enterprise
// from the caller's JWT) -- the browser never fetches global lists and filters them.
export function useEnterpriseData(enterpriseId) {
  const enabled = enterpriseId != null

  const overviewQuery = useQuery({
    queryKey: ["enterprise-overview", enterpriseId],
    queryFn: getEnterprisePortalOverview,
    enabled,
    retry: 1,
  })

  const certificationsQuery = useQuery({
    queryKey: ["certifications"],
    queryFn: () => getAllCertifications(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const derived = useMemo(() => {
    const overview = overviewQuery.data ?? {}
    const orgCerts = asArray(overview.orgCerts)

    const certificationById = new Map(
      asArray(certificationsQuery.data).map((certification) => [
        certification.certificationId,
        certification,
      ])
    )

    const learnerById = new Map(
      asArray(overview.learners).map((learner) => [learner.learnerId, learner])
    )

    const orgCertById = new Map(orgCerts.map((cert) => [cert.orgCertId, cert]))

    /* Group name per assignment row, keyed by orgCertLearnerId -- the same id
       the assignment carries, so a roster row looks its group up directly. A
       learner in no active group is simply absent from this map. */
    const groupByOrgCertLearnerId = new Map(
      asArray(overview.groupMemberships).map((membership) => [
        membership.orgCertLearnerId,
        membership,
      ])
    )

    return {
      orgCerts,
      orgCertById,
      certificationById,
      invitations: asArray(overview.invitations),
      assignments: asArray(overview.assignments),
      learnerById,
      groupByOrgCertLearnerId,
      invoices: asArray(overview.invoices),
    }
  }, [certificationsQuery.data, overviewQuery.data])

  const queries = [overviewQuery, certificationsQuery]

  return {
    ...derived,
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    refetchAll: () => queries.forEach((query) => query.refetch()),
    overviewQuery,
    certificationsQuery,
  }
}

export function getLearnerDisplayName(learner) {
  if (!learner) return "Unknown learner"
  const full = [learner.firstName, learner.lastName].filter(Boolean).join(" ")
  return full || learner.username || `Learner #${learner.learnerId}`
}
