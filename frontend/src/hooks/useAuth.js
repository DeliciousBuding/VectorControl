import { useCallback, useEffect, useState } from 'react'
import {
  fetchMe,
  getStoredToken,
  loginUser,
  logoutUser,
  registerUser,
  setStoredToken
} from '../api.js'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  const initSession = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setAuthReady(true)
      return null
    }

    try {
      const payload = await fetchMe()
      setUser(payload?.user || null)
      return payload?.user || null
    } catch {
      setStoredToken('')
      setUser(null)
      return null
    } finally {
      setAuthReady(true)
    }
  }, [])

  useEffect(() => {
    void initSession()
  }, [initSession])

  const login = useCallback(async ({ username, password, mode = 'login' }) => {
    setAuthLoading(true)
    try {
      const payload = mode === 'register'
        ? await registerUser({ username, password })
        : await loginUser({ username, password })
      setStoredToken(payload.token)
      setUser(payload.user)
      return payload.user
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } catch {
      // 忽略退出异常
    }
    setStoredToken('')
    setUser(null)
  }, [])

  return {
    user,
    authLoading,
    authReady,
    login,
    logout,
    initSession
  }
}
