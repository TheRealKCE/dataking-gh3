'use client'

import { useEffect, useState } from 'react'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { resolveBrandContext, type BrandConfig } from '@/lib/brand-context'

interface SubDashboardData {
  status: 'pending' | 'active' | 'suspended'
  walletBalance: number
  totalEarned: number
  totalWithdrawn: number
  uplineShop: {
    shopName: string
    contactPhone?: string
  }
}

export default function SubDashboard() {
  const [data, setData] = useState<SubDashboardData | null>(null)
  const [brand, setBrand] = useState<BrandConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const supabaseAuth = await createRouteHandlerClient()
      const { data: { user } } = await supabaseAuth.auth.getUser()

      if (!user) {
        setError('Not authenticated')
        return
      }

      // Get brand context
      const brandConfig = await resolveBrandContext(user.id, supabaseAuth)
      setBrand(brandConfig)

      // Fetch sub-specific data
      const response = await fetch('/api/dashboard/sub/data')
      const dashData = await response.json()

      if (response.ok) {
        setData(dashData)
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
          <p className="text-gray-600 mt-2">Loading dashboard...</p>
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
        <h1 className="text-3xl font-bold text-gray-900">
          {data?.status === 'pending' ? '⏳ Pending Approval' : 'Welcome Back'}
        </h1>
        {data?.status === 'pending' && (
          <p className="text-gray-600 mt-2">
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
            disabled={data?.status !== 'active'}
            className="px-6 py-2 bg-white text-blue-600 font-semibold rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Earned</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₵{(data?.totalEarned || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Withdrawn</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₵{(data?.totalWithdrawn || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <a
          href="/dashboard/sub/orders"
          className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition"
        >
          <p className="text-2xl mb-2">📋</p>
          <p className="font-semibold text-gray-900">My Orders</p>
          <p className="text-sm text-gray-600">View order history</p>
        </a>

        <a
          href="/dashboard/sub/settings"
          className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition"
        >
          <p className="text-2xl mb-2">⚙️</p>
          <p className="font-semibold text-gray-900">Settings</p>
          <p className="text-sm text-gray-600">Update profile</p>
        </a>

        <a
          href={`/shop/${brand?.uplineShopId}`}
          className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition"
        >
          <p className="text-2xl mb-2">🏪</p>
          <p className="font-semibold text-gray-900">Shop</p>
          <p className="text-sm text-gray-600">Visit storefront</p>
        </a>
      </div>

      {/* Support Info */}
      {data?.uplineShop.contactPhone && (
        <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-600">
          <p>Need help? Contact your Lead</p>
          <p className="font-semibold text-gray-900">{data.uplineShop.contactPhone}</p>
        </div>
      )}

      {/* Platform Attribution */}
      <div className="text-center text-xs text-gray-500 pt-4 border-t">
        Powered by {brand?.isPlatform ? 'KiNG FLEXY' : brand?.shopName || 'KiNG FLEXY'}
      </div>
    </div>
  )
}
