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
import { useCommunityNotifications } from "@/hooks/use-community-notifications.js"

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
  const { logout: authLogout } = useAuth()
  const [searchValue, setSearchValue] = useState("")
  const entitlements = useLearnerEntitlements()

  const query = useQuery({
    queryKey: ["learner-portal-data"],
    queryFn: getLearnerPortalData,
    staleTime: 30_000,
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
  // Tagged by source, not by id shape: these ids come from
  // learner_community_notifications and collide with the inbox table's ids, so
  // "has a numeric id" is not enough to tell them apart -- opening one used to
  // mark an unrelated inbox row read and never reach the post, and deleting one
  // was sent to the inbox endpoint, which answered "Notification not found".
  const community = useCommunityNotifications()
  // The persisted feed (the same one admins and enterprises see) was never read
  // here before, so backend-issued notifications never reached learners at all.
  const inbox = useNotifications()
  const notifications = [
    ...inbox.items,
    ...community.items,
    ...pendingInvitationNotifications,
    ...assignmentNotifications,
  ].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

  // The badge counts every read-tracked feed the bell displays, not just the
  // inbox. Community notifications are persisted server-side with their own
  // read flag, so a comment or an upvote that arrived while the learner was
  // signed out was being listed in the dropdown but never counted -- the bell
  // sat bare next to "View all notifications (4)".
  //
  // `=== false` rather than `!item.read` deliberately: the invitation and
  // assignment items below are derived from portal data and carry no read
  // state at all, so a truthiness test would count them forever. Nothing can
  // mark them read, and a badge that can never reach zero stops being read as
  // a count of new things.
  const unreadCount = notifications.filter((item) => item.read === false).length

  // Marking all read has to reach both feeds for the same reason -- each one
  // has its own bulk endpoint and only knows about its own rows.
  const markAllNotificationsRead = () => {
    inbox.markAllRead()
    if (community.unreadCount > 0) community.markAllRead().catch(() => {})
  }

  const openNotification = (item) => {
    if (item.source === "community") {
      if (item.read === false) community.markRead(item.id)
      if (item.href) navigate(item.href)
      return
    }
    if (typeof item.id === "number") {
      inbox.open(item)
      return
    }
    if (item.href) navigate(item.href)
  }

  // Same routing on the way out: a community row deleted through the inbox
  // endpoint 404s, since that id belongs to a different table.
  const deleteNotification = (item) => {
    if (item.source === "community") {
      community.remove(item.id)
      return
    }
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
            isTopicPage || isCurriculumPage ? "!max-w-none !gap-0 !p-0" : ""
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
