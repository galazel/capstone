import { useEffect, useMemo, useState } from "react"
import { Link, useOutletContext, useSearchParams } from "react-router-dom"
import { ArrowLeftIcon } from "@/components/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Mail, Plus, Trash2, UserCog, UserPlus, Users2, UsersRound } from "@/components/icons"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EnterpriseEmptyState,
  EnterpriseErrorState,
  EnterpriseLoadingSkeleton,
  EnterprisePageHeader,
  EnterpriseStatusBadge,
} from "@/components/enterprise/enterprise-ui.jsx"
import { useAuth } from "@/context/auth-context.jsx"
import {
  getLearnerDisplayName,
  useEnterpriseData,
} from "@/hooks/use-enterprise-data.js"
import {
  addEnterpriseGroupAssignee,
  archiveEnterpriseGroup,
  assignEnterpriseGroupAuthority,
  changeEnterpriseGroupAssigneeRole,
  createEnterpriseGroup,
  getEnterpriseGroupAssignees,
  getEnterpriseGroupAuthorities,
  getEnterpriseGroups,
  getMyEnterpriseMembers,
  inviteEnterpriseMember,
  removeEnterpriseGroupAssignee,
  removeEnterpriseGroupAuthority,
  updateEnterpriseGroup,
} from "@/services/enterpriseService.js"
import {
  cancelEnterpriseInvitation,
  sendEnterpriseInvitations,
} from "@/services/partnershipService.js"

