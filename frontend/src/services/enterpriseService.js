import { base } from "./base"

// Organization / tenant
export function getAllEnterprises() {
  return base("enterprises")
}

export function getEnterpriseById(enterpriseId) {
  return base(`enterprises/${enterpriseId}`)
}

// Admin-only, cross-tenant: every organization's certificate allocations /
// enrolled learners. The admin institution-detail page filters these
// client-side to one enterpriseId.
export function getAllOrganizationCertificates() {
  return base("organization-certificates")
}

export function getAllOrganizationCertificationLearners() {
  return base("organization-certification-learners")
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

// Admin-only (kept for the admin org-detail view). The enterprise portal must
// use getMyEnterpriseMembers below instead -- this one 403s for a real
// enterprise caller.
export function getEnterpriseMembers(enterpriseId) {
  return base(`enterprise-members/enterprise/${enterpriseId}`)
}

// Every member of the caller's OWN organization, scoped to the JWT.
export function getMyEnterpriseMembers() {
  return base("enterprise/me/members")
}

// Creates a brand-new login account for someone to manage on the org's
// behalf (e.g. a group leader). Cognito emails them their credentials.
export function inviteEnterpriseMember({ firstName, lastName, email, memberRole }) {
  return base("enterprise/me/members", {
    method: "POST",
    data: { firstName, lastName, email, memberRole },
  })
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

// Group-owned announcements. The backend scopes these to the caller's own
// group (owner or assigned leader); a member can only reach their groups.
export function getGroupAnnouncements(groupId) {
  return base(`enterprise-groups/${groupId}/announcements`)
}

export function createGroupAnnouncement(groupId, { title, body, pinned }) {
  return base(`enterprise-groups/${groupId}/announcements`, {
    method: "POST",
    data: { title, body, pinned },
  })
}

export function updateGroupAnnouncement(groupId, announcementId, { title, body, pinned }) {
  return base(`enterprise-groups/${groupId}/announcements/${announcementId}`, {
    method: "PUT",
    data: { title, body, pinned },
  })
}

export function archiveGroupAnnouncement(groupId, announcementId) {
  return base(`enterprise-groups/${groupId}/announcements/${announcementId}`, {
    method: "DELETE",
  })
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

// ---------------------------------------------------------------------------
// A group leader monitoring their own learners. All three are scoped to a group
// the caller actually leads (or owns) -- enforced server-side, never here.
// ---------------------------------------------------------------------------

/** The group's active learners with summary progress figures, for the table. */
export function getGroupLearnerRoster(groupId) {
  return base(`enterprise/me/groups/${groupId}/learners`)
}

/** Full statistics for one learner: weak topics, curriculum progress, readiness. */
export function getGroupLearnerAnalytics(groupId, learnerId) {
  return base(`enterprise/me/groups/${groupId}/learners/${learnerId}/analytics`)
}

/** Unassigns the learner from the group. Account, enrollment and progress remain. */
export function removeLearnerFromGroup(groupId, learnerId) {
  return base(`enterprise/me/groups/${groupId}/learners/${learnerId}`, { method: "DELETE" })
}

/**
 * Announcements from the groups the signed-in learner belongs to. The learner
 * is resolved from the token server-side; pass a certificationId to show only
 * the announcements belonging to that course.
 */
export function getMyAnnouncements(certificationId) {
  const query = certificationId != null ? `?certificationId=${certificationId}` : ""
  return base(`learners/me/announcements${query}`)
}
