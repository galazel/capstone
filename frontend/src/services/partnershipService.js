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

// Transaction Three (enterprise): certification access + learner invitations.
export function getEnterpriseCertificationAccess(enterpriseId) {
  return base(`enterprise/certification-access?enterpriseId=${enterpriseId}`)
}

// Sent by a group's leader only -- enterpriseGroupId is required; the
// certification/slots are derived server-side from the group.
export function sendEnterpriseInvitations({ enterpriseGroupId, emails }) {
  return base("enterprise/invitations", {
    method: "POST",
    data: { enterpriseGroupId, emails },
  })
}

export function getEnterpriseInvitations(enterpriseId) {
  return base(`enterprise/invitations?enterpriseId=${enterpriseId}`)
}

// Only the invitation's own group leader may cancel it; enterpriseId is
// resolved from the caller's JWT server-side, never a client param.
export function cancelEnterpriseInvitation(invitationId) {
  return base(`enterprise/invitations/${invitationId}/cancel`, { method: "PUT" })
}
