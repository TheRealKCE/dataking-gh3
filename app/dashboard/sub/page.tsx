'use client'

import { useEffect, useState } from 'react'
import type { BrandConfig } from '@/lib/brand-context'

interface SubDashboardData {
  status: 'pending' | 'active' | 'suspended'
  walletBalance: number
  totalEarned: number
  totalWithdrawn: number
  uplineShop: {
    shopName: string
    contactPhone?: string
  }
  ownShopSlug?: string | null
  brandConfig?: BrandConfig
}

const NETWORKS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'] as const

export default function SubDashboard() {
  const [data, setData] = useState<SubDashboardData | null>(null)
  const [brand, setBrand] = useState<BrandConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Withdrawal modal state
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [wAmount, setWAmount] = useState('')
  const [wNetwork, setWNetwork] = useState<(typeof NETWORKS)[number]>('MTN MoMo')
  const [wMomo, setWMomo] = useState('')
  const [wName, setWName] = useState('')
  const [wSubmitting, setWSubmitting] = useState(false)
  const [wError, setWError] = useState<string | null>(null)
  const [wSuccess, setWSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const openWithdraw = () => {
    setWError(null)
    setWSuccess(null)
    setWAmount('')
    setWMomo('')
    setWName('')
    setWNetwork('MTN MoMo')
    setShowWithdraw(true)
  }

  const submitWithdrawal = async () => {
    setWError(null)
    const amountNum = parseFloat(wAmount)
    if (!amountNum || amountNum <= 0) {
      setWError('Enter a valid amount')
      return
    }
    if (amountNum > (data?.walletBalance || 0)) {
      setWError('Amount exceeds your wallet balance')
      return
    }
    if (!wMomo.trim() || !wName.trim()) {
      setWError('Enter the MoMo number and account name')
      return
    }

    setWSubmitting(true)
    try {
      const res = await fetch('/api/dashboard/sub/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          momoNumber: wMomo.trim(),
          network: wNetwork,
          accountName: wName.trim(),
        }),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(result?.details?.[0] || result?.error || 'Withdrawal failed')
      }
      setWSuccess(result?.message || 'Withdrawal request submitted.')
      await fetchDashboardData()
    } catch (err: any) {
      setWError(err.message || 'Withdrawal failed')
    } finally {
      setWSubmitting(false)
    }
  }

  const fetchDashboardData = async () => {
    try {
      // Fetch sub-specific data (includes brand context)
      const response = await fetch('/api/dashboard/sub/data')
      const dashData = await response.json()

      if (response.ok) {
        setData(dashData)
        if (dashData.brandConfig) {
          setBrand(dashData.brandConfig)
        }
      } else {
        setError(dashData.error || 'Failed to load dashboard')
      }
    } catch (err) {
      setError('An error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header with branding */}
      <div>
        {brand?.logo && (
          <img
            src={brand.logo}
            alt={brand.shopName}
            className="h-12 mb-4"
          />
        )}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
          {data?.status === 'pending' ? '⏳ Pending Approval' : 'Welcome Back'}
        </h1>
        {data?.status === 'pending' && (
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Your account is waiting for approval from <strong>{data.uplineShop.shopName}</strong>.
            You can start using your wallet once approved.
          </p>
        )}
      </div>

      {/* Wallet Balance (Prominent) */}
      <div
        className="rounded-lg shadow-lg p-8 text-white"
        style={{ backgroundColor: brand?.brandColor || '#2563eb' }}
      >
        <p className="text-sm font-semibold opacity-90">Wallet Balance</p>
        <p className="text-5xl font-bold mt-2">₵{(data?.walletBalance || 0).toFixed(2)}</p>
        <div className="flex gap-4 mt-6">
          <button
            disabled={data?.status !== 'active'}
            className="px-6 py-2 bg-white text-blue-600 font-semibold rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Top Up
          </button>
          <button
            onClick={openWithdraw}
            disabled={data?.status !== 'active'}
            className="px-6 py-2 bg-white text-blue-600 font-semibold rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm">Total Earned</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mt-1">₵{(data?.totalEarned || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm">Total Withdrawn</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mt-1">₵{(data?.totalWithdrawn || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <a
          href="/dashboard/sub/orders"
          className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 text-center hover:shadow-md transition"
        >
          <p className="text-2xl mb-2">📋</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">My Orders</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">View order history</p>
        </a>

        <a
          href="/dashboard/sub/profile"
          className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 text-center hover:shadow-md transition"
        >
          <p className="text-2xl mb-2">⚙️</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">Settings</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Update profile</p>
        </a>

        {data?.ownShopSlug ? (
          <a
            href={`/shop/${data.ownShopSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 text-center hover:shadow-md transition"
          >
            <p className="text-2xl mb-2">🏪</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">My Shop</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Visit my storefront</p>
          </a>
        ) : (
          <a
            href="/dashboard/sub/shop"
            className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 text-center hover:shadow-md transition"
          >
            <p className="text-2xl mb-2">🏪</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">My Shop</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create your store</p>
          </a>
        )}
      </div>

      {/* Support Info */}
      {data?.uplineShop.contactPhone && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Need help? Contact your Lead</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{data.uplineShop.contactPhone}</p>
        </div>
      )}

      {/* Platform Attribution */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-4 border-t">
        Powered by {brand?.isPlatform ? 'ARHMS' : brand?.shopName || 'ARHMS'}
      </div>

      {/* Withdrawal Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Withdraw Funds</h2>
              <button
                onClick={() => setShowWithdraw(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Available balance:{' '}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                ₵{(data?.walletBalance || 0).toFixed(2)}
              </span>
            </p>

            {wSuccess ? (
              <div className="mt-6">
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                  {wSuccess} Your Lead will review it, or it moves to the platform payout
                  queue automatically after 48 hours.
                </div>
                <button
                  onClick={() => setShowWithdraw(false)}
                  className="mt-4 w-full rounded bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount (₵)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={wAmount}
                    onChange={(e) => setWAmount(e.target.value)}
                    placeholder="e.g. 50"
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Network</label>
                  <select
                    value={wNetwork}
                    onChange={(e) => setWNetwork(e.target.value as (typeof NETWORKS)[number])}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {NETWORKS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Mobile Money Number
                  </label>
                  <input
                    type="tel"
                    value={wMomo}
                    onChange={(e) => setWMomo(e.target.value)}
                    placeholder="e.g. 0241234567"
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Name</label>
                  <input
                    type="text"
                    value={wName}
                    onChange={(e) => setWName(e.target.value)}
                    placeholder="Name registered on the MoMo account"
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {wError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {wError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowWithdraw(false)}
                    disabled={wSubmitting}
                    className="flex-1 rounded border border-gray-300 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitWithdrawal}
                    disabled={wSubmitting}
                    className="flex-1 rounded bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {wSubmitting ? 'Submitting…' : 'Request Withdrawal'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