function backendMessage(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function CreateGroupDialog({ open, onOpenChange, orgCerts, certificationById, lockedOrgCertId }) {
  const queryClient = useQueryClient()
  const [orgCertId, setOrgCertId] = useState("")
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [totalSlots, setTotalSlots] = useState("")
  const [error, setError] = useState("")

  const selectedOrgCert = orgCerts.find(
    (orgCert) => String(orgCert.orgCertId) === orgCertId
  )

  // Arriving from a specific certification's card: the allocation is fixed,
  // not picked from a dropdown.
  useEffect(() => {
    if (open) {
      setOrgCertId(lockedOrgCertId != null ? String(lockedOrgCertId) : "")
    }
  }, [open, lockedOrgCertId])

  const reset = () => {
    setOrgCertId(lockedOrgCertId != null ? String(lockedOrgCertId) : "")
    setGroupName("")
    setGroupDescription("")
    setTotalSlots("")
    setError("")
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createEnterpriseGroup({
        orgCertId: Number(orgCertId),
        groupName: groupName.trim(),
        groupDescription: groupDescription.trim() || null,
        totalSlots: Number(totalSlots),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-groups"] })
      toast.success("Group created.")
      reset()
      onOpenChange(false)
    },
    onError: (err) => {
      const message = backendMessage(err, "Unable to create the group.")
      setError(message)
      toast.error(message)
    },
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!orgCertId) {
      setError("Select a certification allocation.")
      return
    }
    if (!groupName.trim()) {
      setError("Enter a group name.")
      return
    }
    const slots = Number(totalSlots)
    if (!totalSlots || !Number.isInteger(slots) || slots < 1) {
      setError("Enter a number of slots (at least 1).")
      return
    }
    if (selectedOrgCert && slots > selectedOrgCert.totalSlots) {
      setError(
        `This group can have at most ${selectedOrgCert.totalSlots} slot(s) -- the certification's own allocation limit.`
      )
      return
    }
    createMutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>
            Groups organize learners under one certification allocation. Assign an
            authority afterwards to let them manage the group's learners.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-cert">Certification allocation</Label>
            <Select
              value={orgCertId}
              onValueChange={setOrgCertId}
              disabled={lockedOrgCertId != null}
            >
              <SelectTrigger id="group-cert" className="w-full">
                <SelectValue placeholder="Select certification allocation" />
              </SelectTrigger>
              <SelectContent>
                {orgCerts.map((orgCert) => (
                  <SelectItem key={orgCert.orgCertId} value={String(orgCert.orgCertId)}>
                    {certificationById.get(orgCert.certificationId)?.title ??
                      `Certification #${orgCert.certificationId}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Batch 2026-A"
              maxLength={150}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">Description (optional)</Label>
            <Textarea
              id="group-description"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="What is this group for?"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-slots">Learner slots</Label>
            <Input
              id="group-slots"
              type="number"
              min={1}
              max={selectedOrgCert?.totalSlots}
              value={totalSlots}
              onChange={(e) => setTotalSlots(e.target.value)}
              placeholder="e.g. 30"
            />
            {selectedOrgCert ? (
              <p className="text-xs text-muted-foreground">
                Up to {selectedOrgCert.totalSlots} slot(s) available on this certification allocation.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                "Create group"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ManageGroupDialog({
  group,
  open,
  onOpenChange,
  members,
  userById,
  assignments,
  learnerById,
  invitations,
  orgCertById,
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const groupId = group?.enterpriseGroupId
  const [authorityUserId, setAuthorityUserId] = useState("")
  const [orgCertLearnerId, setOrgCertLearnerId] = useState("")
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [learnerInviteEmail, setLearnerInviteEmail] = useState("")
  const [learnerInviteFirst, setLearnerInviteFirst] = useState("")
  const [learnerInviteLast, setLearnerInviteLast] = useState("")
  const [editingSlots, setEditingSlots] = useState(false)
  const [slotsInput, setSlotsInput] = useState("")

  useEffect(() => {
    if (open && group) {
      setSlotsInput(String(group.totalSlots ?? 0))
      setEditingSlots(false)
    }
  }, [open, group])

  const updateSlotsMutation = useMutation({
    mutationFn: (nextTotalSlots) =>
      updateEnterpriseGroup(groupId, {
        groupName: group.groupName,
        groupDescription: group.groupDescription,
        totalSlots: nextTotalSlots,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-groups"] })
      toast.success("Slot limit updated.")
      setEditingSlots(false)
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to update the slot limit.")),
  })

  const authoritiesQuery = useQuery({
    queryKey: ["enterprise-group-authorities", groupId],
    queryFn: () => getEnterpriseGroupAuthorities({ groupId }),
    enabled: open && groupId != null,
    retry: 1,
  })

  const assigneesQuery = useQuery({
    queryKey: ["enterprise-group-assignees", groupId],
    queryFn: () => getEnterpriseGroupAssignees({ groupId }),
    enabled: open && groupId != null,
    retry: 1,
  })

  const authorities = Array.isArray(authoritiesQuery.data) ? authoritiesQuery.data : []
  const assignees = Array.isArray(assigneesQuery.data) ? assigneesQuery.data : []

  const activeAuthorities = authorities.filter((a) => a.status === "active")
  const activeAssignees = assignees.filter((a) => a.status === "active")

  // Only this group's leader may invite/cancel its learner invitations -- the
  // enterprise account itself is read-only here.
  const isLeader = activeAuthorities.some((a) => a.userId === user?.userId)
  // Assigning/removing a group's leader (and creating a new leader's account)
  // is an organization-management action -- owner-only, same as Billing/
  // Partnership/Organization profile.
  const isOwner = user?.enterpriseMemberRole === "owner"

  const groupInvitations = (Array.isArray(invitations) ? invitations : []).filter(
    (inv) => inv.enterpriseGroupId === groupId
  )
  const pendingGroupInvitations = groupInvitations.filter((inv) => inv.status === "PENDING")

  const orgCert = orgCertById?.get(group?.orgCertId)
  // The group's own slot cap is the binding constraint a leader actually
  // faces (never more than the certification's own remaining slots either --
  // the backend enforces both).
  const groupTotalSlots = group?.totalSlots ?? 0
  const groupUsedSlots = group?.usedSlots ?? 0
  const remainingSlots = Math.max(0, groupTotalSlots - groupUsedSlots)

  const assignedOrgCertLearnerIds = new Set(
    activeAssignees.map((a) => a.orgCertLearnerId)
  )

  // Only learners that already hold access to THIS group's certification and are
  // not already in the group can be added — mirrors the backend invariant.
  const availableLearners = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.orgCertId === group?.orgCertId &&
          !assignedOrgCertLearnerIds.has(assignment.orgCertLearnerId)
      ),
    [assignments, group?.orgCertId, assignedOrgCertLearnerIds]
  )

  const assignAuthorityMutation = useMutation({
    mutationFn: () =>
      assignEnterpriseGroupAuthority({
        enterpriseGroupId: groupId,
        userId: Number(authorityUserId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-group-authorities", groupId] })
      toast.success("Authority assigned.")
      setAuthorityUserId("")
    },
    onError: (err) =>
      toast.error(backendMessage(err, "Unable to assign this authority.")),
  })

  const inviteMemberMutation = useMutation({
    mutationFn: () =>
      inviteEnterpriseMember({
        firstName: inviteFirstName.trim(),
        lastName: inviteLastName.trim(),
        email: inviteEmail.trim(),
        memberRole: "manager",
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-members"] })
      toast.success(
        result?.emailed
          ? `Account created — login credentials were emailed to ${inviteEmail.trim()}.`
          : (result?.note ?? "Account created.")
      )
      setInviteFirstName("")
      setInviteLastName("")
      setInviteEmail("")
      setShowInviteForm(false)
    },
    onError: (err) =>
      toast.error(backendMessage(err, "Unable to create this account.")),
  })

  const inviteLearnerMutation = useMutation({
    mutationFn: () =>
      sendEnterpriseInvitations({
        enterpriseGroupId: groupId,
        learners: [
          {
            firstName: learnerInviteFirst.trim(),
            lastName: learnerInviteLast.trim(),
            email: learnerInviteEmail.trim(),
          },
        ],
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-overview"] })
      toast.success(
        `${response.created} invitation(s) sent.` +
          (response.skipped?.length ? ` ${response.skipped.length} skipped.` : "")
      )
      setLearnerInviteEmail("")
      setLearnerInviteFirst("")
      setLearnerInviteLast("")
    },
    onError: (err) =>
      toast.error(backendMessage(err, "Unable to send this invitation.")),
  })

  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId) => cancelEnterpriseInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-overview"] })
      toast.success("Invitation cancelled. Slot restored.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to cancel this invitation.")),
  })

  const removeAuthorityMutation = useMutation({
    mutationFn: (authorityId) => removeEnterpriseGroupAuthority(authorityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-group-authorities", groupId] })
      toast.success("Authority removed.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to remove authority.")),
  })

  const addLearnerMutation = useMutation({
    mutationFn: () =>
      addEnterpriseGroupAssignee({
        enterpriseGroupId: groupId,
        orgCertLearnerId: Number(orgCertLearnerId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-group-assignees", groupId] })
      toast.success("Learner added to group.")
      setOrgCertLearnerId("")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to add this learner.")),
  })

  const removeLearnerMutation = useMutation({
    mutationFn: (assigneeId) => removeEnterpriseGroupAssignee(assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-group-assignees", groupId] })
      toast.success("Learner removed from group.")
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to remove learner.")),
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ assigneeId, role }) =>
      changeEnterpriseGroupAssigneeRole(assigneeId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-group-assignees", groupId] })
    },
    onError: (err) => toast.error(backendMessage(err, "Unable to update this learner's role.")),
  })

  // Prefer the member's name (captured when their account was provisioned),
  // falling back to email for members created before names were stored.
  const memberLabel = (memberUserId) => {
    const member = userById.get(memberUserId)
    if (!member) return `User #${memberUserId}`
    const name = [member.firstName, member.lastName].filter(Boolean).join(" ")
    if (name && member.email) return `${name} (${member.email})`
    return name || member.email || `User #${memberUserId}`
  }

  if (!group) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{group.groupName}</DialogTitle>
          <DialogDescription>
            Assign an authority (teacher / co-admin) and manage the learners in this
            group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Slots */}
          <section className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {groupUsedSlots} / {groupTotalSlots} slot{groupTotalSlots === 1 ? "" : "s"} used
              </p>
              <p className="text-xs text-muted-foreground">
                Caps how many learners this group's leader can invite.
              </p>
            </div>
            {isOwner ? (
              editingSlots ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={groupUsedSlots}
                    max={orgCert?.totalSlots}
                    value={slotsInput}
                    onChange={(e) => setSlotsInput(e.target.value)}
                    className="w-20"
                  />
                  <Button
                    size="sm"
                    onClick={() => updateSlotsMutation.mutate(Number(slotsInput))}
                    disabled={
                      !slotsInput ||
                      Number(slotsInput) < groupUsedSlots ||
                      updateSlotsMutation.isPending
                    }
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSlots(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditingSlots(true)}>
                  Edit slots
                </Button>
              )
            ) : null}
          </section>

          {/* Authorities */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <UserCog className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-medium">
                Authorities ({activeAuthorities.length})
              </h3>
            </div>

            {isOwner ? (
              <>
                <div className="flex gap-2">
                  <Select value={authorityUserId} onValueChange={setAuthorityUserId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an organization member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No members available
                        </SelectItem>
                      ) : (
                        members.map((member) => (
                          <SelectItem key={member.userId} value={String(member.userId)}>
                            {memberLabel(member.userId)} · {member.memberRole}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => assignAuthorityMutation.mutate()}
                    disabled={!authorityUserId || assignAuthorityMutation.isPending}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Assign
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowInviteForm((prev) => !prev)}
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  {showInviteForm ? "Cancel" : "This person doesn't have an account yet"}
                </Button>

                {showInviteForm ? (
                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Create a new login account for a group leader. They'll receive their
                      username and a temporary password by email.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="invite-first-name">First name</Label>
                        <Input
                          id="invite-first-name"
                          value={inviteFirstName}
                          onChange={(e) => setInviteFirstName(e.target.value)}
                          placeholder="Juan"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="invite-last-name">Last name</Label>
                        <Input
                          id="invite-last-name"
                          value={inviteLastName}
                          onChange={(e) => setInviteLastName(e.target.value)}
                          placeholder="Dela Cruz"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="leader@example.com"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => inviteMemberMutation.mutate()}
                      disabled={
                        !inviteFirstName.trim() ||
                        !inviteLastName.trim() ||
                        !inviteEmail.trim() ||
                        inviteMemberMutation.isPending
                      }
                    >
                      {inviteMemberMutation.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          Creating account...
                        </>
                      ) : (
                        "Create account"
                      )}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the organization owner can assign this group's leader.
              </p>
            )}

            {authoritiesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading authorities...</p>
            ) : activeAuthorities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No authority assigned yet. The enterprise assigns an authority who then
                manages this group's learners.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {activeAuthorities.map((authority) => (
                  <li
                    key={authority.enterpriseGroupAuthorityId}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="text-sm">{memberLabel(authority.userId)}</span>
                    {isOwner ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeAuthorityMutation.mutate(authority.enterpriseGroupAuthorityId)
                        }
                        disabled={removeAuthorityMutation.isPending}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Invitations */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-medium">
                Learner invitations ({remainingSlots} slot{remainingSlots === 1 ? "" : "s"} left)
              </h3>
            </div>

            {isLeader ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                <Input
                  value={learnerInviteFirst}
                  onChange={(e) => setLearnerInviteFirst(e.target.value)}
                  placeholder="First name"
                  disabled={remainingSlots <= 0}
                />
                <Input
                  value={learnerInviteLast}
                  onChange={(e) => setLearnerInviteLast(e.target.value)}
                  placeholder="Last name"
                  disabled={remainingSlots <= 0}
                />
                <Input
                  type="email"
                  value={learnerInviteEmail}
                  onChange={(e) => setLearnerInviteEmail(e.target.value)}
                  placeholder="learner@example.com"
                  disabled={remainingSlots <= 0}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inviteLearnerMutation.mutate()}
                  disabled={
                    !learnerInviteEmail.trim() ||
                    remainingSlots <= 0 ||
                    inviteLearnerMutation.isPending
                  }
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Invite
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only this group's leader can invite learners.
              </p>
            )}

            {groupInvitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invitations sent yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {groupInvitations.map((inv) => (
                  <li
                    key={inv.invitationId}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      {inv.email}
                      <EnterpriseStatusBadge status={inv.status} />
                    </span>
                    {isLeader && inv.status === "PENDING" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelInvitationMutation.mutate(inv.invitationId)}
                        disabled={cancelInvitationMutation.isPending}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Cancel
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Learners */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Users2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-medium">
                Learners ({activeAssignees.length})
              </h3>
            </div>

            {isLeader ? (
              <div className="flex gap-2">
                <Select value={orgCertLearnerId} onValueChange={setOrgCertLearnerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add a learner with access to this certification" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLearners.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No eligible learners
                      </SelectItem>
                    ) : (
                      availableLearners.map((assignment) => (
                        <SelectItem
                          key={assignment.orgCertLearnerId}
                          value={String(assignment.orgCertLearnerId)}
                        >
                          {getLearnerDisplayName(learnerById.get(assignment.learnerId))}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addLearnerMutation.mutate()}
                  disabled={!orgCertLearnerId || addLearnerMutation.isPending}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only this group's leader manages its learner roster.
              </p>
            )}

            {assigneesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading learners...</p>
            ) : activeAssignees.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No learners in this group yet.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {activeAssignees.map((assignee) => {
                  const isLead = assignee.role === "lead"
                  return (
                    <li
                      key={assignee.enterpriseGroupAssigneeId}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        {getLearnerDisplayName(learnerById.get(assignee.learnerId))}
                        {isLead ? <Badge variant="secondary">Lead</Badge> : null}
                      </span>
                      {isLeader ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              changeRoleMutation.mutate({
                                assigneeId: assignee.enterpriseGroupAssigneeId,
                                role: isLead ? "member" : "lead",
                              })
                            }
                            disabled={changeRoleMutation.isPending}
                          >
                            {isLead ? "Make member" : "Make lead"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              removeLearnerMutation.mutate(assignee.enterpriseGroupAssigneeId)
                            }
                            disabled={removeLearnerMutation.isPending}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function EnterpriseGroupsPage() {
  const { enterprise, enterpriseLoading, enterpriseError, refetchEnterprise } =
    useOutletContext()
  const enterpriseId = enterprise?.enterpriseId
  const [searchParams] = useSearchParams()
  // Reached from a specific certification's card on the Certifications page --
  // groups are always created/viewed in the context of one allocation. Without
  // this param (a stale bookmark, e.g.), every group across the org is shown.
  const scopedOrgCertIdParam = searchParams.get("orgCertId")
  const scopedOrgCertId = scopedOrgCertIdParam ? Number(scopedOrgCertIdParam) : null

  const data = useEnterpriseData(enterpriseId)
  const [createOpen, setCreateOpen] = useState(false)
  const [manageGroup, setManageGroup] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const queryClient = useQueryClient()

  const groupsQuery = useQuery({
    queryKey: ["enterprise-groups", enterpriseId],
    queryFn: () => getEnterpriseGroups({ enterpriseId }),
    enabled: enterpriseId != null,
    retry: 1,
  })

  const membersQuery = useQuery({
    queryKey: ["enterprise-members", enterpriseId],
    queryFn: () => getMyEnterpriseMembers(),
    enabled: enterpriseId != null,
    retry: 1,
  })

  const members = Array.isArray(membersQuery.data) ? membersQuery.data : []

  // Member/authority labels come from the tenant-scoped members list (which carries
  // each member's name and email) -- no global users fetch needed.
  const userById = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members]
  )

  const groups = (Array.isArray(groupsQuery.data) ? groupsQuery.data : []).filter(
    (group) =>
      group.status === "active" &&
      (scopedOrgCertId == null || group.orgCertId === scopedOrgCertId)
  )

  const scopedCertification = scopedOrgCertId != null
    ? data.certificationById.get(data.orgCertById.get(scopedOrgCertId)?.certificationId)
    : null

  if (enterpriseLoading || (enterprise && data.isLoading)) {
    return <EnterpriseLoadingSkeleton />
  }
  if (enterpriseError) {
    return <EnterpriseErrorState onRetry={refetchEnterprise} />
  }
  if (!enterprise) {
    return (
      <EnterpriseEmptyState
        title="No organization found"
        description="Learner groups appear here once your organization is registered."
      />
    )
  }

  const hasAllocations = data.orgCerts.length > 0

  return (
    <div className="space-y-6">
      {scopedOrgCertId != null ? (
        <Link
          to="/enterprise/certifications"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to Certifications
        </Link>
      ) : null}

      <EnterprisePageHeader
        title={scopedCertification ? `Groups — ${scopedCertification.title}` : "Groups"}
        subtitle="Organize learners into groups under a certification allocation and delegate management to an authority."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={!hasAllocations}>
            <Plus aria-hidden="true" />
            Create group
          </Button>
        }
      />

      {groupsQuery.isError ? (
        <EnterpriseErrorState onRetry={groupsQuery.refetch} />
      ) : !hasAllocations ? (
        <EnterpriseEmptyState
          icon={UsersRound}
          title="No certification allocations yet"
          description="Once your organization has a certification allocation, you can create groups under it."
        />
      ) : groups.length === 0 ? (
        <EnterpriseEmptyState
          icon={UsersRound}
          title="No groups yet"
          description="Create a group to start organizing your learners."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const orgCert = data.orgCertById.get(group.orgCertId)
            const certification = orgCert
              ? data.certificationById.get(orgCert.certificationId)
              : null
            return (
              <Card key={group.enterpriseGroupId} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{group.groupName}</CardTitle>
                    <EnterpriseStatusBadge status={group.status} />
                  </div>
                  <CardDescription>
                    {certification?.title ??
                      `Certification #${orgCert?.certificationId ?? "?"}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {group.groupDescription || "No description."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {group.usedSlots ?? 0} / {group.totalSlots ?? 0} slot
                    {(group.totalSlots ?? 0) === 1 ? "" : "s"} used
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManageGroup(group)}
                  >
                    <UserCog className="size-4" aria-hidden="true" />
                    Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setArchiveTarget(group)}
                  >
                    Archive
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgCerts={data.orgCerts}
        certificationById={data.certificationById}
        lockedOrgCertId={scopedOrgCertId}
      />

      <ManageGroupDialog
        group={manageGroup}
        open={manageGroup != null}
        onOpenChange={(open) => !open && setManageGroup(null)}
        members={members}
        userById={userById}
        assignments={data.assignments}
        learnerById={data.learnerById}
        invitations={data.invitations}
        orgCertById={data.orgCertById}
      />

      <ArchiveGroupDialog
        group={archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onArchived={() => {
          queryClient.invalidateQueries({ queryKey: ["enterprise-groups"] })
          setArchiveTarget(null)
        }}
      />
    </div>
  )
}

function ArchiveGroupDialog({ group, onClose, onArchived }) {
  const archiveMutation = useMutation({
    mutationFn: (groupId) => archiveEnterpriseGroup(groupId),
    onSuccess: () => {
      toast.success("Group archived.")
      onArchived()
    },
    onError: (err) =>
      toast.error(backendMessage(err, "Unable to archive the group.")),
  })

  return (
    <AlertDialog open={group != null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this group?</AlertDialogTitle>
          <AlertDialogDescription>
            {group?.groupName} will be archived. Learners and authorities stay on
            record but the group is no longer active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveMutation.isPending}>
            Keep group
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              archiveMutation.mutate(group.enterpriseGroupId)
            }}
            disabled={archiveMutation.isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {archiveMutation.isPending ? "Archiving..." : "Archive group"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
