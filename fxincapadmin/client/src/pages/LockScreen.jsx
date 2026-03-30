import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_URL = (import.meta.env.VITE_API_URL ?? '').trim()

const safeParseJson = async (response) => {
  const raw = await response.text()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const LockScreen = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { verifySession, markUnlocked } = useAuth()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('Admin')

  useEffect(() => {
    // Get user info from localStorage
    const userStr = localStorage.getItem('adminUser')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setUserName(user.firstName || user.email || 'Admin')
      } catch (e) {
        console.error('Failed to parse user data')
      }
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Please enter your password')
      return
    }

    const sessionId = localStorage.getItem('adminSessionId')
    if (!sessionId) {
      setError('Session not found. Please login again.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/admin-auth/unlock-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          password,
        }),
      })

      const data = await safeParseJson(response)

      if (response.ok && data?.success) {
        await verifySession(sessionId)
        markUnlocked()
        const lastPath = localStorage.getItem('lastProtectedPath') || location.state?.from?.pathname || '/dashboard'
        navigate(lastPath, { replace: true })
      } else {
        setError(data?.error || `Failed to unlock screen (HTTP ${response.status})`)
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminSessionId')
    localStorage.removeItem('adminUser')
    // Redirect to login
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header Section with Logo */}
          <div className="bg-black px-8 py-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <img 
                  src="/logo_white.png" 
                  alt="SUIMFX Logo" 
                  className="w-12 h-12 object-contain"
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Enter Password</h1>
            <p className="text-slate-400 text-sm">
              Hello <span className="text-white font-medium">{userName}</span>, enter your password to unlock the screen!
            </p>
          </div>

          {/* Form Section */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Unlocking...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </>
                )}
              </button>

              {/* Sign in Link */}
              <div className="text-center pt-4">
                <span className="text-slate-500 text-sm">Not you? return </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                >
                  Sign in here
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
