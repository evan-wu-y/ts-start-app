import React from 'react'
import {
  createFileRoute,
  Outlet,
  Link,
  useLocation,
  redirect,
} from '@tanstack/react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardNotFound } from '@/components/not-found'

export const Route = createFileRoute('/_dashboardLayout')({
  beforeLoad: ({ context }) => {
    if (!context.accessToken) {
      throw redirect({ to: '/login' })
    }
  },
  component: PathlessLayoutComponent,
  notFoundComponent: DashboardNotFound,
})

function PathlessLayoutComponent() {
  const location = useLocation()

  // 根据路径生成面包屑
  const getBreadcrumbs = (): Array<{
    label: string
    path: string
    isLast?: boolean
  }> => {
    const path = location.pathname
    const segments = path.split('/').filter(Boolean)

    if (segments.length === 0) {
      return [{ label: '首页', path: '/', isLast: true }]
    }

    const breadcrumbs: Array<{
      label: string
      path: string
      isLast?: boolean
    }> = [{ label: '首页', path: '/', isLast: false }]
    let currentPath = ''

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const label = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      breadcrumbs.push({
        label,
        path: currentPath,
        isLast: index === segments.length - 1,
      })
    })

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.path}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.path}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden w-full [view-transition-name:main-content]">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
