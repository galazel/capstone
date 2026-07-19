import { base } from "./base"

// Organization / tenant
export function getAllEnterprises() {
  return base("enterprises")
}

export function getEnterpriseById(enterpriseId) {
  return base(`enterprises/${enterpriseId}`)
}

// The caller's OWN organization profile, scoped to the JWT (no admin required).
// The enterprise portal must use this instead of getEnterpriseById, which is
// an admin-only endpoint.
export function getMyEnterpriseProfile() {
  return base("enterprise/me/profile")
}

export function updateEnterprise(enterpriseId, enterprise) {
  return base(`enterprises/${enterpriseId}`, { method: "PUT", data: enterprise })
}

export function getEnterpriseMembers(enterpriseId) {
  return base(`enterprise-members/enterprise/${enterpriseId}`)
}

// Tenant-scoped portal snapshot: org certs, learner assignments, learner summaries,
// invitations, and invoices for the caller's own enterprise (derived from the JWT).
export function getEnterprisePortalOverview() {
  return base("enterprise/me/overview")
}

// Exam results for one of the caller's own learners (404 for learners outside the tenant).
export function getEnterpriseLearnerExamResults(learnerId) {
  return base(`enterprise/me/learners/${learnerId}/exam-results`)
}

// Learner invitations (read-only; the dashboard's "Recent invitations" widget)
export function getLearnerInvitations() {
  return base("learner-invitations")
}

// Enterprise learner groups (per certification allocation)
export function getEnterpriseGroups({ enterpriseId, orgCertId } = {}) {
  const params = new URLSearchParams()
  if (enterpriseId != null) params.set("enterpriseId", enterpriseId)
  if (orgCertId != null) params.set("orgCertId", orgCertId)
  const query = params.toString()
  return base(`enterprise-groups${query ? `?${query}` : ""}`)
}

export function getEnterpriseGroupById(groupId) {
  return base(`enterprise-groups/${groupId}`)
}

export function createEnterpriseGroup(group) {
  return base("enterprise-groups", { method: "POST", data: group })
}

export function updateEnterpriseGroup(groupId, group) {
  return base(`enterprise-groups/${groupId}`, { method: "PUT", data: group })
}

export function archiveEnterpriseGroup(groupId) {
  return base(`enterprise-groups/${groupId}`, { method: "DELETE" })
}

// Group authorities (teacher / co-admin assigned by the enterprise to a group)
export function getEnterpriseGroupAuthorities({ groupId, userId } = {}) {
  const params = new URLSearchParams()
  if (groupId != null) params.set("groupId", groupId)
  if (userId != null) params.set("userId", userId)
  const query = params.toString()
  return base(`enterprise-group-authorities${query ? `?${query}` : ""}`)
}

export function assignEnterpriseGroupAuthority(authority) {
  return base("enterprise-group-authorities", {
    method: "POST",
    data: authority,
  })
}

export function removeEnterpriseGroupAuthority(authorityId) {
  return base(`enterprise-group-authorities/${authorityId}`, {
    method: "DELETE",
  })
}

// Group assignees (learners added to a group by its assigned authority)
export function getEnterpriseGroupAssignees({ groupId } = {}) {
  const query = groupId != null ? `?groupId=${groupId}` : ""
  return base(`enterprise-group-assignees${query}`)
}

export function addEnterpriseGroupAssignee(assignee) {
  return base("enterprise-group-assignees", { method: "POST", data: assignee })
}

export function removeEnterpriseGroupAssignee(assigneeId) {
  return base(`enterprise-group-assignees/${assigneeId}`, { method: "DELETE" })
}

// role: "lead" | "member" -- peer-leader distinction within the group.
export function changeEnterpriseGroupAssigneeRole(assigneeId, role) {
  return base(`enterprise-group-assignees/${assigneeId}/role`, {
    method: "PATCH",
    data: { role },
  })
}

// Transaction Three: submit a partnership request and all of its line items
// atomically, with idempotency to prevent duplicate submissions. enterpriseId
// is derived server-side from the caller's JWT, not sent by the client.
export function submitPartnershipRequestTransaction(request) {
  return base("enterprise/partnership-requests", {
    method: "POST",
    data: request,
  })
}

export function getPartnershipRequestTransactions() {
  return base("enterprise/partnership-requests")
}

// Renewals
export function getRenewalRequestsByOrgCert(orgCertId) {
  return base(`enterprise-certification-renewal-requests/org-cert/${orgCertId}`)
}

export function createRenewalRequest(request) {
  return base("enterprise-certification-renewal-requests", {
    method: "POST",
    data: request,
  })
}

export function getEnterpriseFiles() { return base("enterprise/files") }
// Returns a short-lived presigned download URL, scoped to the caller's own enterprise.
export function getEnterpriseFileDownloadUrl(id) { return base(`enterprise/files/${id}/download-url`) }
export function uploadEnterpriseFile(file) { const formData = new FormData(); formData.append("file", file); return base("enterprise/files", { method: "POST", data: formData }) }
export function deleteEnterpriseFile(id) { return base(`enterprise/files/${id}`, { method: "DELETE" }) }
