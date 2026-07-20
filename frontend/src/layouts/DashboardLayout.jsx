import { Outlet, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationBell } from "@/components/notification-bell.jsx"
import { PortalTopNavigation } from "@/components/navigation/portal-navigation.jsx"
import { PortalThemeToggle } from "@/components/portal-theme-toggle"
import { useAuth } from "@/context/auth-context.jsx"
import { usePortalTheme } from "@/hooks/use-portal-theme.js"
import { getMyNotifications, markNotificationRead } from "@/services/notificationService.js"

export default function DashboardLayout() {
  usePortalTheme()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
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

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="netacad-portal admin-portal flex min-h-screen flex-col bg-background">
      <PortalTopNavigation
        role="ADMIN"
        actions={
          <>
            <NotificationBell
              items={notifications}
              loading={notificationsQuery.isLoading}
              emptyMessage="Partnership request updates will appear here."
              onItemOpen={(item) => markReadMutation.mutate(item.id)}
            />
            <PortalThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open account menu">
                <Avatar><AvatarFallback>{(user?.displayName ?? user?.email ?? "AD").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-52 p-2">
                <DropdownMenuItem><UserIcon />Profile</DropdownMenuItem>
                <DropdownMenuItem><SettingsIcon />Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}><LogOutIcon />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <main className="rebyu-page">
        <Outlet />
      </main>
    </div>
  )
}
