'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Scale, History } from 'lucide-react'
import { StatCards } from './components/StatCards'
import { UserSelector } from './components/UserSelector'
import { TopUpForm } from './components/TopUpForm'
import { SettlementsTab } from './components/SettlementsTab'
import { CreditsHistoryTab } from './components/CreditsHistoryTab'
import { cn } from '@/lib/utils'
import { useSearchParams, useRouter } from 'next/navigation'

const ROLE_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'agent', label: 'Agent' },
    { value: 'customer', label: 'Customer' },
    { value: 'subadmin', label: 'Sub-Admin' },
    { value: 'admin', label: 'Admin' },
]

interface PageStats {
    totalWalletBalance: number
    totalUsers: number
    totalAgents: number
    totalCustomers: number
    totalSubAdmins: number
    totalAdminTopUpsToday: number
    totalCreditedToday: number
    totalOwed: number
    pendingDebtUsersCount: number
}

interface SelectedUser {
    id: string
    first_name: string
    last_name: string
    phone_number: string
    role: string
    wallet_balance: number
    pending_debt_total: number
    last_admin_topup_at: string | null
    last_admin_topup_amount: number | null
}

type TabType = 'topup' | 'settlements' | 'history'

export default function AdminTopUpPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const tabParam = searchParams.get('tab')
    const initialTab: TabType =
        tabParam === 'settlements' ? 'settlements' :
        tabParam === 'history' ? 'history' : 'topup'

    const [activeTab, setActiveTab] = useState<TabType>(initialTab)
    const [roleFilter, setRoleFilter] = useState('agent')
    const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null)
    const [stats, setStats] = useState<PageStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [settlementCount, setSettlementCount] = useState(0)

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/top-up/page-stats')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
                setSettlementCount(data.pendingDebtUsersCount || 0)
            }
        } catch { /* silent */ } finally { setStatsLoading(false) }
    }, [])

    useEffect(() => { fetchStats() }, [fetchStats])

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        const param = tab !== 'topup' ? `?tab=${tab}` : ''
        router.replace(`/admin/top-up${param}`, { scroll: false })
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
                    💳 Manual Credit Centre
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Credit user wallets instantly · Track every debt · Settle with one click
                </p>
            </div>

            {/* Stat Cards */}
            {statsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
                </div>
            ) : stats ? (
                <StatCards stats={stats} />
            ) : null}

            {/* Tab Switcher — centered, large */}
            <div className="flex justify-center">
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-2xl p-1.5 w-full sm:w-auto">
                    <button
                        onClick={() => handleTabChange('topup')}
                        className={cn(
                            'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all flex-1 sm:flex-auto justify-center',
                            activeTab === 'topup'
                                ? 'bg-white dark:bg-slate-800 shadow-md text-yellow-600 dark:text-yellow-400'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <CreditCard className="w-4 h-4" />
                        Top Up
                    </button>
                    <button
                        onClick={() => handleTabChange('settlements')}
                        className={cn(
                            'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all relative flex-1 sm:flex-auto justify-center',
                            activeTab === 'settlements'
                                ? 'bg-white dark:bg-slate-800 shadow-md text-red-600 dark:text-red-400'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Scale className="w-4 h-4" />
                        Settlements
                        {settlementCount > 0 && (
                            <span className="ml-1 bg-red-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-pulse">
                                {settlementCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange('history')}
                        className={cn(
                            'flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all flex-1 sm:flex-auto justify-center',
                            activeTab === 'history'
                                ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-blue-400'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <History className="w-4 h-4" />
                        Credits History
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'topup' && (
                <div className="space-y-4">
                    {/* Role Filter Buttons */}
                    <div className="flex flex-wrap gap-2">
                        {ROLE_FILTERS.map(f => (
                            <button
                                key={f.value}
                                onClick={() => { setRoleFilter(f.value); setSelectedUser(null) }}
                                className={cn(
                                    'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                                    roleFilter === f.value
                                        ? 'bg-yellow-500 text-white border-yellow-500 shadow'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-yellow-400 text-muted-foreground'
                                )}
                            >
                                {f.label}
                                {f.value === 'agent' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalAgents})</span>
                                )}
                                {f.value === 'customer' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalCustomers})</span>
                                )}
                                {f.value === 'subadmin' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalSubAdmins})</span>
                                )}
                                {f.value === 'all' && stats && (
                                    <span className="ml-1 opacity-60">({stats.totalUsers})</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* User Selector */}
                    <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
                        <CardContent className="p-4 sm:p-6">
                            <UserSelector
                                roleFilter={roleFilter}
                                onUserSelect={setSelectedUser}
                                selectedUser={selectedUser}
                                onClear={() => setSelectedUser(null)}
                            />
                        </CardContent>
                    </Card>

                    {/* Top-Up Form */}
                    <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
                        <CardContent className="p-4 sm:p-6">
                            <TopUpForm
                                selectedUser={selectedUser}
                                onSuccess={() => {
                                    setSelectedUser(null)
                                    fetchStats()
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'settlements' && (
                <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
                    <CardContent className="p-4 sm:p-6">
                        <SettlementsTab onDebtChange={fetchStats} />
                    </CardContent>
                </Card>
            )}

            {activeTab === 'history' && (
                <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
                    <CardContent className="p-4 sm:p-6">
                        <CreditsHistoryTab />
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
