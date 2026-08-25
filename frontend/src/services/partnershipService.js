import { base } from "./base"

// Transaction One (public): submit a partnership request from the landing page
// and check its status. No authentication required.
export function submitPublicPartnershipRequest(payload) {
  return base("public/partnership-requests", { method: "POST", data: payload })
}

export function getPublicPartnershipStatus({ referenceNumber, organizationEmail }) {
  return base("public/partnership-requests/status", {
    method: "POST",
    data: { referenceNumber, organizationEmail },
  })
}

// Transaction Two (admin): review partnership requests.
export function getAdminPartnershipRequests(status) {
  const query = status && status !== "ALL" ? `?status=${status}` : ""
  return base(`admin/partnership-requests${query}`)
}

export function getAdminPartnershipRequestDetail(requestId) {
  return base(`admin/partnership-requests/${requestId}`)
}

export function approvePartnershipRequest(requestId, remarks) {
  return base(`admin/partnership-requests/${requestId}/approve`, {
    method: "PUT",
    data: { remarks },
  })
}

export function rejectPartnershipRequest(requestId, remarks) {
  return base(`admin/partnership-requests/${requestId}/reject`, {
    method: "PUT",
    data: { remarks },
  })
}

// Transaction Three (institution): certification access + learner invitations.
export function getInstitutionCertificationAccess(institutionId) {
  return base(`institution/certification-access?institutionId=${institutionId}`)
}

// Sent by a group's leader only -- institutionGroupId is required; the
// certification/slots are derived server-side from the group. `learners` is a
// list of { firstName, lastName, email } (name optional, email required).
export function sendInstitutionInvitations({ institutionGroupId, learners }) {
  return base("institution/invitations", {
    method: "POST",
    data: { institutionGroupId, learners },
  })
}

export function getInstitutionInvitations(institutionId) {
  return base(`institution/invitations?institutionId=${institutionId}`)
}

// Only the invitation's own group leader may cancel it; institutionId is
// resolved from the caller's JWT server-side, never a client param.
export function cancelInstitutionInvitation(invitationId) {
  return base(`institution/invitations/${invitationId}/cancel`, { method: "PUT" })
}
