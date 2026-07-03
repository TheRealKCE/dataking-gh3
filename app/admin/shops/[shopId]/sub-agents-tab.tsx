'use client'

import { useState, useEffect } from 'react'

interface SubAgent {
  id: string
  status: 'pending' | 'active' | 'suspended'
  user: {
    email: string
    phone_number: string
    first_name: string
  }
  createdAt: string
}

interface SubAgentsTabProps {
  shopId: string
}

export function SubAgentsTab({ shopId }: SubAgentsTabProps) {
  const [subs, setSubs] = useState<SubAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubs()
  }, [shopId])

  const fetchSubs = async () => {
    try {
      const response = await fetch(`/api/admin/shops/${shopId}/sub-agents`)
      const data = await response.json()

      if (response.ok) {
        setSubs(data.subs || [])
      } else {
        setError(data.error || 'Failed to load sub-agents')
      }
    } catch (err) {
      setError('An error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: subs.length,
    active: subs.filter(s => s.status === 'active').length,
    pending: subs.filter(s => s.status === 'pending').length,
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded p-3">
          <p className="text-sm text-gray-600">Total Subs</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded p-3">
          <p className="text-sm text-green-700">Active</p>
          <p className="text-2xl font-bold text-green-900">{stats.active}</p>
        </div>
        <div className="bg-yellow-50 rounded p-3">
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
        </div>
      </div>

      {/* List */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-sm">
          {error}
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          No sub-agents yet
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map(sub => (
            <div
              key={sub.id}
              className="bg-white border rounded p-3 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-gray-900">{sub.user.first_name || sub.user.email}</p>
                <p className="text-sm text-gray-600">{sub.user.phone_number}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  sub.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : sub.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
