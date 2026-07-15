import * as React from "react"
import {
  AwardIcon,
  BookOpenCheckIcon,
  CircleAlertIcon,
  CrownIcon,
  MessagesSquareIcon,
  SwordsIcon,
} from "lucide-react"

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
import { useLearnerEntitlements } from "@/hooks/use-learner-entitlements.js"

const learnerNav = {
  main: {
    name: "Learning",
    items: [
      {
        name: "Certifications",
        url: "/learner/certifications",
        icon: AwardIcon,
      },
      {
        name: "My Learning",
        url: "/learner/learning",
        activeUrls: [
          "/learner/learning",
          "/learner/lessons",
        ],
        icon: BookOpenCheckIcon,
      },
      {
        name: "Challenges",
        url: "/learner/challenges",
        activeUrls: [
          "/learner/challenges",
          "/challenges",
        ],
        icon: SwordsIcon,
      },
    ],
  },

  pages: {
    name: "Resources",
    items: [
      {
        name: "Mistakes Bank",
        url: "/learner/mistakes",
        icon: CircleAlertIcon,
      },
      {
        name: "Community Q&A",
        url: "/learner/community",
        activeUrls: [
          "/learner/community",
          "/learner/community/questions",
          "/learner/community/posts",
        ],
        icon: MessagesSquareIcon,
      },
    ],
  },
}

export function LearnerAppSidebar({
                                    ...props
                                  }: React.ComponentProps<typeof Sidebar>) {
  const entitlements = useLearnerEntitlements()
  const planLabel = entitlements.institutionalActive
    ? "Organization access"
    : entitlements.personalProActive
      ? "Pro learner"
      : "Free learner"
  const planDescription = entitlements.institutionalActive
    ? "Sponsored by your organization"
    : entitlements.personalProActive
      ? "Premium features enabled"
      : "Standard learning access"

  return (
      <Sidebar variant="sidebar" {...props}>
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent" aria-label="REBYU learner portal">
                  <BrandLogo className="size-8" />

                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    REBYU
                  </span>

                  <span className="truncate text-xs text-sidebar-foreground/60">
                    Learner Portal
                  </span>
                  </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="justify-center">
          <NavProjects projects={learnerNav} />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                  size="lg"
                  className="cursor-default"
                  tooltip={planLabel}
              >
                <div className={`flex aspect-square size-8 items-center justify-center rounded-lg ${
                  entitlements.hasPremium
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  <CrownIcon className="size-4" />
                </div>

                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {planLabel}
                </span>

                  <span className="truncate text-xs text-sidebar-foreground/60">
                  {planDescription}
                </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
  )
}
