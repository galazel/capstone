import { useMemo } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { FilesIcon, LogOutIcon, SettingsIcon, UserIcon } from "@/components/icons"

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
import { getMyEnterpriseProfile } from "@/services/enterpriseService.js"
import { useAuth } from "@/context/auth-context.jsx"
import { useNotifications } from "@/hooks/use-notifications.js"
import { NotificationBell } from "@/components/notification-bell.jsx"
import { usePortalTheme } from "@/hooks/use-portal-theme.js"
import { PortalThemeMenuItem } from "@/components/portal-theme-toggle"

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

  const scopedQuery = useQuery({
    queryKey: ["enterprise", authEnterpriseId],
    queryFn: () => getMyEnterpriseProfile(),
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
  // An Enterprise Member (group leader, non-owner) has no header nav for
  // Files (see enterprise-ui.jsx's EnterpriseMemberSubNav) -- it lives in
  // this account menu instead. The owner already has Files in the header
  // nav, so it isn't duplicated here for them.
  const isEnterpriseMember = user?.enterpriseMemberRole && user.enterpriseMemberRole !== "owner"
  // Pass the account's real role through so the header can tell the
  // organization's own account apart from one it created for a member.
  const portalRole = (user?.role ?? "").toUpperCase() === "ENTERPRISE_MEMBER"
    ? "ENTERPRISE_MEMBER"
    : "ENTERPRISE"
  const notifications = useNotifications()

  const logout = async () => {
    await authLogout()
    localStorage.removeItem("enterprise_id")
    localStorage.removeItem("organizationId")
    navigate("/login", { replace: true })
  }

  return (
    <div className="netacad-portal enterprise-portal flex min-h-screen flex-col">
      <PortalTopNavigation role={portalRole} organizationName={orgName} enterpriseMemberRole={user?.enterpriseMemberRole} actions={<>
            <NotificationBell
              items={notifications.items}
              unreadCount={notifications.unreadCount}
              loading={notifications.isLoading}
              emptyMessage="Partnership and invitation updates will appear here."
              onItemOpen={notifications.open}
              onMarkAllRead={notifications.markAllRead}
              onDelete={notifications.remove}
            />


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
               {isEnterpriseMember ? (
                 <DropdownMenuItem onClick={() => navigate("/enterprise/files")}>
                   <FilesIcon />
                   Files
                 </DropdownMenuItem>
               ) : null}
               <DropdownMenuSeparator />
               <PortalThemeMenuItem />
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
