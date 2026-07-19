import { useMemo, useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react"

import { PortalTopNavigation } from "@/components/navigation/portal-navigation.jsx"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getEnterpriseById } from "@/services/enterpriseService.js"
import { useAuth } from "@/context/auth-context.jsx"
import { getEnterpriseInvitations } from "@/services/partnershipService.js"
import { NotificationBell } from "@/components/notification-bell.jsx"
import { usePortalTheme } from "@/hooks/use-portal-theme.js"
import { PortalThemeToggle } from "@/components/portal-theme-toggle"
import { base } from "@/services/base.js"

function getInitials(name = "") {
  return (
    name
      .split(/\s/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "OR"
  )
}

export default function EnterpriseLayout() {
  usePortalTheme()
  const navigate = useNavigate()
  const { user, logout: authLogout } = useAuth()
  // A signed-in enterprise account is scoped to its own organization via the
  // enterpriseId from /api/auth/me.
  const authEnterpriseId = user?.enterpriseId ?? null

  // Auto-link orphaned enterprise account on first load
  useEffect(() => {
    if (user) {
      base("admin/fix-my-enterprise-account", { method: "POST" })
        .catch(err => console.warn("Enterprise account already linked or error:", err.message))
    }
  }, [user])

  const scopedQuery = useQuery({
    queryKey: ["enterprise", authEnterpriseId],
    queryFn: () => getEnterpriseById(authEnterpriseId),
    enabled: authEnterpriseId != null,
    staleTime: 60_000,
    retry: 1,
  })

  const enterprise = useMemo(() => {
    if (authEnterpriseId != null) {
      return scopedQuery.data ?? null
    }
    return null
  }, [authEnterpriseId, scopedQuery.data])

  const outletContext = useMemo(
    () => ({
      enterprise,
      enterpriseLoading: scopedQuery.isLoading,
      enterpriseError: scopedQuery.isError,
      refetchEnterprise: scopedQuery.refetch,
    }),
    [enterprise, scopedQuery.isLoading, scopedQuery.isError, scopedQuery.refetch]
  )

  const orgName = enterprise?.enterpriseName ?? "Organization"
  const invitationsQuery = useQuery({
    queryKey: ["enterprise-invitations", authEnterpriseId],
    queryFn: () => getEnterpriseInvitations(authEnterpriseId),
    enabled: authEnterpriseId != null,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  })
  const notifications = (Array.isArray(invitationsQuery.data) ? invitationsQuery.data : [])
    .map((invitation) => {
      const status = String(invitation.status ?? "PENDING").toUpperCase()
      const accepted = status === "ACCEPTED"
      const cancelled = status === "EXPIRED" || status === "REVOKED"
      return {
        id: `invitation-${invitation.invitationId}-${status}`,
        type: accepted ? "accepted" : cancelled ? "cancelled" : "invitation",
        title: accepted
          ? "Learner accepted invitation"
          : cancelled
            ? `Invitation ${status.toLowerCase()}`
            : "Certification invitation sent",
        description: `${invitation.email} · ${invitation.certificationTitle}`,
        createdAt: invitation.sentAt,
        href: "/enterprise/invitations",
      }
    })
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

  const logout = async () => {
    await authLogout()
    localStorage.removeItem("enterprise_id")
    localStorage.removeItem("organizationId")
    navigate("/login", { replace: true })
  }

  return (
    <div className="netacad-portal enterprise-portal flex min-h-screen flex-col bg-background">
      <PortalTopNavigation role="ENTERPRISE" organizationName={orgName} actions={<>
            <NotificationBell
              items={notifications}
              loading={invitationsQuery.isLoading}
              emptyMessage="Learner invitation updates will appear here."
            />

            <PortalThemeToggle />

           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <button
                 type="button"
                 className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                 aria-label="Open account menu"
               >
                 <Avatar>
                   <AvatarFallback>{getInitials(orgName)}</AvatarFallback>
                 </Avatar>
               </button>
             </DropdownMenuTrigger>
             <DropdownMenuContent
               align="end"
               sideOffset={10}
               className="w-56 p-2"
             >
               <DropdownMenuLabel>
                 <span className="block truncate">{orgName}</span>
                 <span className="block truncate text-xs font-normal text-muted-foreground">
                   {user?.email || "Enterprise"}
                 </span>
               </DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => navigate("/enterprise/organization")}>
                 <UserIcon />
                 Profile
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => navigate("/enterprise/settings")}>
                 <SettingsIcon />
                 Settings
               </DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem variant="destructive" onClick={logout}>
                 <LogOutIcon />
                 Log out
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
      </>} />

        <main className="rebyu-page">
          <Outlet context={outletContext} />
        </main>
    </div>
  )
}
