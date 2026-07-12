'use client'

/**
 * De-branded Sub-Agent Profile.
 * Edit name + phone (via /api/users/update-profile) and change password
 * (via Supabase auth). No ARHMS chrome — lives inside the sub portal.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

export default function SubProfilePage() {
  const { dbUser } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (dbUser) {
      setFirstName(dbUser.first_name || '')
      setLastName(dbUser.last_name || '')
      setPhone((dbUser as any).phone_number || '')
    }
  }, [dbUser])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone_number: phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setProfileMsg({ type: 'err', text: data.error || 'Could not save profile' })
      } else {
        setProfileMsg({ type: 'ok', text: 'Profile updated' })
      }
    } catch {
      setProfileMsg({ type: 'err', text: 'Something went wrong' })
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (password.length < 8) {
      setPwMsg({ type: 'err', text: 'Password must be at least 8 characters' })
      return
    }
    if (password !== confirm) {
      setPwMsg({ type: 'err', text: 'Passwords do not match' })
      return
    }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setPwMsg({ type: 'err', text: error.message })
      } else {
        setPwMsg({ type: 'ok', text: 'Password changed' })
        setPassword('')
        setConfirm('')
      }
    } catch {
      setPwMsg({ type: 'err', text: 'Something went wrong' })
    } finally {
      setSavingPw(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100'
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'

  const Banner = ({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) =>
    msg ? (
      <div
        className={`rounded-lg p-3 text-sm ${
          msg.type === 'ok'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}
      >
        {msg.text}
      </div>
    ) : null

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>

      {/* Personal details */}
      <form onSubmit={saveProfile} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Personal details</h2>
        <Banner msg={profileMsg} />

        <div>
          <label className={labelCls}>Email</label>
          <input value={dbUser?.email || ''} disabled className={`${inputCls} bg-gray-50 dark:bg-gray-800 text-gray-500`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="0XXXXXXXXX"
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={savingProfile}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {savingProfile ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Change password</h2>
        <Banner msg={pwMsg} />
        <div>
          <label className={labelCls}>New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={savingPw || !password}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {savingPw ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
