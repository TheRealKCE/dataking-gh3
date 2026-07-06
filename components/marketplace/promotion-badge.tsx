import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'

interface PromotionBadgeProps {
    tier?: number
    tierName?: string
    compact?: boolean
}

const tierStyles = {
    1: { label: 'Bumped', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900' },
    2: { label: 'Boosted', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900' },
    3: { label: 'Featured', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900' },
    4: { label: 'Spotlight', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900' },
}

export function PromotionBadge({ tier, tierName, compact = false }: PromotionBadgeProps) {
    if (!tier && !tierName) return null

    const style = tier ? tierStyles[tier as keyof typeof tierStyles] : tierStyles[1]

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${style.className}`}>
                <Zap className="w-3 h-3" />
            </div>
        )
    }

    return (
        <Badge className={style.className}>
            <Zap className="w-3 h-3 mr-1" />
            {tierName || style.label}
        </Badge>
    )
}
