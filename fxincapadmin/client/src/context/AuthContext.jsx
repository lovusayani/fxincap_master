import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const API_URL = (import.meta.env.VITE_API_URL ?? '').trim()
const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

const safeParseJson = async (response) => {
  const raw = await response.text()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [token, setToken] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')

  // Hydrate from localStorage and verify session
  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken')
    const savedSessionId = localStorage.getItem('adminSessionId')
    const savedUser = localStorage.getItem('adminUser')
    if (savedToken && savedSessionId) {
      setToken(savedToken)
      setSessionId(savedSessionId)
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch (_) {
          setUser(null)
        }
      }
      verifySession(savedSessionId)
    } else {
      setChecking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearAuth = () => {
    setToken(null)
    setSessionId(null)
    setUser(null)
    setLocked(false)
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminSessionId')
    localStorage.removeItem('adminUser')
  }

  // Auto-lock after inactivity
  useEffect(() => {
    if (!sessionId || locked) return undefined

    let timer

    const lockForInactivity = async () => {
      try {
        await fetch(`${API_URL}/api/admin-auth/lock-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
      } catch (err) {
        console.warn('Failed to lock session on server', err)
      } finally {
        setLocked(true)
        navigate('/lock-screen', { replace: true, state: { reason: 'idle' } })
      }
    }

    const resetTimer = () => {
      if (locked) return
      clearTimeout(timer)
      timer = setTimeout(lockForInactivity, IDLE_TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'visibilitychange']
    events.forEach((evt) => window.addEventListener(evt, resetTimer))

    resetTimer()

    return () => {
      clearTimeout(timer)
      events.forEach((evt) => window.removeEventListener(evt, resetTimer))
    }
  }, [sessionId, locked, navigate])

  const logout = () => {
    const currentSessionId = localStorage.getItem('adminSessionId') || sessionId
    if (currentSessionId) {
      fetch(`${API_URL}/api/admin-auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId }),
      }).catch(() => {})
    }
    clearAuth()
    navigate('/login')
  }

  const verifySession = async (id = sessionId) => {
    if (!id) {
      setChecking(false)
      return
    }
    setChecking(true)
    setError('')
    try {
      const resp = await fetch(`${API_URL}/api/admin-auth/session/${id}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await safeParseJson(resp)
      if (resp.ok && data?.success && data?.session) {
        setLocked(!!data.session.isLocked || data.session.is_locked)
        setUser({
          id: data.session.user?.id,
          email: data.session.user?.email,
          firstName: data.session.user?.firstName,
          lastName: data.session.user?.lastName,
          status: data.session.user?.status,
        })
        localStorage.setItem('adminUser', JSON.stringify({
          id: data.session.user?.id,
          email: data.session.user?.email,
          firstName: data.session.user?.firstName,
          lastName: data.session.user?.lastName,
          status: data.session.user?.status,
        }))
      } else {
        clearAuth()
      }
    } catch (err) {
      setError(err?.message || 'Failed to verify session')
    } finally {
      setChecking(false)
    }
  }

  const value = useMemo(() => ({
    token,
    sessionId,
    user,
    locked,
    checking,
    error,
    setAuth: ({ token: t, sessionId: s, user: u }) => {
      if (t) {
        setToken(t)
        localStorage.setItem('adminToken', t)
      }
      if (s) {
        setSessionId(s)
        localStorage.setItem('adminSessionId', s)
      }
      if (u) {
        setUser(u)
        localStorage.setItem('adminUser', JSON.stringify(u))
      }
      setLocked(false)
    },
    markUnlocked: () => setLocked(false),
    verifySession,
    logout,
  }), [token, sessionId, user, locked, checking, error])

  // Save last attempted protected path to resume after unlock/login
  useEffect(() => {
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/register') || location.pathname.startsWith('/lock-screen')) return
    localStorage.setItem('lastProtectedPath', location.pathname + location.search)
  }, [location])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
