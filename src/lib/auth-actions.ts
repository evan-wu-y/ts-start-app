import * as z from 'zod'
import { decodeJwt } from 'jose'
import { useAccessSession, useRefreshSession } from '@/lib/session'
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loginSchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters long' }),
})

async function login(username: string, password: string) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: username,
      password: password,
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to login')
  }
  const data = await response.json()
  return data
}

export const loginFn = createServerFn({
  method: 'POST',
})
  .inputValidator(loginSchema)
  .handler(async ({ data: { username, password } }) => {
    const data = await login(username, password)

    const accessExp = decodeJwt(data.access_token).exp
    const refreshExp = decodeJwt(data.refresh_token).exp
    const now = Math.floor(Date.now() / 1000)

    // 计算 maxAge（秒），exp 是 Unix 时间戳
    const accessMaxAge = accessExp ? accessExp - now : undefined
    const refreshMaxAge = refreshExp ? refreshExp - now : undefined

    // 分别保存 access_token 和 refresh_token 到不同的 session
    const [accessSession, refreshSession] = await Promise.all([
      useAccessSession(accessMaxAge),
      useRefreshSession(refreshMaxAge),
    ])
    await Promise.all([
      accessSession.update({ token: data.access_token }),
      refreshSession.update({ token: data.refresh_token }),
    ])

    // 登录成功后跳转到主页
    throw redirect({ to: '/' })
  })
