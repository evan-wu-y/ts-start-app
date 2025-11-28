import { useAccessSession, useRefreshSession } from './session'

export async function refreshAccessToken() {
  const accessSession = await useAccessSession()
  const refreshSession = await useRefreshSession()
  if (!refreshSession.data?.token) {
    return null
  }
  const newTokenResponse = await fetch(
    `${import.meta.env.VITE_API_URL}/refresh`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshSession.data.token,
      }),
    },
  )
  if (!newTokenResponse.ok) {
    return null
  }

  const newTokenData = await newTokenResponse.json()

  await accessSession.update({ token: newTokenData.access_token })
  await refreshSession.update({ token: newTokenData.refresh_token })

  return newTokenData.access_token as string
}
