'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Phone, RefreshCw, Loader2, CheckCircle, XCircle, Clock, Settings2, Save, AlertTriangle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const NETWORKS = ['MTN', 'Telecel', 'AT'] as const
type Network = typeof NETWORKS[number]

const STATUS_TRANSITIONS: Record<string, string[]> = {
    pending: ['processing', 'failed'],
    processing: ['completed', 'failed'],
    completed: [],
    failed: [],
}

const NETWORK_COLORS: Record<Network, string> = {
    MTN: 'bg-amber-100 text-amber-700 border-amber-200',
    Telecel: 'bg-red-100 text-red-700 border-red-200',
    AT: 'bg-orange-100 text-orange-700 border-orange-200',
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-700 border-amber-200',
        processing: 'bg-blue-100 text-blue-700 border-blue-200',
        completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        failed: 'bg-red-100 text-red-700 border-red-200',
    }
    const icons: Record<string, React.ReactNode> = {
        pending: <Clock className="w-3 h-3" />,
        processing: <Loader2 className="w-3 h-3 animate-spin" />,
        completed: <CheckCircle className="w-3 h-3" />,
        failed: <XCircle className="w-3 h-3" />,
    }
    return (
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize', map[status] || 'bg-slate-100 text-slate-600 border-slate-200')}>
            {icons[status]} {status}
        </span>
    )
}

interface Order {
    id: string; reference_code: string; status: string; network: Network
    beneficiary_phone: string; airtime_amount: number; fee_amount: number
    total_paid: number; fee_rate: number; user_role: string; created_at: string
    users?: { first_name: string; last_name: string; email: string }
    fulfillment_note?: string; fulfilled_at?: string
}

interface AirtimeSettings {
    airtime_fee_mtn_customer: string; airtime_fee_mtn_agent: string
    airtime_fee_telecel_customer: string; airtime_fee_telecel_agent: string
    airtime_fee_at_customer: string; airtime_fee_at_agent: string
    airtime_min_amount: string; airtime_max_amount: string
    airtime_enabled_mtn: string; airtime_enabled_telecel: string; airtime_enabled_at: string
}

