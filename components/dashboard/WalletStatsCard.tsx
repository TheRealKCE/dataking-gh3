'use client'

import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Wallet, TrendingUp, TrendingDown } from "lucide-react"

interface WalletStatsCardProps {
    balance: number
    totalCredited: number
    totalSpent: number
}

export function WalletStatsCard({ balance, totalCredited, totalSpent }: WalletStatsCardProps) {
    return (
        <Card className="overflow-hidden bg-[#111111] border border-[#1f1f1f] dark:bg-[#111111] dark:border-[#1f1f1f] bg-white border-slate-200 rounded-2xl shadow-sm hover:border-indigo-500/30 transition-colors mb-6">
            <div className="bg-[#111111] dark:bg-[#111111] p-6 text-white">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-indigo-400" />
                        <span className="font-semibold uppercase tracking-widest text-xs text-indigo-400">Lifetime Wallet Stats</span>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                    <div className="min-w-0">
                        <p className="text-sm text-gray-400 mb-1">Active Balance</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-black break-all leading-tight">{formatCurrency(balance)}</p>
                    </div>

                    <div className="flex flex-row gap-4 sm:gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-gray-800">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                                <TrendingUp className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                <span>Total Credited</span>
                            </div>
                            <p className="font-bold text-base sm:text-xl text-green-400 break-all">{formatCurrency(totalCredited)}</p>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                                <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span>Total Spent</span>
                            </div>
                            <p className="font-bold text-base sm:text-xl text-red-400 break-all">{formatCurrency(totalSpent)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}
