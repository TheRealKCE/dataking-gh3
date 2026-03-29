'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Wallet, Users, Crown, User, TrendingUp, Banknote, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

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

export function StatCards({ stats }: { stats: PageStats }) {
    const cards = [
        {
            label: 'Total Wallet Balance',
            value: formatCurrency(stats.totalWalletBalance),
            icon: Wallet,
            color: 'bg-yellow-500',
            textColor: 'text-yellow-100',
        },
        {
            label: 'Total Users',
            value: String(stats.totalUsers),
            icon: Users,
            color: 'bg-blue-500',
            textColor: 'text-blue-100',
        },
        {
            label: 'Agents',
            value: String(stats.totalAgents),
            icon: Crown,
            color: 'bg-amber-500',
            textColor: 'text-amber-100',
        },
        {
            label: 'Customers',
            value: String(stats.totalCustomers),
            icon: User,
            color: 'bg-teal-500',
            textColor: 'text-teal-100',
        },
        {
            label: "Top-Ups Today",
            value: String(stats.totalAdminTopUpsToday),
            icon: TrendingUp,
            color: 'bg-green-500',
            textColor: 'text-green-100',
        },
        {
            label: 'Credited Today',
            value: formatCurrency(stats.totalCreditedToday),
            icon: Banknote,
            color: 'bg-emerald-500',
            textColor: 'text-emerald-100',
        },
        {
            label: 'Total Owed',
            value: formatCurrency(stats.totalOwed),
            icon: AlertTriangle,
            color: stats.totalOwed > 0 ? 'bg-red-500' : 'bg-slate-400',
            textColor: 'text-red-100',
            pulse: stats.totalOwed > 0,
            href: '/admin/top-up?tab=settlements',
        },
        {
            label: 'Debtors',
            value: `${stats.pendingDebtUsersCount} users`,
            icon: Users,
            color: stats.pendingDebtUsersCount > 0 ? 'bg-rose-500' : 'bg-slate-400',
            textColor: 'text-rose-100',
            href: '/admin/top-up?tab=settlements',
        },
    ]

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cards.map((card) => {
                const content = (
                    <Card className={`${card.color} border-0 text-white ${card.pulse ? 'animate-pulse' : ''} ${card.href ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${card.textColor} truncate`}>
                                        {card.label}
                                    </p>
                                    <p className="text-lg sm:text-xl font-black text-white truncate">{card.value}</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-white/20 flex-shrink-0 flex items-center justify-center">
                                    <card.icon className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
                return card.href ? (
                    <Link key={card.label} href={card.href}>{content}</Link>
                ) : (
                    <div key={card.label}>{content}</div>
                )
            })}
        </div>
    )
}
