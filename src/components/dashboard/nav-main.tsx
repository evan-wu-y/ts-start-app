"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { Link, useLocation, type LinkOptions } from "@tanstack/react-router"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

type NavMainItem = {
  title: string
  linkOptions: LinkOptions
  icon?: LucideIcon
  items?: readonly {
    title: string
    linkOptions: LinkOptions
  }[]
}

export function NavMain({
  items,
}: {
  items: NavMainItem[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>导航</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const itemPath = item.linkOptions.to || item.linkOptions.href || ''
          const isActive = location.pathname === itemPath ||
            (item.items?.some(subItem => {
              const subItemPath = subItem.linkOptions.to || subItem.linkOptions.href || ''
              return location.pathname === subItemPath
            }))

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={isActive}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    {item.items && item.items.length > 0 && (
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                {item.items && item.items.length > 0 && (
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => {
                        const subItemPath = subItem.linkOptions.to || subItem.linkOptions.href || ''
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname === subItemPath}>
                              <Link {...subItem.linkOptions}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                )}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

