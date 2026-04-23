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
    const pendingWithdrawal = 0

    return (
        <Card className="overflow-hidden border border-border/70 shadow-sm bg-card text-card-foreground relative group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.10),transparent_40%)]" />
            <CardContent className="p-5 sm:p-6 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/15 rounded-md border border-emerald-500/30">
                            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-muted-foreground font-medium text-sm">Shop Profit Balance</h3>
                    </div>

                    <div>
                        <p className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-1">
                            {formatCurrency(balance)}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Available
                            </span>
                            {pendingWithdrawal > 0 && (
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    {formatCurrency(pendingWithdrawal)} pending
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-full sm:w-auto flex flex-col items-end gap-4 border-t border-border/60 sm:border-t-0 sm:border-l pl-0 sm:pl-6 pt-4 sm:pt-0">
                    <Link href="/dashboard/shop/withdraw" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-500/20 transition-all font-semibold rounded-xl h-11 px-6">
                            Withdraw Earnings
                            <ArrowUpRight className="w-4 h-4 ml-2 opacity-70 group-hover:opacity-100 transition-opacity" />
                        </Button>
                    </Link>

                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                        <div className="text-right">
                            <p className="mb-0.5">Total Earned</p>
                            <p className="text-foreground font-semibold">{formatCurrency(totalEarned)}</p>
                        </div>
                        <Link href="/dashboard/shop/withdrawals" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group/link">
                            History <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

