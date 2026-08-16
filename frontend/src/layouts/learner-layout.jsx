import React, { useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  LogOutIcon,
  FilesIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LearnerMobileNavigation, PortalTopNavigation } from "@/components/navigation/portal-navigation.jsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LearnerErrorState,
  LearnerLoadingSkeleton,
  getLearnerDisplayName,
} from "@/components/learner/learner-ui.jsx"
import { LearnerStatusStrip } from "@/components/learner/learner-status-strip.jsx"
import { getLearnerPortalData } from "@/services/learnerAnalyticsService.js"
import { useAuth } from "@/context/auth-context.jsx"
import { NotificationBell } from "@/components/notification-bell.jsx"
import { getLearnerInvitations } from "@/services/enterpriseService.js"
import { usePortalTheme } from "@/hooks/use-portal-theme.js"
import { useNotifications } from "@/hooks/use-notifications.js"
import { PortalThemeMenuItem } from "@/components/portal-theme-toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"

function getInitials(name = "", email = "") {
  const source = name || email || "Learner"
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export default function LearnerLayout() {
  usePortalTheme()
  const navigate = useNavigate()
  const location = useLocation()
  // The topic study page is a full-bleed reading surface with its own fixed
  // sidebar — `.rebyu-page`'s 1440px cap would otherwise re-centre it and
  // strand a wide gutter of unused width on large screens.
  const isTopicPage = /^\/learner\/learning\/[^/]+\/topics\/[^/]+$/.test(location.pathname)
  // The curriculum page opens on a full-bleed ink band, which has to reach both
  // edges of the window to read as one. It keeps the top nav — unlike the topic
  // page it is still a portal screen — so it only drops `.rebyu-page`'s cap and
  // padding and owns its own gutters from there.
  const isCurriculumPage = /^\/learner\/learning\/[^/]+$/.test(location.pathname)
  /* The certification page is a board of tiles that should fill the window the
     way the analytics board does. Inside `.rebyu-page` it was capped twice --
     once by the wrapper and again by its own container -- which left a wide
     empty gutter down both sides on a large screen and made the page look like
     a narrow column floating on the ground colour. It owns its own gutters. */
  const isCertificationDetailPage = /^\/learner\/certifications\/[^/]+$/.test(location.pathname)
  const { logout: authLogout } = useAuth()
  const [searchValue, setSearchValue] = useState("")
  const entitlements = useLearnerEntitlements()

  const query = useQuery({
    queryKey: ["learner-portal-data"],
    queryFn: getLearnerPortalData,
    staleTime: 30_000,
    /* This one gates the whole learner shell -- while it has no data at all,
       every page under it is a skeleton. Leaving the portal for longer than the
       default five-minute cache lifetime and coming back therefore meant a cold
       load of every page, not just the one being opened. Kept for an hour so a
       return is instant and the refresh happens behind the page already drawn. */
    gcTime: 60 * 60_000,
  })

  const displayName = getLearnerDisplayName(query.data)
  const email = query.data?.user?.email ?? query.data?.identity?.email ?? ""
  const invitationsQuery = useQuery({
    queryKey: ["learner-notification-invitations", email],
    queryFn: getLearnerInvitations,
    enabled: Boolean(email),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  })
  const certificationById = new Map(
    (query.data?.certifications ?? []).map((certification) => [
      String(certification.certificationId),
      certification,
    ])
  )
  const pendingInvitationNotifications = (
    Array.isArray(invitationsQuery.data) ? invitationsQuery.data : []
  )
    .filter(
      (invitation) =>
        String(invitation.email ?? "").toLowerCase() === email.toLowerCase() &&
        String(invitation.status ?? "").toUpperCase() === "PENDING"
    )
    .map((invitation) => ({
      id: `pending-certification-invitation-${invitation.invitationId}`,
      type: "invitation",
      title: "You have a certification invitation",
      description: "An organization invited you to join a certification. Open the invitation email to accept it.",
      createdAt: invitation.sentAt,
    }))

  const assignmentNotifications = (query.data?.enrollments ?? [])
    .filter((enrollment) => enrollment.source === "enterprise")
    .map((enrollment) => {
      const certification = certificationById.get(String(enrollment.certificationId))
      return {
        id: `enterprise-certification-${enrollment.certificationId}`,
        type: "certification",
        title: "New certification assigned",
        description: certification?.title ?? certification?.name ?? "Your organization assigned you a certification.",
        createdAt: enrollment.assignedAt,
        href: `/learner/certifications/${enrollment.certificationId}`,
      }
    })
  // The persisted feed (the same one admins and enterprises see) was never read
  // here before, so backend-issued notifications never reached learners at all.
  const inbox = useNotifications()
  const notifications = [
    ...inbox.items,
    ...pendingInvitationNotifications,
    ...assignmentNotifications,
  ].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

  // `=== false` rather than `!item.read` deliberately: the invitation and
  // assignment items below are derived from portal data and carry no read
  // state at all, so a truthiness test would count them forever. Nothing can
  // mark them read, and a badge that can never reach zero stops being read as
  // a count of new things.
  const unreadCount = notifications.filter((item) => item.read === false).length

  const markAllNotificationsRead = () => {
    inbox.markAllRead()
  }

  const openNotification = (item) => {
    if (typeof item.id === "number") {
      inbox.open(item)
      return
    }
    if (item.href) navigate(item.href)
  }

  const deleteNotification = (item) => {
    inbox.remove(item.id)
  }

  const outletContext = useMemo(
    () => ({
      data: query.data,
      searchValue,
      setSearchValue,
      refetch: query.refetch,
    }),
    [query.data, query.refetch, searchValue]
  )

  const logout = async () => {
    await authLogout()
    localStorage.removeItem("learner_id")
    localStorage.removeItem("userId")
    localStorage.removeItem("user_id")
    navigate("/login", { replace: true })
  }

  return (
    <div className="netacad-portal learner-portal flex min-h-screen flex-col">
      {!isTopicPage ? (
      <PortalTopNavigation role="LEARNER" actions={<>
            {/* Ahead of the action icons: these are what the learner is
                playing for, and they read as state rather than controls. */}
            <LearnerStatusStrip portalData={query.data} />

            <NotificationBell
              items={notifications}
              unreadCount={unreadCount}
              loading={query.isLoading || invitationsQuery.isLoading}
              emptyMessage="Certification invitations and assignments will appear here."
              onItemOpen={openNotification}
              onMarkAllRead={markAllNotificationsRead}
              onDelete={deleteNotification}
            />

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Open account menu"
                    >
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(displayName, email)}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Account menu</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-56 p-2"
              >
                <DropdownMenuLabel>
                  <span className="block truncate">{displayName}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {email || "Learner"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/learner/account")}>
                  <UserIcon />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/learner/plan")}>
                  <CalendarDays />
                  Study calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/learner/library")}>
                  <FilesIcon />
                  Library
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/learner/subscription")}>
                  <SettingsIcon />
                  Plan and billing
                </DropdownMenuItem>
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
      ) : null}

        <main
          className={`rebyu-page ${isTopicPage ? "" : "pb-24 lg:pb-8"} ${
            isTopicPage || isCurriculumPage || isCertificationDetailPage
              ? "!max-w-none !gap-0 !p-0"
              : ""
          }`}
        >
          {query.isLoading ? (
            <LearnerLoadingSkeleton />
          ) : query.isError ? (
            <LearnerErrorState error={query.error} onRetry={query.refetch} />
          ) : (
            <Outlet context={outletContext} />
          )}
        </main>
      {!isTopicPage ? <LearnerMobileNavigation /> : null}
    </div>
  )
}
