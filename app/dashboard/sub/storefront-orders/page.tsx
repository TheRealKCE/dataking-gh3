'use client'

/**
 * De-branded Sub-Agent "Store Orders" — the orders CUSTOMERS placed on the
 * sub's own storefront (shop_orders for the shop they own), mirroring the Lead's
 * /dashboard/shop/orders. Reads shop_orders by the sub's shop_id (RLS: the shop
 * owner reads their own rows). Lets the sub file a complaint on a recent order,
 * reusing /api/complaints/submit. No ARHMS chrome.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCcw,
  MessageSquare,
  Search,
  Loader2,
} from 'lucide-react'

interface ShopOrder {
  id: string
  guest_phone: string
  network: string
  package_size: string
  selling_price: number
  profit: number
  status: string
  created_at: string
  package_id?: string | null
  orders?: { id: string; complaints: any[] }[]
}

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
}

const statusIcon: Record<string, any> = {
  pending: Clock,
  processing: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  refunded: AlertCircle,
}

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5

export default function SubStorefrontOrdersPage() {
  const { dbUser } = useAuth()
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasShop, setHasShop] = useState<boolean | null>(null)

  const [tab, setTab] = useState<'data' | 'airtime'>('data')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState<'today' | '7d' | '30d' | 'all'>('7d')
  const [searchPhone, setSearchPhone] = useState('')

  // Complaint modal
  const [selected, setSelected] = useState<ShopOrder | null>(null)
  const [complaint, setComplaint] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchOrders = async () => {
    if (!dbUser?.id) return
    const { data: shop } = await (supabase as any)
      .from('shop_profiles')
      .select('id')
      .eq('owner_id', dbUser.id)
      .maybeSingle()

    if (!shop) {
      setHasShop(false)
      setLoading(false)
      return
    }
    setHasShop(true)

    let query = (supabase as any)
      .from('shop_orders')
      .select('*, orders:orders!shop_order_id(id, complaints(*))')
      .eq('shop_id', shop.id)

    const now = new Date()
    if (filterDate === 'today') {
      query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
    } else if (filterDate === '7d') {
      query = query.gte('created_at', new Date(now.getTime() - 7 * 864e5).toISOString())
    } else if (filterDate === '30d') {
      query = query.gte('created_at', new Date(now.getTime() - 30 * 864e5).toISOString())
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      console.error('[SubStorefrontOrders] Query error:', error)
      toast.error('Failed to load store orders')
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUser?.id, filterDate])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchOrders()
    setRefreshing(false)
  }

  const submitComplaint = async () => {
    if (!selected || !complaint.trim()) return
    setSubmitting(true)
    try {
      const { data: mirror, error: mErr } = await (supabase as any)
        .from('orders')
        .select('id, reference_code')
        .eq('shop_order_id', selected.id)
        .single()
      if (mErr || !mirror) throw new Error('Could not find the linked order record')

      const res = await fetch('/api/complaints/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: mirror.id,
          title: `[Shop: ${dbUser?.first_name}] Issue with order ${mirror.reference_code}`,
          description: complaint.trim(),
          priority: 'medium',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to submit complaint')

      toast.success('Complaint submitted')
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selected.id ? { ...o, orders: [{ id: mirror.id, complaints: [data.complaint] }] } : o
        )
      )
      setSelected(null)
      setComplaint('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit complaint')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = orders.filter((o) => {
    const type = o.package_id == null ? 'airtime' : 'data'
    if (type !== tab) return false
    if (filterStatus !== 'all' && o.status !== filterStatus) return false
    if (searchPhone && !(o.guest_phone || '').includes(searchPhone)) return false
    return true
  })

  const earning = filtered.filter((o) => ['pending', 'processing', 'completed'].includes(o.status))
  const stats = {
    total: filtered.length,
    pending: filtered.filter((o) => o.status === 'pending').length,
    completed: filtered.filter((o) => o.status === 'completed').length,
    revenue: earning.reduce((s, o) => s + (o.selling_price || 0), 0),
    profit: earning.reduce((s, o) => s + (o.profit || 0), 0),
  }

  const card = 'bg-white dark:bg-gray-900 rounded-lg shadow'

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 text-center text-gray-500 dark:text-gray-400 py-16">
        Loading store orders…
      </div>
    )
  }

  if (hasShop === false) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className={`${card} p-10 text-center`}>
          <p className="text-4xl mb-3">🏪</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">No storefront yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create your shop to start receiving customer orders.
          </p>
          <a
            href="/dashboard/sub/shop"
            className="inline-block mt-4 px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Create your shop
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Store Orders</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Orders', value: String(stats.total) },
          { label: 'Pending', value: String(stats.pending) },
          { label: 'Revenue', value: `₵${stats.revenue.toFixed(2)}` },
          { label: 'Your Profit', value: `₵${stats.profit.toFixed(2)}` },
        ].map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {(['data', 'airtime'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t === 'data' ? 'Data Bundles' : 'Airtime'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            placeholder="Search customer phone…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value as any)}
            aria-label="Filter by date"
            className="rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm"
          >
            <option value="today">Today</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="all">All</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className={`${card} p-10 text-center text-gray-500 dark:text-gray-400`}>
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">No orders found</p>
          <p className="text-sm">Customer orders on your storefront will show here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const Icon = statusIcon[o.status] || Clock
            const existing = o.orders?.[0]?.complaints || []
            const canComplain = o.status === 'completed' && hoursSince(o.created_at) < 48
            return (
              <div key={o.id} className={`${card} p-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {o.network} {o.package_id == null ? 'Airtime' : o.package_size}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {o.guest_phone} · {new Date(o.created_at).toLocaleDateString()}{' '}
                      {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100">₵{(o.selling_price || 0).toFixed(2)}</p>
                    {o.status !== 'failed' && (
                      <p className="text-xs font-semibold text-emerald-600">
                        +₵{(o.profit || 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      statusStyles[o.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {o.status}
                  </span>

                  {existing.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-blue-600">
                      <MessageSquare className="w-3 h-3" />
                      Complaint: {String(existing[0]?.status || '').replace('_', ' ')}
                    </span>
                  ) : (
                    canComplain && (
                      <button
                        onClick={() => {
                          setSelected(o)
                          setComplaint('')
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Complain
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Complaint modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${card} w-full max-w-md p-6`}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">File a Complaint</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Order for {selected.guest_phone} — {selected.network}{' '}
              {selected.package_id == null ? 'Airtime' : selected.package_size}
            </p>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={4}
              placeholder="Describe the problem your customer is facing…"
              className="mt-4 w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2 font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitComplaint}
                disabled={submitting || !complaint.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
