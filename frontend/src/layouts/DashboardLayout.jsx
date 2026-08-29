import { Suspense } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { PortalPageSkeleton } from "@/components/portal-page-skeleton.jsx"
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
  const location = useLocation()

  /* Pages that run edge to edge and pad themselves. The portal's gutter would
     only frame them in white -- a full-width banner stopping short of the
     window reads as a mistake rather than as restraint.

     The three table pages used to be here too, which is why they alone met the
     window edge while every other admin page's content sat in the gutter. A
     table is not a banner: it has a card around it, and that card wants the
     same inset as the cards on every other page. They take the gutter now and
     grow into it, so the pager lands at the bottom of the page.

     Matched on the path rather than announced by the page, because the gutter
     belongs to the layout: a child cannot unset padding applied above it
     without negative margins, which break the moment the cap changes. */
  const BLEED_PATHS = [
    /^\/admin\/certification\/[^/]+$/,
  ]

  const isBleedPage = BLEED_PATHS.some((pattern) => pattern.test(location.pathname))
  const { user, logout } = useAuth()
  const notifications = useNotifications()

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className="netacad-portal admin-portal flex min-h-screen flex-col">
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
              onDelete={(item) => notifications.remove(item.id)}
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
      {/* The boundary sits here rather than around the router, so the admin
          nav stays put while the next page's chunk arrives. */}
      <main className={`rebyu-page ${isBleedPage ? "rebyu-page-bleed" : ""}`}>
        <Suspense fallback={<PortalPageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
