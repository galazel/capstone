import { base } from "./base"

// Organization / tenant
export function getAllInstitutions() {
  return base("institutions")
}

export function getInstitutionById(institutionId) {
  return base(`institutions/${institutionId}`)
}

// Admin-only, cross-tenant: every organization's certificate allocations /
// enrolled learners. The admin institution-detail page filters these
// client-side to one institutionId.
export function getAllOrganizationCertificates() {
  return base("organization-certificates")
}

export function getAllOrganizationCertificationLearners() {
  return base("organization-certification-learners")
}

// The caller's OWN organization profile, scoped to the JWT (no admin required).
// The institution portal must use this instead of getInstitutionById, which is
// an admin-only endpoint.
export function getMyInstitutionProfile() {
  return base("institution/me/profile")
}

export function updateInstitution(institutionId, institution) {
  return base(`institutions/${institutionId}`, { method: "PUT", data: institution })
}

// Admin-only (kept for the admin org-detail view). The institution portal must
// use getMyInstitutionMembers below instead -- this one 403s for a real
// institution caller.
export function getInstitutionMembers(institutionId) {
  return base(`institution-members/institution/${institutionId}`)
}

// Every member of the caller's OWN organization, scoped to the JWT.
export function getMyInstitutionMembers() {
  return base("institution/me/members")
}

// Creates a brand-new login account for someone to manage on the org's
// behalf (e.g. a group leader). Cognito emails them their credentials.
export function inviteInstitutionMember({ firstName, lastName, email, memberRole }) {
  return base("institution/me/members", {
    method: "POST",
    data: { firstName, lastName, email, memberRole },
  })
}

// Tenant-scoped portal snapshot: org certs, learner assignments, learner summaries,
// invitations, and invoices for the caller's own institution (derived from the JWT).
export function getInstitutionPortalOverview() {
  return base("institution/me/overview")
}

// Exam results for one of the caller's own learners (404 for learners outside the tenant).
export function getInstitutionLearnerExamResults(learnerId) {
  return base(`institution/me/learners/${learnerId}/exam-results`)
}

// Learner invitations (read-only; the dashboard's "Recent invitations" widget)
export function getLearnerInvitations() {
  return base("learner-invitations")
}

// Group-owned announcements. The backend scopes these to the caller's own
// group (owner or assigned leader); a member can only reach their groups.
export function getGroupAnnouncements(groupId) {
  return base(`institution-groups/${groupId}/announcements`)
}

export function createGroupAnnouncement(groupId, { title, body, pinned }) {
  return base(`institution-groups/${groupId}/announcements`, {
    method: "POST",
    data: { title, body, pinned },
  })
}

export function updateGroupAnnouncement(groupId, announcementId, { title, body, pinned }) {
  return base(`institution-groups/${groupId}/announcements/${announcementId}`, {
    method: "PUT",
    data: { title, body, pinned },
  })
}

export function archiveGroupAnnouncement(groupId, announcementId) {
  return base(`institution-groups/${groupId}/announcements/${announcementId}`, {
    method: "DELETE",
  })
}

// Institution learner groups (per certification allocation)
export function getInstitutionGroups({ institutionId, orgCertId } = {}) {
  const params = new URLSearchParams()
  if (institutionId != null) params.set("institutionId", institutionId)
  if (orgCertId != null) params.set("orgCertId", orgCertId)
  const query = params.toString()
  return base(`institution-groups${query ? `?${query}` : ""}`)
}

export function getInstitutionGroupById(groupId) {
  return base(`institution-groups/${groupId}`)
}

export function createInstitutionGroup(group) {
  return base("institution-groups", { method: "POST", data: group })
}

export function updateInstitutionGroup(groupId, group) {
  return base(`institution-groups/${groupId}`, { method: "PUT", data: group })
}

export function archiveInstitutionGroup(groupId) {
  return base(`institution-groups/${groupId}`, { method: "DELETE" })
}

// Group authorities (teacher / co-admin assigned by the institution to a group)
export function getInstitutionGroupAuthorities({ groupId, userId } = {}) {
  const params = new URLSearchParams()
  if (groupId != null) params.set("groupId", groupId)
  if (userId != null) params.set("userId", userId)
  const query = params.toString()
  return base(`institution-group-authorities${query ? `?${query}` : ""}`)
}

export function assignInstitutionGroupAuthority(authority) {
  return base("institution-group-authorities", {
    method: "POST",
    data: authority,
  })
}

export function removeInstitutionGroupAuthority(authorityId) {
  return base(`institution-group-authorities/${authorityId}`, {
    method: "DELETE",
  })
}

// Group assignees (learners added to a group by its assigned authority)
export function getInstitutionGroupAssignees({ groupId } = {}) {
  const query = groupId != null ? `?groupId=${groupId}` : ""
  return base(`institution-group-assignees${query}`)
}

export function addInstitutionGroupAssignee(assignee) {
  return base("institution-group-assignees", { method: "POST", data: assignee })
}

export function removeInstitutionGroupAssignee(assigneeId) {
  return base(`institution-group-assignees/${assigneeId}`, { method: "DELETE" })
}

// role: "lead" | "member" -- peer-leader distinction within the group.
export function changeInstitutionGroupAssigneeRole(assigneeId, role) {
  return base(`institution-group-assignees/${assigneeId}/role`, {
    method: "PATCH",
    data: { role },
  })
}

// Transaction Three: submit a partnership request and all of its line items
// atomically, with idempotency to prevent duplicate submissions. institutionId
// is derived server-side from the caller's JWT, not sent by the client.
export function submitPartnershipRequestTransaction(request) {
  return base("institution/partnership-requests", {
    method: "POST",
    data: request,
  })
}

export function getPartnershipRequestTransactions() {
  return base("institution/partnership-requests")
}

// Renewals
export function getRenewalRequestsByOrgCert(orgCertId) {
  return base(`institution-certification-renewal-requests/org-cert/${orgCertId}`)
}

export function createRenewalRequest(request) {
  return base("institution-certification-renewal-requests", {
    method: "POST",
    data: request,
  })
}

export function getInstitutionFiles() { return base("institution/files") }
// Returns a short-lived presigned download URL, scoped to the caller's own institution.
export function getInstitutionFileDownloadUrl(id) { return base(`institution/files/${id}/download-url`) }
export function uploadInstitutionFile(file) { const formData = new FormData(); formData.append("file", file); return base("institution/files", { method: "POST", data: formData }) }
export function deleteInstitutionFile(id) { return base(`institution/files/${id}`, { method: "DELETE" }) }

// ---------------------------------------------------------------------------
// A group leader monitoring their own learners. All three are scoped to a group
// the caller actually leads (or owns) -- enforced server-side, never here.
// ---------------------------------------------------------------------------

/** The group's active learners with summary progress figures, for the table. */
export function getGroupLearnerRoster(groupId) {
  return base(`institution/me/groups/${groupId}/learners`)
}

/** Full statistics for one learner: weak topics, curriculum progress, readiness. */
export function getGroupLearnerAnalytics(groupId, learnerId) {
  return base(`institution/me/groups/${groupId}/learners/${learnerId}/analytics`)
}

/** Unassigns the learner from the group. Account, enrollment and progress remain. */
export function removeLearnerFromGroup(groupId, learnerId) {
  return base(`institution/me/groups/${groupId}/learners/${learnerId}`, { method: "DELETE" })
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
