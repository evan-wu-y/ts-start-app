import { useSession } from '@tanstack/react-start/server'

const SESSION_PASSWORD = 'ChangeThisBeforeShippingToProdOrYouWillBeFired'

type AccessSession = {
  token: string
}

type RefreshSession = {
  token: string
}

export function useAccessSession(maxAge?: number) {
  return useSession<AccessSession>({
    password: SESSION_PASSWORD,
    name: 'access-session',
    cookie: {
      maxAge,
    },
  })
}

export function useRefreshSession(maxAge?: number) {
  return useSession<RefreshSession>({
    password: SESSION_PASSWORD,
    name: 'refresh-session',
    cookie: {
      maxAge,
    },
  })
}
