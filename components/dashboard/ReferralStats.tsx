'use client'

import { Users, Wallet, Receipt } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface ReferralStatsProps {
    referredCount: number
    totalEarned: number
    bonusCount: number
}

export function ReferralStats({ referredCount, totalEarned, bonusCount }: ReferralStatsProps) {
    const tiles = [
        { label: 'People Referred', value: String(referredCount), icon: Users },
        { label: 'Total Earned', value: formatCurrency(totalEarned), icon: Wallet },
        { label: 'Bonuses Paid', value: String(bonusCount), icon: Receipt },
    ]

    return (
        <div className="grid grid-cols-3 gap-3">
            {tiles.map((tile) => (
                <Card key={tile.label}>
                    <CardContent className="p-3 sm:p-4">
                        <tile.icon className="w-4 h-4 text-muted-foreground mb-2" />
                        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                            {tile.value}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">
                            {tile.label}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
