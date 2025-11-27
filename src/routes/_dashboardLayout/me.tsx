import { useAccessSession } from '@/lib/session'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const getMe = createServerFn({
  method: 'GET',
}).handler(async () => {
  const accessSession = await useAccessSession()
  const me = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessSession.data?.token}`,
    },
  })
  if (!me.ok) {
    throw new Error('Failed to get me')
  }
  return me.json() as Promise<{
    username: string
    email: string
    avatar: string
  }>
})

export const Route = createFileRoute('/_dashboardLayout/me')({
  component: RouteComponent,
  loader: async () => await getMe(),
  errorComponent: ({ error }) => {
    return <div>Error: {error.message}</div>
  },
})

function RouteComponent() {
  const me = Route.useLoaderData()
  return <div>Hello {me.username}!</div>
}
