import { NavLink } from "react-router-dom"
import {
  AwardIcon,
  BarChart3Icon,
  Building2Icon,
  FolderOpenIcon,
  GraduationCapIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  MailPlusIcon,
  ReceiptTextIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  UsersRoundIcon,
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

const enterpriseNav = {
  main: {
    name: "Main",
    items: [
      {
        name: "Dashboard",
        url: "/enterprise/dashboard",
        icon: LayoutDashboardIcon,
      },
      {
        name: "Learners",
        url: "/enterprise/learners",
        activeUrls: ["/enterprise/learners"],
        icon: UsersIcon,
      },
      {
        name: "Invitations",
        url: "/enterprise/invitations",
        icon: MailPlusIcon,
      },
      {
        name: "Certifications",
        url: "/enterprise/certifications",
        icon: GraduationCapIcon,
      },
      {
        name: "Groups",
        url: "/enterprise/groups",
        icon: UsersRoundIcon,
      },
      {
        name: "Analytics",
        url: "/enterprise/analytics",
        icon: BarChart3Icon,
      },
    ],
  },
  management: {
    name: "Management",
    items: [
      {
        name: "Partnership",
        url: "/enterprise/partnership",
        icon: HandshakeIcon,
      },
      {
        name: "License",
        url: "/enterprise/license",
        icon: SparklesIcon,
      },
      {
        name: "Billing",
        url: "/enterprise/billing",
        icon: ReceiptTextIcon,
      },
      {
        name: "Files",
        url: "/enterprise/files",
        icon: FolderOpenIcon,
      },
      {
        name: "Organization",
        url: "/enterprise/organization",
        icon: Building2Icon,
      },
      {
        name: "Settings",
        url: "/enterprise/settings",
        icon: SettingsIcon,
      },
    ],
  },
}

export function EnterpriseAppSidebar(props) {
  return (
    <Sidebar variant="sidebar" {...props}>
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/enterprise/dashboard">
                <BrandLogo className="size-8" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Rebyu</span>
                  <span className="truncate text-xs">Organization Portal</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="justify-center">
        <NavProjects projects={enterpriseNav} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <BrandLogo className="size-8" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">REBYU</span>
                <span className="truncate text-xs">Empowering teams</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
