import { Outlet, useNavigate } from "react-router-dom"
import { LogOutIcon, SettingsIcon, UserIcon } from "@/components/icons"

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
import { PortalThemeMenuItem } from "@/components/portal-theme-toggle"
import { useAuth } from "@/context/auth-context.jsx"
import { usePortalTheme } from "@/hooks/use-portal-theme.js"
import { useNotifications } from "@/hooks/use-notifications.js"

export default function DashboardLayout() {
  usePortalTheme()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const notifications = useNotifications()

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
              items={notifications.items}
              unreadCount={notifications.unreadCount}
              loading={notifications.isLoading}
              emptyMessage="Partnership request updates will appear here."
              onItemOpen={notifications.open}
              onMarkAllRead={notifications.markAllRead}
              onDelete={notifications.remove}
            />
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open account menu">
                <Avatar><AvatarFallback>{(user?.displayName ?? user?.email ?? "AD").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-52 p-2">
                <DropdownMenuItem><UserIcon />Profile</DropdownMenuItem>
                <DropdownMenuItem><SettingsIcon />Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <PortalThemeMenuItem />
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
