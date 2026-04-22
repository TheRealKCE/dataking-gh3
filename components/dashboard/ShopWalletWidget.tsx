'use client'

import { Wallet, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface ShopWalletWidgetProps {
    wallet: { balance: number; total_earned: number; total_withdrawn: number } | null
}

export function ShopWalletWidget({ wallet }: ShopWalletWidgetProps) {
    const balance = wallet?.balance || 0
    const totalEarned = wallet?.total_earned || 0
    const pendingWithdrawal = 0 // Future implementation could fetch actual pending withdrawals

    return (
        <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-gray-900 to-gray-800 text-white relative group">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />
            <CardContent className="p-5 sm:p-6 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                
                {/* Left side: Balance Info */}
                <div className="space-y-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/20 backdrop-blur-md rounded-lg shadow-inner">
                            <Wallet className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="text-white font-black text-sm tracking-widest uppercase drop-shadow-sm">Shop Profit Balance</h3>
                    </div>
                    
                    <div>
                        <p className="text-4xl sm:text-5xl font-black tracking-tighter text-white mb-2 drop-shadow-lg">
                            {formatCurrency(balance)}
                        </p>
                        <div className="flex items-center gap-4 text-[10px] text-gray-300 font-black uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Available to Withdraw
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Action & Mini Stats */}
                <div className="w-full sm:w-auto flex flex-col items-end gap-5 border-t border-white/10 sm:border-t-0 sm:border-l pl-0 sm:pl-8 pt-6 sm:pt-0">
                    <Link href="/dashboard/shop/withdraw" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-xs h-12 px-8 rounded-2xl">
                            Withdraw Earnings
                            <ArrowUpRight className="w-5 h-5 ml-2 stroke-[3]" />
                        </Button>
                    </Link>
                    
                    <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
                        <div className="text-right">
                            <p className="text-gray-400 mb-1">Total Lifetime Earned</p>
                            <p className="text-white text-sm drop-shadow-sm">{formatCurrency(totalEarned)}</p>
                        </div>
                        <Link href="/dashboard/shop/withdrawals" className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2 group/link bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            History <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>

            </CardContent>
        </Card>
    )
}