// ─── Status Action Modal ───────────────────────────────────────────────────────
function ActionModal({ order, onClose, onSuccess }: { order: Order | null; onClose: () => void; onSuccess: () => void }) {
    const [targetStatus, setTargetStatus] = useState('')
    const [note, setNote] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => { if (order) { setTargetStatus(''); setNote('') } }, [order])

    if (!order) return null
    const transitions = STATUS_TRANSITIONS[order.status] || []

    const handleSubmit = async () => {
        if (!targetStatus) return
        if (targetStatus === 'failed' && !note.trim()) {
            toast.error('A reason note is required when marking as failed')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/admin/airtime/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, status: targetStatus, fulfillmentNote: note }),
            })
            const d = await res.json()
            if (!res.ok) { toast.error(d.error || 'Failed to update order'); return }
            toast.success(`Order marked as ${targetStatus}`)
            onSuccess()
            onClose()
        } catch { toast.error('An error occurred') }
        finally { setLoading(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Update Order Status</h3>
                    <p className="text-sm text-slate-500 mb-5 font-mono">{order.reference_code}</p>

                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-5 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-semibold">{order.users?.first_name} {order.users?.last_name}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Beneficiary</span><span className="font-semibold font-mono">{order.beneficiary_phone}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Network</span><span className="font-semibold">{order.network}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Airtime to send</span><span className="font-bold text-emerald-600">GHS {order.airtime_amount.toFixed(2)}</span></div>
                    </div>

                    {transitions.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-2">This order cannot be updated further.</p>
                    ) : (
                        <>
                            <div className="mb-4">
                                <Label className="text-sm font-semibold mb-2 block">New Status</Label>
                                <div className="flex gap-2">
                                    {transitions.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setTargetStatus(s)}
                                            className={cn(
                                                'flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 capitalize transition-all',
                                                targetStatus === s
                                                    ? s === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white'
                                                        : s === 'failed' ? 'bg-red-500 border-red-500 text-white'
                                                            : 'bg-blue-500 border-blue-500 text-white'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                            )}
                                        >{s}</button>
                                    ))}
                                </div>
                            </div>

                            {targetStatus === 'failed' && (
                                <div className="mb-4">
                                    <Label className="text-sm font-semibold mb-2 block text-red-600">Reason for Failure <span className="text-red-500">*</span></Label>
                                    <textarea
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="Describe why this order failed..."
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-300"
                                    />
                                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> No refund will be triggered. Use Admin Manual Credit to refund if needed.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    <div className="flex gap-3 mt-2">
                        <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={loading}>Cancel</Button>
                        {transitions.length > 0 && (
                            <Button
                                className="flex-1 rounded-xl"
                                onClick={handleSubmit}
                                disabled={!targetStatus || loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Confirm
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminAirtimePage() {
    const [activeTab, setActiveTab] = useState<'orders' | 'settings'>('orders')

    // Orders state
    const [orders, setOrders] = useState<Order[]>([])
    const [ordersLoading, setOrdersLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [networkFilter, setNetworkFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

    // Settings state
    const [settings, setSettings] = useState<AirtimeSettings>({
        airtime_fee_mtn_customer: '5', airtime_fee_mtn_agent: '3',
        airtime_fee_telecel_customer: '5', airtime_fee_telecel_agent: '3',
        airtime_fee_at_customer: '5', airtime_fee_at_agent: '3',
        airtime_min_amount: '1', airtime_max_amount: '500',
        airtime_enabled_mtn: 'true', airtime_enabled_telecel: 'true', airtime_enabled_at: 'true',
    })
    const [settingsLoading, setSettingsLoading] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)

    const loadOrders = useCallback(async () => {
        setOrdersLoading(true)
        try {
            const params = new URLSearchParams({ status: statusFilter, network: networkFilter, ...(search && { search }) })
            const res = await fetch(`/api/admin/airtime/orders?${params}`)
            if (res.ok) { const d = await res.json(); setOrders(d.orders || []) }
        } catch (e) { console.error(e) }
        setOrdersLoading(false)
    }, [statusFilter, networkFilter, search])

    const loadSettings = useCallback(async () => {
        setSettingsLoading(true)
        try {
            const res = await fetch('/api/admin/airtime/settings')
            if (res.ok) { const d = await res.json(); setSettings(d.settings) }
        } catch (e) { console.error(e) }
        setSettingsLoading(false)
    }, [])

    useEffect(() => { loadOrders() }, [loadOrders])
    useEffect(() => { if (activeTab === 'settings') loadSettings() }, [activeTab, loadSettings])

    const saveSettings = async () => {
        setSavingSettings(true)
        try {
            const res = await fetch('/api/admin/airtime/settings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings)
            })
            if (res.ok) toast.success('Settings saved successfully!')
            else { const d = await res.json(); toast.error(d.error || 'Failed to save') }
        } catch { toast.error('An error occurred') }
        setSavingSettings(false)
    }

    // Live preview calculation
    const previewCustomer = (network: Network) => {
        const key = `airtime_fee_${network.toLowerCase()}_customer` as keyof AirtimeSettings
        const fee = parseFloat(settings[key] || '5')
        return (10 * (1 + fee / 100)).toFixed(2)
    }
    const previewAgent = (network: Network) => {
        const key = `airtime_fee_${network.toLowerCase()}_agent` as keyof AirtimeSettings
        const fee = parseFloat(settings[key] || '3')
        return (10 * (1 + fee / 100)).toFixed(2)
    }

    const statusTabs = ['all', 'pending', 'processing', 'completed', 'failed']

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Phone className="w-6 h-6 text-emerald-500" /> Airtime Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage airtime orders and configure fee settings</p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 w-fit">
                {(['orders', 'settings'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            'px-6 py-2 rounded-lg text-sm font-semibold capitalize flex items-center gap-2 transition-all',
                            activeTab === tab ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        {tab === 'orders' ? <Phone className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                        {tab === 'orders' ? 'Orders' : 'Fee Configuration'}
                    </button>
                ))}
            </div>

            {/* ── ORDERS TAB ─────────────────────────────────────────── */}
            {activeTab === 'orders' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <Input
                            placeholder="Search by reference or phone..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-64 rounded-xl h-9"
                        />
                        <select
                            value={networkFilter}
                            onChange={e => setNetworkFilter(e.target.value)}
                            title="Filter by network"
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-3 h-9 focus:outline-none"
                        >
                            <option value="all">All Networks</option>
                            {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <Button variant="outline" size="sm" onClick={loadOrders} disabled={ordersLoading} className="rounded-xl">
                            <RefreshCw className={cn('w-4 h-4 mr-1', ordersLoading && 'animate-spin')} /> Refresh
                        </Button>
                    </div>

                    {/* Status filter tabs */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
                        {statusTabs.map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all',
                                    statusFilter === s ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                )}
                            >{s}</button>
                        ))}
                    </div>

                    {/* Orders table */}
                    {ordersLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <Phone className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">No airtime orders found</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Beneficiary</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Net</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Airtime</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fee</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paid</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((order, idx) => (
                                            <tr key={order.id} className={cn('border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors', idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/10')}>
                                                <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{order.reference_code}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-900 dark:text-white text-xs">{order.users?.first_name} {order.users?.last_name}</div>
                                                    <div className="text-xs text-slate-400 capitalize">{order.user_role}</div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{order.beneficiary_phone}</td>
                                                <td className="px-4 py-3">
                                                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-bold border', NETWORK_COLORS[order.network])}>{order.network}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600">GHS {order.airtime_amount.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">GHS {order.fee_amount.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">GHS {order.total_paid.toFixed(2)}</td>
                                                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                                                <td className="px-4 py-3 text-xs text-slate-400">
                                                    {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {STATUS_TRANSITIONS[order.status]?.length > 0 ? (
                                                        <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs px-3" onClick={() => setSelectedOrder(order)}>
                                                            Update
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── SETTINGS TAB ───────────────────────────────────────────── */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    {settingsLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                    ) : (
                        <>
                            {/* Per-network fee configuration */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                    <h2 className="font-bold text-slate-900 dark:text-white">Fee Configuration per Network</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Set separate fees for customers and agents per network.</p>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {NETWORKS.map(net => {
                                        const custKey = `airtime_fee_${net.toLowerCase()}_customer` as keyof AirtimeSettings
                                        const agentKey = `airtime_fee_${net.toLowerCase()}_agent` as keyof AirtimeSettings
                                        const enabledKey = `airtime_enabled_${net.toLowerCase()}` as keyof AirtimeSettings
                                        const isEnabled = settings[enabledKey] !== 'false'

                                        return (
                                            <div key={net} className="px-6 py-5">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn('px-2.5 py-1 rounded-lg text-sm font-bold border', NETWORK_COLORS[net])}>{net}</span>
                                                        <span className={cn('text-sm font-medium', isEnabled ? 'text-emerald-600' : 'text-slate-400')}>
                                                            {isEnabled ? 'Enabled' : 'Disabled'}
                                                        </span>
                                                    </div>
                                                    <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={v => setSettings(s => ({ ...s, [enabledKey]: v ? 'true' : 'false' }))}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Customer Fee %</Label>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                value={settings[custKey]}
                                                                onChange={e => setSettings(s => ({ ...s, [custKey]: e.target.value }))}
                                                                className="rounded-xl pr-8"
                                                                min="0" max="100" step="0.1"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Agent Fee %</Label>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                value={settings[agentKey]}
                                                                onChange={e => setSettings(s => ({ ...s, [agentKey]: e.target.value }))}
                                                                className="rounded-xl pr-8"
                                                                min="0" max="100" step="0.1"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Live preview */}
                                                <div className="mt-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-xs text-slate-500 flex gap-4">
                                                    <span>📱 Customer buying GHS 10 on {net} pays <strong className="text-slate-700 dark:text-slate-300">GHS {previewCustomer(net)}</strong></span>
                                                    <span>·</span>
                                                    <span>Agent pays <strong className="text-emerald-600">GHS {previewAgent(net)}</strong></span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Min / Max */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-4">Order Limits</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Minimum Amount (GHS)</Label>
                                        <Input type="number" value={settings.airtime_min_amount} onChange={e => setSettings(s => ({ ...s, airtime_min_amount: e.target.value }))} className="rounded-xl" min="0.5" step="0.5" />
                                    </div>
                                    <div>
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Maximum Amount (GHS)</Label>
                                        <Input type="number" value={settings.airtime_max_amount} onChange={e => setSettings(s => ({ ...s, airtime_max_amount: e.target.value }))} className="rounded-xl" min="1" step="1" />
                                    </div>
                                </div>
                            </div>

                            <Button onClick={saveSettings} disabled={savingSettings} className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base">
                                {savingSettings ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Saving...</> : <><Save className="w-5 h-5 mr-2" />Save All Settings</>}
                            </Button>
                        </>
                    )}
                </div>
            )}

            {/* Action Modal */}
            <ActionModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onSuccess={loadOrders} />
        </div>
    )
}
