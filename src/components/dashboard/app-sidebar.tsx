"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Home,
  Server,
  Network,
  Code,
  Sparkles,
  Folder,
  Table2,
  Database,
} from "lucide-react"
import { linkOptions } from "@tanstack/react-router"

import { NavMain } from "./nav-main"
import { NavProjects } from "./nav-projects"
import { NavUser } from "./nav-user"
import { TeamSwitcher } from "./team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"

// 使用 linkOptions 创建类型安全的导航项
const navMainItems = [
  {
    title: "首页",
    linkOptions: linkOptions({ to: "/" }),
    icon: Home,
    items: [
      {
        title: "概览",
        linkOptions: linkOptions({ to: "/" }),
      },
    ],
  },
  {
    title: "仪表盘",
    linkOptions: linkOptions({ to: "/dashboard" }),
    icon: LayoutDashboard,
    items: [
      {
        title: "概览",
        linkOptions: linkOptions({ to: "/dashboard" }),
      },
    ],
  },
  {
    title: "文件管理",
    linkOptions: linkOptions({ to: "/files" }),
    icon: Folder,
    items: [
      {
        title: "文件列表",
        linkOptions: linkOptions({ to: "/files" }),
      },
    ],
  },
  {
    title: "表格转换",
    linkOptions: linkOptions({ to: "/table-converter" as any }),
    icon: Table2,
    items: [
      {
        title: "数据转换",
        linkOptions: linkOptions({ to: "/table-converter" as any }),
      },
    ],
  },
  {
    title: "数据表格",
    linkOptions: linkOptions({ to: "/data-table" as any }),
    icon: Database,
    items: [
      {
        title: "表格展示",
        linkOptions: linkOptions({ to: "/data-table" as any }),
      },
    ],
  },
  {
    title: "演示",
    linkOptions: linkOptions({ to: "/demo/ssr" }),
    icon: Code,
    items: [
      {
        title: "SSR 演示",
        linkOptions: linkOptions({ to: "/demo/ssr" }),
      },
      {
        title: "服务器函数",
        linkOptions: linkOptions({ to: "/demo/server-funcs" }),
      },
      {
        title: "API 请求",
        linkOptions: linkOptions({ to: "/demo/api-request" }),
      },
      {
        title: "SPA 模式",
        linkOptions: linkOptions({ to: "/demo/ssr/spa-mode" }),
      },
      {
        title: "完整 SSR",
        linkOptions: linkOptions({ to: "/demo/ssr/full-ssr" }),
      },
      {
        title: "仅数据 SSR",
        linkOptions: linkOptions({ to: "/demo/ssr/data-only" }),
      },
    ],
  },
]

const projectItems = [
  {
    name: "服务器函数",
    linkOptions: linkOptions({ to: "/demo/server-funcs" }),
    icon: Server,
  },
  {
    name: "API 请求",
    linkOptions: linkOptions({ to: "/demo/api-request" }),
    icon: Network,
  },
  {
    name: "SSR 演示",
    linkOptions: linkOptions({ to: "/demo/ssr" }),
    icon: Sparkles,
  },
]

const data = {
  user: {
    name: "用户",
    email: "user@example.com",
    avatar: "",
  },
  teams: [
    {
      name: "TanStack Start",
      logo: LayoutDashboard,
      plan: "Enterprise",
    },
  ],
  navMain: navMainItems,
  projects: projectItems,
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 pr-2">
            <NavMain items={data.navMain} />
            <NavProjects projects={data.projects} />
          </div>
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

