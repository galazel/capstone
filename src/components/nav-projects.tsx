"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useNavigate } from "react-router-dom"

type NavItem = {
  name: string
  url: string
  icon: LucideIcon
}

type NavGroup = {
  name: string
  items: NavItem[]
}

type NavProjectsProps = {
  projects: Record<string, NavGroup>
}

export function NavProjects({ projects }: NavProjectsProps) {
  const navigate = useNavigate()
  const [activeUrl, setActiveUrl] = React.useState("")

  const handleNavigate = (url: string) => {
    setActiveUrl(url)
    navigate(url)
  }

  return (
    <>
      {Object.values(projects).map((group) => (
        <SidebarGroup
          key={group.name}
          className="group-data-[collapsible=icon]:hidden"
        >
          <SidebarGroupLabel>{group.name}</SidebarGroupLabel>

          <SidebarMenu>
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = activeUrl === item.url

              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.name}
                    isActive={isActive}
                    className={`
                      rounded-none
                      border-l-4
                      border-l-transparent
                      ${
                        isActive
                          ? "border-l-black bg-sidebar-accent text-sidebar-accent-foreground"
                          : ""
                      }
                    `}
                  >
                    <a
                      href={item.url}
                      onClick={(event) => {
                        event.preventDefault()
                        handleNavigate(item.url)
                      }}
                    >
                      <Icon className="size-4" />
                      <span>{item.name}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}