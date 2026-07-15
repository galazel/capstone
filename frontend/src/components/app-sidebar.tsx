"use client"

import * as React from "react"
import { NavLink } from "react-router-dom"

import { NavProjects } from "@/components/nav-projects"
import { BrandLogo } from "@/components/brand-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import {
  AwardIcon,
  TrophyIcon,
  ClipboardListIcon,
  Building2Icon,
  UsersIcon,
  ChartNoAxesCombinedIcon,
  LayoutDashboardIcon,
  HandshakeIcon,
} from "lucide-react"

const data = {
  content: {
    name: "Content",
    items: [
      {
        name: "Dashboard",
        url: "/admin/dashboard",
        icon: LayoutDashboardIcon,
      },
      {
        name: "Certifications",
        url: "/admin",
        exact: true,
        activeUrls: [
          "/admin/certifications",
          "/admin/certification",
          "/admin/lessons",
        ],
        icon: AwardIcon,
      },
      {
        name: "Question Bank",
        url: "/admin/question-bank",
        icon: ClipboardListIcon,
      },
      {
        name: "Challenges",
        url: "/admin/challenges",
        icon: TrophyIcon,
      },
    ],
  },

  management: {
    name: "Management",
    items: [
      {
        name: "Organizations",
        url: "/admin/organizations",
        icon: Building2Icon,
      },
      {
        name: "Partnership Requests",
        url: "/admin/partnership-requests",
        icon: HandshakeIcon,
      },
      {
        name: "Learners",
        url: "/admin/learners",
        icon: UsersIcon,
      },
    ],
  },

  insights: {
    name: "Insights",
    items: [
      {
        name: "Analytics",
        url: "/admin/analytics",
        icon: ChartNoAxesCombinedIcon,
      },
    ],
  },
}

export function AppSidebar({
                             ...props
                           }: React.ComponentProps<typeof Sidebar>) {
  return (
      <Sidebar variant="sidebar" {...props}>
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <NavLink to="/admin">
                  <BrandLogo className="size-8" />

                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Rebyu</span>
                    <span className="truncate text-xs">Admin Portal</span>
                  </div>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="justify-center">
          <NavProjects projects={data} />
        </SidebarContent>

        <SidebarFooter />
      </Sidebar>
  )
}
