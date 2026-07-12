'use client'

/**
 * De-branded Sub-Agent Portal Login
 *
 * A neutral (non-ARHMS) sign-in page for sub-agents, matching the de-branded
 * /join signup portal. Reuses the shared auth engine; on success it sends the
 * user to /dashboard, where middleware routes sub-agents to /dashboard/sub.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export default function PortalLoginPage() {
  const { signIn, user, isLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already signed in → straight to the portal.
  useEffect(() => {
    if (!isLoading && user) {
      window.location.href = '/dashboard/sub'
    }
  }, [user, isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(
          error.message?.startsWith('TOO_MANY_ATTEMPTS:')
            ? 'Too many attempts. Please try again later.'
            : error.message || 'Login failed'
        )
        setLoading(false)
        return
      }
      // Middleware sends sub-agents from /dashboard → /dashboard/sub.
      window.location.href = '/dashboard'
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Sub-Agent Portal</h1>
          <p className="text-gray-600 mt-2">Sign in to continue</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!email || !password || loading}
              className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Signed up but not approved yet? Ask your Lead to approve your account.
          </p>
        </div>
      </div>
    </div>
  )
}
