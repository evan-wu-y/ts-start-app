import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { decodeJwt } from 'jose'

import appCss from '../styles.css?url'
import { RouteProgress } from '../components/route-progress'
import { Toaster } from '@/components/ui/sonner'
import { useAccessSession, useRefreshSession } from '@/lib/session'
import { createServerFn } from '@tanstack/react-start'
import { refreshAccessToken } from '@/lib/auth'

const isTokenExpiringSoon = (token: string, thresholdSeconds = 60): boolean => {
  try {
    const { exp } = decodeJwt(token)
    if (!exp) return true
    const now = Math.floor(Date.now() / 1000)
    return exp - now < thresholdSeconds
  } catch {
    return true
  }
}

const fetchAccessToken = createServerFn({ method: 'GET' }).handler(async () => {
  const [accessSession, refreshSession] = await Promise.all([
    useAccessSession(),
    useRefreshSession(),
  ])

  const accessToken = accessSession.data?.token
  const refreshToken = refreshSession.data?.token

  // 有 accessToken 且距离过期超过1分钟，直接返回
  if (accessToken && !isTokenExpiringSoon(accessToken)) {
    return { accessToken }
  }

  // accessToken 不存在或即将过期，且有 refreshToken，尝试刷新
  if (refreshToken) {
    return await refreshAccessToken()
  }

  return null
})

export const Route = createRootRoute({
  beforeLoad: async () => {
    const accessToken = await fetchAccessToken()

    return {
      accessToken,
    } as const
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        <RouteProgress />
        <Outlet />
        <Toaster />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
