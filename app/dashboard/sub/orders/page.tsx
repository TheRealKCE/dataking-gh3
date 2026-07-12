'use client'

/**
 * De-branded Sub-Agent Orders — the sub's own data/airtime purchase history.
 * Reads the `orders` table (RLS: users read their own rows). No ARHMS chrome.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

interface OrderRow {
  id: string
  network?: string
  status?: string
  created_at?: string
  amount?: number
  total_amount?: number
  recipient?: string
  recipient_phone?: string
  bundle?: string
  package_size?: string
  size?: string
}

const statusStyles: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
}

export default function SubOrdersPage() {
  const { dbUser } = useAuth()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dbUser?.id) return
    ;(async () => {
      const { data } = await (supabase
        .from('orders')
        .select('*')
        .eq('user_id', dbUser.id as any)
        .order('created_at', { ascending: false })
        .limit(100) as any)
      setOrders((data as OrderRow[]) || [])
      setLoading(false)
    })()
  }, [dbUser?.id])

  const bundleOf = (o: OrderRow) => o.bundle || o.package_size || o.size || 'Bundle'
  const recipientOf = (o: OrderRow) => o.recipient_phone || o.recipient || ''
  const amountOf = (o: OrderRow) => Number(o.total_amount ?? o.amount ?? 0)

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Orders</h1>

      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-10 text-center text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">No orders yet</p>
          <p className="text-sm">Your purchases will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {o.network ? `${o.network} · ` : ''}
                  {bundleOf(o)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {recipientOf(o) && `${recipientOf(o)} · `}
                  {o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 dark:text-gray-100">₵{amountOf(o).toFixed(2)}</p>
                <span
                  className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    statusStyles[o.status || ''] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {o.status || 'unknown'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
