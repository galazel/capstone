import React, { useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  LogOutIcon,
  FilesIcon,
  NotebookPenIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"

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
import { getLearnerPortalData } from "@/services/learnerAnalyticsService.js"
import { useAuth } from "@/context/auth-context.jsx"
import { NotificationBell } from "@/components/notification-bell.jsx"
import { getLearnerInvitations } from "@/services/enterpriseService.js"
import { usePortalTheme } from "@/hooks/use-portal-theme.js"
import { PortalThemeToggle } from "@/components/portal-theme-toggle"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"
import { getCommunityNotifications } from "@/services/communityService.js"

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
  const isChallengesPage = location.pathname === "/learner/challenges"
  const { logout: authLogout } = useAuth()
  const [searchValue, setSearchValue] = useState("")
  const entitlements = useLearnerEntitlements()

  const openMistakeNotebook = () => {
    if (entitlements.isLoading) return
    if (!entitlements.hasPremium) {
      return
    }
    navigate("/learner/mistakes")
  }

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
  const communityNotificationsQuery = useQuery({ queryKey: ["learner-community-notifications"], queryFn: getCommunityNotifications, refetchInterval: 30_000, staleTime: 15_000 })
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
  const moderationNotifications = (Array.isArray(communityNotificationsQuery.data) ? communityNotificationsQuery.data : []).map((notification) => ({ ...notification, type: "certification" }))
  const notifications = [...moderationNotifications, ...pendingInvitationNotifications, ...assignmentNotifications]
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

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
    <div className={`netacad-portal learner-portal flex min-h-screen flex-col ${isChallengesPage ? "!bg-[#f1f7fc] dark:!bg-[#111b26]" : "bg-background"}`}>
      <PortalTopNavigation role="LEARNER" actions={<>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => navigate("/learner/plan")} aria-label="Open study plan calendar"><CalendarDays /></Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Study plan calendar</TooltipContent>
            </Tooltip>
            <NotificationBell
              items={notifications}
              loading={query.isLoading || invitationsQuery.isLoading}
              emptyMessage="Certification invitations and assignments will appear here."
            />

            <PortalThemeToggle />

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
                <DropdownMenuItem onClick={() => navigate("/learner/library")}>
                  <FilesIcon />
                  Library
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    if (!entitlements.hasPremium) event.preventDefault()
                    openMistakeNotebook()
                  }}
                >
                  <NotebookPenIcon />
                  <span className="flex-1">Mistake Notebook</span>
                  {!entitlements.hasPremium ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">PRO</span> : null}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/learner/subscription")}>
                  <SettingsIcon />
                  Plan and billing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={logout}>
                  <LogOutIcon />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
      </>} />

        <main className={`rebyu-page pb-24 lg:pb-8 ${isChallengesPage ? "!bg-[#f1f7fc] dark:!bg-[#111b26]" : ""}`}>
          {query.isLoading ? (
            <LearnerLoadingSkeleton />
          ) : query.isError ? (
            <LearnerErrorState error={query.error} onRetry={query.refetch} />
          ) : (
            <Outlet context={outletContext} />
          )}
        </main>
      <LearnerMobileNavigation />
    </div>
  )
}
