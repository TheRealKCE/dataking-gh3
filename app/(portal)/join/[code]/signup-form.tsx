'use client'

import { useState } from 'react'
import { createRouteHandlerClient } from '@/lib/supabase-server'

interface SignupFormProps {
  inviteId: string
  shopId: string
  shopName: string
  brandColor: string
}

type FormStep = 'email-password' | 'otp' | 'success'

export function SubAgentSignupForm({
  inviteId,
  shopId,
  shopName,
  brandColor,
}: SignupFormProps) {
  const [step, setStep] = useState<FormStep>('email-password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Call signup endpoint to:
      // 1. Create Supabase auth user
      // 2. Create users table row
      // 3. Create sub_agents row (status='pending')
      // 4. Send OTP SMS to phone
      const response = await fetch('/api/shop/sub-agents/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          phone,
          inviteId,
          shopId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      setSuccessMessage('OTP sent to your phone. Check SMS to verify.')
      setStep('otp')
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || 'An error occurred')
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Verify OTP and confirm account creation
      const response = await fetch('/api/shop/sub-agents/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          otp,
          inviteId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'OTP verification failed')
        setLoading(false)
        return
      }

      setStep('success')
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || 'An error occurred')
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="text-center">
        <div
          className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl"
          style={{ backgroundColor: brandColor }}
        >
          ✓
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Account Created!
        </h2>
        <p className="text-gray-600 mb-4">
          Your sub-agent account has been created and is pending approval from{' '}
          <strong>{shopName}</strong>.
        </p>
        <p className="text-sm text-gray-500">
          You'll receive an SMS when your account is approved. Then you can set up
          your wallet and start selling!
        </p>
        <button
          onClick={() => (window.location.href = '/login')}
          className="mt-6 w-full px-4 py-2 rounded-lg text-white font-semibold"
          style={{ backgroundColor: brandColor }}
        >
          Go to Login
        </button>
      </div>
    )
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Verify Your Phone
        </h2>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            One-Time Password
          </label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none text-center text-2xl tracking-widest"
            style={{ focusRingColor: brandColor }}
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter the 6-digit code sent to {phone}
          </p>
        </div>

        <button
          type="submit"
          disabled={!otp || otp.length !== 6 || loading}
          className="w-full px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: brandColor }}
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>

        <button
          type="button"
          onClick={() => setStep('email-password')}
          className="w-full text-sm text-gray-600 hover:text-gray-900 py-2"
        >
          Back
        </button>
      </form>
    )
  }

  // Email/Password step
  return (
    <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Account</h2>

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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
          minLength={8}
          required
        />
        <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder="0XXXXXXXXX"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
          pattern="0\d{9}"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Ghana format: 0XXXXXXXXX</p>
      </div>

      <button
        type="submit"
        disabled={!email || !password || password.length < 8 || !phone || loading}
        className="w-full px-4 py-2 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: brandColor }}
      >
        {loading ? 'Creating Account...' : 'Continue'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By signing up, you agree to our Terms of Service and Privacy Policy
      </p>
    </form>
  )
}
