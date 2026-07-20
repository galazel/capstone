import { useMemo } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { getMyEnterpriseProfile } from "@/services/enterpriseService.js"
import { useAuth } from "@/context/auth-context.jsx"
import { getMyNotifications, markNotificationRead } from "@/services/notificationService.js"
import { NotificationBell } from "@/components/notification-bell.jsx"
import { usePortalTheme } from "@/hooks/use-portal-theme.js"
import { PortalThemeToggle } from "@/components/portal-theme-toggle"

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
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({
    queryKey: ["my-notifications"],
    queryFn: getMyNotifications,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  })
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-notifications"] }),
  })
  const notifications = (Array.isArray(notificationsQuery.data) ? notificationsQuery.data : []).map(
    (notification) => ({
      id: notification.id,
      title: notification.title,
      description: notification.body,
      createdAt: notification.createdAt,
      href: notification.href,
      read: notification.read,
    })
  )

  const logout = async () => {
    await authLogout()
    localStorage.removeItem("enterprise_id")
    localStorage.removeItem("organizationId")
    navigate("/login", { replace: true })
  }

  return (
    <div className="netacad-portal enterprise-portal flex min-h-screen flex-col bg-background">
      <PortalTopNavigation role="ENTERPRISE" organizationName={orgName} enterpriseMemberRole={user?.enterpriseMemberRole} actions={<>
            <NotificationBell
              items={notifications}
              loading={notificationsQuery.isLoading}
              emptyMessage="Partnership and invitation updates will appear here."
              onItemOpen={(item) => markReadMutation.mutate(item.id)}
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
