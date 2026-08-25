import { useMemo } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { FilesIcon, LogOutIcon, SettingsIcon } from "@/components/icons"

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
import { getMyInstitutionProfile } from "@/services/institutionService.js"
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

export default function InstitutionLayout() {
  usePortalTheme()
  const navigate = useNavigate()
  const { user, logout: authLogout } = useAuth()
  // A signed-in institution account is scoped to its own organization via the
  // institutionId from /api/auth/me.
  const authInstitutionId = user?.institutionId ?? null

  const scopedQuery = useQuery({
    queryKey: ["institution", authInstitutionId],
    queryFn: () => getMyInstitutionProfile(),
    enabled: authInstitutionId != null,
    staleTime: 60_000,
    retry: 1,
  })

  const institution = useMemo(() => {
    if (authInstitutionId != null) {
      return scopedQuery.data ?? null
    }
    return null
  }, [authInstitutionId, scopedQuery.data])

  const outletContext = useMemo(
    () => ({
      institution,
      institutionLoading: scopedQuery.isLoading,
      institutionError: scopedQuery.isError,
      refetchInstitution: scopedQuery.refetch,
    }),
    [institution, scopedQuery.isLoading, scopedQuery.isError, scopedQuery.refetch]
  )

  const orgName = institution?.institutionName ?? "Organization"
  // An Institution Member (group leader, non-owner) has no header nav for
  // Files (see institution-ui.jsx's InstitutionMemberSubNav) -- it lives in
  // this account menu instead. The owner already has Files in the header
  // nav, so it isn't duplicated here for them.
  const isInstitutionMember = user?.institutionMemberRole && user.institutionMemberRole !== "owner"
  // Pass the account's real role through so the header can tell the
  // organization's own account apart from one it created for a member.
  const portalRole = (user?.role ?? "").toUpperCase() === "INSTITUTION_MEMBER"
    ? "INSTITUTION_MEMBER"
    : "INSTITUTION"
  const notifications = useNotifications()

  const logout = async () => {
    await authLogout()
    localStorage.removeItem("institution_id")
    localStorage.removeItem("organizationId")
    navigate("/login", { replace: true })
  }

  return (
    <div className="netacad-portal institution-portal flex min-h-screen flex-col">
      <PortalTopNavigation role={portalRole} organizationName={orgName} institutionMemberRole={user?.institutionMemberRole} actions={<>
            <NotificationBell
              items={notifications.items}
              unreadCount={notifications.unreadCount}
              loading={notifications.isLoading}
              emptyMessage="Partnership and invitation updates will appear here."
              onItemOpen={notifications.open}
              onMarkAllRead={notifications.markAllRead}
              onDelete={(item) => notifications.remove(item.id)}
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
                   {user?.email || "Institution"}
                 </span>
               </DropdownMenuLabel>
               <DropdownMenuSeparator />
               {/* One entry. "Profile" and "Settings" were two items onto what
                   is now one tabbed page -- and /institution/settings had no
                   route behind it at all, so it fell through to the 404. */}
               <DropdownMenuItem onClick={() => navigate("/institution/organization")}>
                 <SettingsIcon />
                 Organization
               </DropdownMenuItem>
               {isInstitutionMember ? (
                 <DropdownMenuItem onClick={() => navigate("/institution/files")}>
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
