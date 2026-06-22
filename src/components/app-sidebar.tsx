"use client"

import * as React from "react"

import { NavProjects } from "@/components/nav-projects"
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
  TerminalIcon,
  AwardIcon,
  TrophyIcon,
  ClipboardListIcon,
  Building2Icon,
  UsersIcon,
  ChartNoAxesCombinedIcon,
} from "lucide-react"

const data = {
  content: {
    name: "Content",
    items: [
      {
        name: "Certifications",
        url: "/",
        icon: AwardIcon,
      },
      {
        name: "Challenges",
        url: "/challenges",
        icon: TrophyIcon,
      },
      {
        name: "Question Bank",
        url: "/question-bank",
        icon: ClipboardListIcon,
      },
    ],
  },

  management: {
    name: "Management",
    items: [
      {
        name: "Organizations",
        url: "/organizations",
        icon: Building2Icon,
      },
      {
        name: "Learners",
        url: "/learners",
        icon: UsersIcon,
      },
    ],
  },

  insights: {
    name: "Insights",
    items: [
      {
        name: "Analytics",
        url: "/analytics",
        icon: ChartNoAxesCombinedIcon,
      },
    ],
  },
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <TerminalIcon className="size-4" />
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Rebyu</span>
                  <span className="truncate text-xs">Admin Portal</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavProjects projects={data} />
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  )
}